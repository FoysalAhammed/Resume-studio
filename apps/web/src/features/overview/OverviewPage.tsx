import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Briefcase,
  CircleDashed,
  FolderKanban,
  ListChecks,
  Route as RouteIcon,
  Sparkles,
  Target,
  Wrench,
} from 'lucide-react';
import {
  analyseSkillGaps,
  computeRoadmapProgress,
  profileCompleteness,
} from '@careerlens/core';
import { useWorkspace } from '../../state/WorkspaceProvider';
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, Progress, StatTile } from '../../components/ui/primitives';
import { CompletenessGauge, MatchBreakdownChart, ScoreRing, SkillCoverageChart } from '../../components/charts/Charts';
import { matchStatusTone, relativeTime, TONE_CLASSES } from '../../lib/format';

export default function OverviewPage() {
  const { workspace, loadSample } = useWorkspace();
  const profile = workspace.profile;

  const completeness = useMemo(() => profileCompleteness(profile), [profile]);
  const latestJob = workspace.jobs[0];
  const latestMatch = useMemo(
    () => (latestJob ? workspace.matches.find((match) => match.jobId === latestJob.id) : undefined),
    [latestJob, workspace.matches],
  );
  const gaps = useMemo(
    () => (latestJob && latestMatch ? analyseSkillGaps({ profile, job: latestJob, report: latestMatch }) : []),
    [latestJob, latestMatch, profile],
  );
  const roadmap = workspace.roadmaps[0];
  const progress = roadmap ? computeRoadmapProgress(roadmap) : null;
  const nextTask = roadmap?.tasks.find((task) => task.status !== 'completed');

  const isEmpty =
    profile.skills.length === 0 &&
    profile.experience.length === 0 &&
    profile.projects.length === 0 &&
    workspace.jobs.length === 0 &&
    workspace.resumeAnalyses.length === 0;

  const actions = useMemo(() => {
    const list: { label: string; detail: string; to: string; done: boolean }[] = [
      {
        label: 'Import your CV',
        detail: 'Upload a PDF, DOCX or text CV and review what was extracted before it touches your profile.',
        to: '/resume',
        done: workspace.resumeAnalyses.length > 0,
      },
      {
        label: 'Record at least five skills',
        detail: 'The matching engine needs evidence to work with, and skills are its primary input.',
        to: '/profile',
        done: profile.skills.length >= 5,
      },
      {
        label: 'Analyse a job advert',
        detail: 'Paste a real advert so requirements can be extracted and scored against your profile.',
        to: '/jobs',
        done: workspace.jobs.length > 0,
      },
      {
        label: 'Review your skill gaps',
        detail: gaps.length ? `${gaps.length} requirements have incomplete evidence for ${latestJob?.title}.` : 'Gaps appear once you have analysed an advert.',
        to: '/gaps',
        done: workspace.jobs.length > 0 && gaps.length === 0,
      },
      {
        label: 'Build a learning roadmap',
        detail: 'Turn your top gaps into a plan you can track.',
        to: '/roadmap',
        done: workspace.roadmaps.length > 0,
      },
      {
        label: 'Draft a cover letter',
        detail: 'Generate a letter from facts already recorded in your profile, then edit it.',
        to: '/cover-letter',
        done: workspace.drafts.length > 0,
      },
    ];
    return list.sort((a, b) => Number(a.done) - Number(b.done)).slice(0, 4);
  }, [workspace.resumeAnalyses.length, workspace.jobs.length, workspace.roadmaps.length, workspace.drafts.length, profile.skills.length, gaps.length, latestJob?.title]);

  if (isEmpty) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Understand your skills and what to do next."
          description="CareerLens AI reads your CV, pulls requirements out of job adverts, and explains every compatibility score it gives you."
        />
        <Card className="p-0">
          <div className="p-6">
            <EmptyState
              icon={<Sparkles aria-hidden className="h-8 w-8" />}
              title="This workspace is empty"
              description="Start with your own CV and profile, or load the demonstration workspace (a fictional candidate) to explore the app. No API key needed either way."
              action={
                <>
                  <Button onClick={loadSample} icon={<Sparkles aria-hidden className="h-4 w-4" />}>
                    Load demonstration workspace
                  </Button>
                  <Link
                    to="/profile"
                    className="rounded-xl border border-ink-600 bg-ink-700 px-4 py-2.5 text-xs font-semibold text-brand transition-colors hover:bg-ink-600"
                  >
                    Create my own profile
                  </Link>
                </>
              }
            />
          </div>
          <div className="grid gap-4 border-t border-ink-600/60 p-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Resume analysis" value="Real parsing" hint="PDF, DOCX and text are parsed server-side. The file is never stored." icon={<Wrench aria-hidden className="h-4 w-4" />} />
            <StatTile label="Matching" value="Explainable" hint="Weighted requirement scoring with per-requirement reasoning." tone="brand" icon={<Target aria-hidden className="h-4 w-4" />} />
            <StatTile label="Roadmaps" value="Deterministic" hint="Plans are generated from your gaps and weekly availability." icon={<RouteIcon aria-hidden className="h-4 w-4" />} />
            <StatTile label="AI provider" value="Optional" hint="Every feature works without one. AI results are labelled." tone="caution" icon={<Sparkles aria-hidden className="h-4 w-4" />} />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={profile.displayName ? `Welcome back, ${profile.displayName.split(' ')[0]}` : 'Career overview'}
        description="Everything below comes from the data in this workspace. Scores come from the matching engine, so they only change when your profile or an advert changes."
        action={
          <>
            <Badge tone={completeness.score >= 80 ? 'success' : 'brand'}>Profile {completeness.score}% complete</Badge>
            {workspace.origin === 'sample' ? <Badge tone="caution">Demonstration data</Badge> : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Skills recorded" value={profile.skills.length} hint={`${profile.skills.filter((skill) => skill.evidence.length > 1).length} with extra evidence`} icon={<Wrench aria-hidden className="h-4 w-4" />} />
        <StatTile label="Projects" value={profile.projects.length} hint={`${profile.experience.length} experience entries`} icon={<FolderKanban aria-hidden className="h-4 w-4" />} />
        <StatTile
          label="Target role"
          value={latestJob?.title ?? profile.preferredTitles[0] ?? 'Not set'}
          hint={latestJob ? `${latestJob.company}` : 'Analyse an advert to set this'}
          tone="brand"
          icon={<Briefcase aria-hidden className="h-4 w-4" />}
        />
        <StatTile
          label="Latest compatibility"
          value={latestMatch ? `${latestMatch.score}%` : '—'}
          hint={latestMatch ? `${latestMatch.grade} · engine v${latestMatch.engineVersion}` : 'No advert analysed yet'}
          tone={latestMatch ? matchStatusTone(latestMatch.counts.missing === 0 ? 'confirmed' : 'partial') : 'neutral'}
          icon={<Target aria-hidden className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <Card>
            <CardHeader
              title="Recommended next actions"
              icon={<ListChecks aria-hidden className="h-4 w-4" />}
              description="Sorted so the most useful step comes first. Each item links to the page that does it."
            />
            <ul className="mt-4 space-y-2.5">
              {actions.map((action) => (
                <li key={action.label}>
                  <Link
                    to={action.to}
                    className="flex items-center justify-between gap-3 rounded-xl border border-ink-600 bg-ink-850 p-3.5 transition-colors hover:border-brand/50 hover:bg-ink-700"
                  >
                    <span className="flex items-start gap-3">
                      {action.done ? (
                        <span className="mt-0.5 text-success">✓</span>
                      ) : (
                        <CircleDashed aria-hidden className="mt-0.5 h-4 w-4 flex-shrink-0 text-caution" />
                      )}
                      <span>
                        <span className="block text-xs font-bold text-brand">{action.label}</span>
                        <span className="mt-0.5 block text-[11px] leading-relaxed text-brand/65">{action.detail}</span>
                      </span>
                    </span>
                    <ArrowRight aria-hidden className="h-4 w-4 flex-shrink-0 text-brand/50" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          {latestMatch && latestJob ? (
            <Card>
              <CardHeader
                title={`Latest analysis: ${latestJob.title}`}
                icon={<Target aria-hidden className="h-4 w-4" />}
                description={`${latestJob.company} · computed ${relativeTime(latestMatch.createdAt)} · engine v${latestMatch.engineVersion}`}
                action={
                  <Link to={`/jobs/${latestJob.id}`} className="link text-xs font-semibold">
                    Open full report
                  </Link>
                }
              />
              <div className="mt-4 flex flex-wrap items-center gap-6">
                <ScoreRing score={latestMatch.score} grade={latestMatch.grade} />
                <dl className="grid flex-1 grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  {[
                    { label: 'Confirmed', value: latestMatch.counts.confirmed, tone: 'success' as const },
                    { label: 'Partial', value: latestMatch.counts.partial, tone: 'brand' as const },
                    { label: 'No evidence', value: latestMatch.counts.missing, tone: 'danger' as const },
                    { label: 'Required met', value: `${latestMatch.counts.requiredSatisfied}/${latestMatch.counts.requiredTotal}`, tone: 'brand' as const },
                  ].map((item) => (
                    <div key={item.label} className="min-w-0 rounded-xl border border-ink-600 bg-ink-850 p-3">
                      <dt className="break-words text-[10px] font-bold leading-tight tracking-wide text-brand/55">{item.label}</dt>
                      <dd className={`mt-0.5 text-lg font-extrabold ${TONE_CLASSES[item.tone].text}`}>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="mt-4">
                <MatchBreakdownChart report={latestMatch} />
              </div>
              {gaps.length ? (
                <div className="mt-4 rounded-xl border border-ink-600 bg-ink-850 p-3.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-brand/55">Highest priority gaps</p>
                  <ul className="mt-2 space-y-1.5">
                    {gaps.slice(0, 3).map((gap) => (
                      <li key={gap.id} className="flex flex-wrap items-center gap-2 text-[11px] text-brand/75">
                        <Badge tone={gap.importance === 'high' ? 'danger' : gap.importance === 'medium' ? 'caution' : 'neutral'}>{gap.importance}</Badge>
                        <span className="font-semibold text-brand">{gap.label}</span>
                        <span className="text-brand/55">· about {gap.estimatedHours}h to close</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/gaps" className="link mt-2.5 inline-block text-[11px] font-semibold">
                    See the full gap analysis
                  </Link>
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-success/30 bg-success-soft p-3.5 text-[11px] text-success">
                  Every requirement in this advert is currently supported by your profile.
                </p>
              )}
              <p className="mt-3 text-[10px] leading-relaxed text-brand/45">{latestMatch.disclaimer}</p>
            </Card>
          ) : (
            <Card>
              <CardHeader title="No job advert analysed yet" icon={<Briefcase aria-hidden className="h-4 w-4" />} />
              <div className="mt-4">
                <EmptyState
                  title="Analyse your first advert"
                  description="Paste a job description and CareerLens extracts its requirements, then scores each one against your evidence and explains why."
                  action={
                    <Link
                      to="/jobs"
                      className="rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-ink transition-colors hover:bg-brand-hover"
                    >
                      Go to Job Explorer
                    </Link>
                  }
                />
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6 lg:col-span-5">
          <Card>
            <CardHeader title="Profile completeness" icon={<ListChecks aria-hidden className="h-4 w-4" />} description="Answering these makes every other result sharper." />
            <div className="mt-3">
              <CompletenessGauge value={completeness.score} label="Profile complete" />
            </div>
            <ul className="mt-2 space-y-1.5">
              {completeness.nextActions.map((action) => (
                <li key={action} className="flex items-start gap-2 text-[11px] leading-relaxed text-brand/70">
                  <span className="text-caution">○</span>
                  {action}
                </li>
              ))}
            </ul>
            <Link to="/profile" className="link mt-3 inline-block text-[11px] font-semibold">
              Open the profile editor
            </Link>
          </Card>

          <Card>
            <CardHeader
              title="Learning roadmap"
              icon={<RouteIcon aria-hidden className="h-4 w-4" />}
              description={roadmap ? roadmap.title : 'No roadmap yet'}
              action={
                roadmap ? (
                  <Link to="/roadmap" className="link text-xs font-semibold">
                    Open
                  </Link>
                ) : null
              }
            />
            {roadmap && progress ? (
              <div className="mt-4 space-y-3">
                <Progress value={progress.percentComplete} tone={progress.percentComplete > 60 ? 'success' : 'brand'} label="Roadmap progress" />
                <p className="text-[11px] text-brand/70">
                  {progress.completed} of {progress.total} tasks complete · {progress.completedHours}h of {progress.totalHours}h done · about{' '}
                  {progress.estimatedWeeksRemaining} weeks remaining at {roadmap.weeklyHours}h per week
                </p>
                {nextTask ? (
                  <div className="rounded-xl border border-ink-600 bg-ink-850 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand/55">Next task</p>
                    <p className="mt-0.5 text-xs font-bold text-brand">{nextTask.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-brand/65">{nextTask.description}</p>
                  </div>
                ) : (
                  <p className="rounded-xl border border-success/30 bg-success-soft p-3 text-[11px] text-success">
                    Every task in this plan is complete.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState
                  title="No roadmap generated"
                  description="Gaps become tasks once you generate a roadmap: a Foundation, Practice and Portfolio task per gap, plus application tasks."
                  action={
                    <Link to="/roadmap" className="rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-ink transition-colors hover:bg-brand-hover">
                      Generate a roadmap
                    </Link>
                  }
                />
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Skill coverage" icon={<Wrench aria-hidden className="h-4 w-4" />} description="Recorded skills grouped by category." />
            <div className="mt-3">
              <SkillCoverageChart skills={profile.skills} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Recent activity" icon={<Activity aria-hidden className="h-4 w-4" />} description="Kept in this browser only." />
            {workspace.activity.length ? (
              <ul className="mt-3 space-y-2.5">
                {workspace.activity.slice(0, 6).map((event) => (
                  <li key={event.id} className="flex items-start gap-2.5 text-[11px]">
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand/60" />
                    <span>
                      <span className="block leading-relaxed text-brand/75">{event.message}</span>
                      <span className="text-brand/45">{relativeTime(event.at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[11px] text-brand/55">No activity recorded yet.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
