# Project overview

**CareerLens AI** — a career-readiness platform for a university software project.
Series position: this is **Project 1** of a planned three-stage system.

## The idea

Most early-career candidates cannot tell which parts of their profile actually matter for a specific
advert. CareerLens AI turns that into a measurable, explainable process:

1. **Record evidence.** A structured profile where every skill carries evidence and a source label, so
   "I know React" becomes "React — used in the StudyBuddy project, advanced".
2. **Read the documents.** A CV is parsed into the same structured shape, with each field marked as
   found in the document or inferred, and reviewed by you before it is applied.
3. **Read the advert.** Requirements are extracted as required or preferred, each with an importance
   weight, and are editable because extraction is imperfect.
4. **Score compatibility.** A weighted model compares evidence to requirements and explains every
   result in words.
5. **Turn gaps into a plan.** Gaps become phased, tracked tasks with effort estimates.
6. **Improve the documents.** CV wording and cover letters are drafted from facts you already recorded.

## Principles the implementation follows

- **No invented numbers.** Nothing is fabricated: not a metric, not a salary figure, not a qualification,
  not a market statistic. Missing information produces a question or a placeholder, never an estimate
  dressed up as fact.
- **Deterministic by default.** Matching, gap analysis, roadmap generation and extraction contain no
  randomness and no clock-dependent behaviour, so results are reproducible and testable.
- **AI is optional and labelled.** Every AI-assisted path has a local equivalent, and the interface
  marks which one produced a result.
- **Evidence over keywords.** A related skill earns partial credit and an unmentioned skill is reported
  as "no evidence found" rather than "missing".
- **Real functionality over mockups.** Buttons do what they say, empty states explain themselves, and
  destructive actions ask first.
- **Say what is not built.** The README status table, `docs/LIMITATIONS.md` and the in-app Settings page
  all state the gaps explicitly.

## Who each part is for

| Audience | Where to start |
|---|---|
| A candidate using it | Load the demonstration workspace, then build your own profile |
| An examiner assessing it | `docs/DEMO_GUIDE.md` — a scripted 10-minute walkthrough, plus likely questions |
| A developer reviewing the code | `docs/ARCHITECTURE.md`, then `packages/core` and its tests |
| Someone integrating with it | `docs/API.md` (`/api/health` and `/api/meta/match-config` first) |
| Deciding what to build next | `docs/LIMITATIONS.md` and `docs/DATABASE.md` |

## Roadmap for the series

**Project 1 — this build. Career readiness platform.**
Profile management, CV parsing, structured career evidence, advert analysis, explainable matching,
gap analysis, learning roadmap, resume studio, cover letters, dashboard, local demonstration mode and
optional AI integration.

**Project 2 — Adaptive AI career copilot (next).**
A real packaged browser extension against the existing `/api/extension/analyze` contract, semantic
retrieval over a candidate's evidence, adaptive learning paths, AI mock interviews with validated
criteria, portfolio analysis, and job-market intelligence from real sources (with the licensing and
ethics that implies).

**Project 3 — Career and talent ecosystem (later).**
University dashboards, an employer portal, organisation management, multi-tenant isolation, skill
evidence verification against approved sources, and aggregate career analytics with recommendation
evaluation.

None of that is claimed as built. The current architecture keeps the seams open for it — a data-driven
technology lexicon, service boundaries per capability, and user-scoped entity shapes — without adding
infrastructure the first release does not need.
