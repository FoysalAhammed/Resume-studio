# CareerLens AI

**Understand your skills, find your opportunities, build a path toward your career.**

CareerLens AI is a career-readiness app. You give it a CV and a job advert. It pulls structured
evidence out of both, scores how well you fit using a weighted model you can inspect, turns the
gaps into a learning plan you can tick off, and helps you tighten your CV wording and write a
cover letter.

This started as a university project, so it tries to be straight about what is real: every score is
computed from data you actually entered, nothing is invented, and anything produced by the optional
AI provider is labelled as such in the interface.

---

## What works, and what doesn't

| Feature | Status | Notes |
|---|---|---|
| Career profile (skills, experience, education, projects, certifications) | Works | Add, edit and delete; validated with Zod; stored in the browser |
| CV parsing (PDF, DOCX, TXT, MD) | Works | Server-side parsing with `pdf-parse` and `mammoth`; plain text is parsed in the browser |
| CV structure extraction (contact, sections, experience, education, projects, certifications) | Works | Rule-based, with a "found" or "inferred" confidence on each field |
| CV completeness scoring and suggestions | Works | A checklist, not an employability score |
| Job requirement extraction (required vs preferred, experience, education) | Works | Rule-based keyword and pattern matching; you can edit the result |
| Explainable job matching | Works | Weighted, versioned, deterministic; every requirement shows its evidence |
| Skill-gap analysis with effort estimates and practice tasks | Works | Priority is an internal recommendation, not market data |
| Learning roadmap and task tracking | Works | Deterministic templates; progress comes from real task states |
| Resume Studio rewrites and diff view | Works | Suggests wording and asks you for a result instead of inventing a metric |
| Cover-letter drafting | Works | Deterministic template built from recorded facts |
| Interview preparation with rubric feedback | Works | Feedback is a keyword-and-structure heuristic and is labelled as one |
| Dashboard, insights and charts | Works | All figures come from your workspace; empty states when there is nothing yet |
| Sample demonstration workspace | Works | Fictional candidate, labelled everywhere, deterministic |
| Optional AI assistance (requirement refinement, rewrites, letters, questions) | Optional, labelled | Needs `AI_API_KEY`; without it every screen falls back to local logic |
| Browser extension | Preview only | A realistic preview inside the site plus the API contract. No extension is packaged |
| PostgreSQL / Prisma persistence | Not built | Designed in `docs/DATABASE.md`; the app runs on browser storage |
| OCR for scanned PDFs | Not built | You get a clear message when a PDF has no text layer |
| DOCX export, live job listings, salary data, semantic matching | Not built | Listed in `docs/LIMITATIONS.md` |

## Requirements

- Node.js 20 or newer (developed on Node 24) and npm 10+.
- No database, no API key and no internet connection for the core workflow.

## Install

```bash
npm install
```

If `tsc` or `vite` shows up as "not recognized" after installing, your shell has
`NODE_ENV=production` set, which makes npm skip devDependencies. Unset it, or run
`npm install --include=dev`.

## Run it

```bash
npm run dev          # API on :3001 and the web app on :5173, together
```

Open **http://localhost:5173**. The dev server proxies `/api` to the API, so the browser only
ever talks to one origin.

Other commands:

```bash
npm run dev:api      # API only (tsx watch)
npm run dev:web      # web app only (vite)
npm run build        # production build of the API bundle and the web app
npm start            # run the built API (node apps/api/dist/server.js)
npm run preview:web  # serve the built web app on :4173
npm test             # unit and integration tests (vitest)
npm run typecheck    # strict TypeScript across all three packages
npm run verify       # typecheck + tests + build
```

Stop the dev servers with `Ctrl+C`.

## Try it in 60 seconds

1. Open http://localhost:5173.
2. Click **Load demonstration workspace**. It loads a labelled fictional candidate.
3. Go to **Job Explorer** → open a sample advert → **Compatibility report** to see the full reasoning.
4. Go to **Skill Gaps** → **Generate roadmap**, then tick a task off on **Learning Roadmap**.
5. Go to **Settings** → **Export workspace** to see exactly what is stored.

There is a longer walkthrough in `docs/DEMO_GUIDE.md`.

## Environment variables

Copy `.env.example` to `.env` if you want to change anything. Nothing is required locally.

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `3001` | API port |
| `CORS_ORIGIN` | `http://localhost:5173,http://localhost:4173` | Origins allowed to call the API |
| `MAX_UPLOAD_MB` | `6` | Upload limit, enforced on both the client and the server |
| `AI_API_KEY` | empty | **Optional.** Turns on the AI-assisted features. Server-side only |
| `AI_BASE_URL` | `https://api.openai.com/v1` | Any OpenAI-compatible `/chat/completions` endpoint |
| `AI_MODEL` | `gpt-4o-mini` | Model name sent to the provider |
| `AI_TIMEOUT_MS` | `30000` | Per-request timeout; on timeout the app falls back to local logic |
| `AI_MAX_OUTPUT_CHARS` | `20000` | Long model responses are truncated before validation |

The key lives only in the API process. It is never sent to the browser, never stored with your
workspace, and `/api/health` reports only whether a provider is configured and which model is in use.

## How the data flows

```
apps/web  ──(IndexedDB in your browser)──►  your workspace (profile, adverts, roadmaps, drafts)
   │
   └──(HTTP /api/*)──►  apps/api  ──►  @careerlens/core  (pure, deterministic domain logic)
                             │
                             └──(only when AI_API_KEY is set)──►  your LLM provider
```

The API is stateless. It computes and returns; it never receives your whole profile, only the
payload a single feature needs (a pasted advert, a CV file, or a short skill list from the
extension preview). `docs/ARCHITECTURE.md` has the section-by-section detail.

## Deploy to Vercel

The whole thing deploys as **one Vercel project**: the React app is served as static files and the
Express API runs as a single serverless function.

1. Push the repository to GitHub/GitLab/Bitbucket.
2. In Vercel, **Add New → Project**, import the repo, and leave the root directory as the repo root.
3. Deploy. `vercel.json` already sets the build command, the output directory and the function.

Nothing else is required. `AI_API_KEY` is optional and can be added later in the project settings.
Full details, including the serverless caveats, are in `docs/DEPLOYMENT.md`.

## Tests

```bash
npm test
```

The suite covers the parts that matter: matching-score maths and determinism, partial credit for
related skills, missing-skill detection, roadmap progress and recalculation, CV file validation and
parsing, profile merging, rewrite and cover-letter rules, interview question selection and heuristic
scoring, sample-data loading and reset, plus an HTTP integration suite for every API route
(including the "no AI provider configured" fallback path).

## Project structure

```
packages/core/     framework-agnostic domain layer (types, schemas, extraction, matching, roadmap)
  src/             skills lexicon and relation graph, jobs, matching, gap, roadmap, resume, writing, interview, sample
  tests/           unit tests
apps/api/          Express + TypeScript API (stateless), parsers, AI adapter, middleware, routes
apps/web/          React + TypeScript + Vite + Tailwind client
api/               Vercel serverless entry point for the whole app
docs/              overview, architecture, API, database design, demo guide, deployment, limitations
legacy/            the original single-file prototype, kept for reference
```

## Troubleshooting

- **`'tsc' is not recognized`** → `NODE_ENV=production` is set in your shell; run `npm install --include=dev`.
- **PDF upload says the API is offline** → start the API with `npm run dev:api`, or paste the CV text; pasted text is analysed in the browser with no server at all.
- **A scanned PDF returns "no text layer"** → expected. OCR is not implemented.
- **Port already in use** → `netstat -ano | findstr :3001`, stop that PID, or set `PORT` in `.env`.
- **AI features do nothing** → `AI_API_KEY` is empty. That is the default, and everything still works.

## Limitations

Read `docs/LIMITATIONS.md` before you rely on any result. Short version: browser storage is
single-device demo storage with no authentication, matching is lexical rather than semantic, there
is no OCR, no live job-market data, no DOCX export, and the extension page is a preview rather than
an installed extension.
