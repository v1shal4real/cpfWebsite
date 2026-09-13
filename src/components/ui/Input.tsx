import { useId, useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useFieldControl } from './Field';

/**
 * Text and numeric inputs.
 *
 * Shared rules:
 *   - No placeholder carries meaning. Placeholders disappear the moment a user
 *     types, so anything they need to keep is a `hint` on the `Field`.
 *   - Affixes ($, %, /month) are decorative and hidden from assistive tech; the
 *     unit reaches a screen reader through the label or an appended
 *     description instead, so it is announced rather than skipped.
 *   - Numeric inputs use `inputMode` so a phone raises the right keypad, which
 *     matters because mobile is the majority case for a shared link.
 */

const CONTROL_BASE = cn(
  'w-full bg-transparent text-sm text-ink placeholder:text-ink-subtle',
  'outline-none disabled:cursor-not-allowed',
);

const SHELL_BASE = cn(
  'flex h-9.5 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3',
  'transition-[border-color,box-shadow] duration-100',
  'focus-within:border-focus focus-within:outline-2 focus-within:outline-offset-[-1px] focus-within:outline-focus',
  'has-[input:disabled]:bg-surface-2 has-[input:disabled]:opacity-60',
  'has-[input[aria-invalid=true]]:border-critical',
);

interface ShellProps {
  prefix?: ReactNode;
  suffix?: ReactNode;
  className?: string;
  children: ReactNode;
}

function InputShell({ prefix, suffix, className, children }: ShellProps) {
  return (
    <div className={cn(SHELL_BASE, className)}>
      {prefix ? (
        <span aria-hidden="true" className="shrink-0 text-sm text-ink-subtle">
          {prefix}
        </span>
      ) : null}
      {children}
      {suffix ? (
        <span aria-hidden="true" className="shrink-0 text-sm text-ink-subtle">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

export interface TextInputProps extends Omit<ComponentPropsWithRef<'input'>, 'prefix'> {
  prefix?: ReactNode;
  suffix?: ReactNode;
  /** Classes for the bordered shell rather than the inner input. */
  shellClassName?: string;
}

export function TextInput({
  prefix,
  suffix,
  shellClassName,
  className,
  id,
  required,
  ...props
}: TextInputProps) {
  const field = useFieldControl({
    id,
    'aria-describedby': props['aria-describedby'],
    required,
  });

  return (
    <InputShell prefix={prefix} suffix={suffix} className={shellClassName}>
      <input {...props} {...field} className={cn(CONTROL_BASE, className)} />
    </InputShell>
  );
}

/* -------------------------------------------------------------------------- */

export interface NumericInputProps
  extends Omit<ComponentPropsWithRef<'input'>, 'value' | 'onChange' | 'type' | 'prefix'> {
  /** `null` means empty. An empty numeric field is a real state, not zero. */
  value: number | null;
  onValueChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: ReactNode;
  suffix?: ReactNode;
  shellClassName?: string;
  /**
   * Appended to the accessible description so the unit is spoken, e.g.
   * "in Singapore dollars". Affixes alone are not announced.
   */
  unitDescription?: string;
  /** Thousands separators while the field is not focused. */
  groupDigits?: boolean;
}

/**
 * A numeric field that keeps the raw string while focused and formats on blur.
 *
 * Reformatting mid-keystroke moves the caret and makes the field feel like it
 * is fighting the user, so the display only settles once they leave it.
 */
export function NumericInput({
  value,
  onValueChange,
  min,
  max,
  step,
  prefix,
  suffix,
  shellClassName,
  unitDescription,
  groupDigits = true,
  className,
  id,
  required,
  onFocus,
  onBlur,
  ...props
}: NumericInputProps) {
  const unitId = useId();
  const [draft, setDraft] = useState<string | null>(null);

  const field = useFieldControl({
    id,
    'aria-describedby': [props['aria-describedby'], unitDescription ? unitId : null]
      .filter(Boolean)
      .join(' '),
    required,
  });

  const display =
    draft ??
    (value === null
      ? ''
      : groupDigits
        ? value.toLocaleString('en-SG', { maximumFractionDigits: 2 })
        : String(value));

  return (
    <>
      <InputShell prefix={prefix} suffix={suffix} className={shellClassName}>
        <input
          {...props}
          {...field}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={display}
          role="spinbutton"
          aria-valuenow={value ?? undefined}
          aria-valuemin={min}
          aria-valuemax={max}
          onFocus={(event) => {
            setDraft(value === null ? '' : String(value));
            onFocus?.(event);
          }}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            const cleaned = next.replace(/[,\s_]/g, '');
            if (cleaned === '' || cleaned === '-') {
              onValueChange(null);
              return;
            }
            const parsed = Number(cleaned);
            if (Number.isFinite(parsed)) onValueChange(parsed);
          }}
          onBlur={(event) => {
            setDraft(null);
            // Clamp on exit rather than on every keystroke, so typing "1" on the
            // way to "100" in a field with a minimum of 10 is not fought.
            if (value !== null) {
              let clamped = value;
              if (min !== undefined && clamped < min) clamped = min;
              if (max !== undefined && clamped > max) clamped = max;
              if (clamped !== value) onValueChange(clamped);
            }
            onBlur?.(event);
          }}
          onKeyDown={(event) => {
            // Arrow keys are expected on a spinbutton and cost nothing to add.
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
            event.preventDefault();
            const delta = (step ?? 1) * (event.key === 'ArrowUp' ? 1 : -1);
            const base = value ?? min ?? 0;
            let next = base + delta;
            if (min !== undefined && next < min) next = min;
            if (max !== undefined && next > max) next = max;
            setDraft(String(next));
            onValueChange(next);
          }}
          className={cn(CONTROL_BASE, className)}
        />
      </InputShell>
      {unitDescription ? (
        <span id={unitId} className="sr-only-abs">
          {unitDescription}
        </span>
      ) : null}
    </>
  );
}

/** A dollar field. `$` is shown; "in Singapore dollars" is spoken. */
export function MoneyInput(props: Omit<NumericInputProps, 'prefix' | 'unitDescription'>) {
  return <NumericInput prefix="$" unitDescription="in Singapore dollars" step={100} {...props} />;
}

/** A percentage field. The value is in percentage points, not a fraction. */
export function PercentInput(props: Omit<NumericInputProps, 'suffix' | 'unitDescription'>) {
  return (
    <NumericInput
      suffix="%"
      unitDescription="percent"
      step={0.5}
      groupDigits={false}
      {...props}
    />
  );
}
