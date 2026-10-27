import type { Request, RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { AppError } from './errors';

/** Validates and replaces req.body. Throws a 400 AppError on failure. */
export function validateBody<T extends ZodTypeAny>(schema: T): RequestHandler {
  return (req: Request, _res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
        .join('; ');
      next(new AppError(400, `Request validation failed - ${detail}`, 'validation_failed'));
      return;
    }
    req.body = parsed.data;
    next();
  };
}

/** Reads a header value safely, trimming and bounding its length. */
export function safeHeader(req: Request, name: string, maxLength = 200): string {
  const raw = req.headers[name.toLowerCase()];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? '').toString().trim().slice(0, maxLength);
}

export function clientKey(req: Request): string {
  return (req.ip || req.socket.remoteAddress || 'unknown').toString();
}
