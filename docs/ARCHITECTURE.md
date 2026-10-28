# Architecture

## Shape of the system

CareerLens AI is a small monorepo with three packages and one shared domain layer.

```
careerlens-ai/
├── packages/core/          @careerlens/core — pure TypeScript, no I/O
│   ├── src/types.ts             all shared domain types
│   ├── src/schemas.ts           Zod contracts (profile, job, workspace, API bodies, AI outputs)
│   ├── src/constants.ts         matching model constants + limits
│   ├── src/skills/              technology lexicon (~140 entries) and relation graph
│   ├── src/jobs/extract.ts      advert sectioning + requirement extraction
│   ├── src/matching/engine.ts   explainable weighted matching
│   ├── src/gap/analyze.ts       gap derivation + prioritisation
│   ├── src/roadmap/             task templates + roadmap generation and progress
│   ├── src/resume/              file validation + CV text analysis
│   ├── src/writing/             rewrite rules + cover-letter drafting
│   ├── src/interview/           question selection + rubric heuristics
│   ├── src/profile/             profile completeness checklist
│   └── src/sample/              the demonstration workspace
├── apps/api/               Express API, stateless
│   ├── src/app.ts              middleware + route wiring
│   ├── src/env.ts              configuration + health payload
│   ├── src/parsers/            PDF / DOCX / text extraction with signature checks
│   ├── src/ai/provider.ts      OpenAI-compatible adapter (timeouts, failures as values)
│   ├── src/ai/services.ts      one function per AI capability, each validated with Zod
│   ├── src/middleware/         errors, validation, rate limiting, logging
│   └── src/routes/             health, resumes, jobs, matches, studio, cover letter, interviews, extension
└── apps/web/               React + Vite + Tailwind client
    ├── src/state/              WorkspaceProvider (reducer + persistence), ApiStatusProvider
    ├── src/lib/                API client, IndexedDB persistence, formatting, export helpers
    ├── src/components/         design-system primitives, charts, app shell
    ├── src/hooks/              live analysis hook
    └── src/features/           one folder per page
```

## Why the logic lives in `packages/core`

Keeping the domain logic free of any framework makes three things easy to guarantee:

1. **Determinism.** The matching engine, roadmap generator and extractors contain no randomness, no
   clock-dependent branching and no network access. The same profile plus advert always produces the
   same score for a given engine version, which is what makes the numbers defensible.
2. **Testability.** `packages/core/tests` exercises the real functions directly. There is no DOM, no
   HTTP and no mocking layer between the test and the maths.
3. **Reuse.** The identical code runs in the browser (instant feedback, offline capable) and in the
   API (server-side file parsing, optional AI). There is no second implementation to keep in sync.

## Data flow in the browser

```
IndexedDB  ──load──►  WorkspaceProvider (useReducer)
                          │
                          ├── pages read the workspace and derive values with core functions
                          └── actions update the workspace and log an activity entry
                                    │
                            debounced save ──► IndexedDB
```

- **Canonical store:** browser `IndexedDB` (one key). Documented as demonstration persistence, not
  production storage. `docs/DATABASE.md` describes the PostgreSQL/Prisma design that would replace it.
- **Derived data is recomputed, not stored.** Compatibility reports are always derived from the
  current profile and advert, then written into the workspace so the dashboard and insights pages
  read the same result the user saw. Storing a score that could drift from its inputs is deliberately
  avoided.
- **Provenance is first-class.** Skills carry evidence with a source label
  (`self-reported`, `resume-derived`, `project-supported`, `experience-supported`, `verified`), so the
  interface can show *why* a requirement matched, and sample data is tagged `origin: 'sample'`.

## Matching model

```
score = 100 × Σ(weight × matchValue) ÷ Σ(weight)

weight     = base importance (required 3, preferred 1.5) × emphasis (1.0 – 1.3 from the advert wording)
matchValue = strongest single piece of evidence, plus up to +0.1 for independent sources
```

Evidence mapping (all constants are in `packages/core/src/constants.ts`):

| Evidence | Value |
|---|---|
| Recorded skill at or above the target proficiency | 1.00 |
| Recorded skill below target proficiency | 0.70 – 0.85 by proficiency |
| Related skill (curated link or same category) | `0.4 + 0.4 × relation strength` |
| Technology listed in a project | 0.85 |
| Mentioned in a project description | 0.70 |
| Mentioned in work experience | 0.80 |
| Covered by a certification | 0.65 |

Status thresholds: `≥ 0.85` confirmed, `≥ 0.40` partial, `> 0` insufficient evidence, `0` no
evidence found. The last two mean evidence is absent. They are not proof that a skill is missing.

`GET /api/meta/match-config` returns the live model so a marker can audit any score, and the
Career Insights page renders the same explanation in the UI.

## API design

- **Stateless.** No session, no server-side user record, no database.
- **Validated at the boundary.** Every request body is parsed with a Zod schema from
  `@careerlens/core/src/schemas.ts`. Failures return `400` with field paths.
- **Errors are values.** `AppError` carries a status, a code and a message safe to show a user. The
  error middleware never returns stack traces, file paths or provider internals.
- **Uploads are validated server-side.** Extension allow-list, size limit, and a file-signature check
  (`%PDF`, `PK…`) so a renamed file cannot slip through. The upload is processed in memory and is
  never written to disk.
- **Rate limited** per client address with a dependency-free sliding window.
- **AI failures degrade, never break.** The adapter returns failure objects (timeout, unauthorised,
  rate limited, invalid JSON, empty response). Routes fall back to the deterministic result and tell
  the client which path produced the response (`source: "local" | "ai"`).

## Security posture

- No credentials anywhere in client code. The AI key exists only in the API process.
- Uploaded documents and advert text are treated as untrusted data. AI prompts wrap them in
  `<document>` tags with an instruction that content inside is data, never instructions.
- The extension endpoint accepts only a small skill list, so it cannot be used to read a workspace.
- Logging records method, path, status and duration. It never records request bodies, CV content or job text.
- No authentication is implemented, and the documentation says so.

## Front-end architecture

- **One reducer, explicit actions.** Every mutation sets `updatedAt` and appends a provenance entry,
  so the activity log can never disagree with the data.
- **Server state is not duplicated.** The API is consulted for parsing and optional AI only. It holds
  no copy of your workspace.
- **Offline-first.** With no API running, CV text, job analysis, matching, gaps, roadmaps, writing and
  interview practice all still work. Only PDF/DOCX parsing and AI calls need the server, and the UI
  says so instead of failing silently.
- **Design system.** A small set of primitives (buttons, fields, cards, badges, tabs, modal, toasts,
  progress, charts) keeps spacing, focus states and tone consistent, and a single source badge labels
  every result as local rules, AI-assisted or demonstration data.

## Extension points for the planned follow-on projects

- The technology lexicon and relation graph are data, so extending coverage is a data change.
- Services are separate modules (`JobRequirementExtractionService`-style boundaries), so semantic
  retrieval or a different provider can be added behind the same routes.
- Workspace entities are already user-scoped in shape (`origin`, timestamps, ids), which is what a
  multi-tenant schema would need. `docs/DATABASE.md` maps entities to tables with foreign keys.
