import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * A small inline label.
 *
 * Status tones never carry meaning alone — each renders a glyph alongside the
 * text, so the badge still reads in greyscale, in forced-colors mode and for a
 * reader who cannot separate the hues.
 */

export type BadgeTone = 'neutral' | 'good' | 'warning' | 'serious' | 'critical' | 'info';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-ink-muted border-line',
  good: 'bg-surface-2 text-good-ink border-good/35',
  warning: 'bg-surface-2 text-warning-ink border-warning/45',
  serious: 'bg-surface-2 text-serious-ink border-serious/45',
  critical: 'bg-surface-2 text-critical-ink border-critical/40',
  info: 'bg-accent-soft text-accent border-accent/30',
};

const GLYPHS: Partial<Record<BadgeTone, string>> = {
  good: '✓',
  warning: '⚠',
  serious: '⚠',
  critical: '✕',
  info: 'i',
};

export interface BadgeProps {
  tone?: BadgeTone;
  /** Suppresses the status glyph. Only valid for the neutral tone. */
  glyphHidden?: boolean;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', glyphHidden = false, className, children }: BadgeProps) {
  const glyph = glyphHidden ? undefined : GLYPHS[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5',
        'text-[0.6875rem] font-medium leading-4 tracking-wide',
        TONES[tone],
        className,
      )}
    >
      {glyph ? <span aria-hidden="true">{glyph}</span> : null}
      {children}
    </span>
  );
}

/**
 * A colour chip that identifies a data series next to its name.
 *
 * Always paired with a label. The chip is the secondary encoding the palette
 * validation assumes: it sits beside text, never in place of it.
 */
export function Swatch({
  color,
  shape = 'line',
  className,
}: {
  color: string;
  shape?: 'line' | 'square';
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block shrink-0',
        shape === 'line' ? 'h-0.5 w-3.5 rounded-full' : 'size-2.5 rounded-xs',
        className,
      )}
      style={{ backgroundColor: color }}
    />
  );
}
