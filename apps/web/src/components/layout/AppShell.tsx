import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Briefcase,
  FileSearch,
  Info,
  LayoutDashboard,
  Mail,
  Menu,
  MessagesSquare,
  PenLine,
  Puzzle,
  Route,
  Settings,
  Sparkles,
  Target,
  UserRound,
  X,
} from 'lucide-react';
import { APP_TAGLINE } from '@careerlens/core';
import { useApiStatus } from '../../state/ApiStatusProvider';
import { useWorkspace } from '../../state/WorkspaceProvider';
import { useToast } from '../ui/Toast';
import { Button, Badge } from '../ui/primitives';
import { ConfirmDialog } from '../ui/Modal';
import { classNames } from '../../lib/format';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  hint: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Overview', icon: <LayoutDashboard aria-hidden className="h-4 w-4" />, hint: 'Your career snapshot and next actions' },
  { to: '/profile', label: 'Career Profile', icon: <UserRound aria-hidden className="h-4 w-4" />, hint: 'Skills, experience, education and projects' },
  { to: '/resume', label: 'Resume Analyzer', icon: <FileSearch aria-hidden className="h-4 w-4" />, hint: 'Upload a CV and review what was extracted' },
  { to: '/jobs', label: 'Job Explorer', icon: <Briefcase aria-hidden className="h-4 w-4" />, hint: 'Analyse adverts and score compatibility' },
  { to: '/gaps', label: 'Skill Gaps', icon: <Target aria-hidden className="h-4 w-4" />, hint: 'Prioritised gaps for a chosen job' },
  { to: '/roadmap', label: 'Learning Roadmap', icon: <Route aria-hidden className="h-4 w-4" />, hint: 'Tasks built from your gaps' },
  { to: '/studio', label: 'Resume Studio', icon: <PenLine aria-hidden className="h-4 w-4" />, hint: 'Improve CV wording with review' },
  { to: '/cover-letter', label: 'Cover Letter', icon: <Mail aria-hidden className="h-4 w-4" />, hint: 'Generate a draft from your profile' },
  { to: '/interview', label: 'Interview Prep', icon: <MessagesSquare aria-hidden className="h-4 w-4" />, hint: 'Practice questions and heuristic feedback' },
  { to: '/insights', label: 'Career Insights', icon: <BarChart3 aria-hidden className="h-4 w-4" />, hint: 'Charts, activity and model explainability' },
  { to: '/extension', label: 'Extension Preview', icon: <Puzzle aria-hidden className="h-4 w-4" />, hint: 'How the browser assistant would work' },
  { to: '/settings', label: 'Settings', icon: <Settings aria-hidden className="h-4 w-4" />, hint: 'Data, AI status and limitations' },
];

function ApiStatusPill() {
  const { status, health, aiAvailable } = useApiStatus();
  if (status === 'checking') return <Badge tone="neutral">Checking API…</Badge>;
  if (status === 'offline') {
    return (
      <Badge tone="caution" title="The API server is not reachable. In-browser analysis still works, but file parsing and AI features need the server.">
        <span className="hidden sm:inline">API offline, browser only</span>
        <span className="sm:hidden">API offline</span>
      </Badge>
    );
  }
  return (
    <Badge
      tone={aiAvailable ? 'brand' : 'neutral'}
      title={aiAvailable ? `AI provider connected (${health?.ai.model})` : 'API online in deterministic local mode'}
    >
      <span className="hidden sm:inline">{aiAvailable ? `AI: ${health?.ai.model}` : 'API online · local rules'}</span>
      <span className="sm:hidden">{aiAvailable ? 'AI' : 'API online'}</span>
    </Badge>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { isSample, resetToEmpty, loadSample, workspace } = useWorkspace();
  const [navOpen, setNavOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const location = useLocation();
  const toast = useToast();

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const hasData = workspace.profile.skills.length > 0 || workspace.jobs.length > 0 || workspace.resumeAnalyses.length > 0;

  const onConfirmReset = async () => {
    setBusy(true);
    await resetToEmpty();
    setBusy(false);
    setConfirmReset(false);
    toast.success('Workspace cleared', 'You now have an empty workspace. Load the demonstration data again at any time.');
  };

  return (
    <div className="min-h-screen bg-ink text-brand">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[120] focus:rounded-lg focus:bg-brand focus:px-3 focus:py-2 focus:text-xs focus:font-bold focus:text-ink"
      >
        Skip to main content
      </a>

      <div className="mx-auto flex w-full max-w-[100rem]">
        <aside className="sticky top-0 hidden h-screen w-72 flex-shrink-0 flex-col border-r border-ink-600 bg-ink-850 lg:flex">
          <div className="flex items-center gap-2.5 px-5 py-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-lg font-extrabold text-ink">C</span>
            <span>
              <span className="block text-base font-extrabold leading-none tracking-tight">CareerLens</span>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-brand/50">AI</span>
            </span>
          </div>
          <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-thin">
            <ul className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    title={item.hint}
                    className={({ isActive }) =>
                      classNames(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors',
                        isActive ? 'bg-brand text-ink' : 'text-brand/75 hover:bg-ink-700 hover:text-brand',
                      )
                    }
                  >
                    {item.icon}
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="border-t border-ink-600 px-4 py-4">
            <p className="text-[11px] leading-relaxed text-brand/55">{APP_TAGLINE}</p>
          </div>
        </aside>

        {navOpen ? (
          <div className="fixed inset-0 z-[80] lg:hidden">
            <div className="absolute inset-0 bg-ink-900/80 backdrop-blur-sm" onClick={() => setNavOpen(false)} aria-hidden="true" />
            <div className="relative h-full w-72 max-w-[85vw] overflow-y-auto border-r border-ink-600 bg-ink-850 p-4 scrollbar-thin">
              <div className="mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand font-extrabold text-ink">C</span>
                  <span className="font-extrabold">CareerLens AI</span>
                </span>
                <button
                  type="button"
                  onClick={() => setNavOpen(false)}
                  aria-label="Close navigation"
                  className="rounded-lg p-2 text-brand/70 hover:bg-ink-700"
                >
                  <X aria-hidden className="h-4 w-4" />
                </button>
              </div>
              <nav aria-label="Primary">
                <ul className="space-y-1">
                  {NAV_ITEMS.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === '/'}
                        className={({ isActive }) =>
                          classNames(
                            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold',
                            isActive ? 'bg-brand text-ink' : 'text-brand/80 hover:bg-ink-700',
                          )
                        }
                      >
                        {item.icon}
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-50 border-b border-ink-600 bg-ink-850/95 backdrop-blur">
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setNavOpen(true)}
                  aria-label="Open navigation"
                  aria-expanded={navOpen}
                  className="rounded-lg border border-ink-600 p-2 text-brand hover:bg-ink-700 lg:hidden"
                >
                  <Menu aria-hidden className="h-4 w-4" />
                </button>
                <span className="flex items-center gap-2 lg:hidden">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-sm font-extrabold text-ink">C</span>
                  <span className="text-sm font-extrabold">CareerLens AI</span>
                </span>
                <span className="hidden items-center gap-2 text-xs text-brand/60 lg:flex">
                  <Sparkles aria-hidden className="h-3.5 w-3.5" />
                  Career readiness, resume intelligence and explainable job matching
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {isSample ? <Badge tone="caution">Demo data</Badge> : null}
                <ApiStatusPill />
                {hasData ? (
                  <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={() => setConfirmReset(true)}>
                    Start empty
                  </Button>
                ) : (
                  <Button size="sm" className="whitespace-nowrap" onClick={loadSample}>
                    Load demo data
                  </Button>
                )}
              </div>
            </div>

            {isSample ? (
              <div className="border-t border-caution/30 bg-caution-soft px-4 py-2.5 text-[11px] leading-relaxed text-brand/85 sm:px-6">
                <span className="font-bold uppercase tracking-wider text-caution">Demonstration data</span>: this workspace is a fictional
                candidate, “Ayesha Rahman”. It's here so you can explore the platform without an API key or your own documents. Nothing here is a real
                person. Choose <span className="font-semibold text-brand">Start empty</span> to use your own data.
              </div>
            ) : null}
          </header>

          <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8">
            <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
          </main>

          <footer className="border-t border-ink-600 px-4 py-5 text-[11px] leading-relaxed text-brand/50 sm:px-6">
            <div className="mx-auto flex max-w-6xl flex-wrap items-start gap-2">
              <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <p>
                CareerLens AI is a university project. Results come from local rules unless an AI provider is configured, in which
                case they're labelled AI-assisted. Compatibility scores estimate profile-to-advert overlap and don't predict hiring outcomes.
                Workspace data stays in this browser. See{' '}
                <span className="font-mono text-brand/70">docs/LIMITATIONS.md</span> for the full list.
              </p>
            </div>
          </footer>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Start an empty workspace?"
        message="This removes the current profile, analysed jobs, roadmaps, drafts and interview sessions from this browser. Your uploaded files were never stored, so nothing else needs deleting. Export a backup first if you want to keep this workspace."
        confirmLabel="Clear workspace"
        busy={busy}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => void onConfirmReset()}
      />
    </div>
  );
}
