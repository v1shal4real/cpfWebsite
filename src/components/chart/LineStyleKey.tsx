import { LINE_WIDTH } from './chartTheme';

/**
 * A key for a secondary line encoding, e.g. scenario A solid, scenario B
 * dashed. Samples are drawn in muted ink, never a series hue: colour belongs
 * to the series, and a coloured sample would read as one.
 *
 * Sits beside `Legend`, which keys the colours; together they let a chart
 * encode two dimensions without adding a hue.
 */

export interface LineStyleKeyItem {
  label: string;
  /** SVG `stroke-dasharray`. Omit for a solid line. */
  dash?: string;
}

export function LineStyleKey({ items, label }: { items: readonly LineStyleKeyItem[]; label: string }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-ink-muted" aria-label={label}>
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <svg width="22" height="6" aria-hidden="true" className="shrink-0">
            <line x1="1" y1="3" x2="21" y2="3" stroke="var(--ink-muted)" strokeWidth={LINE_WIDTH} strokeDasharray={item.dash} />
          </svg>
          {item.label}
        </li>
      ))}
    </ul>
  );
}
