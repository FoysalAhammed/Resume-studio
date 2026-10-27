# API reference

Base URL in development: `http://localhost:3001`. The web app calls `/api/...` on its own origin,
which the Vite dev server proxies (so no CORS pre-flight in the browser). `localhost:5173` and
`localhost:4173` are allowed origins by default; Chrome extension origins are also accepted so the
extension preview can call the same endpoints a real extension would.

All responses are JSON. Errors use a consistent shape:

```json
{ "error": { "code": "validation_failed", "message": "Request validation failed - rawText: ..." } }
```

Codes in use: `validation_failed`, `not_found`, `payload_too_large`, `invalid_json`,
`unsupported_media_type`, `signature_mismatch`, `empty_upload`, `no_text_extracted`,
`pdf_unreadable`, `docx_unreadable`, `text_too_short`, `rate_limited`, `internal_error`.

Stack traces, file paths, provider credentials and request bodies are never returned, and are never
logged.

`GET /api/health` returns the mode and limits the UI displays:

```json
{
  "status": "ok",
  "mode": "local",
  "ai": { "configured": false, "model": null, "baseUrl": null },
  "version": "1.0.0",
  "matchEngineVersion": "1.0.0",
  "limits": { "maxUploadMb": 6 }
}
```

---

## Health and metadata

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Mode (`local`/`ai`), provider status, engine version, upload limit |
| GET | `/api/meta/match-config` | Weights, thresholds, grade bands, relation formula |

---

## Resumes

### `POST /api/resumes/parse`

Two content types are accepted.

**Raw file** — send the bytes, name the file in a header. Validated server-side: extension allow-list,
size limit, and a magic-byte check, so a renamed file is rejected with `signature_mismatch`.

```bash
curl -X POST http://localhost:3001/api/resumes/parse \
  -H "Content-Type: application/pdf" \
  -H "X-File-Name: cv.pdf" \
  -H "X-Use-Ai: false" \
  --data-binary @cv.pdf
```

**Pasted text** — analysed by the same pipeline, and also entirely in the browser when the API is
unreachable, so this path never depends on the server.

```json
POST /api/resumes/parse
{ "fileName": "cv.txt", "text": "Ayesha Rahman\n…" }
```

Response:

```json
{
  "analysis": {
    "fileName": "cv.pdf",
    "charactersExtracted": 1428,
    "wordCount": 187,
    "sectionsDetected": ["Summary", "Skills", "Experience", "Education"],
    "profile": { "email": { "value": "…", "confidence": "found", "source": "…" }, "displayName": { "…": "…" } },
    "skills": [{ "label": "React", "category": "Frontend", "lexiconId": "react", "mentions": 3, "detectedVia": "found" }],
    "experience": [], "education": [], "projects": [], "certifications": [],
    "strengths": [], "missingInformation": [], "suggestions": [], "warnings": [],
    "completeness": { "score": 89, "checks": [{ "label": "…", "passed": true }] },
    "retained": false
  },
  "patch": { "fields": ["Email", "14 skills"], "skills": [], "experience": [], "…": [] },
  "source": "local",
  "ai": { "used": false, "reason": "No AI provider is configured…" },
  "notice": "The uploaded file is processed in memory and is not stored by the server."
}
```

Every extracted field is marked `found` (read from the document) or `inferred` (derived). Missing
information stays missing and is listed in `missingInformation` — nothing is fabricated.

---

## Jobs

### `POST /api/jobs/analyze`

```json
{
  "title": "Junior Frontend Engineer",
  "company": "Northwind Labs",
  "location": "Manchester, UK (Hybrid)",
  "experienceLevel": "entry",
  "sourceUrl": "https://example.com/job",
  "rawText": "<advert text, 40…30000 characters>",
  "useAi": false
}
```

Returns `{ job, source, ai }`. `job.extraction.method` is `rule-based` or `ai`, and
`job.extraction.notes` always explains how the list was produced. Requirements are editable in the UI,
because automatic extraction is a starting point rather than an authority. `useAi: true` without a
configured provider returns the rule-based result plus `ai.used: false` and a reason.

---

## Matching

### `POST /api/matches/analyze`

```json
{ "profile": { /* CareerProfile */ }, "job": { /* JobDescription */ } }
```

Returns `{ report, gaps, summary, source }`:

- `report.matches[]` — per requirement: `weight`, `matchValue` (0–1), `matchStatus`
  (`confirmed`/`partial`/`insufficient`/`missing`), the `evidence[]` behind that value and a written
  `explanation`.
- `report.counts` — totals including required-satisfied out of required-total.
- `report.disclaimer` — states that the score estimates profile-to-advert overlap and is not a
  prediction of being hired.
- `gaps[]` — prioritised gaps with `whyItMatters`, existing evidence, target proficiency, a practical
  task, estimated hours and `priorityBasis: "internal-recommendation"`.

---

## Writing

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/resume-studio/improve` | `{ profile, text, kind: "summary" \| "experience" \| "project", job?, useAi? }` | `{ suggestion, source, ai, reviewNotice }` |
| POST | `/api/cover-letter/generate` | `{ profile, job, motivation, addressGap?, useAi? }` | `{ draft, checklist, source, ai }` |

`suggestion.needsUserInput` is `true` when a rewrite has no measurable result and the writer must ask
the user for one rather than invent it. Cover-letter drafts insert a bracketed placeholder when the
motivation is missing.

---

## Interviews

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/interviews/generate` | `{ profile, job?, difficulty, types[], topic?, count?, useAi? }` | `{ questions[], session, source, ai, feedbackNotice }` |
| POST | `/api/interviews/evaluate` | `{ question, answer }` | `{ feedback, source, notice }` |

`feedback` is explicitly `label: "heuristic-feedback"` with `coverageScore`, `structureScore` and
`heuristicScore`. It checks rubric keywords and answer structure; it does not assess correctness and
cannot predict an interview outcome.

---

## Extension

### `POST /api/extension/analyze`

The contract a real extension popup would use. It deliberately accepts only a skill subset, so the
endpoint cannot be used to read or exfiltrate a workspace.

```json
{
  "jobText": "<selected advert text>",
  "jobTitle": "Junior Frontend Engineer",
  "company": "Northwind Labs",
  "skills": [{ "name": "React", "proficiency": "advanced" }]
}
```

Returns a compact shape for a popup: `score`, `grade`, `counts`, `matched[]`, `partial[]`, `missing[]`,
`topReasons[]`, `disclaimer` and a `notice` stating that only the supplied skill list was used.

---

## AI provider behaviour

When `AI_API_KEY` is set, these endpoints may use it: `jobs/analyze`, `resumes/parse`,
`resume-studio/improve`, `cover-letter/generate`, `interviews/generate`. Each one:

1. runs the deterministic path first;
2. calls the provider with a narrow payload (never the whole profile);
3. validates the model output against a Zod contract in `packages/core/src/schemas.ts`;
4. keeps the local result if validation fails, and reports why in `ai.reason`.

Every failure mode is handled as a value: `not-configured`, `timeout`, `unauthorised`,
`rate-limited`, `provider-error`, `network-error`, `invalid-json`, `empty-response`.
