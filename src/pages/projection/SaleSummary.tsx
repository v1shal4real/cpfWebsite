import { memo } from 'react';
import { Card, CardBody, CardHeader, SourceLink } from '@/components/ui';
import type { ProjectionResult } from '@/engine/types';
import { formatAgeMonths, formatMoney } from '@/lib/format';

/**
 * Where the sale price went, in the order CPF Board applies it: the loan,
 * then the CPF refund with accrued interest, then cash. Stated, not judged:
 * no figure here is a gain or a loss, only where the money went.
 */

const dollars = (cents: number) => cents / 100;

export const SaleSummary = memo(function SaleSummary({ result }: { result: ProjectionResult }) {
  const month = result.months.find((each) => each.events.some((event) => event.kind === 'property-sold'));
  const sale = month?.events.find((event) => event.kind === 'property-sold');
  if (!month || sale?.kind !== 'property-sold') return null;
  const bought = month.events.find((event) => event.kind === 'property-purchased' && event.afterSale);

  const rows: { label: string; value: string; note?: string }[] = [
    { label: 'Sale price', value: formatMoney(dollars(sale.salePrice)) },
    { label: '1. Housing loan repaid', value: formatMoney(dollars(sale.outstandingLoan)) },
    {
      label: '2. Refunded to CPF',
      value: formatMoney(dollars(sale.refunded)),
      note:
        sale.refundNotCovered > 0
          ? `Of ${formatMoney(dollars(sale.refundDue))} due (CPF used plus accrued interest). The other ${formatMoney(dollars(sale.refundNotCovered))} is not covered by the price and need not be topped up.`
          : 'The CPF used for the property, including any grant, plus accrued interest.',
    },
    ...(sale.refundedToRetirement > 0
      ? [{ label: '   to the Retirement Account', value: formatMoney(dollars(sale.refundedToRetirement)) }]
      : []),
    ...(sale.refunded > 0
      ? [{ label: '   to the Ordinary Account', value: formatMoney(dollars(sale.refundedToOrdinary)) }]
      : []),
    {
      label: '3. Cash proceeds',
      value: formatMoney(dollars(sale.cashProceeds)),
      ...(sale.cashProceeds < 0 && {
        note: 'The price does not cover the loan: this is the cash needed to clear it.',
      }),
    },
  ];

  return (
    <Card>
      <CardHeader
        as="h3"
        title={`Sale at ${formatAgeMonths(month.ageInMonths)} (${month.month})`}
        description="The sale price is applied in this order. CPF refunds go to the Ordinary Account, or from 55 to the Retirement Account first."
      />
      <CardBody className="flex flex-col gap-3">
        <dl className="flex flex-col">
          {rows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-0.5 border-b border-line py-1.5 last:border-0"
            >
              <dt className="whitespace-pre text-[0.8125rem] text-ink-muted">{row.label}</dt>
              <dd className="text-right text-[0.8125rem] font-medium text-ink tabular-nums" data-numeric>
                {row.value}
              </dd>
              {row.note ? (
                <dd className="col-span-2 text-[0.75rem] font-normal text-ink-subtle">{row.note}</dd>
              ) : null}
            </div>
          ))}
        </dl>
        {bought?.kind === 'property-purchased' ? (
          <p className="text-[0.8125rem] text-ink-muted">
            The next home is bought the same month: {formatMoney(dollars(bought.fromOrdinaryAccount))} from
            the Ordinary Account, {formatMoney(dollars(bought.fromCash))} in cash, and a loan of{' '}
            {formatMoney(dollars(bought.loanPrincipal))}.
          </p>
        ) : null}
        <p className="flex flex-wrap gap-2">
          <SourceLink sourceId="housingRefund" variant="chip" />
        </p>
      </CardBody>
    </Card>
  );
});
