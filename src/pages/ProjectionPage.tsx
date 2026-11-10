import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  CopyLinkButton,
} from '@/components/ui';
import { Container } from '@/components/layout/AppShell';
import { projectDraft } from '@/engine/project';
import type { MonthStamp, ProjectionResult } from '@/engine/types';
import { INPUT_LIMITS, type FieldError } from '@/engine/validate';
import { cn } from '@/lib/cn';
import { CURRENT_RULE_SET, ruleSetById, type RuleSet } from '@/rules';
import { AssumptionsPanel } from './projection/AssumptionsPanel';
import { BalanceChart } from './projection/BalanceChart';
import { HeadlineRow } from './projection/HeadlineRow';
import { InputPanel } from './projection/InputPanel';
import { Timeline } from './projection/Timeline';
import { DEFAULT_FORM, errorsByField, toDraft, type FormErrors, type FormField, type FormValues } from './projection/form';
import { encodeScenariosUrl } from './projection/urlState';
import { ScenarioBar } from './projection/ScenarioBar';
import {
  activeForm,
  changedFields,
  singleScenario,
  updateActive,
  type Scenarios,
} from './projection/scenarios';

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
 * tiles here are a first cut.
 */

export interface ProjectionPageProps {
  /** The month the projection starts from, supplied by the app so the engine never reads the clock. */
  startMonth: MonthStamp;
  /** The values the panel opens with: the stated defaults unless a test or a shared link says otherwise. */
  initialForm?: FormValues;
  /** Both scenarios, when a shared link carries a B. Takes precedence over `initialForm`. */
  initialScenarios?: Scenarios;
  /** The rule set id the projection is pinned to; a shared link carries its own. */
  rulesAsAt?: string;
  /** What a shared link carried that could not be used, one sentence each. */
  linkNotices?: readonly string[];
}

export function ProjectionPage({
  startMonth,
  initialForm = DEFAULT_FORM,
  initialScenarios,
  rulesAsAt = CURRENT_RULE_SET.id,
  linkNotices = [],
}: ProjectionPageProps) {
  const [scenarios, setScenarios] = useState<Scenarios>(initialScenarios ?? singleScenario(initialForm));
  const form = activeForm(scenarios);
  const changed = useMemo(
    () => (scenarios.active === 'b' && scenarios.b ? changedFields(scenarios.a, scenarios.b) : undefined),
    [scenarios],
  );
  const ruleSet = ruleSetById(rulesAsAt) ?? CURRENT_RULE_SET;
  const draft = useMemo(() => ({ ...toDraft(form, startMonth), rulesAsAt }), [form, startMonth, rulesAsAt]);

  // The URL is the projection's only memory: every change is written to it,
  // replacing the history entry so Back leaves the page rather than stepping
  // through keystrokes. No storage, no cookie, no server call.
  useEffect(() => {
    const query = encodeScenariosUrl({ scenarios, startMonth, rulesAsAt });
    const { pathname, hash } = window.location;
    window.history.replaceState(window.history.state, '', `${pathname}${query}${hash}`);
  }, [scenarios, startMonth, rulesAsAt]);
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

  const onChange = (patch: Partial<FormValues>) => setScenarios((previous) => updateActive(previous, patch));

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
        <CopyLinkButton label="Copy link to this projection" className="mt-1" />
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
          {shown ? <HeadlineRow result={shown} ruleSet={ruleSet} /> : null}
        </div>
        <InputsRegion
          form={form}
          onChange={onChange}
          errors={errors}
          startMonth={startMonth}
          ruleSet={ruleSet}
          scenarios={scenarios}
          onScenariosChange={setScenarios}
          changed={changed}
        />
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

function InputsRegion({
  form,
  onChange,
  errors,
  startMonth,
  ruleSet,
  scenarios,
  onScenariosChange,
  changed,
}: {
  form: FormValues;
  onChange: (patch: Partial<FormValues>) => void;
  errors: FormErrors;
  startMonth: MonthStamp;
  ruleSet: RuleSet;
  scenarios: Scenarios;
  onScenariosChange: (next: Scenarios) => void;
  changed: ReadonlySet<FormField> | undefined;
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
        <CardBody className="flex flex-col gap-5">
          <ScenarioBar scenarios={scenarios} onChange={onScenariosChange} changedCount={changed?.size ?? 0} />
          <InputPanel values={form} onChange={onChange} errors={errors} rules={ruleSet} changed={changed} />
        </CardBody>
      </Card>
    </aside>
  );
}

function ResultsRegion({ result }: { result: ProjectionResult }) {
  const { startAge, endAge } = result.input;
  const fallback = (startAge <= 55 && 55 <= endAge ? 55 : endAge) * 12;
  const [scrubbed, setScrubbed] = useState(fallback);
  // Inputs can move the ends; keep the scrubbed age inside them.
  const ageInMonths = Math.min(endAge * 12, Math.max(startAge * 12, scrubbed));

  return (
    <section aria-labelledby="results-heading" className="flex min-w-0 flex-col gap-6 lg:[grid-area:results]">
      <h2 id="results-heading" className="sr-only-abs">
        Projection detail
      </h2>
      <BalanceChart
        result={result}
        cursorAgeInMonths={ageInMonths}
        onHoverAge={(age) => setScrubbed(age * 12)}
      />
      <Timeline result={result} ageInMonths={ageInMonths} onAgeChange={setScrubbed} />
      <AssumptionsPanel result={result} />
    </section>
  );
}
