import { useMemo } from 'react';
import {
  Callout,
  Card,
  CardBody,
  CardHeader,
  DefinitionList,
  Money,
  StatTile,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
} from '@/components/ui';
import { Container } from '@/components/layout/AppShell';
import { RulesStamp } from '@/components/layout/RulesStamp';
import { projectDraft } from '@/engine/project';
import type { AccountAmounts, AccountName, ProjectionResult } from '@/engine/types';
import type { ProjectionDraft } from '@/engine/validate';
import { formatMoney, formatPercent } from '@/lib/format';
import { cn } from '@/lib/cn';
import { SERIES, type SeriesKey } from '@/theme/series';

/**
 * The projection page: the product's landing view.
 *
 * Layout, and why. Three regions, in this DOM order, which is also the order
 * at 360px and the order a screen reader and the keyboard follow:
 *
 *   1. Headline: the answer, first. The spec's thirty-second criterion is met
 *      by a projection already on screen above the fold, not by a form.
 *   2. Inputs: what produced the answer, directly beneath it, so the figures
 *      and the assumptions behind them are never more than a scroll apart.
 *   3. Results: the chart, timeline and assumptions panel, which need width
 *      and reward it.
 *
 * From the `lg` breakpoint the inputs move to a sticky left column beside the
 * results, so editing an input and watching the chart respond happen in one
 * view. Grid areas move them; the DOM order does not change, so the reading
 * and focus order stay the same at every width.
 *
 * Each region is a slot its own ticket fills: the input panel, the headline
 * figures row, the balance chart, the timeline and the assumptions panel. The
 * content here is the first cut of each, enough to show the projection on
 * landing.
 */

const AGE_55 = 55;

/** The balance columns, in the series registry's order, and the engine account each reads. */
const BALANCE_COLUMNS: readonly { key: SeriesKey; account: AccountName }[] = [
  { key: 'oa', account: 'ordinary' },
  { key: 'sa', account: 'special' },
  { key: 'ma', account: 'medisave' },
  { key: 'ra', account: 'retirement' },
];

/** Balances, in dollars, at the end of the month the member reaches each age. */
interface AgeRow {
  age: number;
  balances: AccountAmounts;
}

function centsToDollars(cents: number): number {
  return cents / 100;
}

function totalOf(balances: AccountAmounts): number {
  return balances.ordinary + balances.special + balances.medisave + balances.retirement;
}

/** One row every five years, plus 55 and the final age, from the projection's months. */
function rowsAtMilestones(result: ProjectionResult): AgeRow[] {
  const { startAge, endAge } = result.input;
  const ages = new Set<number>([startAge, endAge]);
  for (let age = Math.ceil(startAge / 5) * 5; age <= endAge; age += 5) ages.add(age);
  if (startAge <= AGE_55 && AGE_55 <= endAge) ages.add(AGE_55);
  return [...ages]
    .sort((a, b) => a - b)
    .flatMap((age) => {
      const month = result.months.find((each) => each.ageInMonths === age * 12);
      return month ? [{ age, balances: month.closingBalances }] : [];
    });
}

export function ProjectionPage({ draft }: { draft: ProjectionDraft }) {
  // The engine is pure and well inside its 50ms budget, so the page simply
  // recomputes whenever the draft changes.
  const outcome = useMemo(() => projectDraft(draft), [draft]);

  return (
    <Container className="flex flex-col gap-6 py-6 sm:gap-8 sm:py-10">
      <header className="flex max-w-3xl flex-col gap-2">
        <h1 className="text-[1.625rem] leading-tight text-ink sm:text-[2rem]">
          Your CPF balances, projected to {outcome.ok ? outcome.result.input.endAge : 65}
        </h1>
        <p className="text-ink-muted">
          An illustrative calculation from published CPF Board parameters and the inputs below. It
          is a projection, not advice, and suggests no course of action.
        </p>
      </header>

      {outcome.ok ? (
        <div
          className={cn(
            'grid grid-cols-1 gap-6',
            'lg:grid-cols-[minmax(17rem,20rem)_minmax(0,1fr)] lg:gap-8',
            "lg:[grid-template-areas:'inputs_headline'_'inputs_results']",
          )}
        >
          <HeadlineRegion result={outcome.result} />
          <InputsRegion draft={draft} result={outcome.result} />
          <ResultsRegion result={outcome.result} />
        </div>
      ) : (
        <Callout tone="caution" title="This projection cannot be calculated yet">
          <ul className="list-disc pl-5">
            {outcome.errors.map((error) => (
              <li key={error.field}>{error.message}</li>
            ))}
          </ul>
        </Callout>
      )}
    </Container>
  );
}

function HeadlineRegion({ result }: { result: ProjectionResult }) {
  const { summary, input } = result;
  const atEnd = centsToDollars(totalOf(summary.atEnd.balances));
  return (
    <section aria-labelledby="headline-heading" className="flex min-w-0 flex-col gap-3 lg:[grid-area:headline]">
      <h2 id="headline-heading" className="sr-only-abs">
        Headline figures
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {summary.atAge55 ? (
          <StatTile
            size="lg"
            label="Projected balances at 55"
            value={<Money value={centsToDollars(totalOf(summary.atAge55.balances))} />}
            animationKey={totalOf(summary.atAge55.balances)}
            context="All accounts, once the Retirement Account is formed"
            source={<RulesStamp compact />}
          />
        ) : null}
        <StatTile
          size="lg"
          label={`Projected balances at ${input.endAge}`}
          value={<Money value={atEnd} />}
          animationKey={atEnd}
          context="All accounts, at the end of the projection"
          source={<RulesStamp compact />}
        />
      </div>
    </section>
  );
}

function InputsRegion({ draft, result }: { draft: ProjectionDraft; result: ProjectionResult }) {
  const { input } = result;
  const opening = input.openingBalances;
  return (
    <aside
      aria-labelledby="inputs-heading"
      className="min-w-0 lg:sticky lg:top-20 lg:self-start lg:[grid-area:inputs]"
    >
      <Card>
        <CardHeader
          as="h2"
          title={<span id="inputs-heading">Inputs used</span>}
          description="Illustrative starting values. Every figure below follows from these."
        />
        <CardBody>
          <DefinitionList
            items={[
              { term: 'Current age', value: String(input.startAge) },
              { term: 'Gross monthly salary', value: formatMoney(centsToDollars(input.monthlyOrdinaryWage)) },
              { term: 'Salary growth a year', value: formatPercent(input.salaryGrowth.rate, 1) },
              {
                term: 'Opening balances',
                value:
                  totalOf(opening) === 0
                    ? 'None'
                    : `OA ${formatMoney(centsToDollars(opening.ordinary))}, SA ${formatMoney(centsToDollars(opening.special))}, MA ${formatMoney(centsToDollars(opening.medisave))}`,
              },
              { term: 'Housing plan', value: draft.housingPlan === 'none' ? 'None' : draft.housingPlan === 'hdb-loan' ? 'HDB loan' : 'Bank loan' },
              { term: 'Projection starts', value: input.startMonth },
            ]}
          />
        </CardBody>
      </Card>
    </aside>
  );
}

function ResultsRegion({ result }: { result: ProjectionResult }) {
  const rows = rowsAtMilestones(result);
  return (
    <section aria-labelledby="results-heading" className="flex min-w-0 flex-col gap-6 lg:[grid-area:results]">
      <h2 id="results-heading" className="sr-only-abs">
        Projection detail
      </h2>
      <Card>
        <CardHeader
          as="h3"
          title="Account balances by age"
          description="At the end of the month you reach each age. The Special Account closes and the Retirement Account opens at 55."
        />
        <CardBody>
          <Table caption="Projected account balances by age" captionHidden density="compact" stickyFirstColumn>
            <THead>
              <tr>
                <Th>Age</Th>
                {BALANCE_COLUMNS.map(({ key }) => (
                  <Th key={key} numeric>
                    <abbr title={SERIES[key].label} className="no-underline">
                      {SERIES[key].short}
                    </abbr>
                  </Th>
                ))}
                <Th numeric>Total</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <Tr key={row.age} highlighted={row.age === AGE_55}>
                  <Th scope="row" className="font-normal text-ink">
                    {row.age}
                  </Th>
                  {BALANCE_COLUMNS.map(({ key, account }) => (
                    <Td key={key} numeric>
                      {formatMoney(centsToDollars(row.balances[account]))}
                    </Td>
                  ))}
                  <Td numeric>{formatMoney(centsToDollars(totalOf(row.balances)))}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </CardBody>
      </Card>
    </section>
  );
}
