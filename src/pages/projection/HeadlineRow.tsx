import { Money, SourceLink, StatTile } from '@/components/ui';
import { RulesStamp } from '@/components/layout/RulesStamp';
import type { AccountAmounts, ProjectionResult } from '@/engine/types';
import { formatMoney } from '@/lib/format';
import type { FigureBasis, RuleSet } from '@/rules';
import { SERIES } from '@/theme/series';

/**
 * The headline row: balance at 55, the Retirement Account against the cohort's
 * Full Retirement Sum, and accrued interest owed if the property were sold.
 *
 * Wording is neutral by rule. The gap to the retirement sum is stated as
 * "above" or "below" with the amount, never as good, bad, short or on track:
 * the tool describes a projection and suggests no course of action.
 */

const AGE_55_MONTHS = 55 * 12;

const dollars = (cents: number) => cents / 100;
const totalOf = (b: AccountAmounts) => b.ordinary + b.special + b.medisave + b.retirement;

/** The neutral sentence comparing the Retirement Account to the FRS. Exported for tests. */
export function retirementSumContext(retirementAccount: number, fullRetirementSum: number, year: number): string {
  const gap = retirementAccount - fullRetirementSum;
  const sum = `the Full Retirement Sum of ${formatMoney(fullRetirementSum)} for members turning 55 in ${year}`;
  if (Math.abs(gap) < 1) return `Equal to ${sum}.`;
  return `${formatMoney(Math.abs(gap))} ${gap > 0 ? 'above' : 'below'} ${sum}.`;
}

const BASIS_NOTE: Record<FigureBasis, string | null> = {
  published: null,
  assumed: 'This sum is not yet published; it is carried forward at the stated escalation assumption.',
  'before-published': 'This sum is the earliest one CPF Board publishes, applied to an earlier year.',
};

export interface HeadlineFigures {
  at55: { total: number; retirementAccount: number; fullRetirementSum: number; year: number; basis: FigureBasis } | null;
  /** From the projection's last month. Zero when no CPF was used for housing. */
  accruedInterest: number;
  refundable: number;
  usedCpfForHousing: boolean;
  endAge: number;
}

export function headlineFigures(result: ProjectionResult): HeadlineFigures {
  const { summary, months, input } = result;
  const month55 = months.find((month) => month.ageInMonths === AGE_55_MONTHS);
  const last = months.at(-1);
  const housing = last?.housing;
  return {
    at55:
      summary.atAge55 && month55
        ? {
            total: dollars(totalOf(summary.atAge55.balances)),
            retirementAccount: dollars(summary.atAge55.retirementAccount),
            fullRetirementSum: dollars(summary.atAge55.fullRetirementSum),
            year: Number(month55.month.slice(0, 4)),
            basis: summary.atAge55.retirementSumsBasis,
          }
        : null,
    accruedInterest: housing ? dollars(housing.accruedInterest) : 0,
    refundable: dollars(summary.atEnd.housingRefundable),
    usedCpfForHousing: (housing?.principalUsed ?? 0) > 0,
    endAge: input.endAge,
  };
}

export function HeadlineRow({ result, ruleSet }: { result: ProjectionResult; ruleSet: RuleSet }) {
  const figures = headlineFigures(result);
  const { at55 } = figures;
  const stamp = <RulesStamp compact ruleSet={ruleSet} />;

  return (
    <section aria-labelledby="headline-heading" className="flex min-w-0 flex-col gap-3">
      <h2 id="headline-heading" className="sr-only-abs">
        Headline figures
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {at55 ? (
          <>
            <StatTile
              size="lg"
              label="Projected balances at 55"
              value={<Money value={at55.total} />}
              animationKey={at55.total}
              context="All accounts, once the Retirement Account is formed"
              source={stamp}
            />
            <StatTile
              size="lg"
              label="Retirement Account at 55"
              value={<Money value={at55.retirementAccount} />}
              animationKey={at55.retirementAccount}
              accent={SERIES.ra.color}
              context={
                <>
                  {retirementSumContext(at55.retirementAccount, at55.fullRetirementSum, at55.year)}
                  {BASIS_NOTE[at55.basis] ? <> {BASIS_NOTE[at55.basis]}</> : null}
                </>
              }
              source={
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <SourceLink sourceId="fullRetirementSum" variant="chip" />
                  {stamp}
                </span>
              }
            />
          </>
        ) : null}
        <StatTile
          size="lg"
          label={`Accrued interest owed if sold at ${figures.endAge}`}
          value={<Money value={figures.accruedInterest} />}
          animationKey={figures.accruedInterest}
          accent={SERIES.accrued.color}
          context={
            figures.usedCpfForHousing
              ? `Refundable to CPF on sale: ${formatMoney(figures.refundable)}, the CPF used for the property plus this interest.`
              : 'No CPF used for housing in this projection.'
          }
          source={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <SourceLink sourceId="housingAccruedInterest" variant="chip" />
              {stamp}
            </span>
          }
        />
      </div>
    </section>
  );
}
