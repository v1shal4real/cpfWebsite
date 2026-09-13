import { useId, useRef, type ReactNode } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { transition } from '@/theme/motion';

/**
 * A small set of mutually exclusive choices, shown all at once.
 *
 * Used where the options are few and worth seeing side by side — the housing
 * plan, the nominal/real toggle, the theme. It is a real radio group: arrow
 * keys move and select, Home and End jump to the ends, and only the checked
 * option is in the tab order.
 *
 * The sliding indicator is a `layoutId` shared element, so the highlight
 * travels between options rather than blinking. It is disabled outright under
 * `prefers-reduced-motion`.
 */

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Spoken name, when `label` is an icon or an abbreviation. */
  srLabel?: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  /** Names the group for assistive tech. Required — a bare group is unlabelled. */
  label: string;
  /** Hides the visible legend but keeps it in the accessibility tree. */
  labelHidden?: boolean;
  options: readonly SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  size?: 'sm' | 'md';
  block?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string>({
  label,
  labelHidden = true,
  options,
  value,
  onValueChange,
  size = 'md',
  block = false,
  className,
}: SegmentedControlProps<T>) {
  const groupId = useId();
  const reduceMotion = useReducedMotion();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const enabled = options.filter((option) => !option.disabled);

  function move(direction: 1 | -1) {
    const currentIndex = enabled.findIndex((option) => option.value === value);
    const next = enabled[(currentIndex + direction + enabled.length) % enabled.length];
    if (!next) return;
    onValueChange(next.value);
    focusValue(next.value);
  }

  function focusValue(target: T) {
    const index = options.findIndex((option) => option.value === target);
    refs.current[index]?.focus();
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span id={`${groupId}-label`} className={cn('text-[0.8125rem] font-medium text-ink', labelHidden && 'sr-only-abs')}>
        {label}
      </span>
      <LayoutGroup id={groupId}>
        <div
          role="radiogroup"
          aria-labelledby={`${groupId}-label`}
          className={cn(
            'inline-flex rounded-md border border-line bg-surface-2 p-0.5',
            block && 'w-full',
          )}
          onKeyDown={(event) => {
            switch (event.key) {
              case 'ArrowRight':
              case 'ArrowDown':
                event.preventDefault();
                move(1);
                break;
              case 'ArrowLeft':
              case 'ArrowUp':
                event.preventDefault();
                move(-1);
                break;
              case 'Home':
                event.preventDefault();
                if (enabled[0]) {
                  onValueChange(enabled[0].value);
                  focusValue(enabled[0].value);
                }
                break;
              case 'End': {
                event.preventDefault();
                const last = enabled[enabled.length - 1];
                if (last) {
                  onValueChange(last.value);
                  focusValue(last.value);
                }
                break;
              }
            }
          }}
        >
          {options.map((option, index) => {
            const checked = option.value === value;
            return (
              <button
                key={option.value}
                ref={(node) => {
                  refs.current[index] = node;
                }}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={option.srLabel}
                disabled={option.disabled}
                tabIndex={checked ? 0 : -1}
                onClick={() => onValueChange(option.value)}
                className={cn(
                  'relative inline-flex flex-1 items-center justify-center whitespace-nowrap',
                  'rounded-sm font-medium transition-colors duration-100',
                  'disabled:pointer-events-none disabled:opacity-45',
                  size === 'sm' ? 'h-7 px-2.5 text-[0.75rem]' : 'h-8 px-3 text-[0.8125rem]',
                  checked ? 'text-ink' : 'text-ink-subtle hover:text-ink',
                )}
              >
                {checked ? (
                  <motion.span
                    layoutId="segmented-indicator"
                    aria-hidden="true"
                    className="absolute inset-0 rounded-sm border border-line bg-surface shadow-sm"
                    transition={reduceMotion ? { duration: 0 } : transition.fast}
                  />
                ) : null}
                <span className="relative">{option.label}</span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>
    </div>
  );
}
