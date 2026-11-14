import type { ReactNode } from 'react';
import { formatMoney } from '@/lib/format';
import { SERIES, type SeriesKey } from '@/theme/series';

/**
 * Tooltip bodies for Recharts line and area charts.
 *
 * Pass as `content={({ active, payload, label }) => <ChartTooltip active={active}
 * payload={payload} label={label} />}`. Do not spread Recharts' props: its own
 * `labelFormatter` has a different signature and collides with ours. Rows keep the
 * series order of the chart, skip series that have no value at this point (the
 * Special Account after 55, the Retirement Account before it), and render the
 * figure in ink, never in the series colour.
 *
 * `TooltipFrame` and `TooltipRow` are the shared chrome, so every tooltip in
 * the product looks the same; `ChartTooltip` and `ComparisonTooltip` are the
 * two bodies built from them.
 *
 * The prop types are deliberately loose so this does not couple to a specific
 * Recharts generic signature.
 */

export interface PayloadEntry {
  dataKey?: unknown;
  value?: unknown;
}

/** The box and its heading. `aside` sits at the right of the heading, e.g. a column key. */
export function TooltipFrame({ heading, aside, children }: { heading: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-44 rounded-md border border-line-strong bg-surface px-3 py-2 shadow-lg">
      <p className="mb-1.5 flex justify-between gap-4 text-[0.75rem] font-medium text-ink">
        <span>{heading}</span>
        {aside ? <span className="text-ink-subtle">{aside}</span> : null}
      </p>
      <ul className="flex flex-col gap-1">{children}</ul>
    </div>
  );
}

/** One series: its swatch and name on the left, the figure in ink on the right. */
export function TooltipRow({ series, label, value }: { series: SeriesKey; label?: ReactNode; value: ReactNode }) {
  const meta = SERIES[series];
  return (
    <li className="flex items-center justify-between gap-4 text-[0.75rem]">
      <span className="flex items-center gap-1.5 text-ink-muted">
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
        {label ?? meta.label}
      </span>
      <span className="font-medium text-ink tabular-nums" data-numeric>
        {value}
      </span>
    </li>
  );
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: readonly PayloadEntry[];
  label?: unknown;
  labelFormatter?: (label: unknown) => ReactNode;
  valueFormatter?: (value: number) => string;
}

const ageLabel = (value: unknown) => `Age ${String(value)}`;

export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter = ageLabel,
  valueFormatter = formatMoney,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const rows = payload.filter(
    (entry): entry is { dataKey: SeriesKey; value: number } =>
      typeof entry.value === 'number' && typeof entry.dataKey === 'string' && entry.dataKey in SERIES,
  );
  if (!rows.length) return null;

  return (
    <TooltipFrame heading={labelFormatter(label)}>
      {rows.map((row) => (
        <TooltipRow key={row.dataKey} series={row.dataKey} value={valueFormatter(row.value)} />
      ))}
    </TooltipFrame>
  );
}

export interface ComparisonTooltipProps<K extends SeriesKey = SeriesKey> extends ChartTooltipProps {
  /** The series to list, in chart order. */
  series: readonly K[];
  /** The data key holding the second scenario's value for a series. */
  secondKey: (series: K) => string;
  /** Names of the two scenarios, shown as the column key. */
  names?: readonly [string, string];
}

/** Each series at the hovered point with two values side by side, e.g. scenarios A and B. */
export function ComparisonTooltip<K extends SeriesKey>({
  active,
  payload,
  label,
  series,
  secondKey,
  names = ['A', 'B'],
  labelFormatter = ageLabel,
  valueFormatter = formatMoney,
}: ComparisonTooltipProps<K>) {
  if (!active || !payload?.length) return null;
  const valueOf = (key: string) => {
    const value = payload.find((entry) => entry.dataKey === key)?.value;
    return typeof value === 'number' ? value : null;
  };
  const show = (value: number | null) => (value === null ? '–' : valueFormatter(value));

  const rows = series
    .map((key) => ({ key, first: valueOf(key), second: valueOf(secondKey(key)) }))
    .filter((row) => row.first !== null || row.second !== null);
  if (!rows.length) return null;

  return (
    <TooltipFrame heading={labelFormatter(label)} aside={`${names[0]} · ${names[1]}`}>
      {rows.map((row) => (
        <TooltipRow
          key={row.key}
          series={row.key}
          label={SERIES[row.key].short}
          value={`${show(row.first)} · ${show(row.second)}`}
        />
      ))}
    </TooltipFrame>
  );
}
