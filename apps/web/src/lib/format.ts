export function classNames(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function relativeTime(iso: string | undefined | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return formatDate(iso);
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return 'C';
  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}

export function scoreTone(score: number): 'success' | 'brand' | 'caution' | 'danger' {
  if (score >= 75) return 'success';
  if (score >= 55) return 'brand';
  if (score >= 35) return 'caution';
  return 'danger';
}

export const TONE_CLASSES: Record<'success' | 'brand' | 'caution' | 'danger', { text: string; bg: string; border: string }> = {
  success: { text: 'text-success', bg: 'bg-success-soft', border: 'border-success/40' },
  brand: { text: 'text-brand', bg: 'bg-brand-soft', border: 'border-brand/40' },
  caution: { text: 'text-caution', bg: 'bg-caution-soft', border: 'border-caution/40' },
  danger: { text: 'text-danger', bg: 'bg-danger-soft', border: 'border-danger/40' },
};

export function matchStatusTone(status: 'confirmed' | 'partial' | 'insufficient' | 'missing'): 'success' | 'caution' | 'danger' | 'brand' {
  if (status === 'confirmed') return 'success';
  if (status === 'partial') return 'brand';
  if (status === 'insufficient') return 'caution';
  return 'danger';
}

export function matchStatusLabel(status: 'confirmed' | 'partial' | 'insufficient' | 'missing'): string {
  if (status === 'confirmed') return 'Confirmed match';
  if (status === 'partial') return 'Partial match';
  if (status === 'insufficient') return 'Insufficient evidence';
  return 'No evidence found';
}
