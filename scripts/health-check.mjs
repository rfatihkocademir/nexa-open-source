const baseUrl = (process.env.NEXA_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const timeoutMs = Number(process.env.NEXA_HEALTH_TIMEOUT_MS || 10_000);

const checks = [
  {
    name: "Frontend",
    path: "/health",
    validate: (response, body) => response.ok && body.trim() === "ok",
  },
  {
    name: "Backend liveness",
    path: "/health/live",
    validate: (response, body) => response.ok && JSON.parse(body)?.status === "UP",
  },
  {
    name: "Backend readiness",
    path: "/health/ready",
    validate: (response, body) => response.ok && JSON.parse(body)?.ready === true,
  },
];

let failed = 0;
for (const check of checks) {
  const startedAt = performance.now();
  try {
    const response = await fetch(`${baseUrl}${check.path}`, {
      headers: { accept: "application/json, text/plain" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await response.text();
    const durationMs = Math.round(performance.now() - startedAt);
    const healthy = check.validate(response, body);
    console.log(`${healthy ? "✓" : "✗"} ${check.name}: HTTP ${response.status}, ${durationMs} ms`);
    if (!healthy) failed += 1;
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    console.log(`✗ ${check.name}: ${message}`);
  }
}

if (failed > 0) {
  console.error(`Health check failed: ${failed} check(s) unhealthy.`);
  process.exitCode = 1;
} else {
  console.log("Nexa is healthy.");
}
