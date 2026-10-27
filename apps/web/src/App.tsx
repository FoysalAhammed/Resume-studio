import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ToastProvider } from './components/ui/Toast';
import { ApiStatusProvider } from './state/ApiStatusProvider';
import { WorkspaceProvider, useWorkspace } from './state/WorkspaceProvider';
import { Skeleton } from './components/ui/primitives';
import OverviewPage from './features/overview/OverviewPage';
import ProfilePage from './features/profile/ProfilePage';
import ResumeAnalyzerPage from './features/resume/ResumeAnalyzerPage';
import JobExplorerPage from './features/jobs/JobExplorerPage';
import JobDetailPage from './features/jobs/JobDetailPage';
import SkillGapsPage from './features/gaps/SkillGapsPage';
import RoadmapPage from './features/roadmap/RoadmapPage';
import StudioPage from './features/studio/StudioPage';
import CoverLetterPage from './features/coverletter/CoverLetterPage';
import InterviewPage from './features/interview/InterviewPage';
import InsightsPage from './features/insights/InsightsPage';
import SettingsPage from './features/settings/SettingsPage';
import ExtensionPreviewPage from './features/extension/ExtensionPreviewPage';
import NotFoundPage from './features/NotFoundPage';

function LoadingShell() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6" aria-busy="true" aria-label="Loading your workspace">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function Shell() {
  const { ready } = useWorkspace();
  if (!ready) return <LoadingShell />;
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/resume" element={<ResumeAnalyzerPage />} />
        <Route path="/jobs" element={<JobExplorerPage />} />
        <Route path="/jobs/:jobId" element={<JobDetailPage />} />
        <Route path="/gaps" element={<SkillGapsPage />} />
        <Route path="/roadmap" element={<RoadmapPage />} />
        <Route path="/studio" element={<StudioPage />} />
        <Route path="/cover-letter" element={<CoverLetterPage />} />
        <Route path="/interview" element={<InterviewPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/extension" element={<ExtensionPreviewPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ApiStatusProvider>
        <WorkspaceProvider>
          <Shell />
        </WorkspaceProvider>
      </ApiStatusProvider>
    </ToastProvider>
  );
}
