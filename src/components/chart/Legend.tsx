import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { SERIES, type SeriesKey } from '@/theme/series';

/**
 * A chart legend, rendered in HTML above the plot rather than inside the SVG.
 *
 * Present for any chart with two or more series, so identity never rests on
 * colour alone. Text stays in ink tokens; the swatch beside it carries the hue.
 *
 * With `onToggle`, each entry becomes a toggle button. Hiding a series must not
 * repaint the others — colour comes from the series registry, never from the
 * position of a series among those still visible.
 */

export interface LegendItem {
  key: SeriesKey;
  /** Optional figure beside the label, e.g. the value at the scrubbed age. */
  value?: ReactNode;
  /** Replaces the registry label, e.g. to add "(from 55)". */
  label?: ReactNode;
}

export interface LegendProps {
  items: readonly LegendItem[];
  hidden?: ReadonlySet<SeriesKey>;
  onToggle?: (key: SeriesKey) => void;
  className?: string;
}

export function Legend({ items, hidden, onToggle, className }: LegendProps) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {items.map((item) => {
        const meta = SERIES[item.key];
        const isHidden = hidden?.has(item.key) ?? false;

        const content = (
          <>
            <span
              aria-hidden="true"
              className={cn(
                'h-[3px] w-4 shrink-0 rounded-full transition-opacity',
                isHidden && 'opacity-30',
              )}
              style={{ backgroundColor: meta.color }}
            />
            <span className={cn('text-[0.8125rem] text-ink-muted', isHidden && 'line-through opacity-60')}>
              {item.label ?? meta.label}
            </span>
            {item.value !== undefined ? (
              <span className="text-[0.8125rem] font-medium text-ink tabular-nums" data-numeric>
                {item.value}
              </span>
            ) : null}
          </>
        );

        return (
          <li key={item.key}>
            {onToggle ? (
              <button
                type="button"
                aria-pressed={!isHidden}
                onClick={() => onToggle(item.key)}
                className="-mx-1 inline-flex min-h-6 items-center gap-1.5 rounded-sm px-1 hover:bg-surface-2"
              >
                {content}
              </button>
            ) : (
              <span className="inline-flex min-h-6 items-center gap-1.5">{content}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
