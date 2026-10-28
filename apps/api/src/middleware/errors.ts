import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

/** An error that is safe to show to a client. */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, message: string, code = 'bad_request') {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'AppError';
  }
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: `No route matches ${req.method} ${req.path}` } });
};

// Clients never receive stack traces, file paths or provider details: just a code and a safe message.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'validation_failed',
        message: 'The request body did not match the expected structure.',
        issues: err.issues.slice(0, 12).map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      },
    });
    return;
  }

  const status = typeof (err as { status?: number })?.status === 'number' ? (err as { status: number }).status : 500;
  const type = (err as { type?: string })?.type;

  if (type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'payload_too_large', message: 'The uploaded payload is larger than the configured limit.' } });
    return;
  }
  if (type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'invalid_json', message: 'The request body was not valid JSON.' } });
    return;
  }

  // Deliberately logged without the request body, which may contain a resume.
  console.error(`[api] unhandled error on ${res.req?.method ?? '?'} ${res.req?.path ?? '?'}: ${(err as Error)?.name ?? 'Error'}`);
  res.status(status >= 400 && status < 600 ? status : 500).json({
    error: { code: 'internal_error', message: 'Something went wrong while processing the request. Please try again.' },
  });
};
