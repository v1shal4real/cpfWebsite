import { useId, type ComponentPropsWithRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { clamp } from '@/lib/format';
import { useFieldControl } from './Field';

/**
 * A range slider built on the native `input[type=range]`.
 *
 * Native is the right call twice over here: the keyboard contract (arrows,
 * Page Up/Down, Home/End) arrives correct and free, and this is the control
 * the timeline scrubber is built on, where every millisecond of input latency
 * is visible. The track fill is a CSS gradient driven by a custom property, so
 * dragging repaints one background rather than re-rendering React.
 *
 * `valueLabel` is important: a screen reader reading "62" off a downpayment
 * slider is useless, where "62 percent of the downpayment from the Ordinary
 * Account" is not. It feeds `aria-valuetext`.
 */

export interface SliderProps
  extends Omit<ComponentPropsWithRef<'input'>, 'value' | 'onChange' | 'type'> {
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Spoken in place of the raw number. Always supply one for a unit-bearing value. */
  valueLabel?: string;
  /** Rendered above the track, aligned right. Typically the formatted value. */
  readout?: ReactNode;
  /** Labels under the track at the two ends. */
  minLabel?: ReactNode;
  maxLabel?: ReactNode;
  /** Marks drawn on the track, e.g. the age-55 transition on the scrubber. */
  ticks?: readonly { value: number; label?: string }[];
}

export function Slider({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  valueLabel,
  readout,
  minLabel,
  maxLabel,
  ticks,
  className,
  id,
  disabled,
  ...props
}: SliderProps) {
  const field = useFieldControl({ id, 'aria-describedby': props['aria-describedby'] });
  const ticksId = useId();

  const fraction = max > min ? (clamp(value, min, max) - min) / (max - min) : 0;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {readout ? (
        <div className="flex justify-end text-sm font-medium text-ink" data-numeric>
          {readout}
        </div>
      ) : null}

      <div className="relative flex h-5 items-center">
        {/* Track and fill. Painted behind the input, which is transparent. */}
        <div aria-hidden="true" className="absolute inset-x-0 h-1.5 rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-surface-inverse"
            style={{ width: `${fraction * 100}%` }}
          />
        </div>

        {ticks?.length ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 h-5">
            {ticks.map((tick) => (
              <span
                key={tick.value}
                title={tick.label}
                className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-line-strong"
                style={{ left: `${((tick.value - min) / (max - min)) * 100}%` }}
              />
            ))}
          </div>
        ) : null}

        <input
          {...props}
          {...field}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-valuetext={valueLabel}
          aria-describedby={
            [field['aria-describedby'], ticks?.length ? ticksId : null].filter(Boolean).join(' ') ||
            undefined
          }
          onChange={(event) => onValueChange(Number(event.target.value))}
          className={cn(
            'no-select relative z-10 h-5 w-full cursor-grab bg-transparent active:cursor-grabbing',
            'disabled:cursor-not-allowed disabled:opacity-50',
            // The thumb. Sized past the 24px pointer-target floor on touch.
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-5',
            '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2',
            '[&::-webkit-slider-thumb]:border-surface [&::-webkit-slider-thumb]:bg-surface-inverse',
            '[&::-webkit-slider-thumb]:shadow-md',
            '[&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full',
            '[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-surface',
            '[&::-moz-range-thumb]:bg-surface-inverse [&::-moz-range-thumb]:shadow-md',
            '[&::-moz-range-track]:bg-transparent',
          )}
        />
      </div>

      {minLabel || maxLabel ? (
        <div className="flex justify-between text-[0.75rem] text-ink-subtle" data-numeric>
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      ) : null}

      {ticks?.length ? (
        <span id={ticksId} className="sr-only-abs">
          Marked points:{' '}
          {ticks.map((tick) => tick.label ?? String(tick.value)).join(', ')}.
        </span>
      ) : null}
    </div>
  );
}
