import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ListChecks, Route as RouteIcon, Target } from 'lucide-react';
import { generateRoadmap, preserveTaskState } from '@careerlens/core';
import { useWorkspace } from '../../state/WorkspaceProvider';
import { useJobAnalysis } from '../../hooks/useJobAnalysis';
import { useToast } from '../../components/ui/Toast';
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, Select } from '../../components/ui/primitives';
import { GapList, GapSummary } from './GapList';

export default function SkillGapsPage() {
  const { workspace, dispatch } = useWorkspace();
  const toast = useToast();
  const navigate = useNavigate();
  const [selectedJobId, setSelectedJobId] = useState<string>(workspace.jobs[0]?.id ?? '');

  const job = useMemo(
    () => workspace.jobs.find((item) => item.id === selectedJobId) ?? workspace.jobs[0],
    [workspace.jobs, selectedJobId],
  );
  const analysis = useJobAnalysis(job);
  const gaps = analysis?.gaps ?? [];
  const existingRoadmap = workspace.roadmaps.find((roadmap) => roadmap.jobId === job?.id);

  if (!job) {
    return (
      <div className="space-y-6">
        <PageHeader title="Skill Gap Analysis" description="Gaps come from a compatibility report, so analyse an advert first." />
        <EmptyState
          icon={<Target aria-hidden className="h-8 w-8" />}
          title="No advert analysed yet"
          description="Skill gaps are the requirements your evidence doesn't cover yet. Analyse an advert to get a prioritised list you can trace back."
          action={
            <Link to="/jobs" className="rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-ink transition-colors hover:bg-brand-hover">
              Analyse an advert
            </Link>
          }
        />
      </div>
    );
  }

  const buildRoadmap = () => {
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
      activity: { kind: 'roadmap-generated', message: `Built a roadmap from ${gaps.length} gaps for ${job.title}.` },
    });
    toast.success('Roadmap ready', 'One task per prioritised gap, plus application tasks.');
    navigate('/roadmap');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Skill Gap Analysis"
        description="Each gap is a requirement from this advert that your profile doesn't cover yet. Priority comes from advert importance and the evidence you already have, not market data."
        action={
          <Button size="sm" onClick={buildRoadmap} icon={<RouteIcon aria-hidden className="h-3.5 w-3.5" />}> 
            {existingRoadmap ? 'Recalculate roadmap' : 'Generate roadmap'}
          </Button>
        }
      />

      <Card>
        <CardHeader
          title="Choose an advert"
          icon={<Target aria-hidden className="h-4 w-4" />}
          description="Gaps are always relative to one role. Requirements differ between adverts."
          action={analysis ? <Badge tone="brand">{analysis.report.score}% match</Badge> : null}
        />
        <div className="mt-4 max-w-xl">
          <Select aria-label="Select an advert" value={job.id} onChange={(event) => setSelectedJobId(event.target.value)}>
            {workspace.jobs.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} — {item.company}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <GapSummary gaps={gaps} />

      <Card>
        <CardHeader
          title={`Prioritised gaps (${gaps.length})`}
          icon={<ListChecks aria-hidden className="h-4 w-4" />}
          description="Expand a gap to see why it matters, the evidence found so far, a suggested task and reference material."
        />
        <div className="mt-4">
          <GapList gaps={gaps} emptyMessage="Every requirement here is covered by your recorded evidence, so there is nothing to close." />
        </div>
      </Card>
    </div>
  );
}
