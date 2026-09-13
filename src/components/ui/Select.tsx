import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useFieldControl } from './Field';

/**
 * A native `<select>`, styled.
 *
 * Deliberately not a custom listbox. The native control gets correct keyboard
 * behaviour, correct screen-reader announcement and the platform's own picker
 * on a phone for free, and none of that is worth trading for a custom pop-up
 * in a tool whose selects hold three options each.
 */

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<ComponentPropsWithRef<'select'>, 'children'> {
  options: readonly SelectOption[];
  /** Shown as a disabled first option when the value is empty. */
  placeholder?: string;
  shellClassName?: string;
}

export function Select({
  options,
  placeholder,
  shellClassName,
  className,
  id,
  required,
  ...props
}: SelectProps) {
  const field = useFieldControl({
    id,
    'aria-describedby': props['aria-describedby'],
    required,
  });

  return (
    <div
      className={cn(
        'relative flex h-9.5 items-center rounded-md border border-line-strong bg-surface',
        'transition-[border-color] duration-100',
        'focus-within:border-focus focus-within:outline-2 focus-within:outline-offset-[-1px] focus-within:outline-focus',
        'has-[select:disabled]:bg-surface-2 has-[select:disabled]:opacity-60',
        shellClassName,
      )}
    >
      <select
        {...props}
        {...field}
        className={cn(
          'w-full appearance-none bg-transparent py-0 pl-3 pr-8 text-sm text-ink outline-none',
          'disabled:cursor-not-allowed',
          className,
        )}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-3 text-ink-subtle"
      >
        <ChevronDown />
      </span>
    </div>
  );
}

function ChevronDown(): ReactNode {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
