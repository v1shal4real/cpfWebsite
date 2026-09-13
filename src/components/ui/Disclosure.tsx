import { useId, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { collapse } from '@/theme/motion';

/**
 * Progressive disclosure.
 *
 * The workhorse of dense numerical output: the headline figure stays in view
 * and the working behind it opens beneath. The spec is explicit that the
 * assumptions panel is visible rather than hidden behind a link, so do not use
 * this to tuck assumptions away — use it for *derivations* the user may or may
 * not want to follow.
 *
 * A real `<button aria-expanded>` controlling a region, rather than a native
 * `<details>`, so the body can animate its height and the open state can be
 * lifted into URL state when a shared link should arrive with a panel open.
 */

export interface DisclosureProps {
  title: ReactNode;
  /** Right-aligned in the header row, e.g. a summary figure. Stays visible when closed. */
  summary?: ReactNode;
  defaultOpen?: boolean;
  /** Controlled mode. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  children: ReactNode;
}

export function Disclosure({
  title,
  summary,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className,
  children,
}: DisclosureProps) {
  const id = useId();
  const reduceMotion = useReducedMotion();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;

  function toggle() {
    const next = !open;
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  return (
    <div className={cn('border-b border-line', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        id={`${id}-trigger`}
        onClick={toggle}
        className={cn(
          'flex w-full items-center gap-3 py-3 text-left',
          'text-sm font-medium text-ink hover:text-ink',
        )}
      >
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          className={cn(
            'shrink-0 text-ink-subtle transition-transform duration-150',
            open && 'rotate-90',
          )}
        >
          <path
            d="M4.5 2.5 8 6l-3.5 3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="min-w-0 flex-1">{title}</span>
        {summary ? (
          <span className="shrink-0 text-sm text-ink-muted" data-numeric>
            {summary}
          </span>
        ) : null}
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={`${id}-panel`}
            role="region"
            aria-labelledby={`${id}-trigger`}
            variants={reduceMotion ? undefined : collapse}
            initial={reduceMotion ? undefined : 'hidden'}
            animate={reduceMotion ? undefined : 'visible'}
            exit={reduceMotion ? undefined : 'hidden'}
            className="overflow-hidden"
          >
            <div className="pb-4 pl-6 text-sm text-ink-muted">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
