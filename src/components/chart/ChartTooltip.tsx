import type { ReactNode } from 'react';
import { formatMoney } from '@/lib/format';
import { SERIES, type SeriesKey } from '@/theme/series';

/**
 * Tooltip body for Recharts line and area charts.
 *
 * Pass as `content={({ active, payload, label }) => <ChartTooltip active={active}
 * payload={payload} label={label} />}`. Do not spread Recharts' props: its own
 * `labelFormatter` has a different signature and collides with ours. Rows keep the
 * series order of the chart, skip series that have no value at this point (the
 * Special Account after 55, the Retirement Account before it), and render the
 * figure in ink, never in the series colour.
 *
 * The prop types are deliberately loose so this does not couple to a specific
 * Recharts generic signature.
 */

interface PayloadEntry {
  dataKey?: unknown;
  value?: unknown;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: readonly PayloadEntry[];
  label?: unknown;
  labelFormatter?: (label: unknown) => ReactNode;
  valueFormatter?: (value: number) => string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter = (value) => `Age ${String(value)}`,
  valueFormatter = formatMoney,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const rows = payload.filter(
    (entry): entry is { dataKey: SeriesKey; value: number } =>
      typeof entry.value === 'number' &&
      typeof entry.dataKey === 'string' &&
      entry.dataKey in SERIES,
  );
  if (!rows.length) return null;

  return (
    <div className="min-w-44 rounded-md border border-line-strong bg-surface px-3 py-2 shadow-lg">
      <p className="mb-1.5 text-[0.75rem] font-medium text-ink">{labelFormatter(label)}</p>
      <ul className="flex flex-col gap-1">
        {rows.map((row) => {
          const meta = SERIES[row.dataKey];
          return (
            <li key={row.dataKey} className="flex items-center justify-between gap-4 text-[0.75rem]">
              <span className="flex items-center gap-1.5 text-ink-muted">
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: meta.color }}
                />
                {meta.label}
              </span>
              <span className="font-medium text-ink tabular-nums" data-numeric>
                {valueFormatter(row.value)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
