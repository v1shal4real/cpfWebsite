import { useEffect, useState, type KeyboardEvent } from 'react';
import { Card, CardBody, CardHeader, DefinitionList, LiveRegion, Slider } from '@/components/ui';
import type { ProjectionResult } from '@/engine/types';
import { formatAgeMonths, formatMoney, formatPercent } from '@/lib/format';
import { SERIES } from '@/theme/series';
import { AGE_55 } from './BalanceChart';
import { nextAgeInMonths, readoutAt, type TimelineReadout } from './timelineState';

/**
 * Scrubbable timeline with a readout of the projection's state at that age.
 *
 * Keys: arrows step a year, Shift+arrows a month, Page Up/Down five years,
 * Home/End the ends. The readout is a lookup into the computed months, so
 * dragging never re-runs the engine. The live region waits for the thumb to
 * settle before announcing, so a screen reader is not flooded mid-drag.
 */

const ANNOUNCE_AFTER_MS = 400;

export interface TimelineProps {
  result: ProjectionResult;
  ageInMonths: number;
  onAgeChange: (ageInMonths: number) => void;
}

export function Timeline({ result, ageInMonths, onAgeChange }: TimelineProps) {
  const min = result.input.startAge * 12;
  const max = result.input.endAge * 12;
  const readout = readoutAt(result, ageInMonths);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (!readout) return;
    const timer = setTimeout(() => setAnnouncement(spoken(readout)), ANNOUNCE_AFTER_MS);
    return () => clearTimeout(timer);
    // The readout is derived from these two; depending on the object would re-fire every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, ageInMonths]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const next = nextAgeInMonths(ageInMonths, event.key, { shift: event.shiftKey, min, max });
    if (next === null) return;
    event.preventDefault();
    onAgeChange(next);
  };

  const shows55 = min <= AGE_55 * 12 && AGE_55 * 12 <= max;

  return (
    <Card>
      <CardHeader
        as="h3"
        title="At a chosen age"
        description="Drag, or use the arrow keys: a year per press, a month with Shift, five years with Page Up and Page Down."
      />
      <CardBody className="flex flex-col gap-4">
        <Slider
          aria-label="Age on the timeline"
          value={ageInMonths}
          onValueChange={onAgeChange}
          onKeyDown={onKeyDown}
          min={min}
          max={max}
          step={1}
          valueLabel={readout ? `Age ${formatAgeMonths(ageInMonths)}, ${readout.month}` : undefined}
          readout={readout ? `Age ${formatAgeMonths(ageInMonths)} · ${readout.month}` : null}
          minLabel={result.input.startAge}
          maxLabel={result.input.endAge}
          ticks={shows55 ? [{ value: AGE_55 * 12, label: 'Age 55: Retirement Account formed' }] : undefined}
        />
        {readout ? <ReadoutPanel readout={readout} /> : null}
        <LiveRegion>{announcement}</LiveRegion>
      </CardBody>
    </Card>
  );
}

function spoken(readout: TimelineReadout): string {
  const parts = [`Age ${formatAgeMonths(readout.ageInMonths)}.`, `Total balances ${formatMoney(readout.total)}.`];
  if (readout.contributionRate !== null) parts.push(`Contribution rate ${formatPercent(readout.contributionRate, 1)}.`);
  if (readout.housing) parts.push(`Owed to CPF on sale ${formatMoney(readout.housing.refundable)}.`);
  return parts.join(' ');
}

function ReadoutPanel({ readout }: { readout: TimelineReadout }) {
  const { balances, allocationShares, housing } = readout;
  const balanceItems = [
    { key: 'oa', value: balances.ordinary },
    { key: 'sa', value: balances.special },
    { key: 'ma', value: balances.medisave },
    { key: 'ra', value: balances.retirement },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
      <section aria-label="Balances" className="flex flex-col gap-1">
        <h4 className="text-[0.8125rem] font-semibold text-ink">Balances</h4>
        <DefinitionList
          items={[
            ...balanceItems.map(({ key, value }) => ({
              term: SERIES[key].label,
              value: formatMoney(value),
              swatch: SERIES[key].color,
            })),
            { term: 'Total', value: formatMoney(readout.total) },
          ]}
        />
      </section>

      <section aria-label="Rates this month" className="flex flex-col gap-1">
        <h4 className="text-[0.8125rem] font-semibold text-ink">Rates this month</h4>
        {readout.contributionRate === null || !allocationShares ? (
          <p className="text-[0.8125rem] text-ink-muted">No wages subject to CPF this month.</p>
        ) : (
          <DefinitionList
            items={[
              { term: 'Contribution, of wage', value: formatPercent(readout.contributionRate, 1) },
              { term: 'Employee', value: formatPercent(readout.employeeRate ?? 0, 1) },
              { term: 'Employer', value: formatPercent(readout.employerRate ?? 0, 1) },
              ...balanceItems
                .filter(({ key }) => allocationShares[ACCOUNT[key]] > 0)
                .map(({ key }) => ({
                  term: `To ${SERIES[key].short}`,
                  value: formatPercent(allocationShares[ACCOUNT[key]], 1),
                  swatch: SERIES[key].color,
                })),
            ]}
          />
        )}

        <h4 className="mt-3 text-[0.8125rem] font-semibold text-ink">Accrued interest</h4>
        {housing ? (
          <DefinitionList
            items={[
              { term: 'CPF used for housing', value: formatMoney(housing.principalUsed) },
              { term: 'Accrued interest', value: formatMoney(housing.accruedInterest), swatch: SERIES.accrued.color },
              { term: 'Refundable on sale', value: formatMoney(housing.refundable) },
            ]}
          />
        ) : (
          <p className="text-[0.8125rem] text-ink-muted">No CPF used for housing by this age.</p>
        )}
      </section>
    </div>
  );
}

const ACCOUNT = { oa: 'ordinary', sa: 'special', ma: 'medisave', ra: 'retirement' } as const;
