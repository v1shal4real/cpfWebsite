import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Containers.
 *
 * Elevation is carried by a border and the surface step, not by shadow. A page
 * of stacked drop shadows reads as a dashboard of widgets; this tool is meant
 * to read as one continuous instrument, so `elevated` exists but is reserved
 * for things that genuinely float, like a popover.
 */

export interface CardProps extends ComponentPropsWithRef<'div'> {
  /** `flat` sits on the canvas; `raised` lifts off it; `sunken` recedes into it. */
  tone?: 'flat' | 'raised' | 'sunken';
  elevated?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const TONES = {
  flat: 'bg-surface border border-line',
  raised: 'bg-surface border border-line-strong',
  sunken: 'bg-surface-2 border border-line',
} as const;

const PADDING = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-7',
} as const;

export function Card({
  tone = 'flat',
  elevated = false,
  padding = 'md',
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg',
        TONES[tone],
        PADDING[padding],
        elevated && 'shadow-md',
        className,
      )}
      {...props}
    />
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  /** Rendered under the title. One or two lines at most. */
  description?: ReactNode;
  /** Controls aligned to the right of the title row. */
  actions?: ReactNode;
  /** Heading level. Pick the one the document outline needs, not the one that looks right. */
  as?: 'h2' | 'h3' | 'h4';
  className?: string;
}

export function CardHeader({
  title,
  description,
  actions,
  as: Heading = 'h3',
  className,
}: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <Heading className="text-[0.9375rem] leading-tight text-ink">{title}</Heading>
        {description ? (
          <p className="text-[0.8125rem] leading-snug text-ink-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return <div className={cn('mt-4', className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      className={cn('mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3', className)}
      {...props}
    />
  );
}

export interface SectionProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  as?: 'h2' | 'h3';
  className?: string;
  children: ReactNode;
}

/** A titled region of the page. Renders a real `<section>` with a label. */
export function Section({
  title,
  description,
  actions,
  as = 'h2',
  className,
  children,
}: SectionProps) {
  return (
    <section className={cn('flex flex-col gap-4', className)}>
      <CardHeader title={title} description={description} actions={actions} as={as} />
      {children}
    </section>
  );
}

export function Divider({
  orientation = 'horizontal',
  className,
  ...props
}: ComponentPropsWithRef<'div'> & { orientation?: 'horizontal' | 'vertical' }) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        'bg-line',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  );
}
