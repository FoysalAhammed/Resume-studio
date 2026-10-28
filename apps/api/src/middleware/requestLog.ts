import type { RequestHandler } from 'express';

// Logs method, route, status and duration. Never the body, which may hold a resume.
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
