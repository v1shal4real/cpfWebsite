import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { transition } from '@/theme/motion';

/**
 * A headline figure.
 *
 * The spec's headline row — balance at 55, position against the retirement
 * sum, accrued interest owed on sale — is not a chart. Each is one number that
 * answers one question, so it is rendered as a number, with its question as
 * the label and its provenance underneath.
 *
 * Anatomy, top to bottom: label, value, context line, source. The value
 * re-settles with a short spring when its input changes, keyed on the value,
 * so the eye catches which tile moved when a scenario is edited.
 */

export interface StatTileProps {
  /** Phrase the label as what the number answers: "Projected balance at 55". */
  label: ReactNode;
  value: ReactNode;
  /** Used to key the settle animation. Pass the raw number the value renders. */
  animationKey?: string | number;
  /** A comparison or qualifier: "$18,400 below the Full Retirement Sum". */
  context?: ReactNode;
  /** A `SourceLink` or a rules-as-at note. */
  source?: ReactNode;
  /** An `InfoTip` beside the label. */
  info?: ReactNode;
  /** Colour chip tying the tile to a chart series. */
  accent?: string;
  size?: 'md' | 'lg';
  className?: string;
}

export function StatTile({
  label,
  value,
  animationKey,
  context,
  source,
  info,
  accent,
  size = 'md',
  className,
}: StatTileProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={cn(
        'relative flex min-w-0 flex-col gap-1 rounded-lg border border-line bg-surface p-4',
        className,
      )}
    >
      {accent ? (
        <span
          aria-hidden="true"
          className="absolute left-0 top-4 h-5 w-[3px] rounded-r-full"
          style={{ backgroundColor: accent }}
        />
      ) : null}

      <div className="flex items-center gap-1.5">
        <span className="text-[0.8125rem] font-medium leading-tight text-ink-muted">{label}</span>
        {info}
      </div>

      <motion.div
        key={animationKey}
        initial={reduceMotion || animationKey === undefined ? false : { opacity: 0.4, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transition.spring}
        data-numeric
        className={cn(
          'font-semibold leading-none tracking-tight text-ink tabular-nums',
          size === 'lg' ? 'text-[2rem] sm:text-[2.25rem]' : 'text-[1.625rem]',
        )}
      >
        {value}
      </motion.div>

      {context ? (
        <div className="text-[0.8125rem] leading-snug text-ink-muted">{context}</div>
      ) : null}

      {source ? <div className="mt-1.5 text-[0.6875rem] text-ink-subtle">{source}</div> : null}
    </div>
  );
}
