const elements = {
  lastUpdate: document.getElementById("lastUpdate"),
  monitorPid: document.getElementById("monitorPid"),
  cpuValue: document.getElementById("cpuValue"),
  memoryValue: document.getElementById("memoryValue"),
  appMemoryValue: document.getElementById("appMemoryValue"),
  appMemoryDetails: document.getElementById("appMemoryDetails"),
  uptimeValue: document.getElementById("uptimeValue"),
  requestCountValue: document.getElementById("requestCountValue"),
  probeCountValue: document.getElementById("probeCountValue"),
  streamClientCountValue: document.getElementById("streamClientCountValue"),
  serviceRows: document.getElementById("serviceRows"),
  logList: document.getElementById("logList"),
  systemInfo: document.getElementById("systemInfo"),
  cpuChart: document.getElementById("cpuChart"),
  memoryChart: document.getElementById("memoryChart"),
  latencyChart: document.getElementById("latencyChart"),
  backendRequestTotal: document.getElementById("backendRequestTotal"),
  backendRequestRpm: document.getElementById("backendRequestRpm"),
  backendErrorTotal: document.getElementById("backendErrorTotal"),
  backendStreamStatus: document.getElementById("backendStreamStatus"),
  backendRequestHint: document.getElementById("backendRequestHint"),
  backendRequestRows: document.getElementById("backendRequestRows"),
  queueStatRows: document.getElementById("queueStatRows"),
  queueEventList: document.getElementById("queueEventList"),
  backendAppLogList: document.getElementById("backendAppLogList"),
  liveEventLevelFilter: document.getElementById("liveEventLevelFilter"),
  liveEventSearchFilter: document.getElementById("liveEventSearchFilter"),
  backendRequestMethodFilter: document.getElementById("backendRequestMethodFilter"),
  backendRequestStatusFilter: document.getElementById("backendRequestStatusFilter"),
  backendRequestSearchFilter: document.getElementById("backendRequestSearchFilter"),
  queueEventTypeFilter: document.getElementById("queueEventTypeFilter"),
  queueEventSearchFilter: document.getElementById("queueEventSearchFilter"),
  backendAppLogLevelFilter: document.getElementById("backendAppLogLevelFilter"),
  backendAppLogSearchFilter: document.getElementById("backendAppLogSearchFilter"),
};

const latestData = {
  monitorLogs: [],
  backendTelemetry: null,
};

function escapeHtml(input) {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatTime(timestamp) {
  if (!timestamp) {
    return "-";
  }
  return new Date(timestamp).toLocaleTimeString("tr-TR", {
    hour12: false,
  });
}

function statusClass(status) {
  if (status === "up") {
    return "bg-emerald-400";
  }
  if (status === "down") {
    return "bg-rose-400";
  }
  return "bg-amber-300";
}

function statusTextClass(statusCode) {
  if (statusCode >= 500) {
    return "text-rose-300";
  }
  if (statusCode >= 400) {
    return "text-amber-300";
  }
  return "text-emerald-300";
}

function methodClass(method) {
  const value = (method || "").toUpperCase();
  if (value === "GET") return "text-cyan-300";
  if (value === "POST") return "text-emerald-300";
  if (value === "PUT" || value === "PATCH") return "text-amber-300";
  if (value === "DELETE") return "text-rose-300";
  return "text-slate-300";
}

function queueEventClass(eventType) {
  if (eventType === "failed" || eventType === "enqueue_failed") {
    return "text-rose-300";
  }
  if (eventType === "active") {
    return "text-amber-300";
  }
  if (eventType === "completed") {
    return "text-emerald-300";
  }
  return "text-cyan-300";
}

function toSearchText(value) {
  return String(value ?? "").toLowerCase();
}

function matchesSearch(searchValue, fields) {
  if (!searchValue) {
    return true;
  }
  return fields.some((field) => toSearchText(field).includes(searchValue));
}

function matchesStatusFilter(statusCode, filterValue) {
  if (filterValue === "all") {
    return true;
  }

  if (filterValue === "2xx") {
    return statusCode >= 200 && statusCode < 300;
  }
  if (filterValue === "4xx") {
    return statusCode >= 400 && statusCode < 500;
  }
  if (filterValue === "5xx") {
    return statusCode >= 500 && statusCode < 600;
  }
  return true;
}

function buildBackendAppLogCopyText(entry) {
  const timeText = formatTime(entry.timestamp);
  return `[${timeText}] ${String(entry.level || "").toUpperCase()} [${entry.scope || "-"}] ${entry.message || ""}`;
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const temp = document.createElement("textarea");
  temp.value = text;
  temp.setAttribute("readonly", "true");
  temp.style.position = "absolute";
  temp.style.left = "-9999px";
  document.body.appendChild(temp);
  temp.select();
  document.execCommand("copy");
  document.body.removeChild(temp);
}

function createSingleLinePath(values, min, max) {
  if (!values.length) {
    return "";
  }

  let path = "";
  let drawing = false;

  values.forEach((value, index) => {
    if (value === null || Number.isNaN(value)) {
      drawing = false;
      return;
    }

    const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100;
    const y = max === min ? 14 : 28 - ((value - min) / (max - min)) * 28;
    const command = drawing ? "L" : "M";
    path += `${command}${x.toFixed(2)},${y.toFixed(2)} `;
    drawing = true;
  });

  return path.trim();
}

function renderSingleChart(svg, values, color, min = 0, max = 100) {
  const path = createSingleLinePath(values, min, max);
  svg.innerHTML = `
    <line x1="0" y1="14" x2="100" y2="14" stroke="rgba(148,163,184,0.25)" stroke-width="0.25" />
    <line x1="0" y1="7" x2="100" y2="7" stroke="rgba(148,163,184,0.15)" stroke-width="0.2" />
    <line x1="0" y1="21" x2="100" y2="21" stroke="rgba(148,163,184,0.15)" stroke-width="0.2" />
    <path d="${path}" fill="none" stroke="${color}" stroke-width="1.2" stroke-linecap="round" />
  `;
}

function renderLatencyChart(svg, backendValues, frontendValues) {
  const all = [...backendValues, ...frontendValues].filter((value) => value !== null);
  const max = all.length ? Math.max(...all, 50) : 50;

  const backendPath = createSingleLinePath(backendValues, 0, max);
  const frontendPath = createSingleLinePath(frontendValues, 0, max);

  svg.innerHTML = `
    <line x1="0" y1="14" x2="100" y2="14" stroke="rgba(148,163,184,0.25)" stroke-width="0.25" />
    <line x1="0" y1="7" x2="100" y2="7" stroke="rgba(148,163,184,0.15)" stroke-width="0.2" />
    <line x1="0" y1="21" x2="100" y2="21" stroke="rgba(148,163,184,0.15)" stroke-width="0.2" />
    <path d="${backendPath}" fill="none" stroke="#22d3ee" stroke-width="1.1" stroke-linecap="round" />
    <path d="${frontendPath}" fill="none" stroke="#34d399" stroke-width="1.1" stroke-linecap="round" />
  `;
}

function renderServices(services) {
  elements.serviceRows.innerHTML = services
    .map((service) => {
      const latency = service.lastLatencyMs == null ? "-" : `${service.lastLatencyMs} ms`;
      const errorText = service.lastError || "-";
      const processRam = service.processRssMb ? `${service.processRssMb} MB` : "-";
      return `
        <tr class="border-t border-slate-800/70">
          <td class="py-2 pr-3">
            <div class="font-medium text-slate-100">${escapeHtml(service.name)}</div>
            <div class="text-xs text-slate-400">${escapeHtml(service.url)}</div>
            <div class="text-xs text-slate-500">TCP probe: ${escapeHtml(service.probeTarget)}</div>
          </td>
          <td class="py-2 pr-3">
            <span class="inline-flex items-center gap-2 rounded-full border border-slate-700 px-2 py-1 text-xs">
              <span class="h-2 w-2 rounded-full ${statusClass(service.status)}"></span>
              ${escapeHtml(String(service.status).toUpperCase())}
            </span>
          </td>
          <td class="py-2 pr-3 text-slate-300">${escapeHtml(latency)}</td>
          <td class="py-2 pr-3 text-slate-300">${escapeHtml(processRam)}</td>
          <td class="py-2 pr-3 text-slate-300">%${escapeHtml(service.uptimeRatio)}</td>
          <td class="py-2 text-xs text-slate-400">${escapeHtml(errorText)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderMonitorLogs(logs) {
  const levelFilter = elements.liveEventLevelFilter?.value || "all";
  const searchFilter = toSearchText(elements.liveEventSearchFilter?.value || "");
  const filteredLogs = logs.filter((log) => {
    const levelMatch = levelFilter === "all" || log.level === levelFilter;
    const searchMatch = matchesSearch(searchFilter, [log.level, log.message]);
    return levelMatch && searchMatch;
  });

  if (!filteredLogs.length) {
    elements.logList.innerHTML =
      '<li class="rounded border border-slate-800 bg-slate-950/60 p-2 text-slate-500">Filtreye uygun event yok.</li>';
    return;
  }

  elements.logList.innerHTML = filteredLogs
    .slice()
    .reverse()
    .map((log) => {
      const levelClass = log.level === "error" ? "text-rose-300" : "text-cyan-300";
      return `
        <li class="rounded border border-slate-800 bg-slate-950/60 p-2">
          <div class="mb-1 flex items-center justify-between gap-2">
            <span class="text-[11px] text-slate-500">${formatTime(log.t)}</span>
            <span class="text-[11px] font-medium uppercase ${levelClass}">${escapeHtml(log.level)}</span>
          </div>
          <p class="text-slate-300">${escapeHtml(log.message)}</p>
        </li>
      `;
    })
    .join("");
}

function setBackendStreamStatus(status, className) {
  elements.backendStreamStatus.textContent = status;
  elements.backendStreamStatus.className = `mt-2 text-2xl font-semibold ${className}`;
}

function renderBackendRequests(httpSnapshot) {
  const recent = Array.isArray(httpSnapshot?.recent) ? httpSnapshot.recent : [];
  const methodFilter = (elements.backendRequestMethodFilter?.value || "all").toUpperCase();
  const statusFilter = elements.backendRequestStatusFilter?.value || "all";
  const searchFilter = toSearchText(elements.backendRequestSearchFilter?.value || "");

  const filteredRequests = recent.filter((entry) => {
    const method = String(entry.method || "").toUpperCase();
    const statusCode = Number(entry.statusCode ?? 0);
    const methodMatch = methodFilter === "ALL" || method === methodFilter;
    const statusMatch = matchesStatusFilter(statusCode, statusFilter);
    const searchMatch = matchesSearch(searchFilter, [
      entry.path,
      entry.userId,
      entry.ip,
      entry.requestId,
      method,
      statusCode,
    ]);
    return methodMatch && statusMatch && searchMatch;
  });

  if (!filteredRequests.length) {
    elements.backendRequestRows.innerHTML =
      '<tr><td colspan="8" class="py-3 text-slate-500">Filtreye uygun backend request kaydı yok.</td></tr>';
    return;
  }

  const rows = filteredRequests
    .slice()
    .reverse()
    .slice(0, 140)
    .map((entry) => {
      const statusCode = Number(entry.statusCode ?? 0);
      const contentLength =
        entry.contentLength === null || entry.contentLength === undefined
          ? "-"
          : `${entry.contentLength}b`;
      return `
        <tr class="border-t border-slate-800/70">
          <td class="py-2 pr-3 text-slate-400">${formatTime(entry.timestamp)}</td>
          <td class="py-2 pr-3 font-medium ${methodClass(entry.method)}">${escapeHtml(entry.method)}</td>
          <td class="py-2 pr-3 text-slate-200">${escapeHtml(entry.path)}</td>
          <td class="py-2 pr-3 font-medium ${statusTextClass(statusCode)}">${escapeHtml(statusCode)}</td>
          <td class="py-2 pr-3 text-slate-300">${escapeHtml(entry.durationMs)} ms <span class="text-slate-500">${escapeHtml(contentLength)}</span></td>
          <td class="py-2 pr-3 text-slate-300">${escapeHtml(entry.userId || "-")}</td>
          <td class="py-2 pr-3 text-slate-300">${escapeHtml(entry.ip || "-")}</td>
          <td class="py-2 text-slate-500">${escapeHtml(entry.requestId || "-")}</td>
        </tr>
      `;
    })
    .join("");

  elements.backendRequestRows.innerHTML = rows;
}

function renderQueueStats(queueSnapshot) {
  const stats = Array.isArray(queueSnapshot?.stats) ? queueSnapshot.stats : [];
  if (!stats.length) {
    elements.queueStatRows.innerHTML =
      '<tr><td colspan="5" class="py-2 text-slate-500">Queue verisi yok.</td></tr>';
    return;
  }

  elements.queueStatRows.innerHTML = stats
    .map((stat) => `
      <tr class="border-t border-slate-800/70">
        <td class="py-2 pr-2 text-slate-200">${escapeHtml(stat.queueName)}</td>
        <td class="py-2 pr-2 text-cyan-300">${escapeHtml(stat.queued)}</td>
        <td class="py-2 pr-2 text-amber-300">${escapeHtml(stat.active)}</td>
        <td class="py-2 pr-2 text-emerald-300">${escapeHtml(stat.completed)}</td>
        <td class="py-2 text-rose-300">${escapeHtml(stat.failed + stat.enqueueFailed)}</td>
      </tr>
    `)
    .join("");
}

function renderQueueEvents(queueSnapshot) {
  const recent = Array.isArray(queueSnapshot?.recent) ? queueSnapshot.recent : [];
  const eventFilter = elements.queueEventTypeFilter?.value || "all";
  const searchFilter = toSearchText(elements.queueEventSearchFilter?.value || "");

  const filteredEvents = recent.filter((event) => {
    const eventMatch = eventFilter === "all" || event.event === eventFilter;
    const searchMatch = matchesSearch(searchFilter, [
      event.event,
      event.queueName,
      event.jobName,
      event.jobId,
      event.error,
      event.dataPreview,
    ]);
    return eventMatch && searchMatch;
  });

  if (!filteredEvents.length) {
    elements.queueEventList.innerHTML =
      '<li class="rounded border border-slate-800 bg-slate-950/60 p-2 text-slate-500">Filtreye uygun queue event yok.</li>';
    return;
  }

  elements.queueEventList.innerHTML = filteredEvents
    .slice()
    .reverse()
    .slice(0, 120)
    .map((event) => `
      <li class="rounded border border-slate-800 bg-slate-950/60 p-2">
        <div class="mb-1 flex items-center justify-between gap-2">
          <span class="text-[11px] text-slate-500">${formatTime(event.timestamp)}</span>
          <span class="text-[11px] font-medium uppercase ${queueEventClass(event.event)}">${escapeHtml(event.event)}</span>
        </div>
        <p class="text-slate-200">${escapeHtml(event.queueName)} · ${escapeHtml(event.jobName || "-")} · #${escapeHtml(event.jobId || "-")}</p>
        <p class="text-slate-400">${escapeHtml(event.error || event.dataPreview || "")}</p>
      </li>
    `)
    .join("");
}

function renderBackendAppLogs(appLogsSnapshot) {
  const recent = Array.isArray(appLogsSnapshot?.recent) ? appLogsSnapshot.recent : [];
  const levelFilter = elements.backendAppLogLevelFilter?.value || "all";
  const searchFilter = toSearchText(elements.backendAppLogSearchFilter?.value || "");

  const filteredLogs = recent.filter((entry) => {
    const levelMatch = levelFilter === "all" || entry.level === levelFilter;
    const searchMatch = matchesSearch(searchFilter, [entry.scope, entry.message, entry.level]);
    return levelMatch && searchMatch;
  });

  if (!filteredLogs.length) {
    elements.backendAppLogList.innerHTML =
      '<li class="rounded border border-slate-800 bg-slate-950/60 p-2 text-slate-500">Filtreye uygun backend app log yok.</li>';
    return;
  }

  elements.backendAppLogList.innerHTML = filteredLogs
    .slice()
    .reverse()
    .slice(0, 200)
    .map((entry) => {
      const copyText = buildBackendAppLogCopyText(entry);
      const copyPayload = encodeURIComponent(copyText);
      const levelClass =
        entry.level === "error"
          ? "text-rose-300"
          : entry.level === "warn"
            ? "text-amber-300"
            : entry.level === "debug"
              ? "text-slate-300"
              : "text-cyan-300";
      return `
        <li class="rounded border border-slate-800 bg-slate-950/60 p-2">
          <div class="mb-1 flex items-center justify-between gap-2">
            <span class="text-[11px] text-slate-500">${formatTime(entry.timestamp)}</span>
            <div class="flex items-center gap-2">
              <span class="text-[11px] font-medium uppercase ${levelClass}">${escapeHtml(entry.level)}</span>
              <button type="button" data-copy-log="${escapeHtml(copyPayload)}" class="rounded border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300 transition hover:border-cyan-400 hover:text-cyan-300">Kopyala</button>
            </div>
          </div>
          <p class="text-slate-300">[${escapeHtml(entry.scope)}] ${escapeHtml(entry.message)}</p>
        </li>
      `;
    })
    .join("");
}

function renderBackendTelemetry(snapshot) {
  const httpTotals = snapshot?.http?.totals || {};
  const queueTotals = snapshot?.queue?.totals || {};
  const errors = Number(httpTotals.clientError || 0) + Number(httpTotals.serverError || 0);

  elements.backendRequestTotal.textContent = String(httpTotals.total || 0);
  elements.backendRequestRpm.textContent = String(snapshot?.http?.requestsPerMinute || 0);
  elements.backendErrorTotal.textContent = String(errors);
  elements.backendRequestHint.textContent = `Last backend update: ${formatTime(snapshot?.generatedAt)}`;

  renderBackendRequests(snapshot?.http);
  renderQueueStats(snapshot?.queue);
  renderQueueEvents(snapshot?.queue);
  renderBackendAppLogs(snapshot?.appLogs);

  const activeTotal = Number(queueTotals.active || 0);
  const failedTotal = Number(queueTotals.failed || 0) + Number(queueTotals.enqueueFailed || 0);
  const summary = `Queue active: ${activeTotal} · queue fail: ${failedTotal} · queue events/min: ${snapshot?.queue?.eventsPerMinute || 0}`;
  elements.backendRequestHint.textContent = `${elements.backendRequestHint.textContent} · ${summary}`;
}

function rerenderFilteredPanels() {
  renderMonitorLogs(latestData.monitorLogs);
  renderBackendRequests(latestData.backendTelemetry?.http);
  renderQueueEvents(latestData.backendTelemetry?.queue);
  renderBackendAppLogs(latestData.backendTelemetry?.appLogs);
}

function bindFilterEvents() {
  const controls = [
    elements.liveEventLevelFilter,
    elements.liveEventSearchFilter,
    elements.backendRequestMethodFilter,
    elements.backendRequestStatusFilter,
    elements.backendRequestSearchFilter,
    elements.queueEventTypeFilter,
    elements.queueEventSearchFilter,
    elements.backendAppLogLevelFilter,
    elements.backendAppLogSearchFilter,
  ];

  for (const control of controls) {
    if (!control) {
      continue;
    }

    control.addEventListener("input", rerenderFilteredPanels);
    control.addEventListener("change", rerenderFilteredPanels);
  }
}

function bindBackendAppLogCopyEvents() {
  if (!elements.backendAppLogList) {
    return;
  }

  elements.backendAppLogList.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest("button[data-copy-log]");
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const encoded = button.getAttribute("data-copy-log") || "";
    if (!encoded) {
      return;
    }

    const original = button.textContent || "Kopyala";

    try {
      const text = decodeURIComponent(encoded);
      await copyToClipboard(text);
      button.textContent = "Kopyalandı";
      button.classList.add("border-emerald-400", "text-emerald-300");
      setTimeout(() => {
        button.textContent = original;
        button.classList.remove("border-emerald-400", "text-emerald-300");
      }, 900);
    } catch {
      button.textContent = "Hata";
      button.classList.add("border-rose-400", "text-rose-300");
      setTimeout(() => {
        button.textContent = original;
        button.classList.remove("border-rose-400", "text-rose-300");
      }, 1200);
    }
  });
}

function renderLocalSnapshot(snapshot) {
  elements.lastUpdate.textContent = formatTime(snapshot.timestamp);
  elements.monitorPid.textContent = String(snapshot.monitor.pid);

  elements.cpuValue.textContent = `%${snapshot.system.cpuUsagePercent}`;
  elements.memoryValue.textContent = `%${snapshot.system.memoryUsedPercent}`;
  elements.appMemoryValue.textContent = `${snapshot.app.totalRssMb} MB`;
  elements.appMemoryDetails.textContent = snapshot.app.processes
    .map((process) => `${process.name}: ${process.rssMb} MB`)
    .join(" · ");

  elements.uptimeValue.textContent = formatDuration(snapshot.monitor.uptimeSec);
  elements.requestCountValue.textContent = String(snapshot.monitor.dashboardRequestCount);
  elements.probeCountValue.textContent = String(snapshot.monitor.probeCount);
  elements.streamClientCountValue.textContent = String(snapshot.monitor.sseClientCount);

  elements.systemInfo.textContent = `${snapshot.system.hostname} · ${snapshot.system.platform} · ${snapshot.system.cpuCoreCount} cores · app CPU ${snapshot.app.totalCpuPercent}%`;

  latestData.monitorLogs = Array.isArray(snapshot.logs) ? snapshot.logs : [];
  latestData.backendTelemetry = snapshot?.backendTelemetry || null;

  renderServices(snapshot.services);
  renderMonitorLogs(latestData.monitorLogs);

  const cpuValues = snapshot.history.cpu.map((item) => item.v);
  const memoryValues = snapshot.history.appMemory.map((item) => item.v);
  const backendLatency = snapshot.history.backendLatency.map((item) => item.v);
  const frontendLatency = snapshot.history.frontendLatency.map((item) => item.v);

  renderSingleChart(elements.cpuChart, cpuValues, "#22d3ee", 0, 100);
  const appMemoryMax = Math.max(100, ...memoryValues, snapshot.app.totalRssMb + 10);
  renderSingleChart(elements.memoryChart, memoryValues, "#a78bfa", 0, appMemoryMax);
  renderLatencyChart(elements.latencyChart, backendLatency, frontendLatency);

  renderBackendTelemetry(latestData.backendTelemetry);

  if (snapshot?.backendTelemetryError) {
    setBackendStreamStatus("DEGRADED", "text-amber-300");
    elements.backendRequestHint.textContent = `Backend telemetry issue: ${snapshot.backendTelemetryError}`;
    return;
  }

  if (snapshot?.backendTelemetry) {
    setBackendStreamStatus("CONNECTED", "text-emerald-300");
    return;
  }

  setBackendStreamStatus("WAITING", "text-slate-300");
  elements.backendRequestHint.textContent = "Backend telemetry waiting";
}

function connectLocalStream() {
  const stream = new EventSource("/api/stream");

  const handleSnapshot = (event) => {
    try {
      const snapshot = JSON.parse(event.data);
      renderLocalSnapshot(snapshot);
    } catch {
      elements.lastUpdate.textContent = "invalid local stream payload";
    }
  };

  // Support both unnamed SSE messages (`data: ...`) and named events (`event: snapshot`).
  stream.onmessage = handleSnapshot;
  stream.addEventListener("snapshot", handleSnapshot);

  stream.onerror = () => {
    elements.lastUpdate.textContent = "local stream reconnecting";
  };
}

setBackendStreamStatus("WAITING", "text-slate-300");
bindFilterEvents();
bindBackendAppLogCopyEvents();
connectLocalStream();
