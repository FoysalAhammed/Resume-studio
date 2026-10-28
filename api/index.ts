import { createApp } from '../apps/api/src/app';

// Vercel entry point. The whole Express app becomes one serverless function, so
// the site and the API ship from the same Vercel project. Routing is set up in
// vercel.json: /api/* lands here, everything else falls back to the SPA.
export default createApp();
