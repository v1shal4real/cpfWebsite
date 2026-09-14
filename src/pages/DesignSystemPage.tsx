import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useReducedMotion } from 'framer-motion';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  DefinitionList,
  Disclosure,
  Field,
  IconButton,
  InfoTip,
  Kbd,
  MoneyInput,
  Money,
  MoneyDelta,
  NumericInput,
  Percent,
  PercentInput,
  SegmentedControl,
  Select,
  Slider,
  SourceLink,
  StatTile,
  Switch,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
} from '@/components/ui';
import {
  ChartFrame,
  ChartTooltip,
  Legend,
  LINE_WIDTH,
  Y_AXIS_WIDTH,
  activeDotProps,
  axisLine,
  axisTick,
  chartMargin,
  cursorProps,
  gridProps,
  referenceLineProps,
} from '@/components/chart';
import { Container } from '@/components/layout/AppShell';
import { RulesStamp } from '@/components/layout/RulesStamp';
import { formatMoney, formatMoneyCompact, formatPercent } from '@/lib/format';
import { CURRENT_RULE_SET, bandForAge, sourceFor } from '@/rules';
import { ALL_SERIES, BALANCE_SERIES, SERIES, type SeriesKey } from '@/theme/series';

/**
 * Design system preview.
 *
 * A working reference for every shared component, in both themes, at every
 * width. It is not the product. The chart on this page draws PLACEHOLDER
 * curves with a plausible shape so the palette, legend, tooltip and table can
 * be checked by eye — they are not the output of any projection and must not
 * be read as one.
 */

type HousingPlan = 'none' | 'hdb' | 'bank';

interface SampleRow {
  age: number;
  oa: number | null;
  sa: number | null;
  ma: number | null;
  ra: number | null;
}

/** Placeholder curves. Shape only — not CPF rules, not a projection. */
function placeholderSeries(): SampleRow[] {
  const rows: SampleRow[] = [];
  for (let age = 25; age <= 65; age++) {
    const t = age - 25;
    const oa = Math.max(0, 8_000 + t * 9_000 - (age >= 30 ? 70_000 : 0) + Math.pow(t, 1.6) * 180);
    const sa = age < 55 ? 3_000 + Math.pow(t, 1.75) * 260 : null;
    const ma = Math.min(79_000, 4_000 + t * 3_600);
    const ra = age >= 55 ? 220_400 + (age - 55) * 14_000 : null;
    rows.push({ age, oa: Math.round(oa), sa: sa && Math.round(sa), ma: Math.round(ma), ra });
  }
  return rows;
}

export function DesignSystemPage() {
  const reduceMotion = useReducedMotion();
  const data = useMemo(placeholderSeries, []);

  const [hidden, setHidden] = useState<ReadonlySet<SeriesKey>>(new Set());
  const [age, setAge] = useState<number | null>(30);
  const [salary, setSalary] = useState<number | null>(5_200);
  const [growth, setGrowth] = useState<number | null>(3);
  const [plan, setPlan] = useState<HousingPlan>('hdb');
  const [oaShare, setOaShare] = useState(60);
  const [tenure, setTenure] = useState('25');
  const [real, setReal] = useState(false);
  const [retain, setRetain] = useState(true);
  const [scrubAge, setScrubAge] = useState(40);

  const allocation = bandForAge(CURRENT_RULE_SET.allocation.bands, scrubAge);
  const scrubRow = data.find((row) => row.age === scrubAge);

  function toggleSeries(key: SeriesKey) {
    setHidden((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <Container className="flex flex-col gap-12 py-8 sm:py-10">
      <header className="flex max-w-3xl flex-col gap-3">
        <Badge className="self-start">Design system preview</Badge>
        <h1 className="text-[1.75rem] leading-tight text-ink sm:text-[2.125rem]">
          Components and tokens
        </h1>
        <p className="text-ink-muted">
          Every shared building block for the CPF Projection Tool, rendered live. Switch theme in
          the header and narrow the window to 360px to check both.
        </p>
        <Callout tone="caution" title="Placeholder data">
          Figures and curves on this page exist to exercise the components. They are not produced by
          the projection engine, which has not been built yet.
        </Callout>
      </header>

      {/* ------------------------------------------------------------------ */}
      <PreviewSection title="Framing" description="Projection language sits with the figures it qualifies.">
        <div className="grid gap-3 md:grid-cols-2">
          <Callout>
            This is an illustrative projection based on published CPF Board parameters. It is not a
            recommendation and does not suggest a course of action.
          </Callout>
          <Callout tone="info" title="Why $20,000 keeps appearing">
            HDB-loan buyers may retain up to $20,000 in the Ordinary Account, and the extra-interest
            tier counts no more than $20,000 from it. The two figures are linked.
          </Callout>
        </div>
      </PreviewSection>

      {/* ------------------------------------------------------------------ */}
      <PreviewSection title="Headline figures" description="Stat tiles for single-number answers.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatTile
            size="lg"
            label="Projected balance at 55"
            value={<Money value={412_380} />}
            animationKey={412_380}
            context="Across the Ordinary, Special and MediSave accounts"
            info={
              <InfoTip label="projected balance at 55">
                The sum of all account balances in the month the member turns 55, before the
                Retirement Account is created.
              </InfoTip>
            }
            source={<RulesStamp compact />}
          />
          <StatTile
            size="lg"
            label="Against the Full Retirement Sum"
            value={<MoneyDelta value={-18_400} />}
            animationKey={-18_400}
            context={
              <>
                Full Retirement Sum of <Money value={CURRENT_RULE_SET.thresholds.fullRetirementSum} />
              </>
            }
            source={<SourceLink sourceId={sourceFor(CURRENT_RULE_SET.thresholds, 'fullRetirementSum')} variant="chip" />}
          />
          <StatTile
            size="lg"
            label="Accrued interest owed on sale"
            accent={SERIES.accrued.color}
            value={<Money value={96_210} />}
            animationKey={96_210}
            context={
              <>
                At <Percent value={CURRENT_RULE_SET.housing.accruedInterestRate} digits={1} /> a year,
                compounded
              </>
            }
            source={<SourceLink sourceId={sourceFor(CURRENT_RULE_SET.housing, 'accruedInterestRate')} variant="chip" />}
            className="sm:col-span-2 lg:col-span-1"
          />
        </div>
      </PreviewSection>

      {/* ------------------------------------------------------------------ */}
      <PreviewSection title="Chart" description="Frame, legend, crosshair tooltip, reference line and table view.">
        <ChartFrame
          title="Account balances over time"
          summary="Placeholder curves for the Ordinary, Special, MediSave and Retirement accounts from age 25 to 65, with the Special Account closing and the Retirement Account opening at 55."
          legend={
            <Legend
              items={BALANCE_SERIES.map((key) => ({ key }))}
              hidden={hidden}
              onToggle={toggleSeries}
            />
          }
          actions={
            <SegmentedControl
              label="Dollar basis"
              size="sm"
              value={real ? 'real' : 'nominal'}
              onValueChange={(value) => setReal(value === 'real')}
              options={[
                { value: 'nominal', label: 'Nominal' },
                { value: 'real', label: 'Real' },
              ]}
            />
          }
          footer={
            <>
              <RulesStamp compact />
              <SourceLink sourceId="allocationRates" />
            </>
          }
          renderTable={({ visible }) => (
            <Table
              caption="Account balances by age (placeholder data)"
              captionHidden={!visible}
              focusable={visible}
              density="compact"
              stickyFirstColumn
              maxHeight={visible ? '22rem' : undefined}
            >
              <THead>
                <tr>
                  <Th>Age</Th>
                  {BALANCE_SERIES.map((key) => (
                    <Th key={key} numeric>
                      {SERIES[key].label}
                    </Th>
                  ))}
                </tr>
              </THead>
              <TBody>
                {data.map((row) => (
                  <Tr key={row.age} highlighted={row.age === 55}>
                    <Th scope="row" className="font-normal text-ink">
                      {row.age}
                      {row.age === 55 ? <span className="ml-1.5 text-ink-subtle">RA created</span> : null}
                    </Th>
                    {BALANCE_SERIES.map((key) => (
                      <Td key={key} numeric>
                        {row[key as keyof SampleRow] === null ? (
                          <span className="text-ink-subtle">–</span>
                        ) : (
                          formatMoney(row[key as keyof SampleRow] as number)
                        )}
                      </Td>
                    ))}
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={chartMargin}>
              <CartesianGrid {...gridProps} />
              <XAxis
                dataKey="age"
                type="number"
                domain={[25, 65]}
                ticks={[25, 30, 35, 40, 45, 50, 55, 60, 65]}
                tick={axisTick}
                axisLine={axisLine}
                tickLine={false}
              />
              <YAxis
                width={Y_AXIS_WIDTH}
                tickFormatter={formatMoneyCompact}
                tick={axisTick}
                axisLine={false}
                tickLine={false}
              />
              <ReferenceLine
                x={55}
                {...referenceLineProps}
                label={{ value: 'Age 55', position: 'insideTopRight', fill: 'var(--ink-muted)', fontSize: 11 }}
              />
              <RechartsTooltip
                cursor={cursorProps}
                content={({ active, payload, label }) => (
                  <ChartTooltip active={active} payload={payload} label={label} />
                )}
              />
              {BALANCE_SERIES.map((key) => (
                <Line
                  key={key}
                  dataKey={key}
                  name={SERIES[key].label}
                  hide={hidden.has(key)}
                  type="monotone"
                  stroke={SERIES[key].color}
                  strokeWidth={LINE_WIDTH}
                  dot={false}
                  activeDot={activeDotProps}
                  connectNulls={false}
                  isAnimationActive={!reduceMotion}
                  animationDuration={400}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartFrame>
      </PreviewSection>

      {/* ------------------------------------------------------------------ */}
      <PreviewSection title="Timeline scrub" description="Native range input with ticks, readout and live values.">
        <Card>
          <Field label="Age on the timeline" labelAside={<span className="text-[0.75rem] text-ink-subtle"><Kbd>←</Kbd> <Kbd>→</Kbd> to step</span>}>
            <Slider
              min={25}
              max={65}
              value={scrubAge}
              onValueChange={setScrubAge}
              valueLabel={`Age ${scrubAge}`}
              readout={`Age ${scrubAge}`}
              minLabel="25"
              maxLabel="65"
              ticks={[{ value: 55, label: 'Age 55: Retirement Account created' }]}
            />
          </Field>
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            <Legend
              className="flex-col items-start"
              items={BALANCE_SERIES.map((key) => {
                const raw = scrubRow?.[key as keyof SampleRow];
                return { key, value: raw == null ? '–' : formatMoney(raw) };
              })}
            />
            {allocation ? (
              <DefinitionList
                items={[
                  { term: 'Allocation to Ordinary', value: formatPercent(allocation.ordinary), swatch: SERIES.oa.color },
                  {
                    term: scrubAge >= 55 ? 'Allocation to Retirement' : 'Allocation to Special',
                    value: formatPercent(allocation.specialOrRetirement),
                    swatch: scrubAge >= 55 ? SERIES.ra.color : SERIES.sa.color,
                  },
                  { term: 'Allocation to MediSave', value: formatPercent(allocation.medisave), swatch: SERIES.ma.color },
                ]}
              />
            ) : null}
          </div>
        </Card>
      </PreviewSection>

      {/* ------------------------------------------------------------------ */}
      <PreviewSection title="Inputs" description="Every control is wired to its label, hint and error through Field.">
        <Card>
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Current age"
              hint="Between 16 and 70."
              required
              error={age !== null && (age < 16 || age > 70) ? 'Enter an age between 16 and 70.' : undefined}
            >
              <NumericInput value={age} onValueChange={setAge} min={16} max={70} groupDigits={false} />
            </Field>

            <Field
              label="Gross monthly salary"
              hint="Ordinary Wages only. Contributions stop at the Ordinary Wage ceiling."
              required
              labelAside={<SourceLink sourceId="contributionRates" variant="chip" />}
            >
              <MoneyInput value={salary} onValueChange={setSalary} min={0} />
            </Field>

            <Field label="Expected annual salary growth" hint="An assumption you choose. Default 3%.">
              <PercentInput value={growth} onValueChange={setGrowth} min={0} max={15} />
            </Field>

            <Field label="Loan tenure">
              <Select
                value={tenure}
                onChange={(event) => setTenure(event.target.value)}
                options={[10, 15, 20, 25, 30].map((years) => ({
                  value: String(years),
                  label: `${years} years`,
                }))}
              />
            </Field>

            <div className="md:col-span-2">
              <SegmentedControl<HousingPlan>
                label="Housing plan"
                labelHidden={false}
                value={plan}
                onValueChange={setPlan}
                options={[
                  { value: 'none', label: 'No property' },
                  { value: 'hdb', label: 'HDB loan' },
                  { value: 'bank', label: 'Bank loan' },
                ]}
              />
            </div>

            <Field
              label="Share of downpayment from the Ordinary Account"
              hint="The rest is assumed to be paid in cash."
              className="md:col-span-2"
            >
              <Slider
                min={0}
                max={100}
                step={5}
                value={oaShare}
                onValueChange={setOaShare}
                valueLabel={`${oaShare} percent`}
                readout={`${oaShare}%`}
                minLabel="All cash"
                maxLabel="All from OA"
              />
            </Field>

            <div className="flex flex-col gap-3 md:col-span-2">
              <Checkbox
                checked={retain}
                onCheckedChange={setRetain}
                disabled={plan !== 'hdb'}
                description="HDB-loan buyers may keep up to $20,000 in the Ordinary Account."
              >
                Retain $20,000 in the Ordinary Account
              </Checkbox>
              <Switch checked={real} onCheckedChange={setReal}>
                Show in today’s dollars
              </Switch>
            </div>
          </div>
        </Card>
      </PreviewSection>

      {/* ------------------------------------------------------------------ */}
      <PreviewSection title="Actions and labels">
        <Card className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary">Compare scenarios</Button>
            <Button>Copy share link</Button>
            <Button variant="ghost">Reset inputs</Button>
            <Button variant="link">View all assumptions</Button>
            <Button disabled>Disabled</Button>
            <IconButton label="Copy share link" variant="secondary">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="5" y="5" width="8.5" height="8.5" rx="1.5" />
                <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
              </svg>
            </IconButton>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="primary">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Scenario A</Badge>
            <Badge tone="info">Rules 2026</Badge>
            <Badge tone="good">Retirement sum reached</Badge>
            <Badge tone="warning">Unverified</Badge>
            <Badge tone="serious">Below BHS</Badge>
            <Badge tone="critical">Input out of range</Badge>
          </div>
        </Card>
      </PreviewSection>

      {/* ------------------------------------------------------------------ */}
      <PreviewSection
        title="Assumptions"
        description="Visible by default. Every parameter shows its effective date and links to its source."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Wage ceilings"
              description={`Effective from ${CURRENT_RULE_SET.label}`}
              actions={<SourceLink sourceId={sourceFor(CURRENT_RULE_SET.wageCeilings)} variant="chip" />}
            />
            <CardBody>
              <DefinitionList
                items={[
                  { term: 'Ordinary Wage ceiling', value: `${formatMoney(CURRENT_RULE_SET.wageCeilings.ordinaryWageCeiling)} / month` },
                  { term: 'Annual salary ceiling', value: formatMoney(CURRENT_RULE_SET.wageCeilings.annualSalaryCeiling) },
                  { term: 'CPF Annual Limit', value: formatMoney(CURRENT_RULE_SET.wageCeilings.annualLimit) },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="Interest"
              description="Floors, and the extra-interest tier"
              actions={<SourceLink sourceId={sourceFor(CURRENT_RULE_SET.interest)} variant="chip" />}
            />
            <CardBody>
              <Disclosure title="Base rates" summary="2.5% – 4%" defaultOpen>
                <DefinitionList
                  items={[
                    { term: 'Ordinary Account', value: formatPercent(CURRENT_RULE_SET.interest.ordinary, 1), swatch: SERIES.oa.color },
                    { term: 'Special Account', value: formatPercent(CURRENT_RULE_SET.interest.special, 1), swatch: SERIES.sa.color },
                    { term: 'MediSave Account', value: formatPercent(CURRENT_RULE_SET.interest.medisave, 1), swatch: SERIES.ma.color },
                    { term: 'Retirement Account', value: formatPercent(CURRENT_RULE_SET.interest.retirement, 1), swatch: SERIES.ra.color },
                  ]}
                />
              </Disclosure>
              <Disclosure title="Extra interest below 55" summary="+1% on $60,000">
                <p>
                  An extra 1% a year on the first {formatMoney(60_000)} of combined balances, of which
                  no more than {formatMoney(CURRENT_RULE_SET.interest.ordinaryAccountExtraInterestCap)} may
                  come from the Ordinary Account. Extra interest earned on Ordinary Account savings is
                  credited to the Special Account.
                </p>
              </Disclosure>
            </CardBody>
          </Card>
        </div>
      </PreviewSection>

      {/* ------------------------------------------------------------------ */}
      <PreviewSection
        title="Colour"
        description="Series hues are reserved for data. Status hues are reserved for state and always carry a glyph."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader title="Data series" as="h3" />
            <CardBody className="flex flex-col gap-2.5">
              {ALL_SERIES.map((key) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="h-8 w-12 shrink-0 rounded-sm" style={{ backgroundColor: SERIES[key].color }} />
                  <span className="h-8 w-12 shrink-0 rounded-sm border border-line" style={{ backgroundColor: SERIES[key].soft }} />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-ink">{SERIES[key].label}</span>
                    <span className="truncate text-[0.75rem] text-ink-subtle">{SERIES[key].short}</span>
                  </span>
                </div>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Surfaces and ink" as="h3" />
            <CardBody className="grid grid-cols-2 gap-2 text-[0.75rem]">
              {[
                ['canvas', 'bg-canvas'],
                ['surface', 'bg-surface'],
                ['surface-2', 'bg-surface-2'],
                ['surface-3', 'bg-surface-3'],
              ].map(([name, cls]) => (
                <div key={name} className={`flex h-12 items-end rounded-sm border border-line p-1.5 text-ink-muted ${cls}`}>
                  {name}
                </div>
              ))}
              <p className="col-span-2 mt-2 text-ink">Ink — primary text</p>
              <p className="col-span-2 text-ink-muted">Ink muted — secondary text</p>
              <p className="col-span-2 text-ink-subtle">Ink subtle — captions and ticks</p>
            </CardBody>
          </Card>
        </div>
      </PreviewSection>
    </Container>
  );
}

function PreviewSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4" aria-label={title}>
      <div className="flex flex-col gap-1 border-b border-line pb-2">
        <h2 className="text-[1.125rem] text-ink">{title}</h2>
        {description ? <p className="text-[0.8125rem] text-ink-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
