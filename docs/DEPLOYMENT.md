# Deploying to Vercel

The whole app ships from **one Vercel project**: the React app is served as static
files and the Express API runs as a single serverless function. No second service and
no database are needed.

## How it is wired

```
vercel.json
  buildCommand    -> npm run build:web        (vite build -> apps/web/dist)
  outputDirectory -> apps/web/dist            (the React app)
  functions       -> api/index.ts             (the Express API, one function)
  rewrites        -> /api/*  -> /api          (send API calls to the function)
                     /*      -> /index.html    (React Router deep links)

api/index.ts                Vercel Function; default-exports the Express app
apps/api/src/app.ts         createApp() - the same app the local server uses
```

Vercel checks the filesystem (static files and functions) before applying rewrites, so
requests under `/api/*` reach the function while everything else falls through to
`index.html`. Rewrites to a function keep the original path, which is why the Express
routers still see `/api/health` and friends.

## First deploy

1. Push the repository to GitHub/GitLab/Bitbucket.
2. In Vercel, **Add New → Project** and import the repository.
3. Leave the **Root Directory** as the repository root. Vercel reads `vercel.json`
   automatically, so the build command, output directory and function settings are
   already set.
4. Add environment variables (all optional, see below) and press **Deploy**.

No `vercel.json` edits are needed for the default setup. If the dashboard asks you to
pick a framework preset, choose **Other**, because the config already defines everything.

## Environment variables

Nothing is required. The API runs on deterministic local logic when no provider is set,
and the browser talks to the API on the same origin, so `VITE_API_BASE_URL` should be
left **unset** in production.

| Variable | Required | Notes |
|---|---|---|
| `AI_API_KEY` | No | Enables the optional AI features. Server-side only |
| `AI_BASE_URL` | No | Any OpenAI-compatible `/chat/completions` endpoint |
| `AI_MODEL` | No | Defaults to `gpt-4o-mini` |
| `MAX_UPLOAD_MB` | No | Defaults to `6` |
| `PORT` | No | Ignored on Vercel. The platform assigns the port |
| `CORS_ORIGIN` | No | Not needed for same-origin use. Set it only if you call the API from another domain |
| `VITE_API_BASE_URL` | No | Leave unset in production so requests stay same-origin |

Only variables prefixed with `VITE_` reach the browser, and the API key is never one
of them.

## Things worth knowing on serverless

- **Uploads are parsed in memory.** Nothing is written to disk, which is what makes the
  stateless function model work. The `MAX_UPLOAD_MB` limit still applies.
- **Rate limiting is per instance.** `apps/api/src/middleware/rateLimit.ts` keeps its
  counters in memory, so each function instance limits independently. That is fine for
  a demo. A shared store (Redis, Upstash) would be the next step for real traffic.
- **`app.set('trust proxy', false)`** means `req.ip` is the platform address and not
  the visitor's. If you later rate-limit per visitor, trust the Vercel proxy instead.
- **Function limits.** `maxDuration` is set to 60s because AI calls can take up to the
  `AI_TIMEOUT_MS` budget. Lower it if you are certain AI is off.

## Deploying with the CLI instead

```bash
npm i -g vercel
vercel          # preview deployment
vercel --prod   # production deployment
```

## Local production check

```bash
npm run build                 # typecheck + build the API bundle and the web app
npm run preview:web           # serve apps/web/dist on :4173
npm start                     # run the built API on :3001 (proxying is not required)
```

To reproduce the single-origin production setup locally, run the built API on `:3001`
and point the web build at it with `VITE_API_BASE_URL=http://localhost:3001` before
`npm run build:web`.

## Troubleshooting

- **Every `/api/*` request returns the app's HTML instead of JSON.** The first rewrite is
  missing or out of order. Keep `/api/:path*` -> `/api` above `/(.*)` -> `/index.html`.
- **Deep links 404 after a refresh.** The second rewrite is missing. React Router needs
  every unknown path to land on `/index.html`.
- **The function cannot find `@careerlens/core`.** The build installs from the repository
  root so npm can link the workspace packages. If it still fails, check that Vercel's
  Root Directory is the repository root and not `apps/web`.
- **A route works with `npm run dev` but 404s on Vercel.** Route order matters here.
  `app.use(notFoundHandler)` must stay last in `apps/api/src/app.ts`.
