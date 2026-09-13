import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/Tabs';

/**
 * The frame every chart sits in.
 *
 * It exists to make the accessibility contract impossible to forget. A chart
 * placed in a `ChartFrame` always has:
 *
 *   - a real title and a one-sentence plain-language summary, announced as the
 *     figure's description;
 *   - a tabular alternative that screen readers reach even while the chart view
 *     is showing, and that sighted users can switch to — which is also the
 *     relief the palette validation requires for series below 3:1 contrast;
 *   - a place for the legend above the plot and for sources beneath it.
 */

export interface ChartFrameProps {
  title: ReactNode;
  /** One sentence describing what the chart shows. Always present for assistive tech. */
  summary: string;
  /** Whether the summary is also shown visually under the title. */
  summaryVisible?: boolean;
  legend?: ReactNode;
  /** Controls at the end of the title row, e.g. a nominal/real toggle. */
  actions?: ReactNode;
  /** The plot. Sized by `height`. */
  children: ReactNode;
  /**
   * Renders the data table. Called with `visible: false` for the hidden
   * screen-reader copy, which should pass `focusable={false}` and
   * `captionHidden` to `Table`.
   */
  renderTable: (options: { visible: boolean }) => ReactNode;
  /** Sources, rules-as-at stamp, caveats. */
  footer?: ReactNode;
  height?: number;
  className?: string;
}

export function ChartFrame({
  title,
  summary,
  summaryVisible = true,
  legend,
  actions,
  children,
  renderTable,
  footer,
  height = 320,
  className,
}: ChartFrameProps) {
  const id = useId();
  const [view, setView] = useState<'chart' | 'table'>('chart');

  return (
    <figure
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-summary`}
      className={cn('flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:p-5', className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1">
          <figcaption id={`${id}-title`} className="text-[0.9375rem] font-semibold leading-tight text-ink">
            {title}
          </figcaption>
          <p
            id={`${id}-summary`}
            className={cn('text-[0.8125rem] leading-snug text-ink-muted', !summaryVisible && 'sr-only-abs')}
          >
            {summary}
          </p>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>

      <Tabs value={view} onValueChange={(next) => setView(next as 'chart' | 'table')}>
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-line">
          <div className="pb-2">{legend}</div>
          <TabList label="Chart view" className="border-0">
            <Tab value="chart">Chart</Tab>
            <Tab value="table">Table</Tab>
          </TabList>
        </div>

        <TabPanel value="chart" className="pt-3">
          <div style={{ height }} className="w-full">
            {children}
          </div>
          {/* The same data as a table, for screen readers, while the chart is showing. */}
          <div className="sr-only-abs">{renderTable({ visible: false })}</div>
        </TabPanel>

        <TabPanel value="table" className="pt-3">
          {renderTable({ visible: true })}
        </TabPanel>
      </Tabs>

      {footer ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-[0.75rem] text-ink-subtle">
          {footer}
        </div>
      ) : null}
    </figure>
  );
}
