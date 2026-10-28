import { useMemo, useState } from 'react';
import { Lock, Puzzle, ShieldCheck, Sparkles, Terminal } from 'lucide-react';
import {
  computeMatch,
  createJobDescription,
  emptyProfile,
  makeId,
  resolveSkillLabel,
  SAMPLE_JOB_ONE,
  type MatchReport,
} from '@careerlens/core';
import { useWorkspace } from '../../state/WorkspaceProvider';
import { useApiStatus } from '../../state/ApiStatusProvider';
import { useToast } from '../../components/ui/Toast';
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, Select, SourceBadge } from '../../components/ui/primitives';
import { ScoreRing } from '../../components/charts/Charts';
import { api } from '../../lib/api';
import { matchStatusLabel, matchStatusTone } from '../../lib/format';

interface ExtensionResult {
  score: number;
  grade: string;
  matched: { label: string; status: string }[];
  partial: { label: string; status: string }[];
  missing: { label: string; status: string }[];
  topReasons: { label: string; explanation: string }[];
  disclaimer: string;
  origin: 'api' | 'browser';
}

export default function ExtensionPreviewPage() {
  const { workspace } = useWorkspace();
  const { status } = useApiStatus();
  const toast = useToast();

  const [jobId, setJobId] = useState(workspace.jobs[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExtensionResult | null>(null);

  const selectedJob = workspace.jobs.find((item) => item.id === jobId);
  const advertText = selectedJob?.rawText ?? SAMPLE_JOB_ONE;
  const advertTitle = selectedJob?.title ?? 'Junior Frontend Engineer';
  const advertCompany = selectedJob?.company ?? 'Northwind Labs (fictional sample)';

  // Only the skill name, proficiency and lexicon id leave the page.
  const skillPayload = useMemo(
    () =>
      workspace.profile.skills.map((skill) => ({
        name: skill.name,
        proficiency: skill.proficiency,
        lexiconId: skill.lexiconId,
      })),
    [workspace.profile.skills],
  );

  const analyse = async () => {
    if (skillPayload.length === 0) {
      toast.error('No skills recorded', 'The extension analyses a short skill list. Add skills to your profile first.');
      return;
    }
    setBusy(true);
    try {
      if (status === 'online') {
        const response = await api.extensionAnalyze({
          jobText: advertText,
          jobTitle: advertTitle,
          company: advertCompany,
          skills: skillPayload,
        });
        if (response.ok) {
          setResult({ ...response.data, origin: 'api' });
          toast.success('Analysed through the API', 'This is the same endpoint a real extension would call.');
          return;
        }
        toast.warning('API request failed', `${response.error} Computing the same result in your browser instead.`);
      }

      const job = createJobDescription({ title: advertTitle, company: advertCompany, rawText: advertText });
      const profile = emptyProfile();
      profile.skills = skillPayload.map((skill) => {
        const resolved = resolveSkillLabel(skill.name);
        return {
          id: makeId('skill', skill.name),
          name: resolved?.name ?? skill.name,
          category: resolved?.category ?? 'Other',
          lexiconId: resolved?.id,
          proficiency: skill.proficiency,
          evidence: [{ source: 'self-reported' as const, detail: 'Sent by the extension from the saved workspace' }],
          origin: 'user' as const,
          updatedAt: new Date().toISOString(),
        };
      });
      const report: MatchReport = computeMatch({ profile, job });
      setResult({
        score: report.score,
        grade: report.grade,
        matched: report.matches.filter((match) => match.matchStatus === 'confirmed').map((match) => ({ label: match.label, status: match.matchStatus })),
        partial: report.matches.filter((match) => match.matchStatus === 'partial').map((match) => ({ label: match.label, status: match.matchStatus })),
        missing: report.matches
          .filter((match) => match.matchStatus === 'missing' || match.matchStatus === 'insufficient')
          .map((match) => ({ label: match.label, status: match.matchStatus })),
        topReasons: report.matches.slice(0, 5).map((match) => ({ label: match.label, explanation: match.explanation })),
        disclaimer: report.disclaimer,
        origin: 'browser',
      });
      toast.success('Analysed in the browser', 'Identical engine, no server needed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Browser Extension Preview"
        description="This page shows how the CareerLens assistant would work on a job board. It's a preview running inside the website, not an installed browser extension."
        action={
          <>
            <Badge tone="caution">Preview only</Badge>
            <SourceBadge source={result?.origin === 'api' ? 'local' : 'local'} reason="Analysed by the matching engine" />
          </>
        }
      />

      <div className="rounded-xl border border-caution/40 bg-caution-soft p-3.5 text-[11px] leading-relaxed text-caution">
        No Chrome extension has actually been built or installed. The analysis engine and the API contract it would use are real, but the popup, the
        content script and the packaging are not. Build steps are listed at the bottom of this page.
      </div>

      <Card>
        <CardHeader
          title="Pick the page content to analyse"
          icon={<Puzzle aria-hidden className="h-4 w-4" />}
          description="A real extension would read the advert from the current tab only after you click it, never from other pages."
          action={
            <Button size="sm" onClick={() => void analyse()} loading={busy} icon={<Sparkles aria-hidden className="h-3.5 w-3.5" />}>
              Analyse this page
            </Button>
          }
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="advert-select">
              Advert to display
            </label>
            <Select id="advert-select" value={jobId} onChange={(event) => setJobId(event.target.value)}>
              {workspace.jobs.length === 0 ? <option value="">Sample advert (built in)</option> : null}
              {workspace.jobs.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} — {item.company}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <p className="text-[11px] leading-relaxed text-brand/60">
              {skillPayload.length} skills would be sent, each as a name and proficiency only. Never your full profile.
            </p>
          </div>
        </div>
      </Card>

      <div className="overflow-hidden rounded-2xl border border-ink-600 bg-ink-800 shadow-card">
        <div className="flex items-center gap-3 border-b border-ink-600 bg-ink-900 px-4 py-2.5">
          <span className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-danger/70" />
            <span className="h-3 w-3 rounded-full bg-caution/70" />
            <span className="h-3 w-3 rounded-full bg-success/70" />
          </span>
          <span className="flex flex-1 items-center gap-2 truncate rounded-full border border-ink-600 bg-ink-800 px-3 py-1 text-[11px] text-brand/70">
            <Lock aria-hidden className="h-3 w-3" />
            https://jobs.example.com/view/frontend-engineer/sample
          </span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[11px] font-extrabold text-ink">C</span>
        </div>

        <div className="grid lg:grid-cols-[1.6fr_1fr]">
          <div className="max-h-[34rem] overflow-y-auto border-b border-ink-600 p-5 scrollbar-thin lg:border-b-0 lg:border-r">
            <h2 className="text-lg font-extrabold text-brand">{advertTitle}</h2>
            <p className="mt-0.5 text-xs text-brand/70">
              {advertCompany} · sample page content
            </p>
            <pre className="mt-4 whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-brand/80">{advertText}</pre>
          </div>

          <aside className="bg-ink-850 p-4">
            <div className="flex items-center gap-2 border-b border-ink-600 pb-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand text-[11px] font-extrabold text-ink">C</span>
              <span className="text-xs font-bold text-brand">CareerLens Insights</span>
            </div>

            {result ? (
              <div className="mt-3 space-y-3">
                <div className="rounded-xl border border-ink-600 bg-ink-900 p-3">
                  <ScoreRing score={result.score} size={112} />
                  <p className="mt-1 text-center text-xs font-bold text-brand">{result.grade}</p>
                  <p className="mt-1 text-center text-[10px] text-brand/50">
                    computed {result.origin === 'api' ? 'through the API endpoint' : 'in the browser'}
                  </p>
                </div>

                {[
                  { title: 'Matching skills', items: result.matched, tone: 'success' as const },
                  { title: 'Partial evidence', items: result.partial, tone: 'brand' as const },
                  { title: 'Missing evidence', items: result.missing, tone: 'danger' as const },
                ].map((group) => (
                  <div key={group.title}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand/55">
                      {group.title} ({group.items.length})
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {group.items.length ? (
                        group.items.map((item) => (
                          <Badge key={item.label} tone={group.tone}>
                            {item.label}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-[10px] text-brand/40">none</span>
                      )}
                    </div>
                  </div>
                ))}

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand/55">Why</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {result.topReasons.slice(0, 3).map((reason) => (
                      <li key={reason.label} className="text-[10px] leading-relaxed text-brand/70">
                        · {reason.explanation}
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="text-[10px] leading-relaxed text-brand/45">{result.disclaimer}</p>
              </div>
            ) : (
              <div className="mt-3">
                <EmptyState
                  title="Nothing analysed yet"
                  description="Choose an advert and press “Analyse this page” to see what the assistant would show. It runs the real engine."
                />
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-ink-600 pt-3">
              {['Tailor resume', 'Cover letter', 'Skill gaps'].map((action) => (
                <span key={action} className="cursor-not-allowed rounded-lg border border-ink-600 bg-ink-900 px-2 py-1 text-[10px] text-brand/40" title="Available in the website, not in this preview">
                  {action}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-brand/40">
              Those actions are disabled here and only shown for layout. The real versions live in Resume Studio, the cover letter page and Skill Gaps.
            </p>
          </aside>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="The API contract it would use"
            icon={<Terminal aria-hidden className="h-4 w-4" />}
            description="A real extension would call this endpoint with a small payload."
          />
          <pre className="mt-4 overflow-auto rounded-xl border border-ink-600 bg-ink-900 p-3 font-mono text-[10px] leading-relaxed text-brand/75 scrollbar-thin">
{`POST /api/extension/analyze
Content-Type: application/json

{
  "jobText": "<selected advert text>",
  "jobTitle": "Junior Frontend Engineer",
  "company": "Northwind Labs",
  "skills": [
    { "name": "React", "proficiency": "advanced" },
    { "name": "TypeScript", "proficiency": "intermediate" }
  ]
}

200 OK
{
  "score": 62,
  "grade": "Developing fit",
  "counts": { "total": 12, "confirmed": 7, ... },
  "matched": [ { "label": "React", "status": "confirmed" } ],
  "partial": [ { "label": "TypeScript", "status": "partial" } ],
  "missing": [ { "label": "Docker", "status": "missing" } ],
  "topReasons": [ { "label": "React", "explanation": "..." } ],
  "disclaimer": "..."
}`}
          </pre>
          <p className="mt-3 text-[11px] leading-relaxed text-brand/60">
            The endpoint takes a skill subset only, so it can't be used to pull a whole workspace. Rate limits apply per client
            address and errors come back as short, safe messages.
          </p>
        </Card>

        <Card>
          <CardHeader
            title="What a real extension would need"
            icon={<ShieldCheck aria-hidden className="h-4 w-4" />}
            description="Separate work that still needs doing."
          />
          <ol className="mt-4 space-y-2 text-[11px] leading-relaxed text-brand/75">
            <li>1. A Manifest V3 package with a popup page and a content script that only reads the page after the user clicks the extension.</li>
            <li>2. Minimal permissions: <span className="font-mono">activeTab</span> and <span className="font-mono">scripting</span>. No host permissions for unrelated sites, no background scraping.</li>
            <li>3. User-triggered extraction of the selected advert text, then a POST to the same <span className="font-mono">/api/extension/analyze</span> endpoint.</li>
            <li>4. Rendering of matched, partial and missing requirements with the same explanations shown above.</li>
            <li>5. Graceful failure: a clear message and a retry when the API is unreachable, never a blank popup.</li>
            <li>6. No API key in extension code. The backend holds credentials, and the popup only talks to the configured API origin.</li>
          </ol>
          {selectedJob ? (
            <p className="mt-3 text-[11px] text-brand/55">
              Currently previewing with your analysed advert “{selectedJob.title}”. Match statuses are{' '}
              {matchStatusLabel('confirmed').toLowerCase()}, {matchStatusLabel('partial').toLowerCase()} and{' '}
              {matchStatusLabel('missing').toLowerCase()}. Tone key: {matchStatusTone('confirmed')}.
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
