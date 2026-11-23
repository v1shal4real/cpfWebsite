import { Field, PercentInput, SegmentedControl, SourceLink } from '@/components/ui';
import { INFLATION_LIMITS, describeDisplay, type DisplaySettings } from './displayState';

/**
 * The nominal / real switch, and the inflation assumption it rests on,
 * visible and editable whenever real terms are on.
 */
export function DisplayControl({
  display,
  onChange,
}: {
  display: DisplaySettings;
  onChange: (next: DisplaySettings) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl<'nominal' | 'real'>
        label="Show figures in"
        labelHidden={false}
        value={display.realTerms ? 'real' : 'nominal'}
        onValueChange={(value) => onChange({ ...display, realTerms: value === 'real' })}
        options={[
          { value: 'nominal', label: "Each year's dollars" },
          { value: 'real', label: "Today's dollars" },
        ]}
      />
      {display.realTerms ? (
        <Field
          label="Inflation a year"
          hint="Default: the historical average of MAS Core Inflation, which leaves out accommodation and private transport. An assumption, not a forecast; enter your own."
          labelAside={<SourceLink sourceId="masMacroeconomicReviewOct2026" variant="chip" />}
        >
          <PercentInput
            value={display.inflationPercent}
            onValueChange={(inflationPercent) =>
              onChange({
                ...display,
                inflationPercent: Math.min(
                  INFLATION_LIMITS.max,
                  Math.max(INFLATION_LIMITS.min, inflationPercent ?? INFLATION_LIMITS.min),
                ),
              })
            }
            min={INFLATION_LIMITS.min}
            max={INFLATION_LIMITS.max}
            step={0.1}
          />
        </Field>
      ) : null}
      <p className="text-[0.8125rem] text-ink-muted" aria-live="polite">
        {describeDisplay(display)}
      </p>
    </div>
  );
}
