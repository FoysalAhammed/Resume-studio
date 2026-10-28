# Limitations

Each item below says what is missing and how the app handles it.

## Data and security

| Limitation | Detail | How the app handles it |
|---|---|---|
| No authentication | There are no accounts, logins or sessions | Stated in Settings. The app is single-user by design |
| No multi-user isolation | Anyone with access to the browser profile can read the workspace | Documented in Settings → "Limits of this build" |
| Browser storage is not production storage | IndexedDB is unencrypted, single-device and clearable by the browser | Labelled "demonstration persistence", with export/import provided |
| No PostgreSQL/Prisma implementation | Only the design exists (`docs/DATABASE.md`) | The app runs entirely without a database |
| No server-side user data | The API is stateless and stores nothing about you | Only the minimum payload per feature is sent |
| No OCR | Scanned or image-only PDFs have no text layer | Reported explicitly, with the suggestion to paste text |
| Free-text extraction is heuristic | Sections and dates are inferred from patterns | Fields are marked `found` or `inferred`. You review before applying |

## Analysis quality

| Limitation | Detail |
|---|---|
| Lexical matching (not semantic) | Matching uses keywords plus a curated relation graph. "Used Kubernetes in a class project" will not be understood as equivalent to a listed skill, but a *related* skill does earn partial credit |
| Requirement extraction can miss wording | Unusual wording is sometimes not recognised. The advert's requirement list is editable for exactly this reason |
| No market data | No live vacancies, no salary figures, no demand statistics. Priority is an internal recommendation derived from the advert in front of you |
| No market trend claims | Charts show only your workspace data. Empty states appear instead of decorative placeholders |
| Completeness is not employability | Profile and CV completeness are checklists over entered data, never a judgement of a person |

## Generation and feedback

| Limitation | Detail |
|---|---|
| Interview feedback is a heuristic | Rubric keyword coverage plus structure signals, labelled `heuristic-feedback`. It does not assess correctness and cannot predict an interview outcome |
| CV rewrites are templates | Deterministic rules unless AI is enabled. A missing metric becomes a question to you, never an invented number |
| Cover letters are drafts | Assembled from recorded facts with bracketed placeholders for missing motivation. Nothing is ever submitted |
| Roadmap completion is not employment | Completing a plan closes gaps for one advert. It is not a guarantee of a job |
| AI output can still be imprecise | Structured output is schema-validated before use, but the interface asks you to review anything AI-assisted |

## Product surface

| Limitation | Detail |
|---|---|
| Extension is a preview | No Manifest V3 package is built or installed. The page shows the intended popup, runs the real engine against real endpoints, documents the API contract and lists the remaining build steps |
| No DOCX export | "Print / Save as PDF" and plain-text export are implemented. A real `.docx` writer is future work |
| No automatic job scraping | Adverts are pasted by you, so every requirement is traceable to a source you chose |
| No file retention | Uploads are parsed in memory and discarded. A parsed CV cannot be re-downloaded because it was never stored |
| Roadmaps target one role | A plan is generated per advert. Comparing several plans side by side is not supported |

## Development and operations

| Limitation | Detail |
|---|---|
| Rate limiting is in-memory | Fine for a single instance. A multi-instance deployment would need shared storage |
| No ESLint configuration | Strict TypeScript (`npm run typecheck`) and the test suite are the quality gates that are actually wired up |
| No linter or formatter config committed | Formatting follows the existing file style |
| Accessibility is partially verified | Focus states, keyboard navigation, ARIA roles, skip link and reduced-motion support are implemented. No automated a11y audit (axe/Lighthouse) has been run |
| Browser testing is limited to the flows listed below | See "Verification performed" |

## Verification performed

This is what was actually run for this build:

- `npm run typecheck` is clean across `@careerlens/core`, `@careerlens/api`, `@careerlens/web`.
- `npm test`: **133 tests passing** (11 files), covering matching maths and determinism, partial
  credit, missing-skill detection, roadmap generation/progress/recalculation, CV validation and
  parsing, profile merge, writing rules, interview selection and heuristics, sample load/reset, and an
  HTTP integration suite for every API route including the no-AI fallback.
- `npm run build`: the API bundle and web build both succeed.
- Live API smoke test against the **built** server: **28/28 checks** (health, job analysis with the
  AI-fallback reason, matching, gaps, CV parsing, rewrites, cover letter, interviews, extension,
  validation and 404 shapes).
- Real file parsing: a genuine 61 KB PDF (produced by a browser print-to-PDF engine) and a generated
  DOCX both parsed correctly: contact details, six sections, 14 skills, two experience entries and an
  89% completeness score.
- Browser run in headless Edge over the DevTools protocol from a clean profile: **24 of 25 checks**
  passed: hydration, empty-state messaging, loading the demonstration workspace, the job list, the
  job detail page and its compatibility report tab, per-requirement reasoning, gaps, roadmap, studio
  rationale, zero console errors, zero uncaught exceptions, and no horizontal overflow at 375 px. The
  single failing check asserted the disclaimer text while the *match tab* was open. The disclaimer is
  rendered in the job overview card (verified visually), so this was a test selector error and not a
  product defect.
- Visual inspection of desktop and mobile screenshots. Two cosmetic issues found this way (weak
  contrast in the demo banner, cramped header at 375 px) were fixed and re-verified.

Not performed: an automated accessibility audit, load testing, a security review, and interaction
testing in any browser other than Chromium-based Edge.
