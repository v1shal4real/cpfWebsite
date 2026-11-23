import type { ReactNode } from 'react';
import { Field, MoneyInput, NumericInput, SourceLink } from '@/components/ui';
import type { FormField, FormValues } from './form';

/**
 * A voluntary housing refund: cash paid back into CPF against the home.
 *
 * Stated, not urged: the hint says what a refund does to the figures and
 * where the money goes, and nothing about whether to make one.
 */

export interface RefundFieldsProps {
  values: FormValues;
  onChange: (patch: Partial<FormValues>) => void;
  mark: (field: FormField, existing?: ReactNode) => ReactNode;
  errorFor: (field: FormField) => ReactNode;
  markTouched: (field: FormField) => () => void;
}

export function RefundFields({ values, onChange, mark, errorFor, markTouched }: RefundFieldsProps) {
  return (
    <>
      <Field
        label="Refund amount"
        hint="Optional. Cash paid back into CPF. It reduces the CPF used first, then the accrued interest, so less accrues from then on. It is credited to the Ordinary Account, or from 55 to the Retirement Account up to the Full Retirement Sum first."
        labelAside={mark(
          'voluntaryRefundAmount',
          <SourceLink sourceId="voluntaryHousingRefund" variant="chip" />,
        )}
        error={errorFor('voluntaryRefundAmount')}
      >
        <MoneyInput
          value={values.voluntaryRefundAmount}
          onValueChange={(voluntaryRefundAmount) =>
            onChange({
              voluntaryRefundAmount,
              // Start the age at the purchase the first time an amount is entered.
              ...(voluntaryRefundAmount !== null &&
                values.voluntaryRefundAge === null &&
                values.purchaseAge !== null && { voluntaryRefundAge: values.purchaseAge + 5 }),
            })
          }
          onBlur={markTouched('voluntaryRefundAmount')}
          min={0}
          step={1_000}
        />
      </Field>

      {values.voluntaryRefundAmount !== null ? (
        <Field
          label="Age at refund"
          hint="Capped at the CPF used plus accrued interest owed then."
          labelAside={mark('voluntaryRefundAge')}
          error={errorFor('voluntaryRefundAge')}
        >
          <NumericInput
            value={values.voluntaryRefundAge}
            onValueChange={(voluntaryRefundAge) => onChange({ voluntaryRefundAge })}
            onBlur={markTouched('voluntaryRefundAge')}
            groupDigits={false}
            suffix="years"
          />
        </Field>
      ) : null}
    </>
  );
}
