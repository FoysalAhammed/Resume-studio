import express from 'express';
import cors, { type CorsOptions } from 'cors';
import { config } from './env';
import { errorHandler, notFoundHandler } from './middleware/errors';
import { rateLimit } from './middleware/rateLimit';
import { requestLogger } from './middleware/requestLog';
import { healthRouter } from './routes/health';
import { resumesRouter } from './routes/resumes';
import { jobsRouter } from './routes/jobs';
import { matchesRouter } from './routes/matches';
import { studioRouter } from './routes/studio';
import { coverLetterRouter } from './routes/coverLetter';
import { interviewsRouter } from './routes/interviews';
import { extensionRouter } from './routes/extension';

/**
 * Browser origins allowed to call the API. Chrome extension origins are accepted
 * so the extension preview can talk to the same endpoints a real extension would.
 */
const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) return callback(null, true);
    if (origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://')) return callback(null, true);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-File-Name', 'X-Use-Ai'],
  exposedHeaders: ['X-RateLimit-Remaining', 'Retry-After'],
  maxAge: 600,
};

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // No proxy is trusted by default: req.ip stays the direct peer address.
  app.set('trust proxy', false);

  app.use(cors(corsOptions));
  app.use(requestLogger());
  app.use(express.json({ limit: '2mb' }));
  app.use(rateLimit({ name: 'global', windowMs: 60_000, max: 300 }));

  app.use('/api', healthRouter);
  app.use('/api/resumes', resumesRouter);
  app.use('/api/jobs', jobsRouter);
  app.use('/api/matches', matchesRouter);
  app.use('/api/resume-studio', studioRouter);
  app.use('/api/cover-letter', coverLetterRouter);
  app.use('/api/interviews', interviewsRouter);
  app.use('/api/extension', extensionRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
