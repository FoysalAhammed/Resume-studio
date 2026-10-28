import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Activity, BarChart3, Cpu, Info, Scale, ShieldCheck, Target } from 'lucide-react';
import {
  analyseSkillGaps,
  computeRoadmapProgress,
  EVIDENCE_SOURCE_LABELS,
  MATCH_CONFIG,
  profileCompleteness,
} from '@careerlens/core';
import { useWorkspace } from '../../state/WorkspaceProvider';
import { useApiStatus } from '../../state/ApiStatusProvider';
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatTile } from '../../components/ui/primitives';
import { CompletenessGauge, MatchBreakdownChart, RoadmapProgressChart, ScoreRing, SkillCoverageChart } from '../../components/charts/Charts';
import { formatDateTime, relativeTime } from '../../lib/format';

export default function InsightsPage() {
  const { workspace } = useWorkspace();
  const { status, health } = useApiStatus();
  const profile = workspace.profile;

  const completeness = useMemo(() => profileCompleteness(profile), [profile]);
  const latestJob = workspace.jobs[0];
  const latestMatch = workspace.matches.find((match) => match.jobId === latestJob?.id);
  const gaps = useMemo(
    () => (latestJob && latestMatch ? analyseSkillGaps({ profile, job: latestJob, report: latestMatch }) : []),
    [latestJob, latestMatch, profile],
  );
  const roadmap = workspace.roadmaps[0];
  const progress = roadmap ? computeRoadmapProgress(roadmap) : null;

  const storedBytes = useMemo(() => new Blob([JSON.stringify(workspace)]).size, [workspace]);

  const hasAnything = profile.skills.length > 0 || workspace.jobs.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Career Insights"
        description="Charts drawn only from data in this workspace. Where there isn't enough, the panel says so instead of showing a fake placeholder."
        action={<Badge tone={workspace.origin === 'sample' ? 'caution' : 'neutral'}>{workspace.origin === 'sample' ? 'Demonstration data' : 'Your data'}</Badge>}
      />

      {!hasAnything ? (
        <Card>
          <EmptyState
            icon={<BarChart3 aria-hidden className="h-8 w-8" />}
            title="Not enough data to chart yet"
            description="Add skills or analyse an advert and this page fills with real figures: profile completeness, requirement outcomes, skill coverage and roadmap progress."
            action={
              <Link to="/jobs" className="rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-ink transition-colors hover:bg-brand-hover">
                Analyse an advert
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Profile completeness" value={`${completeness.score}%`} hint={`${completeness.checks.filter((check) => check.passed).length} of ${completeness.checks.length} checks passed`} icon={<ShieldCheck aria-hidden className="h-4 w-4" />} />
            <StatTile label="Skills recorded" value={profile.skills.length} hint={`${new Set(profile.skills.map((skill) => skill.category)).size} categories`} tone="brand" icon={<Scale aria-hidden className="h-4 w-4" />} />
            <StatTile label="Adverts analysed" value={workspace.jobs.length} hint={`${workspace.matches.length} stored reports`} icon={<Target aria-hidden className="h-4 w-4" />} />
            <StatTile label="Workspace size" value={`${Math.round(storedBytes / 1024)} KB`} hint="Stored in this browser only" icon={<Cpu aria-hidden className="h-4 w-4" />} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Profile completeness" description="A data checklist, not an employability score." />
              <div className="mt-3">
                <CompletenessGauge value={completeness.score} label="Profile complete" />
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Skill coverage by category"
                description="Where your recorded skills sit. Empty categories just mean nothing recorded yet."
              />
              <div className="mt-3">
                <SkillCoverageChart skills={profile.skills} />
              </div>
            </Card>
          </div>

          {latestMatch && latestJob ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader
                  title={`Latest compatibility: ${latestJob.title}`}
                  description={`${latestJob.company} · ${relativeTime(latestMatch.createdAt)}`}
                  action={
                    <Link to={`/jobs/${latestJob.id}`} className="link text-xs font-semibold">
                      Full report
                    </Link>
                  }
                />
                <div className="mt-4">
                  <ScoreRing score={latestMatch.score} grade={latestMatch.grade} />
                </div>
                <div className="mt-4">
                  <MatchBreakdownChart report={latestMatch} />
                </div>
              </Card>

              <Card>
                <CardHeader
                  title="Highest priority gaps"
                  description="Prioritised from advert importance and missing evidence, not market statistics."
                  action={
                    <Link to="/gaps" className="link text-xs font-semibold">
                      Gap analysis
                    </Link>
                  }
                />
                {gaps.length ? (
                  <ul className="mt-4 space-y-2.5">
                    {gaps.slice(0, 6).map((gap) => (
                      <li key={gap.id} className="rounded-xl border border-ink-600 bg-ink-850 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-brand">{gap.label}</span>
                          <Badge tone={gap.importance === 'high' ? 'danger' : gap.importance === 'medium' ? 'caution' : 'neutral'}>{gap.importance}</Badge>
                        </div>
                        <p className="mt-1 text-[11px] text-brand/60">
                          evidence {Math.round(gap.matchValue * 100)}% · about {gap.estimatedHours}h · priority {gap.priorityScore}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-[11px] text-brand/60">No open gaps for the latest advert.</p>
                )}
              </Card>
            </div>
          ) : null}

          {roadmap && progress ? (
            <Card>
              <CardHeader
                title={`Roadmap progress: ${roadmap.title}`}
                description={`${progress.completed} of ${progress.total} tasks complete · ${progress.completedHours}h of ${progress.totalHours}h`}
                action={
                  <Link to="/roadmap" className="link text-xs font-semibold">
                    Open roadmap
                  </Link>
                }
              />
              <div className="mt-4">
                <RoadmapProgressChart roadmap={roadmap} />
              </div>
            </Card>
          ) : null}
        </>
      )}

      <Card>
        <CardHeader
          title="How the scoring model works"
          icon={<Scale aria-hidden className="h-4 w-4" />}
          description="The matching engine's live configuration, so you can audit any score."
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-ink-600 bg-ink-850 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand/55">Engine version</p>
            <p className="mt-0.5 text-base font-extrabold text-brand">{MATCH_CONFIG.version}</p>
          </div>
          <div className="rounded-xl border border-ink-600 bg-ink-850 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand/55">Required vs preferred</p>
            <p className="mt-0.5 text-base font-extrabold text-brand">
              {MATCH_CONFIG.weights.required} : {MATCH_CONFIG.weights.preferred}
            </p>
          </div>
          <div className="rounded-xl border border-ink-600 bg-ink-850 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand/55">Partial threshold</p>
            <p className="mt-0.5 text-base font-extrabold text-brand">{MATCH_CONFIG.statusThresholds.partial}</p>
          </div>
          <div className="rounded-xl border border-ink-600 bg-ink-850 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand/55">Confirmed threshold</p>
            <p className="mt-0.5 text-base font-extrabold text-brand">{MATCH_CONFIG.statusThresholds.confirmed}</p>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-[11px] leading-relaxed text-brand/70">
          <p>
            <span className="font-semibold text-brand">Formula: </span>
            score = 100 × Σ(weight × matchValue) ÷ Σ(weight). A requirement's weight is its base importance ({MATCH_CONFIG.weights.required} required,{' '}
            {MATCH_CONFIG.weights.preferred} preferred) multiplied by an emphasis factor of {MATCH_CONFIG.emphasis.min}–{MATCH_CONFIG.emphasis.max} based on
            the advert's wording.
          </p>
          <p>
            <span className="font-semibold text-brand">Evidence mapping: </span>
            a recorded skill at or above the target level scores {MATCH_CONFIG.directMatch}; a related skill earns partial credit (
            {MATCH_CONFIG.relatedSkill(1).toFixed(1)} at the closest relation, lower as the relation weakens); a project technology scores{' '}
            {MATCH_CONFIG.projectTechnology}; a project mention scores {MATCH_CONFIG.projectMention}; work experience scores{' '}
            {MATCH_CONFIG.experienceMention}; a certification scores {MATCH_CONFIG.certification}. Independent sources add a small bonus of{' '}
            {MATCH_CONFIG.multiSourceBonus} each, capped at {MATCH_CONFIG.maxMultiSourceBonus}.
          </p>
          <p>
            <span className="font-semibold text-brand">Determinism: </span>
            No randomness, no time-based drift and no external calls. The same profile and advert always produce the same score for a given
            engine version, which is what makes the unit tests meaningful.
          </p>
        </div>
        <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
          {Object.entries(EVIDENCE_SOURCE_LABELS).map(([key, label]) => (
            <p key={key} className="text-[11px] text-brand/65">
              <span className="font-mono text-brand/50">{key}</span> · {label}
            </p>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="What is real, what is optional"
          icon={<Info aria-hidden className="h-4 w-4" />}
          description="A blunt summary so nothing here is over-claimed."
        />
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-success/30 bg-success-soft p-3.5">
            <p className="text-xs font-bold text-success">Genuinely implemented</p>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-success/90">
              <li>· CV parsing for PDF, DOCX and text, with section detection and completeness scoring</li>
              <li>· Rule-based job requirement extraction (required vs preferred, experience, education)</li>
              <li>· Explainable weighted matching with per-requirement evidence and version tracking</li>
              <li>· Skill-gap analysis with effort estimates and practice tasks</li>
              <li>· Deterministic roadmap generation with real progress maths</li>
              <li>· CV rewriting guidance, cover-letter drafting and interview practice</li>
              <li>· Browser persistence (IndexedDB) with export and import</li>
            </ul>
          </div>
          <div className="rounded-xl border border-caution/30 bg-caution-soft p-3.5">
            <p className="text-xs font-bold text-caution">Optional, labelled or not yet built</p>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-caution/90">
              <li>· AI-assisted features need AI_API_KEY. Without it the same screens return deterministic local results</li>
              <li>· Semantic matching isn't implemented. Matching is lexical with a curated relation graph</li>
              <li>· No OCR: image-only PDFs report that the text layer is missing</li>
              <li>· No DOCX export and no live job-market data or salary statistics</li>
              <li>· The extension page is a preview inside the website, not an installed browser extension</li>
              <li>· Browser storage is single-device demonstration persistence, not multi-user secure storage</li>
            </ul>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Activity log"
          icon={<Activity aria-hidden className="h-4 w-4" />}
          description={`${workspace.activity.length} events recorded in this browser. Last updated ${formatDateTime(workspace.updatedAt)}.`}
          action={
            <Badge tone={status === 'online' ? (health?.ai.configured ? 'brand' : 'neutral') : 'caution'}>
              {status === 'online' ? (health?.ai.configured ? `AI: ${health.ai.model}` : 'API online · local rules') : 'API offline'}
            </Badge>
          }
        />
        {workspace.activity.length ? (
          <ol className="mt-4 space-y-2.5">
            {workspace.activity.map((event) => (
              <li key={event.id} className="flex items-start gap-2.5 border-b border-ink-600/40 pb-2.5 last:border-0">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand/60" />
                <span>
                  <span className="block text-[11px] leading-relaxed text-brand/80">{event.message}</span>
                  <span className="text-[10px] text-brand/45">
                    {event.kind} · {formatDateTime(event.at)}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-[11px] text-brand/55">No activity recorded yet.</p>
        )}
      </Card>
    </div>
  );
}
