import { createLogger } from '../utils/logger';
import { GoogleGenAI } from '@google/genai';

type AIProvider = 'gemini' | 'ollama' | 'openrouter';

const logger = createLogger('AIProvider');

interface GenerateOptions {
  expectJson?: boolean;
}

function externalAIDataAllowed(): boolean {
  const value = process.env.AI_ALLOW_EXTERNAL_DATA?.trim().toLowerCase();
  return value === 'true' || value === '1';
}

function redactSensitiveData(value: string): string {
  return value
    .replace(/(authorization\s*[:=]\s*(?:bearer\s+)?|bearer\s+)[^\s,}\]]+/gi, '$1[REDACTED]')
    .replace(/(["']?(?:password|passwd|secret|token|api[_-]?key|client[_-]?secret)["']?\s*[:=]\s*["']?)[^,"'}\s]+/gi, '$1[REDACTED]');
}

function hasOllamaModel(installed: Set<string>, requested: string): boolean {
  return installed.has(requested) || (!requested.includes(':') && installed.has(`${requested}:latest`));
}

function getPreferredProviders(): AIProvider[] {
  const configured = process.env.AI_PROVIDER?.trim().toLowerCase();
  
  let providers: AIProvider[];
  if (!configured) {
    providers = ['ollama'];
  } else {
    // Support comma-separated providers like "gemini,ollama"
    providers = configured
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s === 'gemini' || s === 'ollama' || s === 'openrouter') as AIProvider[];
  }

  if (providers.length === 0) {
    providers = ['ollama'];
  }

  if (!externalAIDataAllowed()) {
    const localOnlyProviders = providers.filter((provider) => provider === 'ollama');
    if (providers.some((provider) => provider !== 'ollama')) {
      logger.warn('External AI providers are disabled because AI_ALLOW_EXTERNAL_DATA is not explicitly enabled.');
    }
    providers = localOnlyProviders.length > 0 ? localOnlyProviders : ['ollama'];
  }

  // Enhanced configuration status logging
  const geminiStatus = process.env.GEMINI_API_KEY ? 'CONFIGURED' : 'MISSING_API_KEY';
  const openRouterStatus = process.env.OPENROUTER_API_KEY ? 'CONFIGURED' : 'MISSING_API_KEY';
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
  
  logger.info(`AI provider chain initialized: ${providers.join(' -> ')}`);
  if (providers.includes('gemini')) {
    logger.info(`Gemini status: ${geminiStatus} (Model: ${process.env.GEMINI_MODEL || 'gemini-2.5-flash'})`);
  }
  if (providers.includes('openrouter')) {
    logger.info(`OpenRouter status: ${openRouterStatus} (Model: ${process.env.OPENROUTER_MODEL || 'meta-llama/llama-3-8b-instruct'})`);
  }
  if (providers.includes('ollama')) {
    logger.info(`Ollama status: READY (Endpoint: ${ollamaUrl}, Model: ${process.env.OLLAMA_MODEL || 'qwen3:8b'})`);
  }

  return providers;
}

type AIReadinessResult = {
  healthy: boolean;
  providers: Array<{ provider: AIProvider; healthy: boolean }>;
};

let readinessCache: { expiresAt: number; result: AIReadinessResult } | undefined;
const generationProbeCompleted = new Set<AIProvider>();

function generationProbeEnabled(): boolean {
  const raw = process.env.AI_READINESS_GENERATION_PROBE?.trim().toLowerCase();
  if (raw !== undefined && raw !== '') return raw === 'true' || raw === '1';
  return process.env.NODE_ENV === 'production';
}

async function checkGeminiGenerationReadiness(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('missing API key');

  const ai = new GoogleGenAI({ apiKey });
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error('generation probe timed out')), 10_000);
  });

  try {
    const result = await Promise.race([
      ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        contents: 'Reply with OK only.',
        config: { maxOutputTokens: 1 },
      }),
      timeoutPromise,
    ]);
    if (!result?.text?.trim()) throw new Error('empty generation response');
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function checkOpenRouterGenerationReadiness(): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('missing API key');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3-8b-instruct',
        messages: [{ role: 'user', content: 'Reply with OK only.' }],
        max_tokens: 1,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    if (!payload.choices?.length) throw new Error('empty generation response');
  } finally {
    clearTimeout(timeout);
  }
}

async function checkOllamaGenerationReadiness(): Promise<void> {
  const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || 'qwen3:8b',
        prompt: 'Reply with OK only.',
        stream: false,
        think: false,
        options: { num_predict: 1 },
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as { response?: string };
    if (!payload.response?.trim()) throw new Error('empty generation response');
  } finally {
    clearTimeout(timeout);
  }
}

async function checkGenerationReadiness(provider: AIProvider): Promise<void> {
  if (!generationProbeEnabled() || generationProbeCompleted.has(provider)) return;

  if (provider === 'gemini') await checkGeminiGenerationReadiness();
  else if (provider === 'openrouter') await checkOpenRouterGenerationReadiness();
  else await checkOllamaGenerationReadiness();

  generationProbeCompleted.add(provider);
}

async function checkOllamaReadiness(): Promise<void> {
  const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_000);
  try {
    const response = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as { models?: Array<{ name?: string }> };
    const installed = new Set(
      (payload.models || [])
        .map((model) => model.name)
        .filter((name): name is string => Boolean(name)),
    );
    const required = [
      process.env.OLLAMA_MODEL || 'qwen3:8b',
      process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
    ];
    const missing = required.filter((model) => !hasOllamaModel(installed, model));
    if (missing.length > 0) throw new Error(`missing model(s): ${missing.join(', ')}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function checkGeminiReadiness(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('missing API key');
  const ai = new GoogleGenAI({ apiKey });
  await ai.models.get({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' });
}

async function checkOpenRouterReadiness(): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('missing API key');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_000);
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as { data?: Array<{ id?: string }> };
    const model = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3-8b-instruct';
    const available = (payload.data || []).map((entry) => entry.id).filter(Boolean);
    if (available.length > 0 && !available.includes(model)) throw new Error('configured model is unavailable');
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkAIReadiness(): Promise<AIReadinessResult> {
  if (readinessCache && readinessCache.expiresAt > Date.now()) return readinessCache.result;

  const providers = getPreferredProviders();
  const checks: AIReadinessResult['providers'] = [];
  for (const provider of providers) {
    try {
      if (provider === 'gemini') await checkGeminiReadiness();
      else if (provider === 'openrouter') await checkOpenRouterReadiness();
      else await checkOllamaReadiness();
      await checkGenerationReadiness(provider);
      checks.push({ provider, healthy: true });
    } catch (error) {
      logger.warn(`AI readiness check failed for ${provider}: ${error instanceof Error ? error.message : String(error)}`);
      checks.push({ provider, healthy: false });
    }
  }

  const result = { healthy: checks.some((check) => check.healthy), providers: checks };
  readinessCache = { expiresAt: Date.now() + 30_000, result };
  return result;
}

function shouldLogProviderUsage(): boolean {
  const raw = process.env.AI_PROVIDER_LOGGING?.trim().toLowerCase();
  return raw !== 'false' && raw !== '0';
}

function cleanTextResponse(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```markdown\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function extractJsonPayload(text: string): string {
  const trimmed = cleanTextResponse(text);
  if (!trimmed) {
    throw new Error('AI returned an empty JSON payload.');
  }

  const firstBrace = trimmed.indexOf('{');
  const firstBracket = trimmed.indexOf('[');
  const starts = [firstBrace, firstBracket].filter((index) => index >= 0);

  if (starts.length === 0) {
    return trimmed;
  }

  const start = Math.min(...starts);
  const sliced = trimmed.slice(start);
  const lastBrace = sliced.lastIndexOf('}');
  const lastBracket = sliced.lastIndexOf(']');
  const end = Math.max(lastBrace, lastBracket);

  if (end >= 0) {
    return sliced.slice(0, end + 1);
  }

  return sliced;
}

function parseRetryDelayMs(error: any, attempt: number): number {
  let waitTime = (attempt + 1) * 5000;
  const details = error?.details || error?.error?.details || error?.response?.data?.error?.details || [];
  const retryInfo = details.find((detail: any) => detail['@type']?.includes('RetryInfo'));

  if (retryInfo?.retryDelay) {
    const seconds = parseInt(String(retryInfo.retryDelay).replace('s', ''), 10);
    if (!Number.isNaN(seconds)) {
      waitTime = (seconds + 1) * 1000;
    }
  }

  return waitTime;
}

async function generateWithGemini(prompt: string, options: GenerateOptions): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini is unavailable because GEMINI_API_KEY is not configured.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await ai.models.generateContent({
        model: model,
        contents: redactSensitiveData(prompt),
        config: options.expectJson ? { responseMimeType: 'application/json' } : undefined,
      });

      const text = cleanTextResponse(result?.text || '');
      if (!text) {
        throw new Error('Gemini returned an empty response.');
      }

      return text;
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      const quotaExhausted = /quota exceeded|resource_exhausted|daily.*limit|per day/i.test(message);
      if (error?.status === 429 && !quotaExhausted && attempt < maxRetries - 1) {
        const waitTime = parseRetryDelayMs(error, attempt);
        logger.warn(`Gemini quota exceeded. Retrying in ${waitTime / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      throw error;
    }
  }

  throw new Error('Gemini request failed after retries.');
}

async function generateWithOllama(prompt: string, options: GenerateOptions): Promise<string> {
  const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const model = process.env.OLLAMA_MODEL || 'qwen3:8b';
  let response: Response;

  const controller = new AbortController();
  const timeoutMs = 300000; // 5 minutes
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        think: false,
        keep_alive: process.env.OLLAMA_KEEP_ALIVE || '30m',
        format: options.expectJson ? 'json' : undefined,
        options: {
          num_ctx: Number(process.env.OLLAMA_CONTEXT_LENGTH || 8192),
        },
      }),
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Ollama request timed out after ${timeoutMs / 1000}s. High complexity tasks may need more time or GPU acceleration.`);
    }
    const reason = error?.cause?.code || error?.cause?.message || error?.message || 'unknown error';
    throw new Error(`Ollama is unreachable at ${baseUrl}. ${reason}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Ollama request failed with status ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const text = cleanTextResponse(data?.response || '');
  if (!text) {
    throw new Error('Ollama returned an empty response.');
  }

  return text;
}

async function generateWithOpenRouter(prompt: string, options: GenerateOptions): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OpenRouter is unavailable because OPENROUTER_API_KEY is not configured.');
  }

  const model = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3-8b-instruct';
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: redactSensitiveData(prompt) }],
          response_format: options.expectJson ? { type: "json_object" } : undefined
        })
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        if (response.status === 429 && attempt < maxRetries - 1) {
          logger.warn(`OpenRouter quota/rate limit exceeded. Retrying...`);
          await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 2000));
          continue;
        }
        const providerError = new Error(`OpenRouter request failed with status ${response.status}: ${errorBody}`) as Error & { status?: number };
        providerError.status = response.status;
        throw providerError;
      }

      const data = await response.json();
      const rawText = data?.choices?.[0]?.message?.content || '';
      const text = cleanTextResponse(rawText);
      
      if (!text) {
        throw new Error('OpenRouter returned an empty response.');
      }

      return text;
    } catch (error: any) {
      // Invalid credentials, model errors and other client failures are not
      // transient. Retrying them only delays the request and can amplify an
      // outage under load. Network errors and 429/5xx responses may retry.
      const status = Number(error?.status);
      if (Number.isInteger(status) && status >= 400 && status < 500 && status !== 429) {
        throw error;
      }
      if (attempt >= maxRetries - 1) {
        throw error;
      }
      logger.warn(`OpenRouter error on attempt ${attempt + 1}: ${error.message}. Retrying...`);
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 2000));
    }
  }

  throw new Error('OpenRouter request failed after retries.');
}

export async function generateAIText(prompt: string, options: GenerateOptions = {}): Promise<string> {
  const providers = getPreferredProviders();
  const errors: string[] = [];

  for (const provider of providers) {
    try {
      let result: string;

      if (provider === 'gemini') {
        result = await generateWithGemini(prompt, options);
      } else if (provider === 'openrouter') {
        result = await generateWithOpenRouter(prompt, options);
      } else {
        result = await generateWithOllama(prompt, options);
      }

      if (shouldLogProviderUsage()) {
        logger.info(`Generated response with provider=${provider}`);
      }

      return result;
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${provider}: ${message}`);
      logger.warn(`AI provider ${provider} failed: ${message}`);
      
      // Explicitly log fallback if there are more providers left
      const nextProviderIndex = providers.indexOf(provider) + 1;
      if (nextProviderIndex < providers.length) {
        const nextProvider = providers[nextProviderIndex];
        logger.info(`FALLBACK: Switching from ${provider} to ${nextProvider}...`);
      }
    }
  }

  throw new Error(`All AI providers failed. ${errors.join(' | ')}`);
}

export async function generateAIJson<T>(prompt: string): Promise<T> {
  const text = await generateAIText(prompt, { expectJson: true });
  return JSON.parse(extractJsonPayload(text)) as T;
}

async function generateEmbeddingWithGemini(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key not configured.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const configuredModel = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
  const fallbackModel = 'gemini-embedding-001';
  
  const config: any = {};
  if (process.env.GEMINI_EMBEDDING_DIMENSION) {
    config.outputDimensionality = parseInt(process.env.GEMINI_EMBEDDING_DIMENSION, 10);
  }

  for (const model of [...new Set([configuredModel, fallbackModel])]) {
    try {
      const result = await ai.models.embedContent({
        model,
        contents: [redactSensitiveData(text)],
        config,
      });

      const values = result?.embeddings?.[0]?.values;
      if (!Array.isArray(values) || values.length === 0) {
        throw new Error('Gemini embedding response did not contain vector values.');
      }

      return values;
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      const notFound = error?.status === 404 || /not found|not_supported|not supported/i.test(message);
      if (model !== fallbackModel && notFound) {
        logger.warn(`Configured Gemini embedding model is unavailable; retrying with ${fallbackModel}.`);
        continue;
      }
      logger.error('Gemini embedding error:', error);
      throw error;
    }
  }

  throw new Error('Gemini embedding failed after model fallback.');
}

async function generateEmbeddingWithOllama(text: string): Promise<number[]> {
  const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const model = process.env.EMBEDDING_MODEL || process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
  const payload = JSON.stringify({
    model,
    input: text,
    prompt: text,
  });

  const endpoints = ['/api/embed', '/api/embeddings'];
  const errors: string[] = [];

  for (const endpoint of endpoints) {
    let response: Response;

    try {
      response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
    } catch (error: any) {
      const reason = error?.cause?.code || error?.cause?.message || error?.message || 'unknown error';
      throw new Error(`Ollama is unreachable at ${baseUrl}. ${reason}`);
    }

    if (!response.ok) {
      errors.push(`${endpoint}: ${response.status}`);
      continue;
    }

    const data = await response.json();
    const embedding = Array.isArray(data?.embeddings)
      ? data.embeddings[0]
      : data?.embedding;

    if (!Array.isArray(embedding) || embedding.length === 0) {
      errors.push(`${endpoint}: empty embedding payload`);
      continue;
    }

    return embedding;
  }

  throw new Error(`Ollama embedding failed. ${errors.join(' | ')}`);
}

export async function generateAIEmbedding(text: string): Promise<number[]> {
  const providers = getPreferredProviders();
  const errors: string[] = [];

  for (const provider of providers) {
    try {
      let embedding: number[] | undefined;

      if (provider === 'gemini') {
        embedding = await generateEmbeddingWithGemini(text);
      }

      if (provider === 'ollama') {
        embedding = await generateEmbeddingWithOllama(text);
      }

      if (!embedding || embedding.length === 0) {
        throw new Error('Embedding provider returned an empty vector.');
      }

      if (shouldLogProviderUsage()) {
        logger.info(`Generated embedding with provider=${provider} dimensions=${embedding.length}`);
      }

      return embedding;
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${provider}: ${message}`);
      logger.warn(`AI embedding provider ${provider} failed: ${message}`);

      // Explicitly log fallback
      const nextProviderIndex = providers.indexOf(provider) + 1;
      if (nextProviderIndex < providers.length) {
        const nextProvider = providers[nextProviderIndex];
        logger.info(`FALLBACK: Switching embedding provider from ${provider} to ${nextProvider}...`);
      }
    }
  }

  throw new Error(`All embedding providers failed. ${errors.join(' | ')}`);
}
