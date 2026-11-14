import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartFrame,
  ChartTooltip,
  ComparisonTooltip,
  Legend,
  LineStyleKey,
  SECONDARY_DASH,
  Y_AXIS_WIDTH,
  axisLine,
  axisTick,
  chartMargin,
  cursorProps,
  gridProps,
  referenceLineProps,
  seriesLineProps,
} from '@/components/chart';
import type { ProjectionResult } from '@/engine/types';
import { formatMoneyCompact } from '@/lib/format';
import { BALANCE_SERIES, SERIES } from '@/theme/series';
import { AGE_55, ageTicks, chartPoints, comparisonPoints, scenarioBKey, yearlyRows } from './balanceData';
import { BalanceTable, ComparisonTable } from './BalanceTables';

/**
 * OA, SA, MA and RA balances over age, with the age-55 transition marked and
 * a yearly table as the alternative view. With a scenario B, both scenarios
 * share the chart: colour stays with the account, and B is drawn dashed.
 *
 * This file is the chart's composition only. Its data lives in
 * `balanceData.ts`, its tables in `BalanceTables.tsx`, and the generic parts
 * (tooltips, the line-style key, line props) in `components/chart`.
 */

export interface BalanceChartProps {
  result: ProjectionResult;
  /** The timeline's age, in months: drawn as the crosshair. */
  cursorAgeInMonths?: number;
  /** Called with the hovered age, in whole years, so the timeline follows the pointer. */
  onHoverAge?: (age: number) => void;
  /**
   * With a scenario B: both scenarios on one chart. `result` is still the
   * scenario being edited, for the crosshair.
   */
  compare?: { resultA: ProjectionResult; resultB: ProjectionResult } | undefined;
}

const LEGEND_ITEMS = BALANCE_SERIES.map((key) => ({
  key,
  label:
    key === 'ra' ? `${SERIES.ra.label} (from 55)` : key === 'sa' ? `${SERIES.sa.label} (to 55)` : undefined,
}));

const SCENARIO_STYLES = [
  { label: 'Scenario A: solid' },
  { label: 'Scenario B: dashed', dash: SECONDARY_DASH },
];

export function BalanceChart({ result, cursorAgeInMonths, onHoverAge, compare }: BalanceChartProps) {
  const rowsA = yearlyRows(compare ? compare.resultA : result);
  const rowsB = compare ? yearlyRows(compare.resultB) : [];
  const points = compare ? comparisonPoints(rowsA, rowsB) : chartPoints(rowsA);
  const inputs = compare ? [compare.resultA.input, compare.resultB.input] : [result.input];
  const startAge = Math.min(...inputs.map((input) => input.startAge));
  const endAge = Math.max(...inputs.map((input) => input.endAge));
  const shows55 = startAge <= AGE_55 && AGE_55 <= endAge;

  const summary = [
    `Projected Ordinary, Special, MediSave and Retirement Account balances from age ${startAge} to ${endAge}`,
    compare ? ', scenario A as solid lines and scenario B as dashed lines in the same account colours' : '',
    '.',
    shows55 ? ' At 55 the Special Account closes and the Retirement Account opens.' : '',
  ].join('');

  return (
    <ChartFrame
      title="Account balances by age"
      summary={summary}
      legend={
        <div className="flex flex-col gap-1.5">
          <Legend items={LEGEND_ITEMS} />
          {compare ? <LineStyleKey label="Scenarios" items={SCENARIO_STYLES} /> : null}
        </div>
      }
      renderTable={({ visible }) =>
        compare ? (
          <ComparisonTable rowsA={rowsA} rowsB={rowsB} visible={visible} />
        ) : (
          <BalanceTable rows={rowsA} visible={visible} />
        )
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={points}
          margin={chartMargin}
          onMouseMove={(state) => {
            const age = Number(state?.activeLabel);
            if (onHoverAge && Number.isFinite(age)) onHoverAge(age);
          }}
        >
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
            content={({ active, payload, label }) =>
              compare ? (
                <ComparisonTooltip
                  active={active}
                  payload={payload}
                  label={label}
                  series={BALANCE_SERIES}
                  secondKey={scenarioBKey}
                />
              ) : (
                <ChartTooltip active={active} payload={payload} label={label} />
              )
            }
          />
          {shows55 ? (
            <ReferenceLine
              x={AGE_55}
              {...referenceLineProps}
              label={{ value: 'Age 55', position: 'insideTopRight', fill: 'var(--ink-subtle)', fontSize: 11 }}
            />
          ) : null}
          {cursorAgeInMonths !== undefined ? (
            <ReferenceLine
              x={cursorAgeInMonths / 12}
              stroke="var(--ink)"
              strokeWidth={1}
              ifOverflow="hidden"
            />
          ) : null}
          {/* Recharts reads <Line> as direct children, so the lines are mapped here rather than wrapped. */}
          {BALANCE_SERIES.map((key) => (
            <Line key={key} dataKey={key} name={SERIES[key].label} {...seriesLineProps(SERIES[key].color)} />
          ))}
          {compare
            ? BALANCE_SERIES.map((key) => (
                <Line
                  key={scenarioBKey(key)}
                  dataKey={scenarioBKey(key)}
                  name={`${SERIES[key].label}, scenario B`}
                  {...seriesLineProps(SERIES[key].color, SECONDARY_DASH)}
                />
              ))
            : null}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
