import { createContext, useContext, useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * The wiring layer for every form control.
 *
 * `Field` owns the ids and the `aria-describedby` chain so no individual input
 * has to remember to build one. An input placed inside a `Field` picks up its
 * label, hint and error association automatically via context; the same input
 * used outside a `Field` still works and falls back to its own props.
 */

interface FieldContextValue {
  controlId: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/**
 * Read by input components. Returns the props an input must spread onto its
 * control element to be correctly associated with the surrounding `Field`.
 */
export function useFieldControl(overrides?: {
  id?: string;
  'aria-describedby'?: string;
  required?: boolean;
}) {
  const field = useContext(FieldContext);
  const fallbackId = useId();
  const describedBy =
    [field?.describedBy, overrides?.['aria-describedby']].filter(Boolean).join(' ') || undefined;

  return {
    id: overrides?.id ?? field?.controlId ?? fallbackId,
    'aria-describedby': describedBy,
    'aria-invalid': field?.invalid ? (true as const) : undefined,
    required: overrides?.required ?? field?.required ?? false,
  };
}

export interface FieldProps {
  label: ReactNode;
  /** Persistent helper text. Never a placeholder — placeholders vanish on type. */
  hint?: ReactNode;
  /** When set, the field renders as invalid and announces the message. */
  error?: ReactNode;
  required?: boolean;
  /** Sits at the end of the label row. Intended for a `SourceLink` or a `Tooltip`. */
  labelAside?: ReactNode;
  /** Hides the label visually but leaves it for screen readers. Use sparingly. */
  labelHidden?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({
  label,
  hint,
  error,
  required = false,
  labelAside,
  labelHidden = false,
  className,
  children,
}: FieldProps) {
  const controlId = useId();
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;

  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <FieldContext.Provider
      value={{
        controlId,
        describedBy: describedBy || undefined,
        invalid: Boolean(error),
        required,
      }}
    >
      <div className={cn('flex flex-col gap-1.5', className)}>
        <div
          className={cn(
            'flex items-baseline justify-between gap-3',
            labelHidden && 'sr-only-abs',
          )}
        >
          <label htmlFor={controlId} className="text-[0.8125rem] font-medium text-ink">
            {label}
            {required ? (
              <span className="ml-0.5 text-ink-subtle" aria-hidden="true">
                *
              </span>
            ) : null}
          </label>
          {labelAside ? <span className="shrink-0">{labelAside}</span> : null}
        </div>

        {children}

        {hint ? (
          <p id={hintId} className="text-[0.75rem] leading-snug text-ink-subtle">
            {hint}
          </p>
        ) : null}

        {error ? (
          <p
            id={errorId}
            role="alert"
            className="flex items-start gap-1 text-[0.75rem] leading-snug text-critical-ink"
          >
            <span aria-hidden="true" className="mt-px">
              &#9888;
            </span>
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}
