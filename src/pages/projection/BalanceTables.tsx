import { Fragment } from 'react';
import { TBody, THead, Table, Td, Th, Tr } from '@/components/ui';
import { formatMoney, formatMoneyDelta } from '@/lib/format';
import { BALANCE_SERIES, SERIES } from '@/theme/series';
import { ACCOUNT_OF, AGE_55, unionAges, type YearRow } from './balanceData';

/**
 * The balance chart's tabular alternatives: one scenario by year, or two
 * scenarios by year with the difference in the total. `visible` is false for
 * the screen-reader copy shown while the chart is, which must not take focus.
 */

interface TableViewProps {
  visible: boolean;
}

/** A column group: an account, or the total. */
const COLUMNS = [
  ...BALANCE_SERIES.map((key) => ({ id: key as string, title: SERIES[key].label, short: SERIES[key].short })),
  { id: 'total', title: 'Total', short: 'Total' },
];

function ColumnHeading({ title, short }: { title: string; short: string }) {
  return (
    <abbr title={title} className="no-underline">
      {short}
    </abbr>
  );
}

function AgeCell({ age }: { age: number }) {
  return (
    <Th scope="row" className="font-normal text-ink">
      {age}
    </Th>
  );
}

/** A dollar figure, or a dash where the scenario has no row at this age. */
function MoneyCell({ value }: { value: number | undefined }) {
  return <Td numeric>{value === undefined ? '–' : formatMoney(value)}</Td>;
}

const totalOrAccount = (row: YearRow | undefined, id: string) =>
  row === undefined
    ? undefined
    : id === 'total'
      ? row.total
      : row.balances[ACCOUNT_OF[id as keyof typeof ACCOUNT_OF]];

export function BalanceTable({ rows, visible }: TableViewProps & { rows: readonly YearRow[] }) {
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
          {COLUMNS.map((column) => (
            <Th key={column.id} numeric>
              <ColumnHeading {...column} />
            </Th>
          ))}
        </tr>
      </THead>
      <TBody>
        {rows.map((row) => (
          <Tr key={row.age} highlighted={row.age === AGE_55}>
            <AgeCell age={row.age} />
            {COLUMNS.map((column) => (
              <MoneyCell key={column.id} value={totalOrAccount(row, column.id)} />
            ))}
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}

export function ComparisonTable({
  rowsA,
  rowsB,
  visible,
}: TableViewProps & { rowsA: readonly YearRow[]; rowsB: readonly YearRow[] }) {
  const byAgeA = new Map(rowsA.map((row) => [row.age, row]));
  const byAgeB = new Map(rowsB.map((row) => [row.age, row]));

  return (
    <Table
      caption="Projected account balances by age, scenarios A and B, and the difference in the total"
      captionHidden
      focusable={visible}
      density="compact"
      stickyFirstColumn
    >
      <THead>
        <tr>
          <Th rowSpan={2}>Age</Th>
          {COLUMNS.map((column) => (
            <Th key={column.id} colSpan={2} scope="colgroup" numeric className="text-center">
              <ColumnHeading {...column} />
            </Th>
          ))}
          <Th rowSpan={2} numeric>
            Difference in total, B − A
          </Th>
        </tr>
        <tr>
          {COLUMNS.map((column) => (
            <Fragment key={column.id}>
              <Th numeric>A</Th>
              <Th numeric>B</Th>
            </Fragment>
          ))}
        </tr>
      </THead>
      <TBody>
        {unionAges(rowsA, rowsB).map((age) => {
          const a = byAgeA.get(age);
          const b = byAgeB.get(age);
          return (
            <Tr key={age} highlighted={age === AGE_55}>
              <AgeCell age={age} />
              {COLUMNS.map((column) => (
                <Fragment key={column.id}>
                  <MoneyCell value={totalOrAccount(a, column.id)} />
                  <MoneyCell value={totalOrAccount(b, column.id)} />
                </Fragment>
              ))}
              <Td numeric>{a && b ? formatMoneyDelta(b.total - a.total) : '–'}</Td>
            </Tr>
          );
        })}
      </TBody>
    </Table>
  );
}
