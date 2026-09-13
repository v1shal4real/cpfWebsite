import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { fadeSlide } from '@/theme/motion';

/**
 * A tooltip that satisfies WCAG 2.2 1.4.13 (content on hover or focus).
 *
 * Three properties that most tooltip implementations miss, and that matter a
 * lot in a tool whose tooltips explain the rule behind a number:
 *
 *   - Dismissible: Escape closes it without moving the pointer or the focus.
 *   - Hoverable: the pointer can travel into the bubble, so its text can be
 *     read slowly and selected. That is why the close timer is cancelled on
 *     entering the bubble rather than fired on leaving the trigger.
 *   - Persistent: it stays while hovered or focused, and never on a timeout.
 *
 * Tooltips carry supplementary explanation only. Nothing a user must have in
 * order to complete a task belongs in one — that goes in a `Field` hint.
 */

export interface TooltipProps {
  content: ReactNode;
  side?: 'top' | 'bottom';
  /**
   * Adds the wrapper to the tab order. Leave `true` when the trigger is plain
   * text or an icon; set `false` when the child is already a button or link,
   * so the tab stop is not duplicated.
   */
  focusable?: boolean;
  className?: string;
  children: ReactNode;
}

export function Tooltip({
  content,
  side = 'top',
  focusable = true,
  className,
  children,
}: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const reduceMotion = useReducedMotion();

  function show() {
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  }

  // A short grace period so the pointer can cross the gap into the bubble.
  function scheduleHide() {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  }

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

  return (
    <span
      className={cn('relative inline-flex', className)}
      tabIndex={focusable ? 0 : undefined}
      aria-describedby={open ? id : undefined}
      onPointerEnter={show}
      onPointerLeave={scheduleHide}
      onFocus={show}
      onBlur={scheduleHide}
    >
      {children}
      <AnimatePresence>
        {open ? (
          <motion.span
            id={id}
            role="tooltip"
            variants={reduceMotion ? undefined : fadeSlide}
            initial={reduceMotion ? undefined : 'hidden'}
            animate={reduceMotion ? undefined : 'visible'}
            exit={reduceMotion ? undefined : 'exit'}
            onPointerEnter={show}
            onPointerLeave={scheduleHide}
            className={cn(
              'absolute left-1/2 z-50 w-max max-w-[min(19rem,80vw)] -translate-x-1/2',
              'rounded-md border border-line-strong bg-surface px-2.5 py-1.5 shadow-lg',
              'text-[0.75rem] font-normal leading-snug text-ink',
              side === 'top' ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]',
            )}
          >
            {content}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

/**
 * The question-mark affordance used beside a figure or a field label.
 *
 * `label` names the thing being explained, so the button announces as
 * "About the Ordinary Wage ceiling" rather than a row of identical "more info"
 * buttons.
 */
export function InfoTip({
  label,
  side = 'top',
  children,
}: {
  label: string;
  side?: 'top' | 'bottom';
  children: ReactNode;
}) {
  return (
    <Tooltip content={children} side={side} focusable={false}>
      <button
        type="button"
        aria-label={`About ${label}`}
        className={cn(
          'inline-flex size-4 items-center justify-center rounded-full',
          'border border-line-strong text-[0.625rem] font-semibold leading-none',
          'text-ink-subtle transition-colors hover:border-ink-muted hover:text-ink',
        )}
      >
        <span aria-hidden="true">?</span>
      </button>
    </Tooltip>
  );
}
