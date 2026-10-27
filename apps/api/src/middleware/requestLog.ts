import type { RequestHandler } from 'express';

/**
 * Logs method, route, status and duration only.
 * Request bodies (which can contain a resume or job text) are never logged.
 */
export function requestLogger(): RequestHandler {
  return (req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - started;
      console.log(`[api] ${req.method} ${req.path} -> ${res.statusCode} (${ms}ms)`);
    });
    next();
  };
}
