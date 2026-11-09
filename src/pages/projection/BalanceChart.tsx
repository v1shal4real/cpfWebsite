import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
import { TBody, THead, Table, Td, Th, Tr } from '@/components/ui';
import type { AccountAmounts, AccountName, ProjectionResult } from '@/engine/types';
import { formatMoney, formatMoneyCompact } from '@/lib/format';
import { BALANCE_SERIES, SERIES, type SeriesKey } from '@/theme/series';

/**
 * OA, SA, MA and RA balances over age, with the age-55 transition marked and
 * a yearly table as the alternative view.
 *
 * Colours come only from the series registry. The Special Account line ends
 * the year before 55 and the Retirement Account line starts at 55, because
 * the two accounts never exist at the same time; a zero would draw a false
 * drop to the axis.
 */

export const AGE_55 = 55;

const ACCOUNT_OF: Record<(typeof BALANCE_SERIES)[number], AccountName> = {
  oa: 'ordinary',
  sa: 'special',
  ma: 'medisave',
  ra: 'retirement',
  accrued: 'ordinary', // not a balance series; never read
};

/** Balances, in dollars, at the end of the month the member reaches each age. */
export interface YearRow {
  age: number;
  balances: AccountAmounts;
  total: number;
}

/** A chart point: dollars per series, `null` where the account does not exist at that age. */
export type ChartPoint = { age: number } & Partial<Record<SeriesKey, number | null>>;

const toDollars = (cents: number) => cents / 100;

/** One row per whole year of age, from the start age to the end age. */
export function yearlyRows(result: ProjectionResult): YearRow[] {
  const byAgeInMonths = new Map(result.months.map((month) => [month.ageInMonths, month]));
  const rows: YearRow[] = [];
  for (let age = result.input.startAge; age <= result.input.endAge; age += 1) {
    const month = byAgeInMonths.get(age * 12);
    if (!month) continue;
    const b = month.closingBalances;
    const balances: AccountAmounts = {
      ordinary: toDollars(b.ordinary),
      special: toDollars(b.special),
      medisave: toDollars(b.medisave),
      retirement: toDollars(b.retirement),
    };
    rows.push({ age, balances, total: balances.ordinary + balances.special + balances.medisave + balances.retirement });
  }
  return rows;
}

export function chartPoints(rows: readonly YearRow[]): ChartPoint[] {
  return rows.map(({ age, balances }) => ({
    age,
    oa: balances.ordinary,
    sa: age < AGE_55 ? balances.special : null,
    ma: balances.medisave,
    ra: age >= AGE_55 ? balances.retirement : null,
  }));
}

/** The start age, every multiple of five after it, and the end age. */
function ageTicks(startAge: number, endAge: number): number[] {
  const ticks = new Set([startAge, endAge]);
  for (let age = Math.ceil(startAge / 5) * 5; age < endAge; age += 5) ticks.add(age);
  return [...ticks].sort((a, b) => a - b);
}

export function BalanceChart({ result }: { result: ProjectionResult }) {
  const rows = yearlyRows(result);
  const points = chartPoints(rows);
  const { startAge, endAge } = result.input;
  const shows55 = startAge <= AGE_55 && AGE_55 <= endAge;

  return (
    <ChartFrame
      title="Account balances by age"
      summary={`Projected Ordinary, Special, MediSave and Retirement Account balances from age ${startAge} to ${endAge}.${
        shows55 ? ' At 55 the Special Account closes and the Retirement Account opens.' : ''
      }`}
      legend={
        <Legend
          items={BALANCE_SERIES.map((key) => ({
            key,
            label: key === 'ra' ? `${SERIES.ra.label} (from 55)` : key === 'sa' ? `${SERIES.sa.label} (to 55)` : undefined,
          }))}
        />
      }
      renderTable={({ visible }) => <BalanceTable rows={rows} visible={visible} />}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={chartMargin}>
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="age"
            type="number"
            domain={[startAge, endAge]}
            ticks={ageTicks(startAge, endAge)}
            tick={axisTick}
            axisLine={axisLine}
            tickLine={false}
            allowDecimals={false}
          />
          <YAxis
            width={Y_AXIS_WIDTH}
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => formatMoneyCompact(value)}
          />
          <Tooltip
            cursor={cursorProps}
            content={({ active, payload, label }) => <ChartTooltip active={active} payload={payload} label={label} />}
          />
          {shows55 ? (
            <ReferenceLine
              x={AGE_55}
              {...referenceLineProps}
              label={{ value: 'Age 55', position: 'insideTopRight', fill: 'var(--ink-subtle)', fontSize: 11 }}
            />
          ) : null}
          {BALANCE_SERIES.map((key) => (
            <Line
              key={key}
              dataKey={key}
              name={SERIES[key].label}
              type="monotone"
              stroke={SERIES[key].color}
              strokeWidth={LINE_WIDTH}
              dot={false}
              activeDot={{ ...activeDotProps, fill: SERIES[key].color }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function BalanceTable({ rows, visible }: { rows: readonly YearRow[]; visible: boolean }) {
  return (
    <Table
      caption="Projected account balances by age"
      captionHidden
      focusable={visible}
      density="compact"
      stickyFirstColumn
    >
      <THead>
        <tr>
          <Th>Age</Th>
          {BALANCE_SERIES.map((key) => (
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
            {BALANCE_SERIES.map((key) => (
              <Td key={key} numeric>
                {formatMoney(row.balances[ACCOUNT_OF[key]])}
              </Td>
            ))}
            <Td numeric>{formatMoney(row.total)}</Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
