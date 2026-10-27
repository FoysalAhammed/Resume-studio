import type { ApiHealth } from '@careerlens/core';
import { LIMITS, MATCH_CONFIG } from '@careerlens/core';

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigins: string[];
  maxUploadBytes: number;
  ai: {
    apiKey: string;
    baseUrl: string;
    model: string;
    timeoutMs: number;
    maxOutputChars: number;
  };
}

const apiKey = (process.env.AI_API_KEY ?? '').trim();

export const config: AppConfig = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: num(process.env.PORT, 3001),
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:4173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  maxUploadBytes: num(process.env.MAX_UPLOAD_MB, LIMITS.maxUploadBytes / (1024 * 1024)) * 1024 * 1024,
  ai: {
    apiKey,
    baseUrl: (process.env.AI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/+$/, ''),
    model: (process.env.AI_MODEL ?? 'gpt-4o-mini').trim(),
    timeoutMs: num(process.env.AI_TIMEOUT_MS, 30000),
    maxOutputChars: num(process.env.AI_MAX_OUTPUT_CHARS, 20000),
  },
};

export function aiConfigured(): boolean {
  return config.ai.apiKey.length > 0;
}

export function healthPayload(): ApiHealth {
  return {
    status: 'ok',
    mode: aiConfigured() ? 'ai' : 'local',
    ai: {
      configured: aiConfigured(),
      // The key itself is never returned, only the endpoint and model in use.
      model: aiConfigured() ? config.ai.model : null,
      baseUrl: aiConfigured() ? config.ai.baseUrl : null,
    },
    version: process.env.npm_package_version ?? '1.0.0',
    matchEngineVersion: MATCH_CONFIG.version,
    limits: { maxUploadMb: Math.round(config.maxUploadBytes / (1024 * 1024)) },
  };
}
