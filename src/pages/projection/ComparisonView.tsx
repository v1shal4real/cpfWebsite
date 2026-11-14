import { Badge, Money, StatTile } from '@/components/ui';
import { RulesStamp } from '@/components/layout/RulesStamp';
import type { ProjectionResult } from '@/engine/types';
import { formatMoney } from '@/lib/format';
import type { RuleSet } from '@/rules';
import { SERIES } from '@/theme/series';
import { comparisonMetric } from './comparisonMetric';
import { headlineFigures, retirementSumContext } from './HeadlineRow';
import type { ScenarioId } from './scenarios';

/**
 * Scenarios A and B side by side, under one difference statement.
 *
 * Wide screens: two columns. Below the `sm` breakpoint the columns stack, A
 * above B, each headed by its name, so at 360px nothing is squeezed and
 * nothing scrolls sideways. The statement comes first in the DOM, so it is
 * also what a screen reader reaches first.
 *
 * Neutral by construction: the statement is the KAN-45 wording, the columns
 * use the same tiles and ink colours, and neither scenario is highlighted as
 * preferred. The only mark is which one the input panel is editing.
 */

export interface ComparisonViewProps {
  resultA: ProjectionResult;
  /** `null` while B's inputs cannot be projected. */
  resultB: ProjectionResult | null;
  active: ScenarioId;
  ruleSet: RuleSet;
}

export function ComparisonView({ resultA, resultB, active, ruleSet }: ComparisonViewProps) {
  const metric = resultB ? comparisonMetric(resultA, resultB) : null;
  const statement = !resultB
    ? 'Scenario B cannot be projected with its current inputs, so there is no comparison yet.'
    : metric
      ? metric.sentence
      : 'There is no comparison at 55: one of the projections ends before 55.';

  return (
    <section aria-labelledby="comparison-heading" className="flex min-w-0 flex-col gap-3">
      <h2 id="comparison-heading" className="sr-only-abs">
        Scenario comparison
      </h2>
      <div className="rounded-lg border border-line bg-surface p-4" role="status" aria-live="polite">
        <p className="text-[1.0625rem] font-semibold leading-snug text-ink sm:text-[1.25rem]" data-numeric>
          {statement}
        </p>
        {metric ? (
          <p className="mt-1 text-[0.8125rem] text-ink-muted">
            Scenario A {formatMoney(metric.a)}, scenario B {formatMoney(metric.b)}: all four accounts, once the
            Retirement Account is formed.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ScenarioColumn id="a" result={resultA} editing={active === 'a'} ruleSet={ruleSet} />
        {resultB ? <ScenarioColumn id="b" result={resultB} editing={active === 'b'} ruleSet={ruleSet} /> : null}
      </div>
    </section>
  );
}

function ScenarioColumn({
  id,
  result,
  editing,
  ruleSet,
}: {
  id: ScenarioId;
  result: ProjectionResult;
  editing: boolean;
  ruleSet: RuleSet;
}) {
  const name = `Scenario ${id.toUpperCase()}`;
  const figures = headlineFigures(result);
  const { at55 } = figures;
  return (
    <section aria-label={name} className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[0.9375rem] font-semibold text-ink">{name}</h3>
        {editing ? <Badge tone="neutral">Editing</Badge> : null}
      </div>
      {at55 ? (
        <>
          <StatTile
            label="Combined balances at 55"
            value={<Money value={at55.total} />}
            animationKey={at55.total}
            source={<RulesStamp compact ruleSet={ruleSet} />}
          />
          <StatTile
            label="Retirement Account at 55"
            value={<Money value={at55.retirementAccount} />}
            animationKey={at55.retirementAccount}
            accent={SERIES.ra.color}
            context={retirementSumContext(at55.retirementAccount, at55.fullRetirementSum, at55.year)}
          />
        </>
      ) : null}
      <StatTile
        label={`Accrued interest owed if sold at ${figures.endAge}`}
        value={<Money value={figures.accruedInterest} />}
        animationKey={figures.accruedInterest}
        accent={SERIES.accrued.color}
        context={figures.usedCpfForHousing ? undefined : 'No CPF used for housing.'}
        source={at55 ? undefined : <RulesStamp compact ruleSet={ruleSet} />}
      />
    </section>
  );
}
