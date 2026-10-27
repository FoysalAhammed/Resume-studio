import { useEffect, useMemo, useRef } from 'react';
import {
  analyseSkillGaps,
  computeMatch,
  type JobDescription,
  type MatchReport,
  type SkillGap,
} from '@careerlens/core';
import { useWorkspace } from '../state/WorkspaceProvider';

export interface JobAnalysis {
  report: MatchReport;
  gaps: SkillGap[];
}

/**
 * Computes the compatibility report and the derived gap list for a job.
 *
 * The engine is deterministic, so the value rendered is always derived from the
 * current profile and advert - it can never drift from what is stored. The
 * report is written into the workspace so the dashboard and insights pages can
 * reference the latest result without recomputing it.
 */
export function useJobAnalysis(job: JobDescription | undefined): JobAnalysis | null {
  const { workspace, dispatch } = useWorkspace();
  const profile = workspace.profile;
  const lastSaved = useRef<string | null>(null);

  const analysis = useMemo<JobAnalysis | null>(() => {
    if (!job) return null;
    const report = computeMatch({ profile, job });
    const gaps = analyseSkillGaps({ profile, job, report });
    return { report, gaps };
  }, [profile, job]);

  useEffect(() => {
    if (!analysis || !job) return;
    const signature = `${analysis.report.id}:${analysis.report.score}:${analysis.report.matches.length}`;
    if (lastSaved.current === signature) return;
    lastSaved.current = signature;
    dispatch({ type: 'save-match', report: analysis.report });
  }, [analysis, job, dispatch]);

  return analysis;
}

/** The job the user most recently interacted with, used as a sensible default. */
export function useLatestJob(): JobDescription | undefined {
  const { workspace } = useWorkspace();
  return workspace.jobs[0];
}
