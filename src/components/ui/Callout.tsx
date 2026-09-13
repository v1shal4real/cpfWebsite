import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * A block of framing or caveat text.
 *
 * This product needs one of these on nearly every view, because the framing
 * constraint says the projection language is not a disclaimer appended at the
 * bottom — it sits with the figures it qualifies. The `note` tone is the
 * default and is deliberately quiet: a page of yellow warning boxes teaches
 * people to stop reading them.
 */

export type CalloutTone = 'note' | 'info' | 'caution' | 'critical';

const TONES: Record<CalloutTone, { box: string; rule: string; glyph: string; role: string }> = {
  note: {
    box: 'bg-surface-2 text-ink-muted',
    rule: 'bg-line-strong',
    glyph: '',
    role: 'note',
  },
  info: {
    box: 'bg-accent-soft text-ink',
    rule: 'bg-accent',
    glyph: 'i',
    role: 'note',
  },
  caution: {
    box: 'bg-surface-2 text-ink',
    rule: 'bg-warning',
    glyph: '⚠',
    role: 'note',
  },
  critical: {
    box: 'bg-surface-2 text-ink',
    rule: 'bg-critical',
    glyph: '⚠',
    role: 'alert',
  },
};

export interface CalloutProps {
  tone?: CalloutTone;
  /** Bold lead-in. Keep it to a few words. */
  title?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Callout({ tone = 'note', title, className, children }: CalloutProps) {
  const style = TONES[tone];
  return (
    <div
      role={style.role}
      className={cn(
        'relative overflow-hidden rounded-md py-3 pl-4 pr-4 text-[0.8125rem] leading-relaxed',
        style.box,
        className,
      )}
    >
      <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-[3px]', style.rule)} />
      {title ? (
        <p className="mb-1 flex items-center gap-1.5 font-semibold text-ink">
          {style.glyph ? <span aria-hidden="true">{style.glyph}</span> : null}
          {title}
        </p>
      ) : null}
      <div className={cn(title ? '' : 'flex items-start gap-2')}>
        {!title && style.glyph ? (
          <span aria-hidden="true" className="mt-px shrink-0">
            {style.glyph}
          </span>
        ) : null}
        <div className="[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2">{children}</div>
      </div>
    </div>
  );
}
