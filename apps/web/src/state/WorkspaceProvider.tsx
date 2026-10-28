import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  createSampleWorkspace,
  emptyWorkspace,
  makeId,
  mergePatchIntoProfile,
  workspaceSchema,
  type ActivityEvent,
  type ActivityKind,
  type CareerProfile,
  type CertificationEntry,
  type DraftDocument,
  type EducationEntry,
  type ExperienceEntry,
  type InterviewSession,
  type JobDescription,
  type LearningRoadmap,
  type MatchReport,
  type ProfilePatch,
  type ProjectEntry,
  type ResumeAnalysis,
  type Skill,
  type StoredProfile,
  type Workspace,
} from '@careerlens/core';
import { clearWorkspace, loadWorkspace, saveWorkspace } from '../lib/persistence';

type CollectionName = 'education' | 'experience' | 'projects' | 'certifications';
type CollectionItem = EducationEntry | ExperienceEntry | ProjectEntry | CertificationEntry;

export interface ActivityNote {
  kind: ActivityKind;
  message: string;
}

type Action =
  | { type: 'hydrate'; workspace: Workspace }
  | { type: 'replace'; workspace: Workspace }
  | { type: 'load-sample' }
  | { type: 'reset' }
  | { type: 'update-profile'; patch: Partial<CareerProfile>; activity?: ActivityNote }
  | { type: 'apply-resume-patch'; patch: ProfilePatch; activity?: ActivityNote }
  | { type: 'upsert-skill'; skill: Skill; activity?: ActivityNote }
  | { type: 'remove-skill'; id: string; activity?: ActivityNote }
  | { type: 'upsert-collection'; collection: CollectionName; item: CollectionItem; activity?: ActivityNote }
  | { type: 'remove-collection-item'; collection: CollectionName; id: string; activity?: ActivityNote }
  | { type: 'upsert-job'; job: JobDescription; activity?: ActivityNote }
  | { type: 'remove-job'; id: string; activity?: ActivityNote }
  | { type: 'save-match'; report: MatchReport }
  | { type: 'save-roadmap'; roadmap: LearningRoadmap; activity?: ActivityNote }
  | { type: 'remove-roadmap'; id: string; activity?: ActivityNote }
  | { type: 'save-resume-analysis'; analysis: ResumeAnalysis; activity?: ActivityNote }
  | { type: 'remove-resume-analysis'; id: string; activity?: ActivityNote }
  | { type: 'save-draft'; draft: DraftDocument; activity?: ActivityNote }
  | { type: 'update-draft'; draft: DraftDocument }
  | { type: 'remove-draft'; id: string; activity?: ActivityNote }
  | { type: 'save-interview'; session: InterviewSession; activity?: ActivityNote }
  | { type: 'update-settings'; settings: Partial<Workspace['settings']> };

const MAX_ACTIVITY = 40;

function logActivity(activity: ActivityEvent[], note: ActivityNote | undefined, now: string): ActivityEvent[] {
  if (!note) return activity;
  return [{ id: makeId('act', `${note.kind}:${now}:${activity.length}`), kind: note.kind, message: note.message, at: now }, ...activity].slice(0, MAX_ACTIVITY);
}

function upsert<T extends { id: string }>(items: T[], item: T): T[] {
  const index = items.findIndex((existing) => existing.id === item.id);
  if (index === -1) return [...items, item];
  const next = [...items];
  next[index] = item;
  return next;
}

// One reducer for the whole workspace. Every branch keeps updatedAt and the
// activity log in sync, so the dashboard never shows stale provenance.
function reducer(state: Workspace, action: Action): Workspace {
  const now = new Date().toISOString();
  const withMeta = (next: Partial<Workspace>): Workspace => ({ ...state, ...next, updatedAt: now });
  const withActivity = (next: Partial<Workspace>, note?: ActivityNote): Workspace =>
    ({ ...state, ...next, activity: logActivity(state.activity, note, now), updatedAt: now });

  switch (action.type) {
    case 'hydrate':
    case 'replace':
      return action.workspace;

    case 'load-sample':
      return createSampleWorkspace();

    case 'reset':
      return { ...emptyWorkspace(), settings: state.settings, updatedAt: now };

    case 'update-profile':
      return withActivity({ profile: { ...state.profile, ...action.patch, updatedAt: now } }, action.activity);

    case 'apply-resume-patch': {
      const merged = mergePatchIntoProfile(state.profile, action.patch);
      return withActivity({ profile: { ...merged, origin: state.profile.origin } }, action.activity);
    }

    case 'upsert-skill':
      return withActivity(
        { profile: { ...state.profile, skills: upsert(state.profile.skills, action.skill), updatedAt: now } },
        action.activity,
      );

    case 'remove-skill':
      return withActivity(
        { profile: { ...state.profile, skills: state.profile.skills.filter((skill) => skill.id !== action.id), updatedAt: now } },
        action.activity,
      );

    case 'upsert-collection': {
      const profile: StoredProfile = { ...state.profile, updatedAt: now };
      if (action.collection === 'education') profile.education = upsert(profile.education, action.item as EducationEntry);
      else if (action.collection === 'experience') profile.experience = upsert(profile.experience, action.item as ExperienceEntry);
      else if (action.collection === 'projects') profile.projects = upsert(profile.projects, action.item as ProjectEntry);
      else profile.certifications = upsert(profile.certifications, action.item as CertificationEntry);
      return withActivity({ profile }, action.activity);
    }

    case 'remove-collection-item': {
      const profile: StoredProfile = { ...state.profile, updatedAt: now };
      if (action.collection === 'education') profile.education = profile.education.filter((item) => item.id !== action.id);
      else if (action.collection === 'experience') profile.experience = profile.experience.filter((item) => item.id !== action.id);
      else if (action.collection === 'projects') profile.projects = profile.projects.filter((item) => item.id !== action.id);
      else profile.certifications = profile.certifications.filter((item) => item.id !== action.id);
      return withActivity({ profile }, action.activity);
    }

    case 'upsert-job':
      return withActivity({ jobs: upsert(state.jobs, { ...action.job, updatedAt: now }) }, action.activity);

    case 'remove-job':
      return withActivity(
        {
          jobs: state.jobs.filter((job) => job.id !== action.id),
          matches: state.matches.filter((match) => match.jobId !== action.id),
          roadmaps: state.roadmaps.filter((roadmap) => roadmap.jobId !== action.id),
        },
        action.activity,
      );

    case 'save-match': {
      const others = state.matches.filter((match) => match.jobId !== action.report.jobId);
      return withMeta({ matches: [...others, action.report] });
    }

    case 'save-roadmap':
      return withActivity({ roadmaps: upsert(state.roadmaps, { ...action.roadmap, updatedAt: now }) }, action.activity);

    case 'remove-roadmap':
      return withActivity({ roadmaps: state.roadmaps.filter((roadmap) => roadmap.id !== action.id) }, action.activity);

    case 'save-resume-analysis':
      return withActivity({ resumeAnalyses: [action.analysis, ...state.resumeAnalyses].slice(0, 5) }, action.activity);

    case 'remove-resume-analysis':
      return withActivity({ resumeAnalyses: state.resumeAnalyses.filter((analysis) => analysis.id !== action.id) }, action.activity);

    case 'save-draft':
      return withActivity({ drafts: [action.draft, ...state.drafts].slice(0, 20) }, action.activity);

    case 'update-draft':
      return withMeta({ drafts: state.drafts.map((draft) => (draft.id === action.draft.id ? action.draft : draft)) });

    case 'remove-draft':
      return withActivity({ drafts: state.drafts.filter((draft) => draft.id !== action.id) }, action.activity);

    case 'save-interview':
      return withActivity({ interviewSessions: [action.session, ...state.interviewSessions].slice(0, 10) }, action.activity);

    case 'update-settings':
      return withMeta({ settings: { ...state.settings, ...action.settings } });

    default:
      return state;
  }
}

interface WorkspaceContextValue {
  workspace: Workspace;
  ready: boolean;
  persisted: boolean;
  dispatch: (action: Action) => void;
  updateProfile: (patch: Partial<CareerProfile>, activity?: ActivityNote) => void;
  updateSettings: (settings: Partial<Workspace['settings']>) => void;
  applyResumePatch: (patch: ProfilePatch, activity?: ActivityNote) => void;
  loadSample: () => void;
  resetToEmpty: () => Promise<void>;
  eraseEverything: () => Promise<void>;
  exportJson: () => string;
  importJson: (text: string) => { ok: true } | { ok: false; error: string };
  isSample: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, dispatch] = useReducer(reducer, undefined, emptyWorkspace);
  const [ready, setReady] = useState(false);
  const [persisted, setPersisted] = useState(true);
  const hydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadWorkspace();
      if (cancelled) return;
      if (stored) {
        // A stored workspace from a newer schema is ignored, not guessed at.
        const parsed = workspaceSchema.safeParse(stored);
        if (parsed.success) dispatch({ type: 'hydrate', workspace: parsed.data as Workspace });
      }
      hydrated.current = true;
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !hydrated.current) return;
    const timer = setTimeout(() => {
      void saveWorkspace(workspace).then(setPersisted);
    }, 350);
    return () => clearTimeout(timer);
  }, [workspace, ready]);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(workspace.settings.reducedMotion);
  }, [workspace.settings.reducedMotion]);

  const updateProfile = useCallback((patch: Partial<CareerProfile>, activity?: ActivityNote) => {
    dispatch({ type: 'update-profile', patch, activity });
  }, []);

  const updateSettings = useCallback((settings: Partial<Workspace['settings']>) => {
    dispatch({ type: 'update-settings', settings });
  }, []);

  const applyResumePatch = useCallback((patch: ProfilePatch, activity?: ActivityNote) => {
    dispatch({ type: 'apply-resume-patch', patch, activity });
  }, []);

  const loadSample = useCallback(() => {
    dispatch({ type: 'load-sample' });
  }, []);

  const resetToEmpty = useCallback(async () => {
    dispatch({ type: 'reset' });
    await clearWorkspace();
  }, []);

  const eraseEverything = useCallback(async () => {
    await clearWorkspace();
    dispatch({ type: 'replace', workspace: emptyWorkspace() });
  }, []);

  const exportJson = useCallback(() => JSON.stringify(workspace, null, 2), [workspace]);

  const importJson = useCallback((text: string): { ok: true } | { ok: false; error: string } => {
    try {
      const parsed = workspaceSchema.safeParse(JSON.parse(text));
      if (!parsed.success) {
        return { ok: false, error: 'That file is not a valid CareerLens workspace export.' };
      }
      dispatch({ type: 'replace', workspace: parsed.data as Workspace });
      return { ok: true };
    } catch {
      return { ok: false, error: 'The file could not be read as JSON.' };
    }
  }, []);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspace,
      ready,
      persisted,
      dispatch,
      updateProfile,
      updateSettings,
      applyResumePatch,
      loadSample,
      resetToEmpty,
      eraseEverything,
      exportJson,
      importJson,
      isSample: workspace.origin === 'sample' || workspace.profile.origin === 'sample',
    }),
    [workspace, ready, persisted, updateProfile, updateSettings, applyResumePatch, loadSample, resetToEmpty, eraseEverything, exportJson, importJson],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside a WorkspaceProvider.');
  return context;
}

export function useNewId(prefix: string): (seed: string) => string {
  return useCallback((seed: string) => makeId(prefix, `${seed}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`), [prefix]);
}
