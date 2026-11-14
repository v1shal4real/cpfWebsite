import { Money, SourceLink, StatTile } from '@/components/ui';
import { RulesStamp } from '@/components/layout/RulesStamp';
import type { ProjectionResult } from '@/engine/types';
import { formatMoney } from '@/lib/format';
import type { FigureBasis, RuleSet } from '@/rules';
import { SERIES } from '@/theme/series';
import { headlineFigures, retirementSumContext } from './headlineFigures';

/**
 * The headline row: balance at 55, the Retirement Account against the cohort's
 * Full Retirement Sum, and accrued interest owed if the property were sold.
 *
 * Wording is neutral by rule. The gap to the retirement sum is stated as
 * "above" or "below" with the amount, never as good, bad, short or on track:
 * the tool describes a projection and suggests no course of action.
 */

const BASIS_NOTE: Record<FigureBasis, string | null> = {
  published: null,
  assumed: 'This sum is not yet published; it is carried forward at the stated escalation assumption.',
  'before-published': 'This sum is the earliest one CPF Board publishes, applied to an earlier year.',
};

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
