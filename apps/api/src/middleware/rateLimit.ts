import type { RequestHandler } from 'express';
import { clientKey } from './validate';

interface Bucket {
  hits: number[];
}

// Sliding-window rate limiter. Fine for a single instance; running several would
// need shared storage instead of an in-memory map.
export function rateLimit(options: { windowMs: number; max: number; name: string }): RequestHandler {
  const buckets = new Map<string, Bucket>();

  return (req, res, next) => {
    const key = `${options.name}:${clientKey(req)}`;
    const now = Date.now();
    const bucket = buckets.get(key) ?? { hits: [] };
    bucket.hits = bucket.hits.filter((timestamp) => now - timestamp < options.windowMs);

    if (bucket.hits.length >= options.max) {
      const retryAfter = Math.ceil((options.windowMs - (now - bucket.hits[0])) / 1000);
      res.setHeader('Retry-After', String(Math.max(1, retryAfter)));
      res.status(429).json({
        error: { code: 'rate_limited', message: `Too many requests. Try again in ${Math.max(1, retryAfter)} seconds.` },
      });
      return;
    }

    bucket.hits.push(now);
    buckets.set(key, bucket);
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, options.max - bucket.hits.length)));

    // Bound memory: drop buckets that have gone quiet.
    if (buckets.size > 500) {
      for (const [bucketKey, value] of buckets) {
        if (value.hits.every((timestamp) => now - timestamp > options.windowMs)) buckets.delete(bucketKey);
      }
    }

    next();
  };
}
