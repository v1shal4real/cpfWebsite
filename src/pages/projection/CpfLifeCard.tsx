import { memo } from 'react';
import { Callout, Card, CardBody, CardHeader, SourceLink } from '@/components/ui';
import { escalatingPayoutAt } from '@/engine/cpfLife';
import type { ProjectionResult } from '@/engine/types';
import { formatMoney, formatPercent } from '@/lib/format';

/**
 * CPF LIFE monthly payouts from 65, as estimates.
 *
 * Framing: every figure is an estimate read off CPF Board's published table,
 * labelled as such beside it, and no plan is presented as the better one.
 * The plans are described by what they do; the choice is the member's.
 */

const dollars = (cents: number) => cents / 100;

export const CpfLifeCard = memo(function CpfLifeCard({ result }: { result: ProjectionResult }) {
  const estimate = result.summary.cpfLife;
  if (!estimate) return null;
  const rise = formatPercent(estimate.escalatingAnnualRise, 0);

  const plans = [
    {
      name: 'Standard Plan',
      payout: formatMoney(dollars(estimate.standardFrom65)),
      detail: `Level for life. Started at 70 instead: about ${formatMoney(dollars(estimate.standardFrom70))} a month.`,
    },
    {
      name: 'Escalating Plan',
      payout: formatMoney(dollars(estimate.escalatingFrom65)),
      detail: `Starts lower and rises ${rise} a year: about ${formatMoney(dollars(escalatingPayoutAt(estimate, 75)))} at 75 and ${formatMoney(dollars(escalatingPayoutAt(estimate, 85)))} at 85.`,
    },
  ];

  return (
    <Card>
      <CardHeader
        as="h3"
        title="CPF LIFE monthly payouts from 65: estimates"
        description={`From ${formatMoney(dollars(estimate.premiumAt65))} in the Retirement Account at 65, the CPF LIFE premium.`}
      />
      <CardBody className="flex flex-col gap-4">
        <dl className="flex flex-col">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-0.5 border-b border-line py-2 last:border-0"
            >
              <dt className="text-[0.8125rem] font-medium text-ink">{plan.name}</dt>
              <dd className="text-right text-[0.9375rem] font-semibold text-ink tabular-nums" data-numeric>
                about {plan.payout} a month
              </dd>
              <dd className="col-span-2 text-[0.75rem] text-ink-muted">{plan.detail}</dd>
            </div>
          ))}
          <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-0.5 py-2">
            <dt className="text-[0.8125rem] font-medium text-ink">Basic Plan</dt>
            <dd className="text-right text-[0.8125rem] text-ink-muted">Not estimated</dd>
            <dd className="col-span-2 text-[0.75rem] text-ink-muted">
              Only part of the Retirement Account, 10% to 20%, becomes the premium, and payouts fall once
              balances drop below $60,000. CPF Board publishes no figures for it that scale to a balance.
            </dd>
          </div>
        </dl>

        <Callout tone="note" title="Estimates, not quotes">
          <p>
            Read off CPF Board&apos;s published Standard Plan figures for a male member turning 55 in 2026, at
            today&apos;s payout per dollar of premium; CPF Board notes payouts may be adjusted for long-term
            changes in interest rates or life expectancy. The Escalating Plan starts about 20% below the
            Standard Plan, a figure from a 2024 article on CPF Board&apos;s site. Amounts are in that
            year&apos;s dollars. The CPF LIFE Estimator on CPF Board&apos;s site gives a member&apos;s own
            figures.
          </p>
          <p className="flex flex-wrap gap-2 pt-1">
            <SourceLink sourceId="cpfLifePayouts" variant="chip" />
            <SourceLink sourceId="cpfLifeEscalatingPlan" variant="chip" />
            <SourceLink sourceId="cpfLifePlansComparison" variant="chip" />
          </p>
        </Callout>
      </CardBody>
    </Card>
  );
});
