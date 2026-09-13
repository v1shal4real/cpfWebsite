import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useFieldControl } from './Field';

/**
 * Switch and Checkbox.
 *
 * The distinction is behavioural, not cosmetic: a `Switch` takes effect the
 * moment it moves (show the table view, adjust for inflation), a `Checkbox`
 * records a choice that something else later acts on. Both are built on a real
 * `input` so they inherit form semantics and the platform's own hit testing.
 */

export interface SwitchProps extends Omit<ComponentPropsWithRef<'input'>, 'type' | 'onChange'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Visible text beside the switch. Omit only when a `Field` supplies the label. */
  children?: ReactNode;
}

export function Switch({
  checked,
  onCheckedChange,
  children,
  className,
  id,
  disabled,
  ...props
}: SwitchProps) {
  const field = useFieldControl({ id, 'aria-describedby': props['aria-describedby'] });

  return (
    <label
      className={cn(
        'inline-flex cursor-pointer items-center gap-2.5 text-sm text-ink',
        disabled && 'cursor-not-allowed opacity-55',
        className,
      )}
    >
      <span className="relative inline-flex shrink-0">
        <input
          {...props}
          {...field}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="peer absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none flex h-5 w-9 items-center rounded-full p-0.5',
            'transition-colors duration-150',
            'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus',
            checked ? 'bg-surface-inverse' : 'bg-surface-3',
          )}
        >
          <span
            className={cn(
              'size-4 rounded-full bg-surface shadow-sm transition-transform duration-150',
              checked ? 'translate-x-4' : 'translate-x-0',
            )}
          />
        </span>
      </span>
      {children ? <span>{children}</span> : null}
    </label>
  );
}

export interface CheckboxProps extends Omit<ComponentPropsWithRef<'input'>, 'type' | 'onChange'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children?: ReactNode;
  /** Secondary line under the label. */
  description?: ReactNode;
}

export function Checkbox({
  checked,
  onCheckedChange,
  children,
  description,
  className,
  id,
  disabled,
  ...props
}: CheckboxProps) {
  const field = useFieldControl({ id, 'aria-describedby': props['aria-describedby'] });

  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-2.5 text-sm text-ink',
        disabled && 'cursor-not-allowed opacity-55',
        className,
      )}
    >
      <span className="relative mt-px inline-flex shrink-0">
        <input
          {...props}
          {...field}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="peer absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <span
          aria-hidden="true"
          className={cn(
            'flex size-[1.125rem] items-center justify-center rounded-xs border',
            'transition-colors duration-100',
            'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus',
            checked
              ? 'border-transparent bg-surface-inverse text-ink-inverse'
              : 'border-line-strong bg-surface',
          )}
        >
          {checked ? (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path
                d="M2.5 6.2 4.8 8.5 9.5 3.8"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </span>
      </span>
      {children || description ? (
        <span className="flex flex-col gap-0.5">
          {children ? <span>{children}</span> : null}
          {description ? (
            <span className="text-[0.75rem] leading-snug text-ink-subtle">{description}</span>
          ) : null}
        </span>
      ) : null}
    </label>
  );
}
