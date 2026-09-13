import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Content for assistive tech only. Prefer real visible text where it fits. */
export function VisuallyHidden({ className, ...props }: ComponentPropsWithRef<'span'>) {
  return <span className={cn('sr-only-abs', className)} {...props} />;
}

/**
 * A polite live region. Used to announce the scrubbed age and the headline
 * figures as they change, since those updates are otherwise silent.
 *
 * Keep the text short and keep the region mounted — a region that is inserted
 * with content already in it is not reliably announced.
 */
export function LiveRegion({
  children,
  politeness = 'polite',
}: {
  children: ReactNode;
  politeness?: 'polite' | 'assertive';
}) {
  return (
    <div aria-live={politeness} aria-atomic="true" className="sr-only-abs">
      {children}
    </div>
  );
}

/**
 * A loading placeholder. The engine is synchronous and fast, so this exists for
 * the lazily-loaded chart bundle, not for the projection itself.
 */
export function Skeleton({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-surface-3', className)}
      {...props}
    />
  );
}

/**
 * A labelled list of parameters, used by the assumptions panel and the scrub
 * readout. Renders a real `<dl>` so each term is associated with its value.
 */
export interface DefinitionItem {
  term: ReactNode;
  value: ReactNode;
  /** Right-aligned beneath the value, e.g. a `SourceLink`. */
  meta?: ReactNode;
  /** Colour chip for a series. */
  swatch?: string;
}

export function DefinitionList({
  items,
  columns = 1,
  className,
}: {
  items: readonly DefinitionItem[];
  columns?: 1 | 2;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        'grid gap-x-6',
        columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1',
        className,
      )}
    >
      {items.map((item, index) => (
        <div
          key={index}
          className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0 sm:[&:nth-last-child(2)]:border-0"
        >
          <dt className="flex min-w-0 items-center gap-2 text-[0.8125rem] text-ink-muted">
            {item.swatch ? (
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-xs"
                style={{ backgroundColor: item.swatch }}
              />
            ) : null}
            {item.term}
          </dt>
          <dd className="flex shrink-0 flex-col items-end gap-0.5 text-right">
            <span className="text-[0.8125rem] font-medium text-ink tabular-nums" data-numeric>
              {item.value}
            </span>
            {item.meta ? <span className="text-[0.6875rem]">{item.meta}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Keyboard key glyph, used in the timeline's keyboard hint. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-line-strong border-b-2 bg-surface px-1 font-mono text-[0.6875rem] text-ink-muted">
      {children}
    </kbd>
  );
}
