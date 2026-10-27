# CareerLens AI

**Understand your skills. Discover your opportunities. Build a path toward your career.**

CareerLens AI is a career-readiness platform: it parses a CV into structured evidence, extracts the
requirements from a job advert, scores compatibility with an explainable weighted model, turns the
gaps into a tracked learning roadmap, and helps with CV wording and cover letters.

This is a university software project. It is built to be **honest about what is real**: every score
is computed from your own recorded data, no number is invented, and anything produced by an optional
AI provider is labelled as such in the interface.

---

## What actually works

| Capability | Status | Notes |
|---|---|---|
| Structured career profile (skills, experience, education, projects, certifications) | **Implemented** | Add / edit / delete, validated with Zod, persisted in the browser |
| CV parsing (PDF, DOCX, TXT, MD) | **Implemented** | Server-side parsing with `pdf-parse` and `mammoth`; text files are parsed in the browser |
| CV structure extraction (contact, sections, experience, education, projects, certifications) | **Implemented** | Deterministic rules, with per-field "found" vs "inferred" confidence |
| CV completeness scoring and suggestions | **Implemented** | A checklist, not an employability score |
| Job requirement extraction (required vs preferred, experience, education) | **Implemented** | Deterministic keyword + pattern extraction, editable by you |
| Explainable job matching | **Implemented** | Weighted, versioned, deterministic; every requirement carries its evidence |
| Skill-gap analysis with effort estimates and practice tasks | **Implemented** | Priority is an **internal recommendation**, never presented as market data |
| Learning roadmap generation + task tracking | **Implemented** | Deterministic templates; progress is computed from real task states |
| Resume Studio rewrites and diff view | **Implemented** | Suggests wording; asks you for a result rather than inventing a metric |
| Cover-letter drafting | **Implemented** | Deterministic template from recorded facts |
| Interview preparation with rubric feedback | **Implemented** | Feedback is a keyword/structure **heuristic**, clearly labelled |
| Career dashboard, insights and charts | **Implemented** | All figures come from workspace data; empty states when there is none |
| Sample demonstration workspace | **Implemented** | Fictional candidate, labelled everywhere, deterministic |
| Optional AI assistance (requirement refinement, rewrites, letters, questions) | **Optional, labelled** | Needs `AI_API_KEY`; without it every screen falls back to local logic |
| Browser extension | **Preview only** | A realistic preview inside the website plus the API contract. No extension is packaged or installed |
| PostgreSQL / Prisma persistence | **Not implemented** | Designed and documented in `docs/DATABASE.md`; the app runs on browser storage |
| OCR for scanned PDFs | **Not implemented** | Reported clearly when a PDF has no text layer |
| DOCX export, live job listings, salary data, semantic matching | **Not implemented** | Listed in `docs/LIMITATIONS.md` |

---

## Prerequisites

- **Node.js 20 or newer** (developed and verified on Node 24) and npm 10+.
- No database server, no API key and no internet connection are required for the core workflow.

## Install

```bash
npm install
```

> **If `tsc` or `vite` is "not recognized"** after installing, your shell has `NODE_ENV=production`
> set, which makes npm skip `devDependencies`. Either unset it or run `npm install --include=dev`.

## Run it

```bash
npm run dev          # starts the API on :3001 and the web app on :5173 together
```

Then open **http://localhost:5173**. The web dev server proxies `/api` to the API, so the browser
only ever talks to one origin.

Other useful commands:

```bash
npm run dev:api      # API only (tsx watch)
npm run dev:web      # web app only (vite)
npm run build        # production build of the API bundle and the web app
npm start            # run the built API (node apps/api/dist/server.js)
npm run preview:web  # serve the built web app on :4173
npm test             # 133 unit + integration tests (vitest)
npm run typecheck    # strict TypeScript across all three packages
npm run verify       # typecheck + tests + build
```

Stop the dev servers with `Ctrl+C` in the terminal that is running them (or `npm run dev` again after
killing the process). If a port is stuck, see Troubleshooting below.

## Try it in 60 seconds

1. Open http://localhost:5173.
2. Click **Load demonstration workspace** — a clearly labelled fictional candidate.
3. Open **Job Explorer** → a sample advert → **Compatibility report** for the full reasoning.
4. Open **Skill Gaps** → **Generate roadmap**, then tick a task complete on **Learning Roadmap**.
5. Open **Settings** → **Export workspace** to see exactly what is stored.

The full walkthrough for a demonstration is in `docs/DEMO_GUIDE.md`.

## Environment configuration

Copy `.env.example` to `.env` if you want to change anything. **Nothing is required** for local use.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | API port |
| `CORS_ORIGIN` | `http://localhost:5173,http://localhost:4173` | Origins allowed to call the API |
| `MAX_UPLOAD_MB` | `6` | Upload size limit, enforced client- and server-side |
| `AI_API_KEY` | *(empty)* | **Optional.** Enables AI-assisted features. Server-side only |
| `AI_BASE_URL` | `https://api.openai.com/v1` | Any OpenAI-compatible `/chat/completions` endpoint |
| `AI_MODEL` | `gpt-4o-mini` | Model name passed to the provider |
| `AI_TIMEOUT_MS` | `30000` | Per-request timeout; a timeout falls back to local logic |
| `AI_MAX_OUTPUT_CHARS` | `20000` | Oversized model responses are truncated before validation |

The key lives **only** in the API process. It is never sent to the browser, never stored with your
workspace, and `/api/health` reports only whether a provider is configured and which model is in use.

## How the data flows

```
apps/web  ──(browser storage: IndexedDB)──►  your workspace (profile, adverts, roadmaps, drafts)
   │
   └──(HTTP /api/*)──►  apps/api  ──►  @careerlens/core  (pure, deterministic domain logic)
                             │
                             └──(only when AI_API_KEY is set)──►  your LLM provider
```

The API is **stateless**: it computes and returns. It never receives your whole profile — only the
specific payload a feature needs (a pasted advert, a CV file, or a short skill list from the
extension preview). Section-by-section detail is in `docs/ARCHITECTURE.md`.

## Tests

```bash
npm test
```

`133` tests cover the business logic that matters: matching-score maths and determinism, partial
credit for related skills, missing-skill detection, roadmap progress and recalculation, CV file
validation and parsing, profile-merge behaviour, rewrite and cover-letter rules, interview question
selection and heuristic scoring, sample-data loading/reset, plus an HTTP integration suite for every
API route (including the "no AI provider configured" fallback path).

## Project structure

```
packages/core/     framework-agnostic domain layer (types, schemas, extraction, matching, roadmap)
  src/…            skills lexicon + relation graph, jobs, matching, gap, roadmap, resume, writing, interview, sample
  tests/           unit tests
apps/api/          Express + TypeScript API (stateless), parsers, AI adapter, middleware, routes
apps/web/          React + TypeScript + Vite + Tailwind client
docs/              overview, architecture, API, database design, demo guide, limitations
legacy/            the original single-file prototype, kept for reference
```

## Troubleshooting

- **`'tsc' is not recognized`** → `NODE_ENV=production` in your shell; run `npm install --include=dev`.
- **PDF upload says the API is offline** → start the API (`npm run dev:api`) or paste the CV text;
  text is analysed in the browser with no server at all.
- **A scanned PDF returns "no text layer"** → correct and expected: OCR is not implemented.
- **Port already in use** → `netstat -ano | findstr :3001` then stop that PID, or set `PORT` in `.env`.
- **AI features do nothing** → `AI_API_KEY` is empty. That is the default and everything still works.

## Limitations

Read `docs/LIMITATIONS.md` before presenting or relying on any result. In short: browser storage is
single-device demonstration storage with no authentication, matching is lexical rather than semantic,
there is no OCR, no live job-market data, no DOCX export, and the extension page is a preview rather
than an installed extension.
