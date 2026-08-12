import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { io } from "socket.io-client";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const execFileAsync = promisify(execFile);

const PORT = Number(process.env.MONITOR_PORT || 4010);
const CHECK_INTERVAL_MS = 3000;
const PROBE_TIMEOUT_MS = 2500;
const BACKEND_TELEMETRY_TIMEOUT_MS = 2200;
const HISTORY_LIMIT = 120;
const LOG_LIMIT = 200;

function parseProbeTarget(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const port = parsed.port
      ? Number(parsed.port)
      : parsed.protocol === "https:"
        ? 443
        : 80;

    return {
      host: parsed.hostname,
      port,
      label: `${parsed.hostname}:${port}`,
    };
  } catch {
    return null;
  }
}

const services = [
  {
    id: "backend",
    name: "Backend API",
    url: process.env.MONITOR_BACKEND_URL || "http://127.0.0.1:1996/health",
  },
  {
    id: "frontend",
    name: "Frontend App",
    url: process.env.MONITOR_FRONTEND_URL || "http://127.0.0.1:5173/",
  },
].map((service) => {
  const probeTarget = parseProbeTarget(service.url);
  return {
    ...service,
    probeHost: probeTarget?.host ?? null,
    probePort: probeTarget?.port ?? null,
    probeTarget: probeTarget?.label ?? "invalid-target",
  };
});

function deriveBackendTelemetryUrl() {
  const raw = process.env.MONITOR_BACKEND_TELEMETRY_URL;
  if (raw) {
    return raw;
  }

  const backendService = services.find((service) => service.id === "backend");
  if (!backendService?.url) {
    return null;
  }

  try {
    const origin = new URL(backendService.url).origin;
    return `${origin}/api/v1/monitor/snapshot`;
  } catch {
    return null;
  }
}

const BACKEND_TELEMETRY_URL = deriveBackendTelemetryUrl();
const BACKEND_SOCKET_ORIGIN = BACKEND_TELEMETRY_URL ? new URL(BACKEND_TELEMETRY_URL).origin : null;


const state = {
  startedAt: Date.now(),
  dashboardRequestCount: 0,
  probeCount: 0,
  sseClientCount: 0,
  cpuUsagePercent: 0,
  memoryUsedPercent: 0,
  history: {
    cpu: [],
    memory: [],
    appMemory: [],
    backendLatency: [],
    frontendLatency: [],
  },
  logs: [],
  appProcesses: {
    sampledAt: null,
    totalRssMb: 0,
    totalCpuPercent: 0,
    backend: { name: "Backend", rssMb: 0, cpuPercent: 0 },
    frontend: { name: "Frontend", rssMb: 0, cpuPercent: 0 },
    monitor: { name: "Monitor", rssMb: 0, cpuPercent: 0 },
  },
  backendTelemetry: null,
  backendTelemetryError: null,
  backendTelemetryUpdatedAt: null,
  services: Object.fromEntries(
    services.map((service) => [
      service.id,
      {
        id: service.id,
        name: service.name,
        url: service.url,
        probeTarget: service.probeTarget,
        status: "unknown",
        checks: 0,
        successes: 0,
        failures: 0,
        uptimeRatio: 0,
        lastLatencyMs: null,
        lastCheckedAt: null,
        lastError: null,
        processRssMb: 0,
        processCpuPercent: 0,
      },
    ]),
  ),
};

const sseClients = new Set();

let previousCpuSample = sampleCpuTotals();

function sampleCpuTotals() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;

  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total +=
      cpu.times.user +
      cpu.times.nice +
      cpu.times.sys +
      cpu.times.irq +
      cpu.times.idle;
  }

  return { idle, total };
}

function calculateCpuUsagePercent() {
  const current = sampleCpuTotals();
  const idleDelta = current.idle - previousCpuSample.idle;
  const totalDelta = current.total - previousCpuSample.total;
  previousCpuSample = current;

  if (totalDelta <= 0) {
    return state.cpuUsagePercent;
  }

  const usage = 100 - (idleDelta / totalDelta) * 100;
  return Math.max(0, Math.min(100, usage));
}

function pushHistory(seriesName, value) {
  const list = state.history[seriesName];
  if (!list) {
    return;
  }

  list.push({ t: Date.now(), v: value });
  if (list.length > HISTORY_LIMIT) {
    list.shift();
  }
}

function pushLog(level, message) {
  state.logs.push({
    t: Date.now(),
    level,
    message,
  });

  if (state.logs.length > LOG_LIMIT) {
    state.logs.shift();
  }
}

function toOneDecimal(value) {
  return Number(value.toFixed(1));
}

function normalizeArgText(input) {
  return input.toLowerCase().replaceAll("\\", "/");
}

function buildEmptyAppProcessSnapshot() {
  return {
    sampledAt: Date.now(),
    totalRssMb: 0,
    totalCpuPercent: 0,
    backend: { name: "Backend", rssMb: 0, cpuPercent: 0 },
    frontend: { name: "Frontend", rssMb: 0, cpuPercent: 0 },
    monitor: { name: "Monitor", rssMb: 0, cpuPercent: 0 },
  };
}

function classifyProcess(commandLine, pid) {
  if (pid === process.pid) {
    return "monitor";
  }

  const text = normalizeArgText(commandLine);
  const root = normalizeArgText(PROJECT_ROOT);
  const inBackend = text.includes(`${root}/backend/`);
  const inFrontend = text.includes(`${root}/frontend/`);

  if (
    inBackend &&
    (text.includes("ts-node-dev") ||
      text.includes("src/server.ts") ||
      text.includes("dist/server.js") ||
      text.includes("ecosystem.config.js"))
  ) {
    return "backend";
  }

  if (inFrontend && text.includes("vite")) {
    return "frontend";
  }

  return null;
}

async function collectAppProcessMetrics() {
  const snapshot = buildEmptyAppProcessSnapshot();

  try {
    const { stdout } = await execFileAsync("ps", [
      "-eo",
      "pid=,rss=,pcpu=,args=",
    ]);
    const lines = stdout.split("\n").filter(Boolean);

    for (const line of lines) {
      const match = line.trim().match(/^(\d+)\s+(\d+)\s+([\d.]+)\s+(.+)$/);
      if (!match) {
        continue;
      }

      const pid = Number(match[1]);
      const rssKb = Number(match[2]);
      const cpuPercent = Number(match[3]);
      const commandLine = match[4];
      const key = classifyProcess(commandLine, pid);

      if (!key || !snapshot[key]) {
        continue;
      }

      snapshot[key].rssMb += rssKb / 1024;
      snapshot[key].cpuPercent += cpuPercent;
    }

    for (const key of ["backend", "frontend", "monitor"]) {
      snapshot[key].rssMb = toOneDecimal(snapshot[key].rssMb);
      snapshot[key].cpuPercent = toOneDecimal(snapshot[key].cpuPercent);
      snapshot.totalRssMb += snapshot[key].rssMb;
      snapshot.totalCpuPercent += snapshot[key].cpuPercent;
    }

    snapshot.totalRssMb = toOneDecimal(snapshot.totalRssMb);
    snapshot.totalCpuPercent = toOneDecimal(snapshot.totalCpuPercent);
  } catch (error) {
    pushLog(
      "error",
      `App process metrics failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return snapshot;
}

async function collectBackendTelemetry() {
  // Logic removed in favor of WebSocket updates. 
  // Initial state might be empty until first socket event.
  return;
}

function setupBackendSocket() {
  if (!BACKEND_SOCKET_ORIGIN) {
    pushLog("error", "Cannot setup backend socket: Missing origin");
    return;
  }

  pushLog("info", `Connecting to backend socket at ${BACKEND_SOCKET_ORIGIN}`);
  const socket = io(BACKEND_SOCKET_ORIGIN, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });

  socket.on("connect", () => {
    pushLog("info", "Backend socket connected");
    socket.emit("join_monitoring");
  });

  socket.on("telemetry_snapshot", (payload) => {
    state.backendTelemetry = payload;
    state.backendTelemetryError = null;
    state.backendTelemetryUpdatedAt = Date.now();
  });

  socket.on("disconnect", (reason) => {
    pushLog("warn", `Backend socket disconnected: ${reason}`);
    state.backendTelemetryError = `Disconnected from backend (${reason})`;
  });

  socket.on("connect_error", (error) => {
    state.backendTelemetryError = `Socket connection error: ${error.message}`;
  });

  return socket;
}


async function checkService(service) {
  if (!service.probeHost || !service.probePort) {
    return {
      up: false,
      latencyMs: null,
      error: "Invalid probe target",
    };
  }

  return await new Promise((resolve) => {
    const started = performance.now();
    const socket = net.createConnection({
      host: service.probeHost,
      port: service.probePort,
    });

    let settled = false;
    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      socket.destroy();
      resolve(result);
    };

    const timeout = setTimeout(() => {
      finish({
        up: false,
        latencyMs: null,
        error: "Probe timeout",
      });
    }, PROBE_TIMEOUT_MS);

    socket.once("connect", () => {
      const latencyMs = Math.round(performance.now() - started);
      finish({
        up: true,
        latencyMs,
        error: null,
      });
    });

    socket.once("error", (error) => {
      finish({
        up: false,
        latencyMs: null,
        error: error instanceof Error ? error.message : "Probe error",
      });
    });
  });
}

async function collectMetrics() {
  state.cpuUsagePercent = calculateCpuUsagePercent();
  state.memoryUsedPercent =
    ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;
  state.appProcesses = await collectAppProcessMetrics();

  await collectBackendTelemetry();

  pushHistory("cpu", Number(state.cpuUsagePercent.toFixed(1)));
  pushHistory("memory", Number(state.memoryUsedPercent.toFixed(1)));
  pushHistory("appMemory", state.appProcesses.totalRssMb);

  for (const service of services) {
    state.probeCount += 1;
    const result = await checkService(service);
    const metric = state.services[service.id];
    const previousStatus = metric.status;
    const nextStatus = result.up ? "up" : "down";

    metric.status = nextStatus;
    metric.checks += 1;
    metric.lastCheckedAt = Date.now();
    metric.lastLatencyMs = result.latencyMs;
    metric.lastError = result.error;
    metric.processRssMb =
      service.id === "backend"
        ? state.appProcesses.backend.rssMb
        : service.id === "frontend"
          ? state.appProcesses.frontend.rssMb
          : 0;
    metric.processCpuPercent =
      service.id === "backend"
        ? state.appProcesses.backend.cpuPercent
        : service.id === "frontend"
          ? state.appProcesses.frontend.cpuPercent
          : 0;

    if (result.up) {
      metric.successes += 1;
    } else {
      metric.failures += 1;
    }

    metric.uptimeRatio = metric.checks
      ? Number(((metric.successes / metric.checks) * 100).toFixed(1))
      : 0;

    if (previousStatus !== nextStatus) {
      if (nextStatus === "up") {
        pushLog("info", `${metric.name} is UP`);
      } else {
        pushLog(
          "error",
          `${metric.name} is DOWN (${result.error || "No response"})`,
        );
      }
    }

    if (service.id === "backend") {
      pushHistory("backendLatency", result.latencyMs);
    }
    if (service.id === "frontend") {
      pushHistory("frontendLatency", result.latencyMs);
    }
  }

  broadcastSnapshot();
}

function getSnapshot() {
  const uptimeSec = Math.floor((Date.now() - state.startedAt) / 1000);

  return {
    timestamp: new Date().toISOString(),
    monitor: {
      name: "Nexa Runtime Monitor",
      uptimeSec,
      pid: process.pid,
      nodeVersion: process.version,
      dashboardRequestCount: state.dashboardRequestCount,
      probeCount: state.probeCount,
      sseClientCount: state.sseClientCount,
      memoryRssMb: Number((process.memoryUsage().rss / 1024 / 1024).toFixed(1)),
    },
    app: {
      sampledAt: state.appProcesses.sampledAt,
      totalRssMb: state.appProcesses.totalRssMb,
      totalCpuPercent: state.appProcesses.totalCpuPercent,
      processes: [
        state.appProcesses.backend,
        state.appProcesses.frontend,
        state.appProcesses.monitor,
      ],
    },
    system: {
      hostname: os.hostname(),
      platform: `${os.platform()} ${os.arch()}`,
      cpuUsagePercent: Number(state.cpuUsagePercent.toFixed(1)),
      memoryUsedPercent: Number(state.memoryUsedPercent.toFixed(1)),
      totalMemoryGb: Number((os.totalmem() / 1024 / 1024 / 1024).toFixed(1)),
      loadAverage: os
        .loadavg()
        .map((value) => Number(value.toFixed(2))),
      cpuCoreCount: os.cpus().length,
    },
    services: Object.values(state.services),
    history: state.history,
    logs: state.logs.slice(-60),
    backendTelemetry: state.backendTelemetry,
    backendTelemetryError: state.backendTelemetryError,
    backendTelemetryUpdatedAt: state.backendTelemetryUpdatedAt
      ? new Date(state.backendTelemetryUpdatedAt).toISOString()
      : null,
  };
}

function broadcastSnapshot() {
  if (sseClients.size === 0) {
    return;
  }

  const payload = `data: ${JSON.stringify(getSnapshot())}\n\n`;

  for (const client of [...sseClients]) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }

  state.sseClientCount = sseClients.size;
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }
  if (filePath.endsWith(".js")) {
    return "application/javascript; charset=utf-8";
  }
  if (filePath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }
  return "application/octet-stream";
}

async function serveStaticFile(res, relativePath) {
  const filePath = path.join(__dirname, "public", relativePath);
  const body = await readFile(filePath);
  res.writeHead(200, {
    "content-type": contentType(filePath),
    "cache-control": "no-store",
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const reqUrl = req.url || "/";
  const reqPath = reqUrl.split("?")[0];
  const reqQuery = new URL(reqUrl, "http://127.0.0.1").searchParams;

  if (reqPath === "/api/metrics") {
    if (reqQuery.get("manual") === "1") {
      state.dashboardRequestCount += 1;
    }
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end(JSON.stringify(getSnapshot()));
    return;
  }

  if (reqPath === "/api/stream") {
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      connection: "keep-alive",
    });
    res.write(`data: ${JSON.stringify(getSnapshot())}\n\n`);

    sseClients.add(res);
    state.sseClientCount = sseClients.size;

    req.on("close", () => {
      sseClients.delete(res);
      state.sseClientCount = sseClients.size;
    });
    return;
  }

  try {
    if (reqPath === "/" || reqPath === "/index.html") {
      await serveStaticFile(res, "index.html");
      return;
    }

    if (reqPath === "/app.js") {
      await serveStaticFile(res, "app.js");
      return;
    }

    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  } catch (error) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(error instanceof Error ? error.message : "Internal Server Error");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  pushLog("info", `Monitor started on http://127.0.0.1:${PORT}`);
  console.log(`[monitor] running on http://127.0.0.1:${PORT}`);
});

collectMetrics().catch((error) => {
  pushLog("error", `Initial metrics error: ${String(error)}`);
});

setupBackendSocket();


setInterval(() => {
  collectMetrics().catch((error) => {
    pushLog("error", `Metrics refresh failed: ${String(error)}`);
  });
}, CHECK_INTERVAL_MS);

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
