import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Data table primitives.
 *
 * The table is not a fallback. The spec requires a tabular alternative to
 * every chart for screen-reader users, and the palette validation leans on it
 * as the relief for series colours that fall below 3:1 against the surface. So
 * it is designed to be read, not tolerated: tabular numerals, right-aligned
 * figures, a sticky header and first column, and a horizontal scroll container
 * that is itself keyboard-focusable and labelled, so a 360px screen can pan it.
 */

export interface TableProps extends ComponentPropsWithRef<'table'> {
  /** Required. Rendered as a real `<caption>`, visually hidden if `captionHidden`. */
  caption: ReactNode;
  captionHidden?: boolean;
  /** Tighter rows for the year-by-year projection table. */
  density?: 'comfortable' | 'compact';
  /** Keeps the first column visible while panning horizontally. */
  stickyFirstColumn?: boolean;
  /** Caps the scroll height; the header row stays pinned. */
  maxHeight?: string;
  containerClassName?: string;
  /**
   * Whether the scroll container is a tab stop. Keep `true` for a visible
   * table; set `false` when the table is rendered visually hidden as a chart's
   * screen-reader alternative, so it does not add an invisible tab stop.
   */
  focusable?: boolean;
}

export function Table({
  caption,
  captionHidden = false,
  density = 'comfortable',
  stickyFirstColumn = false,
  maxHeight,
  containerClassName,
  focusable = true,
  className,
  children,
  ...props
}: TableProps) {
  return (
    <div
      // Focusable so keyboard users can scroll it. WCAG 2.1.1 for scrollable regions.
      tabIndex={focusable ? 0 : undefined}
      role={focusable ? 'region' : undefined}
      aria-label={focusable && typeof caption === 'string' ? caption : undefined}
      className={cn(
        'relative overflow-auto rounded-md border border-line bg-surface',
        containerClassName,
      )}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table
        data-density={density}
        data-sticky-first={stickyFirstColumn || undefined}
        className={cn(
          'w-full border-collapse text-left text-[0.8125rem]',
          // Density
          'data-[density=comfortable]:[&_td]:py-2.5 data-[density=comfortable]:[&_th]:py-2.5',
          'data-[density=compact]:[&_td]:py-1.5 data-[density=compact]:[&_th]:py-1.5',
          // Sticky first column
          'data-[sticky-first]:[&_tr>*:first-child]:sticky data-[sticky-first]:[&_tr>*:first-child]:left-0',
          'data-[sticky-first]:[&_tr>*:first-child]:z-[1] data-[sticky-first]:[&_tbody_tr>*:first-child]:bg-surface',
          className,
        )}
        {...props}
      >
        <caption
          className={cn(
            'px-3 pb-2 pt-3 text-left text-[0.8125rem] font-medium text-ink',
            captionHidden && 'sr-only-abs',
          )}
        >
          {caption}
        </caption>
        {children}
      </table>
    </div>
  );
}

export function THead({ className, ...props }: ComponentPropsWithRef<'thead'>) {
  return (
    <thead
      className={cn(
        'sticky top-0 z-[2] bg-surface-2 [&_th]:border-b [&_th]:border-line',
        className,
      )}
      {...props}
    />
  );
}

export function TBody({ className, ...props }: ComponentPropsWithRef<'tbody'>) {
  return (
    <tbody
      className={cn(
        '[&_tr]:border-b [&_tr]:border-line [&_tr:last-child]:border-0',
        '[&_tr:hover]:bg-surface-2/60',
        className,
      )}
      {...props}
    />
  );
}

export function TFoot({ className, ...props }: ComponentPropsWithRef<'tfoot'>) {
  return (
    <tfoot
      className={cn('border-t border-line-strong bg-surface-2 font-medium', className)}
      {...props}
    />
  );
}

export function Tr({
  highlighted = false,
  className,
  ...props
}: ComponentPropsWithRef<'tr'> & {
  /** Marks a row such as the age-55 transition. Pair with a text cue in the row. */
  highlighted?: boolean;
}) {
  return (
    <tr
      data-highlighted={highlighted || undefined}
      className={cn('data-[highlighted]:bg-accent-soft/60', className)}
      {...props}
    />
  );
}

export function Th({
  numeric = false,
  className,
  scope = 'col',
  ...props
}: ComponentPropsWithRef<'th'> & { numeric?: boolean }) {
  return (
    <th
      scope={scope}
      className={cn(
        'whitespace-nowrap px-3 text-[0.75rem] font-medium text-ink-muted',
        numeric ? 'text-right' : 'text-left',
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  numeric = false,
  className,
  ...props
}: ComponentPropsWithRef<'td'> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        'whitespace-nowrap px-3 text-ink',
        numeric && 'text-right tabular-nums',
        className,
      )}
      {...props}
    />
  );
}
