# Demonstration guide

For a university examiner or anyone seeing the project for the first time. The whole sequence works
with **no API key, no database and no internet connection beyond your machine**.

## Setup (once)

```bash
npm install
npm run dev
```

Open **http://localhost:5173**. Two processes start: the API on `:3001` and the web app on `:5173`.
Stop them with `Ctrl+C` in that terminal.

> If `npm run dev` says the command is missing, see the `NODE_ENV=production` note in the README
> troubleshooting section (`npm install --include=dev`).

---

## The 10-minute demonstration

### 1. Open the application
You land on **Overview** with an empty workspace. The screen makes the choice clear: it offers two
paths, load the labelled demonstration workspace or build your own, and states that no API key is needed.

### 2. Load the demonstration workspace
Click **Load demonstration workspace**.

- An amber banner marks the workspace as **demonstration data** and names the fictional candidate
  (Ayesha Rahman). This labelling follows the data everywhere it appears.
- Say clearly: *"This is a fictional candidate, generated deterministically. The same data is produced
  on every load. There is no randomness anywhere in this project."*

### 3. Review the career profile
Go to **Career Profile**.

- **Profile completeness** is a checklist of data you entered. It is not an employability score,
  which is worth pointing out because most such products imply otherwise.
- The **Skills** card groups skills by category. Each skill carries **evidence with a source**:
  `resume-derived`, `project-supported`, `self-reported`. Nothing is marked "verified" unless a source
  was actually recorded.
- Change a proficiency level. Every dependent figure elsewhere (compatibility, gaps) updates because
  it is computed, not stored.

### 4. Analyse a job advert
Go to **Job Explorer**.

- Press **Junior Frontend Engineer** under "Try a sample advert" to load a sample advert, or paste a
  real one from any job board (copy the text, and the app never scrapes).
- Press **Extract requirements**. The result shows how many required and preferred criteria were found,
  plus a **"How this was extracted"** panel listing the deterministic rules used.
- Open the advert → **Edit requirements** tab: toggle a requirement between *required* and
  *preferred*, delete one, or add one that was missed. The score recalculates immediately, because the
  report is derived from that list.

### 5. Examine the compatibility score
Open **Compatibility report**.

- The score is a **weighted requirement match**: `100 × Σ(weight × matchValue) ÷ Σ(weight)`, with
  required criteria weighted twice as heavily as preferred ones.
- The chart splits **confirmed / partial / no evidence** across all, required and preferred criteria.
- **Every requirement has a written explanation**: the strongest piece of evidence behind its value,
  or an explicit statement that no evidence was found.
- Point at the disclaimer: the score estimates profile-to-advert overlap and is **not** a prediction
  of being hired, and a missing keyword is not proof of a missing skill.
- Go to **Career Insights** → "How the scoring model works" to show the live weights and thresholds the
  score came from. `GET /api/meta/match-config` exposes the same thing.

### 6. Review the skill gaps
Open **Skill Gaps**. Select the advert if needed.

- Gaps are ordered by **internal priority** (advert importance × missing evidence) and each one carries
  why it matters, the evidence found so far, a target proficiency, a suggested practical task and
  reference documentation.
- Be explicit: *"the priority is an internal recommendation derived from this advert, not
  employment-market data. The project does not invent market statistics."*

### 7. Generate and work the learning roadmap
Press **Generate roadmap** (from Skill Gaps or the advert page).

- Tasks arrive in four phases: **Foundation → Practice → Portfolio → Applications**, each with an
  exercise, an estimated effort, prerequisites and completion criteria.
- **Complete a task** and watch the progress figure move. It is computed from task states only:
  `completed ÷ total`, with in-progress tasks counting half their hours toward effort.
- **Recalculate** the plan after changing your profile: completed tasks keep their status.
- Try the budget case by setting weekly hours very low in the profile. The plan tells you what it had
  to leave out instead of silently overrunning.

### 8. Improve a resume section
Open **Resume Studio**.

- Each card shows the **original**, a **draft**, a **word-level diff** and the **reason** for the change.
- Find a bullet with no measurable result: the studio **asks you for the figure** instead of inventing
  one. That shows the project's rule about not inventing facts more clearly than anything else.
- Press **Apply to profile** to commit a draft, or **Print / Save as PDF** to export the assembled CV.

### 9. Generate a cover letter
Open **Cover Letter**.

- Choose the advert, leave the motivation blank, press **Generate draft**. The letter uses only
  recorded facts and inserts a **bracketed instruction** where your motivation belongs.
- Fill in a motivation and regenerate to see it used verbatim. A checklist reminds you to verify every
  claim before sending.

### 10. Review architecture and limitations
Open **Career Insights** (model explainability, what is real vs optional) and **Settings**.

- **Settings → Local workspace storage**: shows the storage mode, a data inventory and export/import.
  Be explicit that this is single-device browser storage with no authentication. It is demonstration
  persistence and not production storage.
- **Settings → AI provider**: shows whether a provider is configured. With no key, it shows *"No AI
  provider is configured"* and explains that every screen still works.
- **Settings → Limitations of this build**: read it aloud. It lists no OCR, no DOCX export, no live
  job-market data, lexical matching instead of semantic, heuristic interview feedback, and the fact
  that the extension page is a preview.

Then walk the code structure: `packages/core` (pure domain logic and 133 tests),
`apps/api` (stateless Express API), `apps/web` (React client), `legacy/original-prototype.html` (the
original single-file prototype, preserved in git history for comparison).

---

## Optional: demonstrating the AI path

If you have an OpenAI-compatible key, add it to `.env` (`AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`),
restart the API, and reload the app. The header pill changes to `AI: <model>`, and the AI toggles
appear on the CV, advert, studio, cover-letter and interview screens.

Worth demonstrating:

1. AI off → **attempt** an AI action: the result still appears, marked **Local rules**, with the reason
   the provider was skipped. Nothing breaks.
2. AI on → the same action returns a result marked **AI-assisted**, and the "how this was produced"
   notes say what the model contributed.
3. Point out that the structured AI output is validated against a Zod schema before use, that only a
   narrow payload is sent (never the whole profile), and that the key never reaches the browser.

---

## Questions an examiner is likely to ask

**"Is the score random or hardcoded?"**
No. It is a weighted sum over extracted requirements, and the engine is versioned. `npm test` asserts
determinism and the exact arithmetic for known inputs, and the same inputs always produce the same
result in the browser and the API.

**"What happens with a scanned CV?"**
The extractor finds no text layer, reports that clearly, and says OCR is not implemented. It does not
silently return nothing or pretend to read it.

**"Where is the data stored, and what happens on refresh?"**
In IndexedDB in your browser, restored on load. The API stores nothing about you. Export/import in
Settings gives you a portable copy.

**"What is real and what is a mock?"**
The status table at the top of the README is the authoritative answer, and
`docs/LIMITATIONS.md` lists the gaps. The extension page is the one deliberate "preview" surface, and
it says so on the page itself.

**"How would this scale to multiple users?"**
`docs/DATABASE.md` contains the PostgreSQL/Prisma design with per-user foreign keys and cascade rules,
and `docs/ARCHITECTURE.md` explains the service boundaries the planned follow-on projects would extend.
