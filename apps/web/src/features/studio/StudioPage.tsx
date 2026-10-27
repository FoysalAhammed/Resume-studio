import { useMemo, useState } from 'react';
import { ArrowRight, Check, Copy, Download, FileText, PenLine, Printer, Sparkles, Wand2 } from 'lucide-react';
import {
  buildTailoredExperience,
  diffWords,
  draftResumeText,
  improveBullet,
  improveProject,
  improveSummary,
  type ExperienceEntry,
  type ImprovementSuggestion,
  type JobDescription,
  type ProjectEntry,
} from '@careerlens/core';
import { useWorkspace } from '../../state/WorkspaceProvider';
import { useApiStatus } from '../../state/ApiStatusProvider';
import { useToast } from '../../components/ui/Toast';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  PageHeader,
  Select,
  SourceBadge,
} from '../../components/ui/primitives';
import { api } from '../../lib/api';
import { copyToClipboard, downloadText, printTextDocument } from '../../lib/download';
import { classNames } from '../../lib/format';

interface StudioItem {
  id: string;
  kind: ImprovementSuggestion['kind'];
  label: string;
  context: string;
  suggestion: ImprovementSuggestion;
  apply: (revised: string) => void;
}

export default function StudioPage() {
  const { workspace, dispatch, updateProfile } = useWorkspace();
  const { aiAvailable } = useApiStatus();
  const toast = useToast();

  const [jobId, setJobId] = useState(workspace.jobs[0]?.id ?? '');
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiOverrides, setAiOverrides] = useState<Record<string, ImprovementSuggestion>>({});

  const profile = workspace.profile;
  const job: JobDescription | undefined = workspace.jobs.find((item) => item.id === jobId);

  const items = useMemo<StudioItem[]>(() => {
    const result: StudioItem[] = [];

    result.push({
      id: 'summary',
      kind: 'summary',
      label: 'Professional summary',
      context: 'The first two lines a reviewer reads.',
      suggestion: improveSummary(profile, job),
      apply: (revised) => updateProfile({ summary: revised }, { kind: 'profile-updated', message: 'Applied an improved professional summary.' }),
    });

    profile.experience.forEach((entry: ExperienceEntry) => {
      if (entry.summary) {
        result.push({
          id: `${entry.id}-summary`,
          kind: 'experience',
          label: `${entry.title} · role description`,
          context: `${entry.company}`,
          suggestion: improveBullet(entry.summary, 'experience', { job, profile }),
          apply: (revised) =>
            dispatch({
              type: 'upsert-collection',
              collection: 'experience',
              item: { ...entry, summary: revised },
              activity: { kind: 'profile-updated', message: `Improved the description for ${entry.title}.` },
            }),
        });
      }
      entry.achievements.forEach((achievement, index) => {
        result.push({
          id: `${entry.id}-achievement-${index}`,
          kind: 'experience',
          label: `${entry.title} · achievement ${index + 1}`,
          context: `${entry.company}`,
          suggestion: improveBullet(achievement, 'experience', { job, profile }),
          apply: (revised) =>
            dispatch({
              type: 'upsert-collection',
              collection: 'experience',
              item: { ...entry, achievements: entry.achievements.map((item, i) => (i === index ? revised : item)) },
              activity: { kind: 'profile-updated', message: `Improved an achievement bullet for ${entry.title}.` },
            }),
        });
      });
    });

    profile.projects.forEach((project: ProjectEntry) => {
      result.push({
        id: `${project.id}-project`,
        kind: 'project',
        label: project.name,
        context: project.technologies.join(', ') || 'No technologies listed',
        suggestion: improveProject(project, job),
        apply: (revised) =>
          dispatch({
            type: 'upsert-collection',
            collection: 'projects',
            item: { ...project, description: revised },
            activity: { kind: 'profile-updated', message: `Improved the description of ${project.name}.` },
          }),
      });
    });

    return result;
  }, [profile, job, dispatch, updateProfile]);

  const tailored = useMemo(
    () => (job ? buildTailoredExperience(profile, job) : []),
    [profile, job],
  );
  const exportText = useMemo(() => draftResumeText(profile, job), [profile, job]);

  const runAiRewrite = async (item: StudioItem) => {
    setAiBusy(item.id);
    try {
      const response = await api.improve({
        profile,
        text: item.suggestion.original,
        kind: item.kind,
        job,
        useAi: true,
      });
      if (response.ok) {
        setAiOverrides((current) => ({ ...current, [item.id]: { ...item.suggestion, ...response.data.suggestion } }));
        toast.success('AI rewrite ready', response.data.ai.used ? 'Review it before applying.' : response.data.ai.reason);
      } else {
        toast.error('AI rewrite failed', response.error);
      }
    } finally {
      setAiBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resume Studio"
        description="Rewrites are suggestions, never silent edits. Each one shows the original, the draft and the reason for the change, and you decide whether to apply it to your profile. Nothing is invented: when a result needs a figure, the studio asks you for it."
        action={
          <>
            <SourceBadge source={Object.keys(aiOverrides).length ? 'ai' : 'local'} reason="Deterministic rewrite templates unless you request an AI rewrite" />
            <Badge tone="neutral">{items.length} sections</Badge>
          </>
        }
      />

      <Card>
        <CardHeader
          title="Tailor to an advert (optional)"
          icon={<Sparkles aria-hidden className="h-4 w-4" />}
          description="Choosing an advert aligns the rewrites with its wording and reorders your experience bullets by relevance. It never adds a technology you have not recorded."
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Target advert">
            <Select value={jobId} onChange={(event) => setJobId(event.target.value)}>
              <option value="">No advert — generic improvements</option>
              {workspace.jobs.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} — {item.company}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <p className="text-[11px] leading-relaxed text-brand/60">
              {job
                ? `Aligning with ${job.title}: ${job.requirements.length} extracted requirements are used as keyword guidance only.`
                : 'Without an advert the studio applies general CV writing rules.'}
            </p>
          </div>
        </div>
      </Card>

      {items.length === 0 ? (
        <EmptyState
          icon={<PenLine aria-hidden className="h-8 w-8" />}
          title="Nothing to rewrite yet"
          description="Import a CV or add experience and projects to your profile, then the studio can propose stronger wording for each section."
        />
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const active = aiOverrides[item.id] ?? item.suggestion;
            const segments = diffWords(active.original, active.revised);
            return (
              <Card key={item.id}>
                <CardHeader
                  title={item.label}
                  icon={<PenLine aria-hidden className="h-4 w-4" />}
                  description={item.context}
                  action={
                    <>
                      <Badge tone="neutral">{item.kind}</Badge>
                      {aiOverrides[item.id] ? <SourceBadge source="ai" /> : <SourceBadge source="local" />}
                    </>
                  }
                />

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-ink-600 bg-ink-850 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand/55">Original</p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-brand/75">{active.original}</p>
                  </div>
                  <div className="rounded-xl border border-brand/40 bg-brand-soft p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand/70">Draft (review before using)</p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-brand">{active.revised}</p>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-ink-600 bg-ink-900/40 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand/55">Word level comparison</p>
                  <p className="mt-1.5 text-[11px] leading-relaxed">
                    {segments.map((segment, index) => (
                      <span
                        key={index}
                        className={classNames(
                          segment.type === 'added' && 'rounded bg-success-soft px-0.5 text-success',
                          segment.type === 'removed' && 'rounded bg-danger-soft px-0.5 text-danger line-through',
                          segment.type === 'same' && 'text-brand/70',
                        )}
                      >
                        {segment.value}{' '}
                      </span>
                    ))}
                  </p>
                </div>

                <p className="mt-3 text-[11px] leading-relaxed text-brand/70">
                  <span className="font-semibold text-brand">Why: </span>
                  {active.rationale}
                </p>

                {active.needsUserInput && active.promptFor ? (
                  <p className="mt-2 rounded-xl border border-caution/40 bg-caution-soft p-3 text-[11px] leading-relaxed text-caution">
                    The studio needs information from you: {active.promptFor}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      item.apply(active.revised);
                      toast.success('Applied to your profile', 'The original wording is replaced in your saved profile. You can edit it again at any time.');
                    }}
                    icon={<Check aria-hidden className="h-3.5 w-3.5" />}
                  >
                    Apply to profile
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Copy aria-hidden className="h-3.5 w-3.5" />}
                    onClick={() =>
                      void copyToClipboard(active.revised).then((ok) =>
                        ok ? toast.success('Copied', 'The draft is on your clipboard.') : toast.error('Copy failed', 'Select the text manually instead.'),
                      )
                    }
                  >
                    Copy draft
                  </Button>
                  {aiAvailable ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={aiBusy === item.id}
                      onClick={() => void runAiRewrite(item)}
                      icon={<Wand2 aria-hidden className="h-3.5 w-3.5" />}
                    >
                      Rewrite with AI
                    </Button>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader
          title="Tailored experience order"
          icon={<ArrowRight aria-hidden className="h-4 w-4" />}
          description="When an advert is selected, achievements containing its keywords are listed first. The wording itself is unchanged."
        />
        {tailored.length ? (
          <div className="mt-4 space-y-4">
            {tailored.map((entry) => (
              <div key={`${entry.title}-${entry.company}`} className="rounded-xl border border-ink-600 bg-ink-850 p-3.5">
                <p className="text-xs font-bold text-brand">
                  {entry.title} · <span className="font-semibold text-brand/80">{entry.company}</span>
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-brand/75">
                  {entry.bullets.map((bullet, index) => (
                    <li key={index}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-[11px] text-brand/60">No experience entries recorded yet.</p>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Export a clean resume"
          icon={<FileText aria-hidden className="h-4 w-4" />}
          description="Assembled from your recorded profile data only, with no invented metrics. Print to PDF, or download as plain text."
          action={
            <>
              <Button
                size="sm"
                variant="secondary"
                icon={<Copy aria-hidden className="h-3.5 w-3.5" />}
                onClick={() =>
                  void copyToClipboard(exportText).then((ok) =>
                    ok ? toast.success('Copied', 'The full resume text is on your clipboard.') : toast.error('Copy failed', 'Try downloading the file instead.'),
                  )
                }
              >
                Copy
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={<Download aria-hidden className="h-3.5 w-3.5" />}
                onClick={() => {
                  downloadText(`${(profile.displayName || 'careerlens').replace(/\s+/g, '-').toLowerCase()}-resume.txt`, exportText);
                  toast.success('Downloaded', 'Saved as a plain text file.');
                }}
              >
                Download .txt
              </Button>
              <Button
                size="sm"
                icon={<Printer aria-hidden className="h-3.5 w-3.5" />}
                onClick={() => {
                  if (!printTextDocument('CareerLens resume', exportText)) {
                    toast.error('Pop-up blocked', 'Allow pop-ups for this site to print or save as PDF.');
                  }
                }}
              >
                Print / Save as PDF
              </Button>
            </>
          }
        />
        <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-ink-600 bg-ink-900 p-4 font-mono text-[11px] leading-relaxed text-brand/75 scrollbar-thin">
          {exportText}
        </pre>
        <p className="mt-3 text-[11px] leading-relaxed text-brand/55">
          DOCX export is not implemented in this build: it needs a document generation library rather than a text dump. It is listed as future work
          in docs/LIMITATIONS.md.
        </p>
      </Card>
    </div>
  );
}
