import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Briefcase, FileText, Plus, Sparkles, Trash2 } from 'lucide-react';
import {
  computeMatch,
  createJobDescription,
  jobAnalyzeRequestSchema,
  SAMPLE_JOBS,
  type ExperienceLevel,
} from '@careerlens/core';
import { useWorkspace } from '../../state/WorkspaceProvider';
import { useApiStatus } from '../../state/ApiStatusProvider';
import { useToast } from '../../components/ui/Toast';
import { Badge, Button, Card, CardHeader, Checkbox, EmptyState, Field, Input, PageHeader, Select, SourceBadge, Textarea } from '../../components/ui/primitives';
import { ConfirmDialog } from '../../components/ui/Modal';
import { api } from '../../lib/api';
import { formatDateTime, matchStatusTone } from '../../lib/format';

export default function JobExplorerPage() {
  const { workspace, dispatch } = useWorkspace();
  const { aiAvailable } = useApiStatus();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '',
    company: '',
    location: '',
    experienceLevel: '' as ExperienceLevel | '',
    sourceUrl: '',
    rawText: '',
  });
  const [useAi, setUseAi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const scores = useMemo(() => {
    const map = new Map<string, number>();
    for (const job of workspace.jobs) {
      const report = workspace.matches.find((match) => match.jobId === job.id) ?? computeMatch({ profile: workspace.profile, job });
      map.set(job.id, report.score);
    }
    return map;
  }, [workspace.jobs, workspace.matches, workspace.profile]);

  const submit = async () => {
    setFormError(null);
    const parsed = jobAnalyzeRequestSchema.safeParse({
      title: form.title || undefined,
      company: form.company || undefined,
      location: form.location || undefined,
      experienceLevel: form.experienceLevel || undefined,
      sourceUrl: form.sourceUrl || undefined,
      rawText: form.rawText,
      useAi: useAi && aiAvailable,
    });

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Check the advert text and try again.';
      setFormError(message);
      toast.error('The advert could not be analysed', message);
      return;
    }

    setBusy(true);
    try {
      if (useAi && aiAvailable) {
        const response = await api.analyzeJob(parsed.data);
        if (response.ok) {
          dispatch({
            type: 'upsert-job',
            job: response.data.job,
            activity: { kind: 'job-analysed', message: `Analysed ${response.data.job.title} with AI-assisted extraction (${response.data.job.requirements.length} criteria).` },
          });
          toast.success('Advert analysed with AI assistance', `${response.data.job.requirements.length} requirements extracted.`);
          navigate(`/jobs/${response.data.job.id}`);
          return;
        }
        toast.warning('AI extraction unavailable', `${response.error} The deterministic extractor was used instead.`);
      }

      const job = createJobDescription({
        title: form.title || undefined,
        company: form.company || undefined,
        location: form.location || undefined,
        experienceLevel: form.experienceLevel || undefined,
        sourceUrl: form.sourceUrl || undefined,
        rawText: form.rawText,
      });
      dispatch({
        type: 'upsert-job',
        job,
        activity: { kind: 'job-analysed', message: `Analysed ${job.title}: ${job.requirements.length} requirements extracted by rule-based matching.` },
      });
      toast.success('Advert analysed', `${job.requirements.length} requirements extracted. Review the list and correct anything that looks wrong.`);
      navigate(`/jobs/${job.id}`);
    } finally {
      setBusy(false);
    }
  };

  const fillSample = (description: string, label: string) => {
    const creditLine = description.split('\n').slice(0, 2).join(' ').trim();
    const companyMatch = description.match(/^(.+?)\s*-\s*(.+)$/m);
    setForm({
      title: label,
      company: companyMatch?.[2]?.split('(')[0]?.trim() ?? '',
      location: companyMatch?.[2]?.match(/\(([^)]+)\)/)?.[1] ?? '',
      experienceLevel: '',
      sourceUrl: '',
      rawText: description,
    });
    setFormError(null);
    toast.info('Sample advert loaded', `${creditLine} — paste over it with a real advert whenever you like.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job Explorer"
        description="Paste a job advert and CareerLens extracts its requirements with deterministic keyword and pattern rules, then scores each one against your recorded evidence. Adverts are stored in this browser so you can compare roles."
        action={<Badge tone="neutral">{workspace.jobs.length} saved</Badge>}
      />

      <Card>
        <CardHeader
          title="Analyse an advert"
          icon={<Plus aria-hidden className="h-4 w-4" />}
          description="Nothing is scraped from the web: you paste the text of an advert you already have. That keeps the source of every requirement auditable."
          action={<SourceBadge source={useAi && aiAvailable ? 'ai' : 'local'} />}
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand/55">Try a sample advert:</span>
          {SAMPLE_JOBS.map((sample) => (
            <Button key={sample.label} size="sm" variant="ghost" onClick={() => fillSample(sample.description, sample.label)}>
              <FileText aria-hidden className="h-3.5 w-3.5" /> {sample.label}
            </Button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Job title" hint="Optional — inferred from the advert if left blank.">
            <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Junior Frontend Engineer" />
          </Field>
          <Field label="Company">
            <Input value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} placeholder="Northwind Labs" />
          </Field>
          <Field label="Location">
            <Input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Manchester, UK (Hybrid)" />
          </Field>
          <Field label="Experience level">
            <Select value={form.experienceLevel} onChange={(event) => setForm({ ...form, experienceLevel: event.target.value as ExperienceLevel | '' })}>
              <option value="">Not specified</option>
              <option value="student">Student / intern</option>
              <option value="entry">Entry level</option>
              <option value="mid">Mid level</option>
              <option value="senior">Senior</option>
            </Select>
          </Field>
          <Field label="Advert URL" hint="Stored for your reference only — CareerLens never fetches it." className="sm:col-span-2">
            <Input value={form.sourceUrl} onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })} placeholder="https://…" />
          </Field>
        </div>

        <Field
          label="Job description text"
          className="mt-4"
          hint={`At least 40 characters. Up to ${30000} characters are stored.`}
          error={formError ?? undefined}
        >
          <Textarea
            rows={9}
            value={form.rawText}
            invalid={Boolean(formError)}
            onChange={(event) => setForm({ ...form, rawText: event.target.value })}
            placeholder="Paste the full advert here, including the requirements section…"
          />
        </Field>

        {aiAvailable ? (
          <div className="mt-4">
            <Checkbox
              label="Refine the extracted requirements with the configured AI provider"
              description="The AI reviews the advert and may recategorise or add criteria. Its output is validated against a schema before use, and rule-based extraction runs first either way."
              checked={useAi}
              onChange={(event) => setUseAi(event.target.checked)}
            />
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-ink-600 bg-ink-850 p-3 text-[11px] leading-relaxed text-brand/60">
            No AI provider is configured, so requirements are extracted with the deterministic rule-based analyser. That analyser is what runs by
            default in every configuration; adding an AI provider only refines its output. See docs/API.md for the provider setup.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={() => void submit()} loading={busy} icon={<Sparkles aria-hidden className="h-4 w-4" />}>
            Extract requirements
          </Button>
          <span className="text-[11px] text-brand/55">{form.rawText.trim().length} characters</span>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Saved adverts"
          icon={<Briefcase aria-hidden className="h-4 w-4" />}
          description="Scores shown here are recomputed from your current profile, so they stay consistent with the job detail page."
        />
        {workspace.jobs.length ? (
          <ul className="mt-4 space-y-2.5">
            {workspace.jobs.map((job) => {
              const score = scores.get(job.id) ?? 0;
              return (
                <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-600 bg-ink-850 p-3.5">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-brand">
                      <Link to={`/jobs/${job.id}`} className="hover:underline">
                        {job.title}
                      </Link>
                      {job.origin === 'sample' ? <Badge tone="caution">demo</Badge> : null}
                      <Badge tone={job.extraction.method === 'ai' ? 'brand' : 'neutral'}>
                        {job.extraction.method === 'ai' ? 'AI-assisted extraction' : 'rule-based extraction'}
                      </Badge>
                    </p>
                    <p className="mt-0.5 text-[11px] text-brand/60">
                      {job.company} · {job.location} · {job.requirements.length} requirements · added {formatDateTime(job.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={matchStatusTone(score >= 85 ? 'confirmed' : score >= 40 ? 'partial' : 'missing')}>{score}% match</Badge>
                    <Link
                      to={`/jobs/${job.id}`}
                      className="rounded-xl border border-ink-600 bg-ink-700 px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-ink-600"
                    >
                      Open
                    </Link>
                    <button
                      type="button"
                      onClick={() => setPendingRemoval(job.id)}
                      aria-label={`Delete ${job.title}`}
                      className="rounded-lg p-1.5 text-danger/80 transition-colors hover:bg-danger-soft"
                    >
                      <Trash2 aria-hidden className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-4">
            <EmptyState
              icon={<Briefcase aria-hidden className="h-8 w-8" />}
              title="No adverts analysed yet"
              description="Paste an advert above, or load one of the sample adverts to see how requirement extraction and scoring behave."
            />
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(pendingRemoval)}
        title="Delete this advert?"
        message="The advert, its compatibility report and any roadmap generated from it will be removed from this browser. This cannot be undone."
        confirmLabel="Delete advert"
        onCancel={() => setPendingRemoval(null)}
        onConfirm={() => {
          if (pendingRemoval) {
            dispatch({ type: 'remove-job', id: pendingRemoval, activity: { kind: 'job-analysed', message: 'Deleted an analysed advert.' } });
            toast.info('Advert deleted');
          }
          setPendingRemoval(null);
        }}
      />
    </div>
  );
}
