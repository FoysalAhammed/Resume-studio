import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState, PageHeader } from '../components/ui/primitives';

export default function NotFoundPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Page not found" description="That route does not exist in CareerLens AI." />
      <EmptyState
        icon={<Compass aria-hidden className="h-8 w-8" />}
        title="Nothing here"
        description="The link may be out of date. Use the navigation to return to a working page."
        action={
          <Link
            to="/"
            className="rounded-xl border border-ink-600 bg-ink-700 px-4 py-2.5 text-xs font-semibold text-brand transition-colors hover:bg-ink-600"
          >
            Back to Overview
          </Link>
        }
      />
    </div>
  );
}
