import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
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
import type { AccountAmounts, AccountName, MonthStamp, ProjectionResult } from '@/engine/types';
import { INPUT_LIMITS, type FieldError } from '@/engine/validate';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/cn';
import { CURRENT_RULE_SET, ruleSetById, type RuleSet } from '@/rules';
import { SERIES, type SeriesKey } from '@/theme/series';
import { InputPanel } from './projection/InputPanel';
import { DEFAULT_FORM, errorsByField, toDraft, type FormErrors, type FormValues } from './projection/form';
import { encodeUrlState } from './projection/urlState';

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
 * The page owns the form values. The input panel edits them, and the
 * projection recomputes on every change. The headline, chart, timeline and
 * assumptions panel are each a slot their own ticket fills; the headline
 * tiles and balances table here are first cuts.
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

export interface ProjectionPageProps {
  /** The month the projection starts from, supplied by the app so the engine never reads the clock. */
  startMonth: MonthStamp;
  /** The values the panel opens with: the stated defaults unless a test or a shared link says otherwise. */
  initialForm?: FormValues;
  /** The rule set id the projection is pinned to; a shared link carries its own. */
  rulesAsAt?: string;
  /** What a shared link carried that could not be used, one sentence each. */
  linkNotices?: readonly string[];
}

export function ProjectionPage({
  startMonth,
  initialForm = DEFAULT_FORM,
  rulesAsAt = CURRENT_RULE_SET.id,
  linkNotices = [],
}: ProjectionPageProps) {
  const [form, setForm] = useState<FormValues>(initialForm);
  const ruleSet = ruleSetById(rulesAsAt) ?? CURRENT_RULE_SET;
  const draft = useMemo(() => ({ ...toDraft(form, startMonth), rulesAsAt }), [form, startMonth, rulesAsAt]);

  // The URL is the projection's only memory: every change is written to it,
  // replacing the history entry so Back leaves the page rather than stepping
  // through keystrokes. No storage, no cookie, no server call.
  useEffect(() => {
    const query = encodeUrlState({ form, startMonth, rulesAsAt });
    const { pathname, hash } = window.location;
    window.history.replaceState(window.history.state, '', `${pathname}${query}${hash}`);
  }, [form, startMonth, rulesAsAt]);
  // The engine is pure and well inside its 50ms budget, so the page simply
  // recomputes on every change.
  const outcome = useMemo(() => projectDraft(draft), [draft]);
  const errors = useMemo(() => (outcome.ok ? {} : errorsByField(outcome.errors)), [outcome]);

  // While the inputs cannot be projected, for instance halfway through typing
  // a number, the last projection that could stays on screen, marked as such,
  // rather than the figures vanishing under the visitor's cursor.
  const lastResult = useRef<ProjectionResult | null>(null);
  if (outcome.ok) lastResult.current = outcome.result;
  const shown = outcome.ok ? outcome.result : lastResult.current;

  const onChange = (patch: Partial<FormValues>) => setForm((previous) => ({ ...previous, ...patch }));

  return (
    <Container className="flex flex-col gap-6 py-6 sm:gap-8 sm:py-10">
      <header className="flex max-w-3xl flex-col gap-2">
        <h1 className="text-[1.625rem] leading-tight text-ink sm:text-[2rem]">
          Your CPF balances, projected to {shown ? shown.input.endAge : INPUT_LIMITS.projectionEndAge}
        </h1>
        <p className="text-ink-muted">
          An illustrative calculation from published CPF Board parameters and the inputs below. It
          is a projection, not advice, and suggests no course of action.
        </p>
      </header>

      <div
        className={cn(
          'grid grid-cols-1 gap-6',
          // The first row fits the headline; the results take the rest, so a
          // tall inputs column spanning both rows cannot stretch the first.
          'lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-8',
          "lg:[grid-template-areas:'inputs_headline'_'inputs_results']",
        )}
      >
        <div className="flex min-w-0 flex-col gap-4 lg:[grid-area:headline]">
          <LinkNotice notices={linkNotices} />
          {outcome.ok ? null : <StaleNotice errors={outcome.errors} hasEarlierResult={shown !== null} />}
          {shown ? <HeadlineRegion result={shown} ruleSet={ruleSet} /> : null}
        </div>
        <InputsRegion form={form} onChange={onChange} errors={errors} startMonth={startMonth} ruleSet={ruleSet} />
        {shown ? <ResultsRegion result={shown} /> : null}
      </div>
    </Container>
  );
}

/**
 * Shown when a shared link carried values that could not be used, so the
 * visitor knows the figures are not exactly the ones that were shared.
 * Dismissible: once read, it has done its job.
 */
function LinkNotice({ notices }: { notices: readonly string[] }) {
  const [dismissed, setDismissed] = useState(false);
  if (notices.length === 0 || dismissed) return null;
  return (
    <Callout tone="info" title="Parts of this link could not be used">
      <ul className="list-disc pl-5">
        {notices.map((notice) => (
          <li key={notice}>{notice}</li>
        ))}
      </ul>
      <Button variant="link" size="sm" className="mt-1" onClick={() => setDismissed(true)}>
        Dismiss
      </Button>
    </Callout>
  );
}

/**
 * Shown while the inputs cannot be projected: says which figures are on
 * screen, and lists every problem in one place, including any beside a field
 * the visitor has not reached yet.
 */
function StaleNotice({ errors, hasEarlierResult }: { errors: readonly FieldError[]; hasEarlierResult: boolean }) {
  return (
    <Callout
      tone="caution"
      title={hasEarlierResult ? 'Showing your last complete projection' : 'This projection cannot be calculated yet'}
    >
      <p>
        {hasEarlierResult
          ? 'The figures below are from your last complete set of inputs. They will update once these are resolved:'
          : 'Resolve these to see a projection:'}
      </p>
      <ul className="mt-1 list-disc pl-5">
        {errors.map((error) => (
          <li key={error.field}>{error.message}</li>
        ))}
      </ul>
    </Callout>
  );
}

function HeadlineRegion({ result, ruleSet }: { result: ProjectionResult; ruleSet: RuleSet }) {
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
            source={<RulesStamp compact ruleSet={ruleSet} />}
          />
        ) : null}
        <StatTile
          size="lg"
          label={`Projected balances at ${input.endAge}`}
          value={<Money value={atEnd} />}
          animationKey={atEnd}
          context="All accounts, at the end of the projection"
          source={<RulesStamp compact ruleSet={ruleSet} />}
        />
      </div>
    </section>
  );
}

function InputsRegion({
  form,
  onChange,
  errors,
  startMonth,
  ruleSet,
}: {
  form: FormValues;
  onChange: (patch: Partial<FormValues>) => void;
  errors: FormErrors;
  startMonth: MonthStamp;
  ruleSet: RuleSet;
}) {
  return (
    <aside
      aria-labelledby="inputs-heading"
      // Sticky beside the results on wide screens, scrolling on its own when
      // it is taller than the window, so no field is ever out of reach.
      className="min-w-0 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto lg:[grid-area:inputs]"
    >
      <Card>
        <CardHeader
          as="h2"
          title={<span id="inputs-heading">Your inputs</span>}
          description={`Every figure follows from these. The projection starts in ${startMonth}.`}
        />
        <CardBody>
          <InputPanel values={form} onChange={onChange} errors={errors} rules={ruleSet} />
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
