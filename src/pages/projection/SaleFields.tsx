import type { ReactNode } from 'react';
import {
  Checkbox,
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
import type { RuleSet } from '@/rules';
import type { FormField, FormValues } from './form';

/**
 * Selling the first home, and buying the next one in the same month.
 *
 * The sale price is the member's own figure: the tool makes no forecast of
 * property prices. The next home takes the same fields as the first, and the
 * same checks run on them.
 */

export interface SaleFieldsProps {
  values: FormValues;
  onChange: (patch: Partial<FormValues>) => void;
  rules: RuleSet;
  /** From the input panel: the changed-from-A mark, the due error, and touched tracking. */
  mark: (field: FormField, existing?: ReactNode) => ReactNode;
  errorFor: (field: FormField) => ReactNode;
  markTouched: (field: FormField) => () => void;
}

export function SaleFields({ values, onChange, rules, mark, errorFor, markTouched }: SaleFieldsProps) {
  const next = values.nextHousingPlan;
  const nextLimits = next === 'bank-loan' ? rules.housing.bankLoanLimits : rules.housing.hdbLoanLimits;
  const pct = (fraction: number) => `${Math.round(fraction * 100)}%`;

  return (
    <>
      <Checkbox
        checked={values.selling}
        onCheckedChange={(selling) =>
          onChange({
            selling,
            // A sensible starting point the first time it is ticked: ten years on.
            ...(selling &&
              values.saleAge === null &&
              values.purchaseAge !== null && { saleAge: values.purchaseAge + 10 }),
          })
        }
        description="Sold at your expected price: the loan is cleared, then the CPF used and its accrued interest are refunded, and the rest is cash."
      >
        Sell this home later
      </Checkbox>

      {values.selling ? (
        <>
          <Field label="Age at sale" required labelAside={mark('saleAge')} error={errorFor('saleAge')}>
            <NumericInput
              value={values.saleAge}
              onValueChange={(saleAge) => onChange({ saleAge })}
              onBlur={markTouched('saleAge')}
              groupDigits={false}
              suffix="years"
            />
          </Field>

          <Field
            label="Expected sale price"
            hint="Your own figure; the projection makes no forecast of property prices."
            required
            labelAside={mark('salePrice', <SourceLink sourceId="housingRefund" variant="chip" />)}
            error={errorFor('salePrice')}
          >
            <MoneyInput
              value={values.salePrice}
              onValueChange={(salePrice) => onChange({ salePrice })}
              onBlur={markTouched('salePrice')}
              min={0}
              step={10_000}
            />
          </Field>

          {mark('nextHousingPlan') ? (
            <span className="-mb-2 self-start">{mark('nextHousingPlan')}</span>
          ) : null}
          <SegmentedControl<HousingPlanChoice>
            label="Next home, bought the same month"
            labelHidden={false}
            block
            value={next}
            onValueChange={(nextHousingPlan) => onChange({ nextHousingPlan })}
            options={[
              { value: 'none', label: 'None' },
              { value: 'hdb-loan', label: 'HDB loan' },
              { value: 'bank-loan', label: 'Bank loan' },
            ]}
          />

          {next !== 'none' ? (
            <>
              <Field
                label="Next home price"
                required
                labelAside={mark('nextPropertyPrice')}
                error={errorFor('nextPropertyPrice')}
              >
                <MoneyInput
                  value={values.nextPropertyPrice}
                  onValueChange={(nextPropertyPrice) => onChange({ nextPropertyPrice })}
                  onBlur={markTouched('nextPropertyPrice')}
                  min={0}
                  step={10_000}
                />
              </Field>

              <Field
                label="Next home downpayment"
                hint={`At least ${pct(1 - nextLimits.maximumLoanToValue)} of the price. It can draw on the CPF refunded from the sale.`}
                required
                labelAside={mark('nextDownpayment')}
                error={errorFor('nextDownpayment')}
              >
                <MoneyInput
                  value={values.nextDownpayment}
                  onValueChange={(nextDownpayment) => onChange({ nextDownpayment })}
                  onBlur={markTouched('nextDownpayment')}
                  min={0}
                  step={1_000}
                />
              </Field>

              <Field
                label="Share of the next downpayment from the Ordinary Account"
                hint={
                  nextLimits.minimumCashDownpayment > 0
                    ? `The rest is paid in cash, which can come from the sale. With a bank loan, at least ${pct(nextLimits.minimumCashDownpayment)} of the price must be cash.`
                    : 'The rest is paid in cash, which can come from the sale.'
                }
                labelAside={mark('nextOrdinaryAccountSharePercent')}
                error={errorFor('nextOrdinaryAccountSharePercent')}
              >
                <Slider
                  min={0}
                  max={100}
                  step={5}
                  value={values.nextOrdinaryAccountSharePercent}
                  onValueChange={(nextOrdinaryAccountSharePercent) =>
                    onChange({ nextOrdinaryAccountSharePercent })
                  }
                  valueLabel={`${values.nextOrdinaryAccountSharePercent} percent from the Ordinary Account`}
                  readout={`${values.nextOrdinaryAccountSharePercent}%`}
                  minLabel="All cash"
                  maxLabel="All from OA"
                />
              </Field>

              <Field
                label="Next home loan tenure"
                hint={`Up to ${nextLimits.maximumTenureYears} years. Not needed if the downpayment covers the price.`}
                labelAside={mark('nextLoanTenureYears')}
                error={errorFor('nextLoanTenureYears')}
              >
                <Select
                  value={values.nextLoanTenureYears === null ? '' : String(values.nextLoanTenureYears)}
                  onChange={(event) =>
                    onChange({
                      nextLoanTenureYears: event.target.value === '' ? null : Number(event.target.value),
                    })
                  }
                  onBlur={markTouched('nextLoanTenureYears')}
                  placeholder="Choose a tenure"
                  options={Array.from({ length: nextLimits.maximumTenureYears }, (_, index) => {
                    const years = index + 1;
                    return { value: String(years), label: `${years} year${years === 1 ? '' : 's'}` };
                  })}
                />
              </Field>

              {next === 'bank-loan' ? (
                <Field
                  label="Next home bank loan rate"
                  hint="Your own figure, held for the whole tenure."
                  required
                  labelAside={mark('nextBankLoanRatePercent')}
                  error={errorFor('nextBankLoanRatePercent')}
                >
                  <PercentInput
                    value={values.nextBankLoanRatePercent}
                    onValueChange={(nextBankLoanRatePercent) => onChange({ nextBankLoanRatePercent })}
                    onBlur={markTouched('nextBankLoanRatePercent')}
                    min={0}
                    max={INPUT_LIMITS.maximumBankLoanRatePercent}
                    step={0.05}
                  />
                </Field>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}
