import { useState, type ReactNode } from 'react';
import {
  Badge,
  Callout,
  Field,
  MoneyInput,
  NumericInput,
  PercentInput,
  SegmentedControl,
  Select,
  Slider,
  SourceLink,
} from '@/components/ui';
import { INPUT_LIMITS, type HousingPlanChoice } from '@/engine/validate';
import { formatMoney } from '@/lib/format';
import { sourceFor, type RuleSet } from '@/rules';
import {
  DEFAULT_SALARY_GROWTH_PERCENT,
  shouldShowError,
  type FormErrors,
  type FormField,
  type FormValues,
} from './form';
import { retentionHint, retentionNote, shareInterestHint } from './retentionCopy';

/**
 * The projection input panel: every §3.1 input.
 *
 * Controlled from the page, which owns the form values, so the projection
 * recomputes on every change. The panel owns only which fields the visitor has
 * visited, which decides when a "required" message may appear (see
 * `shouldShowError`); a wrong value is flagged as soon as it is entered.
 *
 * Bounds and figures in hints come from the rule set and `INPUT_LIMITS`, the
 * same sources the validator uses, so a hint never promises a range the
 * engine would reject.
 */

export interface InputPanelProps {
  values: FormValues;
  onChange: (patch: Partial<FormValues>) => void;
  errors: FormErrors;
  /** The rule set the projection is pinned to, for the figures in hints. */
  rules: RuleSet;
  /** While editing scenario B: the fields that differ from scenario A, each marked. */
  changed?: ReadonlySet<FormField> | undefined;
}

export function InputPanel({ values, onChange, errors, rules, changed }: InputPanelProps) {
  /** A visible, announced mark on a field B has changed from A, next to anything already in the label row. */
  const mark = (field: FormField, existing?: ReactNode): ReactNode => {
    const isChanged = changed?.has(field) ?? false;
    if (!isChanged) return existing;
    return (
      <span className="flex items-center gap-1.5">
        <ChangedMark />
        {existing}
      </span>
    );
  };
  const { wageCeilings, contributionRates } = rules;
  const [touched, setTouched] = useState<ReadonlySet<FormField>>(new Set());

  const markTouched = (field: FormField) => () =>
    setTouched((previous) => (previous.has(field) ? previous : new Set(previous).add(field)));

  /** The error to show beside a field, if any is due yet. */
  const errorFor = (field: FormField): ReactNode =>
    shouldShowError(errors[field], touched.has(field)) ? errors[field]?.message : undefined;

  const housing = values.housingPlan !== 'none';
  const loanLimits =
    values.housingPlan === 'bank-loan' ? rules.housing.bankLoanLimits : rules.housing.hdbLoanLimits;
  const maxTenure = loanLimits.maximumTenureYears;
  const pct = (fraction: number) => `${Math.round(fraction * 100)}%`;

  return (
    <form
      className="flex flex-col gap-6"
      // Nothing to submit: the projection follows every change.
      onSubmit={(event) => event.preventDefault()}
      noValidate
    >
      <Group legend="About you">
        <Field
          label="Current age"
          hint={`${INPUT_LIMITS.minimumAge} to ${INPUT_LIMITS.maximumAge}.`}
          required
          labelAside={mark('currentAge')}
          error={errorFor('currentAge')}
        >
          <NumericInput
            value={values.currentAge}
            onValueChange={(currentAge) => onChange({ currentAge })}
            onBlur={markTouched('currentAge')}
            min={INPUT_LIMITS.minimumAge}
            max={INPUT_LIMITS.maximumAge}
            groupDigits={false}
            suffix="years"
          />
        </Field>

        <Field
          label="Gross monthly salary"
          hint={`Ordinary Wages only. Contributions stop at the ${formatMoney(wageCeilings.ordinaryWageCeiling)} Ordinary Wage ceiling.`}
          required
          labelAside={mark(
            'monthlySalary',
            <SourceLink sourceId={sourceFor(contributionRates)} variant="chip" />,
          )}
          error={errorFor('monthlySalary')}
        >
          <MoneyInput
            value={values.monthlySalary}
            onValueChange={(monthlySalary) => onChange({ monthlySalary })}
            onBlur={markTouched('monthlySalary')}
            min={0}
            suffix="/month"
          />
        </Field>

        <Field
          label="Expected salary growth a year"
          hint={`Default ${DEFAULT_SALARY_GROWTH_PERCENT}%: assumes your salary stays as it is today. Enter your own expectation to see the effect of pay rises; ${INPUT_LIMITS.minimumSalaryGrowthPercent}% to ${INPUT_LIMITS.maximumSalaryGrowthPercent}%.`}
          required
          labelAside={mark('salaryGrowthPercent')}
          error={errorFor('salaryGrowthPercent')}
        >
          <PercentInput
            value={values.salaryGrowthPercent}
            onValueChange={(salaryGrowthPercent) => onChange({ salaryGrowthPercent })}
            onBlur={markTouched('salaryGrowthPercent')}
            min={INPUT_LIMITS.minimumSalaryGrowthPercent}
            max={INPUT_LIMITS.maximumSalaryGrowthPercent}
          />
        </Field>
      </Group>

      <Group legend="Current CPF balances" description="Optional. Leave a field blank for zero.">
        <Field
          label="Ordinary Account"
          labelAside={mark('ordinaryBalance')}
          error={errorFor('ordinaryBalance')}
        >
          <MoneyInput
            value={values.ordinaryBalance}
            onValueChange={(ordinaryBalance) => onChange({ ordinaryBalance })}
            onBlur={markTouched('ordinaryBalance')}
            min={0}
          />
        </Field>
        <Field label="Special Account" labelAside={mark('specialBalance')} error={errorFor('specialBalance')}>
          <MoneyInput
            value={values.specialBalance}
            onValueChange={(specialBalance) => onChange({ specialBalance })}
            onBlur={markTouched('specialBalance')}
            min={0}
          />
        </Field>
        <Field
          label="MediSave Account"
          labelAside={mark('medisaveBalance')}
          error={errorFor('medisaveBalance')}
        >
          <MoneyInput
            value={values.medisaveBalance}
            onValueChange={(medisaveBalance) => onChange({ medisaveBalance })}
            onBlur={markTouched('medisaveBalance')}
            min={0}
          />
        </Field>
      </Group>

      <Group legend="Property">
        {changed?.has('housingPlan') ? (
          <span className="-mb-2 self-start">
            <ChangedMark what="Housing plan" />
          </span>
        ) : null}
        <SegmentedControl<HousingPlanChoice>
          label="Housing plan"
          labelHidden={false}
          block
          value={values.housingPlan}
          onValueChange={(housingPlan) => onChange({ housingPlan })}
          options={[
            { value: 'none', label: 'None' },
            { value: 'hdb-loan', label: 'HDB loan' },
            { value: 'bank-loan', label: 'Bank loan' },
          ]}
        />

        {/* Only with a plan: hidden fields are neither shown nor validated. */}
        {housing ? (
          <>
            <Field
              label="Property price"
              required
              labelAside={mark('propertyPrice')}
              error={errorFor('propertyPrice')}
            >
              <MoneyInput
                value={values.propertyPrice}
                onValueChange={(propertyPrice) => onChange({ propertyPrice })}
                onBlur={markTouched('propertyPrice')}
                min={0}
                step={1_000}
              />
            </Field>

            <Field
              label="Age at purchase"
              hint="From your current age up to the end of the projection."
              required
              labelAside={mark('purchaseAge')}
              error={errorFor('purchaseAge')}
            >
              <NumericInput
                value={values.purchaseAge}
                onValueChange={(purchaseAge) => onChange({ purchaseAge })}
                onBlur={markTouched('purchaseAge')}
                groupDigits={false}
                suffix="years"
              />
            </Field>

            <Field
              label="Downpayment"
              hint={`The whole downpayment, at least ${pct(1 - loanLimits.maximumLoanToValue)} of the price: ${values.housingPlan === 'bank-loan' ? 'a bank loan' : 'an HDB loan'} covers up to ${pct(loanLimits.maximumLoanToValue)}. The loan is the price less this.`}
              required
              labelAside={mark('downpayment')}
              error={errorFor('downpayment')}
            >
              <MoneyInput
                value={values.downpayment}
                onValueChange={(downpayment) => onChange({ downpayment })}
                onBlur={markTouched('downpayment')}
                min={0}
                step={1_000}
              />
            </Field>

            <Field
              label="Share of the downpayment from the Ordinary Account"
              hint={
                loanLimits.minimumCashDownpayment > 0
                  ? `The rest is paid in cash. With a bank loan, at least ${pct(loanLimits.minimumCashDownpayment)} of the price must be cash. ${shareInterestHint()}`
                  : `The rest is paid in cash. An HDB loan downpayment may come wholly from the Ordinary Account. ${shareInterestHint()}`
              }
              labelAside={mark('ordinaryAccountSharePercent')}
              error={errorFor('ordinaryAccountSharePercent')}
            >
              <Slider
                min={0}
                max={100}
                step={5}
                value={values.ordinaryAccountSharePercent}
                onValueChange={(ordinaryAccountSharePercent) => onChange({ ordinaryAccountSharePercent })}
                valueLabel={`${values.ordinaryAccountSharePercent} percent from the Ordinary Account`}
                readout={`${values.ordinaryAccountSharePercent}%`}
                minLabel="All cash"
                maxLabel="All from OA"
              />
            </Field>

            <Field
              label="Ordinary Account to set aside"
              hint={retentionHint(rules, values.housingPlan)}
              labelAside={mark('retainedOrdinaryAccount')}
              error={errorFor('retainedOrdinaryAccount')}
            >
              <MoneyInput
                value={values.retainedOrdinaryAccount}
                onValueChange={(retainedOrdinaryAccount) => onChange({ retainedOrdinaryAccount })}
                onBlur={markTouched('retainedOrdinaryAccount')}
                min={0}
                max={values.housingPlan === 'hdb-loan' ? rules.housing.hdbLoanRetentionCap : undefined}
                step={1_000}
              />
            </Field>

            <RetentionNoteCallout rules={rules} plan={values.housingPlan} />

            <Field
              label="Loan tenure"
              hint={`Up to ${maxTenure} years for ${values.housingPlan === 'bank-loan' ? 'a bank loan' : 'an HDB loan'}. Not needed if the downpayment covers the price.`}
              labelAside={mark('loanTenureYears')}
              error={errorFor('loanTenureYears')}
            >
              <Select
                value={values.loanTenureYears === null ? '' : String(values.loanTenureYears)}
                onChange={(event) =>
                  onChange({ loanTenureYears: event.target.value === '' ? null : Number(event.target.value) })
                }
                onBlur={markTouched('loanTenureYears')}
                placeholder="Choose a tenure"
                options={Array.from({ length: maxTenure }, (_, index) => {
                  const years = index + 1;
                  return { value: String(years), label: `${years} year${years === 1 ? '' : 's'}` };
                })}
              />
            </Field>

            {values.housingPlan === 'bank-loan' ? (
              <Field
                label="Bank loan interest rate"
                hint="Your own figure, held for the whole tenure. HDB loans take their rate from CPF's published peg instead."
                required
                labelAside={mark('bankLoanRatePercent')}
                error={errorFor('bankLoanRatePercent')}
              >
                <PercentInput
                  value={values.bankLoanRatePercent}
                  onValueChange={(bankLoanRatePercent) => onChange({ bankLoanRatePercent })}
                  onBlur={markTouched('bankLoanRatePercent')}
                  min={0}
                  max={INPUT_LIMITS.maximumBankLoanRatePercent}
                  step={0.05}
                />
              </Field>
            ) : null}
          </>
        ) : null}
      </Group>
    </form>
  );
}

/**
 * A titled group of related fields. A real fieldset, so the legend is
 * announced with each control. Browsers lay a legend out outside the
 * fieldset's own flow; floating it puts it back in, so the description and
 * fields stack beneath it instead of under it.
 */
function Group({
  legend,
  description,
  children,
}: {
  legend: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="float-left w-full text-[0.9375rem] font-semibold leading-tight text-ink">
        {legend}
      </legend>
      <div className="clear-left flex flex-col gap-4 pt-1">
        {description ? <p className="text-[0.8125rem] text-ink-muted">{description}</p> : null}
        {children}
      </div>
    </fieldset>
  );
}

/** The note beside the retention option: why the HDB cap and the extra-interest sub-cap match. */
function RetentionNoteCallout({ rules, plan }: { rules: RuleSet; plan: FormValues['housingPlan'] }) {
  const note = retentionNote(rules, plan);
  return (
    <Callout tone="note" title={note.title}>
      {note.paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <p className="flex flex-wrap gap-2 pt-1">
        <SourceLink sourceId={sourceFor(rules.housing, 'hdbLoanRetentionCap')} variant="chip" />
        <SourceLink sourceId={sourceFor(rules.interest, 'extraInterestCountingOrder')} variant="chip" />
      </p>
    </Callout>
  );
}

/** The mark on a scenario B field that differs from scenario A. Text, not colour alone. */
function ChangedMark({ what }: { what?: string }) {
  return (
    <Badge tone="info" className="whitespace-nowrap">
      {what ? `${what}: changed from A` : 'Changed from A'}
    </Badge>
  );
}
