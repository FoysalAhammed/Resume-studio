import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { classNames } from '../../lib/format';

/* --------------------------------------------------------------- button -- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-ink hover:bg-brand-hover border border-transparent',
  secondary: 'bg-ink-700 text-brand border border-ink-600 hover:bg-ink-600',
  ghost: 'bg-transparent text-brand border border-transparent hover:bg-ink-700',
  danger: 'bg-danger-soft text-danger border border-danger/50 hover:bg-danger/25',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-sm',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={classNames(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------- card -- */

export function Card({ children, className, as: Tag = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <Tag className={classNames('card p-5', className)}>{children}</Tag>;
}

export function CardHeader({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={classNames('flex flex-wrap items-start justify-between gap-3 border-b border-ink-600/60 pb-3', className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? <span className="mt-0.5 text-brand/80">{icon}</span> : null}
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-brand">{title}</h2>
          {description ? <p className="mt-1 text-xs leading-relaxed text-brand/60">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="flex flex-shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-brand sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-relaxed text-brand/70">{description}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </header>
  );
}

/* ---------------------------------------------------------------- badge -- */

type BadgeTone = 'brand' | 'success' | 'caution' | 'danger' | 'neutral';

const BADGE_TONES: Record<BadgeTone, string> = {
  brand: 'bg-brand-soft text-brand border-brand/40',
  success: 'bg-success-soft text-success border-success/40',
  caution: 'bg-caution-soft text-caution border-caution/40',
  danger: 'bg-danger-soft text-danger border-danger/40',
  neutral: 'bg-ink-700 text-brand/80 border-ink-600',
};

export function Badge({ children, tone = 'neutral', className, title }: { children: ReactNode; tone?: BadgeTone; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={classNames('inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[11px] font-semibold', BADGE_TONES[tone], className)}
    >
      {children}
    </span>
  );
}

/**
 * Labels where a result came from. The application never presents template
 * output as if it were AI, so this badge is used next to generated content.
 */
export function SourceBadge({ source, reason }: { source: 'local' | 'ai' | 'sample'; reason?: string }) {
  if (source === 'ai') {
    return (
      <Badge tone="brand" title={reason ?? 'Produced by the configured AI provider'}>
        AI-assisted
      </Badge>
    );
  }
  if (source === 'sample') {
    return (
      <Badge tone="caution" title="Fictional demonstration data">
        Demonstration data
      </Badge>
    );
  }
  return (
    <Badge tone="neutral" title={reason ?? 'Produced locally by deterministic rules - no AI provider was used'}>
      Local rules
    </Badge>
  );
}

/* -------------------------------------------------------------- progress -- */

export function Progress({ value, tone = 'brand', label }: { value: number; tone?: BadgeTone; label?: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const toneClass =
    tone === 'success' ? 'bg-success' : tone === 'caution' ? 'bg-caution' : tone === 'danger' ? 'bg-danger' : 'bg-brand';
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Progress'}
      className="h-2 w-full overflow-hidden rounded-full bg-ink-900"
    >
      <div className={classNames('h-full rounded-full transition-all', toneClass)} style={{ width: `${clamped}%` }} />
    </div>
  );
}

/* ----------------------------------------------------------- form fields -- */

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-[11px] font-medium text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="hint">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={classNames('input', invalid && 'input-error', className)} {...rest} />;
}

export function Textarea({ className, invalid, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea className={classNames('input resize-y', invalid && 'input-error', className)} {...rest} />;
}

export function Select({ className, invalid, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select className={classNames('input', invalid && 'input-error', className)} {...rest}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  description,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-ink-600 bg-ink-850 p-3 transition-colors hover:border-brand/40">
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand" {...rest} />
      <span>
        <span className="block text-xs font-semibold text-brand">{label}</span>
        {description ? <span className="mt-0.5 block text-[11px] leading-relaxed text-brand/60">{description}</span> : null}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------ empty/skel -- */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-600 bg-ink-850/60 px-5 py-10 text-center">
      {icon ? <span className="mb-3 text-brand/70">{icon}</span> : null}
      <h3 className="text-sm font-bold text-brand">{title}</h3>
      <p className="mt-1.5 max-w-md text-xs leading-relaxed text-brand/65">{description}</p>
      {action ? <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={classNames('animate-shimmer rounded-lg bg-ink-700', className)} />;
}

export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: BadgeTone;
  icon?: ReactNode;
}) {
  return (
    <div className="card-flat flex items-start gap-3 p-4">
      {icon ? (
        <span className={classNames('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border', BADGE_TONES[tone])}>
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-brand/55">{label}</p>
        <p className="mt-0.5 truncate text-lg font-extrabold text-brand">{value}</p>
        {hint ? <p className="mt-0.5 text-[11px] leading-relaxed text-brand/60">{hint}</p> : null}
      </div>
    </div>
  );
}
