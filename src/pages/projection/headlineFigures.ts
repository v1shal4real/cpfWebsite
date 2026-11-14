import type { AccountAmounts, ProjectionResult } from '@/engine/types';
import { formatMoney } from '@/lib/format';
import type { FigureBasis } from '@/rules';

/**
 * The figures and sentences behind the headline row and the comparison
 * columns. Wording is neutral by rule: "above" or "below" with the amount,
 * never good, bad, short or on track.
 */

const AGE_55_MONTHS = 55 * 12;

const dollars = (cents: number) => cents / 100;
const totalOf = (b: AccountAmounts) => b.ordinary + b.special + b.medisave + b.retirement;

/** The neutral sentence comparing the Retirement Account to the FRS. */
export function retirementSumContext(
  retirementAccount: number,
  fullRetirementSum: number,
  year: number,
): string {
  const gap = retirementAccount - fullRetirementSum;
  const sum = `the Full Retirement Sum of ${formatMoney(fullRetirementSum)} for members turning 55 in ${year}`;
  if (Math.abs(gap) < 1) return `Equal to ${sum}.`;
  return `${formatMoney(Math.abs(gap))} ${gap > 0 ? 'above' : 'below'} ${sum}.`;
}

export interface HeadlineFigures {
  at55: {
    total: number;
    retirementAccount: number;
    fullRetirementSum: number;
    year: number;
    basis: FigureBasis;
  } | null;
  /** From the projection's last month. Zero when no CPF was used for housing. */
  accruedInterest: number;
  refundable: number;
  usedCpfForHousing: boolean;
  endAge: number;
}

export function headlineFigures(result: ProjectionResult): HeadlineFigures {
  const { summary, months, input } = result;
  const month55 = months.find((month) => month.ageInMonths === AGE_55_MONTHS);
  const last = months.at(-1);
  const housing = last?.housing;
  return {
    at55:
      summary.atAge55 && month55
        ? {
            total: dollars(totalOf(summary.atAge55.balances)),
            retirementAccount: dollars(summary.atAge55.retirementAccount),
            fullRetirementSum: dollars(summary.atAge55.fullRetirementSum),
            year: Number(month55.month.slice(0, 4)),
            basis: summary.atAge55.retirementSumsBasis,
          }
        : null,
    accruedInterest: housing ? dollars(housing.accruedInterest) : 0,
    refundable: dollars(summary.atEnd.housingRefundable),
    usedCpfForHousing: (housing?.principalUsed ?? 0) > 0,
    endAge: input.endAge,
  };
}
