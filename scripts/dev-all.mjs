import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const nodeCmd = process.execPath;

const services = [
  {
    name: "backend",
    cwd: path.join(rootDir, "backend"),
    cmd: npmCmd,
    args: ["run", "dev"],
  },
  {
    name: "frontend",
    cwd: path.join(rootDir, "frontend"),
    cmd: npmCmd,
    args: ["run", "dev"],
  },
  {
    name: "monitor",
    cwd: rootDir,
    cmd: nodeCmd,
    args: [path.join(rootDir, "monitor", "server.mjs")],
  },
];

let shuttingDown = false;
const children = [];

function stopAll(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGKILL");
        }
      }, 5000).unref();
    }
  }

  process.exitCode = exitCode;
}

for (const service of services) {
  const child = spawn(service.cmd, service.args, {
    cwd: service.cwd,
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (signal) {
      console.error(`[${service.name}] exited with signal ${signal}`);
      stopAll(1);
      return;
    }

    if (code && code !== 0) {
      console.error(`[${service.name}] exited with code ${code}`);
      stopAll(code);
      return;
    }

    stopAll(0);
  });

  child.on("error", (error) => {
    console.error(`[${service.name}] failed to start`, error);
    stopAll(1);
  });

  children.push(child);
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
