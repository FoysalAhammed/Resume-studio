import { createApp } from './app';
import { config, aiConfigured, healthPayload } from './env';

const app = createApp();

const server = app.listen(config.port, () => {
  const health = healthPayload();
  console.log(`[api] CareerLens AI API listening on http://localhost:${config.port}`);
  console.log(`[api] mode: ${health.mode}${aiConfigured() ? ` (model: ${health.ai.model})` : ' - deterministic local logic, no AI provider configured'}`);
  console.log(`[api] upload limit: ${health.limits.maxUploadMb} MB; CORS origins: ${config.corsOrigins.join(', ')}`);
});

function shutdown(signal: string) {
  console.log(`[api] ${signal} received, closing server.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
