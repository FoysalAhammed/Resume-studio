import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  FileText,
  Info,
  ListChecks,
  Pencil,
  Route as RouteIcon,
  Save,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react';
import {
  generateRoadmap,
  makeId,
  preserveTaskState,
  resolveSkillLabel,
  type JobRequirement,
  type RequirementStatus,
} from '@careerlens/core';
import { useWorkspace } from '../../state/WorkspaceProvider';
import { useJobAnalysis } from '../../hooks/useJobAnalysis';
import { useToast } from '../../components/ui/Toast';
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select, SourceBadge } from '../../components/ui/primitives';
import { Tabs } from '../../components/ui/Tabs';
import { MatchBreakdownChart, ScoreRing } from '../../components/charts/Charts';
import { GapList, GapSummary } from '../gaps/GapList';
import { matchStatusLabel, matchStatusTone, TONE_CLASSES } from '../../lib/format';

type TabId = 'overview' | 'match' | 'gaps' | 'requirements' | 'text';

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { workspace, dispatch } = useWorkspace();
  const toast = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>('overview');
  const [newRequirement, setNewRequirement] = useState('');

  const job = workspace.jobs.find((item) => item.id === jobId);
  const analysis = useJobAnalysis(job);

  const existingRoadmap = useMemo(() => workspace.roadmaps.find((roadmap) => roadmap.jobId === job?.id), [workspace.roadmaps, job?.id]);

  if (!job) {
    return (
      <div className="space-y-6">
        <PageHeader title="Advert not found" description="This advert is no longer in your workspace." />
        <EmptyState
          icon={<Briefcase aria-hidden className="h-8 w-8" />}
          title="Nothing to show"
          description="It may have been deleted. Choose another advert from the Job Explorer."
          action={
            <Link to="/jobs" className="rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-ink transition-colors hover:bg-brand-hover">
              Back to Job Explorer
            </Link>
          }
        />
      </div>
    );
  }

  const report = analysis?.report;
  const gaps = analysis?.gaps ?? [];

  const updateRequirements = (requirements: JobRequirement[], message: string) => {
    dispatch({
      type: 'upsert-job',
      job: { ...job, requirements, updatedAt: new Date().toISOString() },
      activity: { kind: 'job-analysed', message },
    });
  };

  const toggleStatus = (requirement: JobRequirement) => {
    const next: RequirementStatus = requirement.status === 'required' ? 'preferred' : 'required';
    updateRequirements(
      job.requirements.map((item) => (item.id === requirement.id ? { ...item, status: next, editedByUser: true } : item)),
      `Marked ${requirement.label} as ${next} in ${job.title}.`,
    );
    toast.info(`${requirement.label} is now ${next}`, 'The compatibility score was recalculated with the new weighting.');
  };

  const removeRequirement = (requirement: JobRequirement) => {
    updateRequirements(
      job.requirements.filter((item) => item.id !== requirement.id),
      `Removed the requirement ${requirement.label} from ${job.title}.`,
    );
    toast.info('Requirement removed');
  };

  const addRequirement = () => {
    const label = newRequirement.trim();
    if (!label) return;
    const resolved = resolveSkillLabel(label);
    const requirement: JobRequirement = {
      id: makeId('req', `${job.id}:${label}:${job.requirements.length}`),
      skillId: resolved?.id,
      label: resolved?.name ?? label,
      category: resolved?.category,
      status: 'required',
      weight: 3,
      emphasis: 1,
      learnHours: resolved?.learnHours,
      editedByUser: true,
    };
    updateRequirements([...job.requirements, requirement], `Added the requirement ${requirement.label} to ${job.title}.`);
    setNewRequirement('');
    toast.success('Requirement added', 'The report now includes it.');
  };

  const buildRoadmap = () => {
    if (!report) return;
    const generated = generateRoadmap({
      targetRole: job.title,
      jobId: job.id,
      profile: workspace.profile,
      gaps,
      weeklyHours: workspace.profile.weeklyLearningHours,
      horizonWeeks: workspace.settings.defaultHorizonWeeks,
    });
    const roadmap = preserveTaskState(existingRoadmap, generated);
    dispatch({
      type: 'save-roadmap',
      roadmap,
      activity: {
        kind: 'roadmap-generated',
        message: `${existingRoadmap ? 'Recalculated' : 'Generated'} a ${roadmap.tasks.length} task roadmap for ${job.title}.`,
      },
    });
    toast.success(existingRoadmap ? 'Roadmap recalculated' : 'Roadmap generated', 'Progress on matching tasks was preserved.');
    navigate('/roadmap');
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/jobs" className="link inline-flex items-center gap-1.5 text-[11px] font-semibold">
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> All adverts
        </Link>
      </div>

      <PageHeader
        title={job.title}
        description={`${job.company} · ${job.location}${job.experienceLevel ? ` · ${job.experienceLevel} level` : ''}`}
        action={
          <>
            <Badge tone={job.extraction.method === 'ai' ? 'brand' : 'neutral'}>
              {job.extraction.method === 'ai' ? 'AI-assisted extraction' : 'Rule-based extraction'}
            </Badge>
            {job.origin === 'sample' ? <Badge tone="caution">Demonstration data</Badge> : null}
            <Button size="sm" variant="secondary" onClick={buildRoadmap} icon={<RouteIcon aria-hidden className="h-3.5 w-3.5" />}>
              {existingRoadmap ? 'Recalculate roadmap' : 'Generate roadmap'}
            </Button>
          </>
        }
      />

      <Tabs<TabId>
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview', icon: <Info aria-hidden className="h-3.5 w-3.5" /> },
          { id: 'match', label: 'Compatibility report', icon: <Target aria-hidden className="h-3.5 w-3.5" />, badge: report ? <span className="ml-1 font-extrabold">{report.score}%</span> : null },
          { id: 'gaps', label: 'Skill gaps', icon: <ListChecks aria-hidden className="h-3.5 w-3.5" />, badge: gaps.length ? <span className="ml-1 font-extrabold">{gaps.length}</span> : null },
          { id: 'requirements', label: 'Edit requirements', icon: <Pencil aria-hidden className="h-3.5 w-3.5" /> },
          { id: 'text', label: 'Advert text', icon: <FileText aria-hidden className="h-3.5 w-3.5" /> },
        ]}
      />

      {tab === 'overview' ? (
        <div className="space-y-6">
          {report ? (
            <Card>
              <CardHeader
                title="Compatibility at a glance"
                icon={<Target aria-hidden className="h-4 w-4" />}
                description={`Engine v${report.engineVersion} · recomputed from your current profile. The same inputs always produce this score.`}
              />
              <div className="mt-4 flex flex-wrap items-center gap-6">
                <ScoreRing score={report.score} grade={report.grade} />
                <dl className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    { label: 'Requirements', value: report.counts.total, tone: 'brand' as const },
                    { label: 'Confirmed', value: report.counts.confirmed, tone: 'success' as const },
                    { label: 'Partial', value: report.counts.partial, tone: 'brand' as const },
                    { label: 'No evidence', value: report.counts.missing, tone: 'danger' as const },
                    { label: 'Required met', value: `${report.counts.requiredSatisfied}/${report.counts.requiredTotal}`, tone: 'brand' as const },
                    { label: 'Open gaps', value: gaps.length, tone: 'caution' as const },
                  ].map((item) => (
                    <div key={item.label} className="min-w-0 rounded-xl border border-ink-600 bg-ink-850 p-3">
                      <dt className="break-words text-[10px] font-bold leading-tight tracking-wide text-brand/55">{item.label}</dt>
                      <dd className={`mt-0.5 text-lg font-extrabold ${TONE_CLASSES[item.tone].text}`}>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <p className="mt-3 text-[10px] leading-relaxed text-brand/45">{report.disclaimer}</p>
            </Card>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="What the advert asks for" description="Structured summary extracted from the text." />
              <dl className="mt-4 space-y-3 text-xs">
                <div className="flex justify-between gap-3 border-b border-ink-600/40 pb-2">
                  <dt className="text-brand/55">Experience required</dt>
                  <dd className="text-right font-semibold text-brand">{job.experienceRequirement ? job.experienceRequirement.text : 'Not stated'}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-ink-600/40 pb-2">
                  <dt className="text-brand/55">Education</dt>
                  <dd className="text-right font-semibold text-brand">{job.educationRequirement}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-brand/55">Requirements detected</dt>
                  <dd className="text-right font-semibold text-brand">
                    {job.requirements.filter((requirement) => requirement.status === 'required').length} required ·{' '}
                    {job.requirements.filter((requirement) => requirement.status === 'preferred').length} preferred
                  </dd>
                </div>
              </dl>
              {job.responsibilities.length ? (
                <div className="mt-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand/55">Responsibilities detected</p>
                  <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-brand/75">
                    {job.responsibilities.map((item, index) => (
                      <li key={index}>· {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>

            <Card>
              <CardHeader title="How this was extracted" description="Provenance for everything shown on this page." action={<SourceBadge source={job.extraction.method === 'ai' ? 'ai' : 'local'} />} />
              <ul className="mt-4 space-y-2">
                {job.extraction.notes.map((note, index) => (
                  <li key={index} className="flex items-start gap-2 text-[11px] leading-relaxed text-brand/70">
                    <BadgeCheck aria-hidden className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand/60" />
                    {note}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[11px] leading-relaxed text-brand/55">
                Requirement extraction is keyword and pattern based. Always check the list — a tool mentioned in an unusual way can be missed, and you
                can correct it in the “Edit requirements” tab.
              </p>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === 'match' && report ? (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Requirement outcomes" description="Confirmed means strong evidence was found; partial means related or indirect evidence." />
            <div className="mt-4">
              <MatchBreakdownChart report={report} />
            </div>
          </Card>

          <Card>
            <CardHeader title={`Every requirement (${report.matches.length})`} description="Each row explains the evidence behind its score." />
            <ul className="mt-4 space-y-3">
              {report.matches.map((match) => (
                <li key={match.requirementId} className="rounded-xl border border-ink-600 bg-ink-850 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-brand">{match.label}</span>
                      <Badge tone={match.status === 'required' ? 'danger' : 'neutral'}>{match.status}</Badge>
                      <Badge tone={matchStatusTone(match.matchStatus)}>{matchStatusLabel(match.matchStatus)}</Badge>
                    </div>
                    <span className="text-[11px] text-brand/60">
                      weight {match.weight} · evidence {Math.round(match.matchValue * 100)}%
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-brand/75">{match.explanation}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Recommended next steps" description="Generated from the report above." />
            <ol className="mt-4 space-y-2">
              {report.nextSteps.map((step, index) => (
                <li key={index} className="flex items-start gap-2.5 rounded-xl border border-ink-600 bg-ink-850 p-3 text-[11px] leading-relaxed text-brand/80">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-brand text-[10px] font-bold text-ink">{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      ) : null}

      {tab === 'match' && !report ? (
        <EmptyState title="No report available" description="This advert has no stored compatibility report yet." />
      ) : null}

      {tab === 'gaps' ? (
        <div className="space-y-6">
          <GapSummary gaps={gaps} />
          <Card>
            <CardHeader
              title="Prioritised gaps"
              icon={<ListChecks aria-hidden className="h-4 w-4" />}
              description="Ordered by internal priority: advert importance multiplied by the evidence you are missing. Expand a gap to see the suggested practical task."
              action={
                <Button size="sm" onClick={buildRoadmap} icon={<RouteIcon aria-hidden className="h-3.5 w-3.5" />}>
                  Turn into a roadmap
                </Button>
              }
            />
            <div className="mt-4">
              <GapList gaps={gaps} emptyMessage="Every requirement for this advert is supported by your recorded evidence. Nothing to close." />
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'requirements' ? (
        <Card>
          <CardHeader
            title={`Review and correct the requirements (${job.requirements.length})`}
            icon={<Pencil aria-hidden className="h-4 w-4" />}
            description="Automatic extraction is not perfect. Correcting it here changes the report immediately, because the score is recomputed from this list."
            action={
              <Button size="sm" variant="secondary" onClick={() => navigate(`/jobs/${job.id}`)} icon={<Save aria-hidden className="h-3.5 w-3.5" />}>
                Done
              </Button>
            }
          />

          <ul className="mt-4 space-y-2.5">
            {job.requirements.map((requirement) => (
              <li key={requirement.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-600 bg-ink-850 p-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-brand">
                    {requirement.label}
                    {requirement.editedByUser ? <Badge tone="brand">edited</Badge> : null}
                    {requirement.category ? <Badge tone="neutral">{requirement.category}</Badge> : null}
                  </p>
                  <p className="mt-0.5 text-[11px] text-brand/55">
                    weight {requirement.weight} · emphasis ×{requirement.emphasis}
                    {requirement.learnHours ? ` · about ${requirement.learnHours}h to learn` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    aria-label={`Status for ${requirement.label}`}
                    className="w-32 py-1.5 text-xs"
                    value={requirement.status}
                    onChange={() => toggleStatus(requirement)}
                  >
                    <option value="required">required</option>
                    <option value="preferred">preferred</option>
                  </Select>
                  <button
                    type="button"
                    onClick={() => removeRequirement(requirement)}
                    aria-label={`Remove ${requirement.label}`}
                    className="rounded-lg p-1.5 text-danger/80 transition-colors hover:bg-danger-soft"
                  >
                    <Trash2 aria-hidden className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="Add a requirement that was missed" hint="Known technologies are recognised automatically; anything else is treated as a custom criterion.">
              <Input
                value={newRequirement}
                onChange={(event) => setNewRequirement(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') addRequirement();
                }}
                placeholder="e.g. GraphQL, stakeholder management"
              />
            </Field>
            <div className="flex items-end">
              <Button onClick={addRequirement} icon={<Sparkles aria-hidden className="h-4 w-4" />}>
                Add requirement
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {tab === 'text' ? (
        <Card>
          <CardHeader
            title="Advert text as you provided it"
            description="This is the source of truth for the analysis. It is stored in this browser only and is never sent anywhere unless you explicitly enable AI assistance."
          />
          <pre className="mt-4 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-xl border border-ink-600 bg-ink-900 p-4 font-mono text-[11px] leading-relaxed text-brand/75 scrollbar-thin">
            {job.rawText}
          </pre>
          {job.sourceUrl ? (
            <p className="mt-3 text-[11px] text-brand/60">
              Reference URL (never fetched): <span className="font-mono">{job.sourceUrl}</span>
            </p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
