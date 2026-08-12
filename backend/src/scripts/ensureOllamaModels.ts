import 'dotenv/config';
import { createLogger } from '../utils/logger';

const logger = createLogger('OllamaBootstrap');

function configuredProviders(): string[] {
  return (process.env.AI_PROVIDER || 'ollama')
    .split(',')
    .map((provider) => provider.trim().toLowerCase())
    .filter(Boolean);
}

function withTimeout(ms: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { controller, clear: () => clearTimeout(timeout) };
}

function hasModel(installed: Set<string>, requested: string): boolean {
  return installed.has(requested) || (!requested.includes(':') && installed.has(`${requested}:latest`));
}

async function waitForOllama(baseUrl: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastReason = 'service is not ready';

  while (Date.now() < deadline) {
    const requestTimeout = withTimeout(5_000);
    try {
      const response = await fetch(`${baseUrl}/api/tags`, { signal: requestTimeout.controller.signal });
      if (response.ok) return;
      lastReason = `HTTP ${response.status}`;
    } catch (error) {
      lastReason = error instanceof Error ? error.message : String(error);
    } finally {
      requestTimeout.clear();
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  throw new Error(`Ollama did not become ready within ${timeoutMs}ms: ${lastReason}`);
}

async function ensureModel(baseUrl: string, model: string, timeoutMs: number): Promise<void> {
  const listTimeout = withTimeout(15_000);
  try {
    const listResponse = await fetch(`${baseUrl}/api/tags`, { signal: listTimeout.controller.signal });
    if (!listResponse.ok) {
      throw new Error(`model list returned HTTP ${listResponse.status}`);
    }

    const payload = await listResponse.json() as { models?: Array<{ name?: string }> };
    const installed = new Set(
      (payload.models || [])
        .map((item) => item.name)
        .filter((name): name is string => Boolean(name)),
    );
    if (hasModel(installed, model)) {
      logger.info(`Ollama model is available: ${model}`);
      return;
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot inspect Ollama model ${model}: ${reason}`);
  } finally {
    listTimeout.clear();
  }

  logger.info(`Pulling missing Ollama model: ${model}`);
  const pullTimeout = withTimeout(timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, stream: false }),
      signal: pullTimeout.controller.signal,
    });
    const body = await response.text().catch(() => '');
    if (!response.ok) {
      throw new Error(`model pull returned HTTP ${response.status}: ${body.slice(0, 500)}`);
    }
    logger.info(`Ollama model is ready: ${model}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot pull Ollama model ${model}: ${reason}`);
  } finally {
    pullTimeout.clear();
  }
}

async function main(): Promise<void> {
  if (!configuredProviders().includes('ollama')) {
    logger.info('Ollama is not in the configured AI provider chain; bootstrap skipped.');
    return;
  }

  const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const models = [...new Set([
    process.env.OLLAMA_MODEL || 'qwen3:8b',
    process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
  ])];
  const timeoutMs = Number(process.env.OLLAMA_MODEL_PULL_TIMEOUT_MS || 900_000);
  const startupTimeoutMs = Number(process.env.OLLAMA_STARTUP_TIMEOUT_MS || 120_000);

  await waitForOllama(baseUrl, startupTimeoutMs);

  for (const model of models) {
    await ensureModel(baseUrl, model, timeoutMs);
  }
}

main().catch((error) => {
  logger.error('Ollama bootstrap failed', error);
  process.exitCode = 1;
});
