import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CURRENT_RULE_SET, basicHealthcareSumInYear, retirementSumsForCohort } from '@/rules';
import { addMonths, monthsBetween, parseMonth } from './calendar';
import { project } from './project';
import { levelInstalment } from './loan';
import type { HousingPlan, LoanTerms, ProjectionInput } from './types';

const BASE_INPUT: ProjectionInput = {
  startMonth: '2026-01',
  startAge: 30,
  endAge: 65,
  openingBalances: { ordinary: 2_000_000, special: 1_000_000, medisave: 500_000, retirement: 0 },
  monthlyOrdinaryWage: 500_000,
  salaryGrowth: { rate: 0, appliedInMonth: 1 },
};

const input = (overrides: Partial<ProjectionInput> = {}): ProjectionInput => ({
  ...BASE_INPUT,
  ...overrides,
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('project', () => {
  it('steps one month at a time from the start age through the end age', () => {
    const result = project(input({ startAge: 30, endAge: 65 }));
    expect(result.months).toHaveLength((65 - 30) * 12 + 1);
    expect(result.months.at(0)?.month).toBe('2026-01');
    expect(result.months.at(0)?.ageInMonths).toBe(30 * 12);
    expect(result.months.at(-1)?.ageInMonths).toBe(65 * 12);
  });

  it('advances the calendar across year boundaries', () => {
    const result = project(input({ startMonth: '2026-11', startAge: 64, endAge: 65 }));
    const stamps = result.months.map((month) => month.month);
    expect(stamps.slice(0, 4)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    for (const [index, stamp] of stamps.entries()) {
      expect(stamp).toBe(addMonths('2026-11', index));
    }
  });

  it('records the rules each month was computed under', () => {
    const result = project(input());
    for (const month of result.months) {
      expect(month.ruleSetId).toBe(CURRENT_RULE_SET.id);
    }
    // One entry per distinct rule set, which is one until a second dated set
    // is added. A projection crossing a rule change lists both, in order.
    expect(result.ruleSetIds).toEqual([CURRENT_RULE_SET.id]);
  });

  it('is pure: the same input always produces an identical result', () => {
    const first = project(input());
    const second = project(input());
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('does not mutate the input it was given', () => {
    const given = input();
    const snapshot = structuredClone(given);
    const result = project(given);
    expect(given).toEqual(snapshot);
    // Balances in the result must not alias the caller's object either.
    expect(result.months.at(0)?.openingBalances).not.toBe(given.openingBalances);
  });

  it('gives the same result whatever the system clock says', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const early = project(input());
    vi.setSystemTime(new Date('2071-06-30T23:59:59Z'));
    const late = project(input());
    expect(late).toEqual(early);
  });

  it('never reads the clock', () => {
    const now = vi.spyOn(Date, 'now');
    project(input());
    expect(now).not.toHaveBeenCalled();
  });
});

describe('salary growth', () => {
  const wagesByMonth = (given: ProjectionInput) =>
    project(given).months.map((month) => ({ month: month.month, wage: month.ordinaryWage }));

  it('holds the wage flat when growth is zero', () => {
    const wages = wagesByMonth(input({ salaryGrowth: { rate: 0, appliedInMonth: 1 } }));
    expect(new Set(wages.map((entry) => entry.wage))).toEqual(new Set([500_000]));
  });

  it('applies the raise once a year, in the stated month', () => {
    const wages = wagesByMonth(
      input({ startAge: 30, endAge: 33, salaryGrowth: { rate: 0.03, appliedInMonth: 4 } }),
    );
    const raises = wages.filter((entry, index) => index > 0 && entry.wage !== wages[index - 1]?.wage);
    // The projection ends in 2029-01, before that year's raise month.
    expect(raises.map((entry) => entry.month)).toEqual(['2026-04', '2027-04', '2028-04']);
    // 3% a year, compounding, rounded to the cent each time.
    expect(raises.map((entry) => entry.wage)).toEqual([515_000, 530_450, 546_364]);
  });

  it('does not raise the wage in the first month, even when it is the raise month', () => {
    const wages = wagesByMonth(
      input({ startMonth: '2026-04', salaryGrowth: { rate: 0.03, appliedInMonth: 4 } }),
    );
    expect(wages.at(0)).toEqual({ month: '2026-04', wage: 500_000 });
    // The first raise lands a year after the projection starts.
    expect(wages.at(12)).toEqual({ month: '2027-04', wage: 515_000 });
  });
});

describe('contributions through the loop', () => {
  it('computes a contribution for every month and totals them', () => {
    const result = project(input({ startAge: 30, endAge: 31 }));
    const monthly = result.months.at(0)?.contribution;
    // $5,000 a month at 37%, of which the employee pays 20%.
    expect(monthly?.ordinaryWageSubjectToCpf).toBe(500_000);
    expect(monthly?.total).toBe(185_000);
    expect(monthly?.employee).toBe(100_000);
    expect(result.summary.totals.contributions).toBe(185_000 * result.months.length);
  });

  it('caps a high earner at the Ordinary Wage ceiling every month', () => {
    const ceiling = CURRENT_RULE_SET.wageCeilings.ordinaryWageCeiling * 100;
    const result = project(input({ monthlyOrdinaryWage: 2_000_000, startAge: 30, endAge: 31 }));
    for (const month of result.months) {
      expect(month.contribution.ordinaryWageSubjectToCpf).toBe(ceiling);
      expect(month.contribution.total).toBe(296_000);
    }
  });

  it('applies the age band from the month after the 55th birthday', () => {
    const result = project(input({ startMonth: '2026-06', startAge: 55, endAge: 56 }));
    const [birthdayMonth, monthAfter] = result.months;
    // 37% in June, 34% from July.
    expect(birthdayMonth?.contribution.total).toBe(185_000);
    expect(monthAfter?.contribution.total).toBe(170_000);
  });

  it('raises contributions with the wage', () => {
    const result = project(
      input({ startAge: 30, endAge: 31, salaryGrowth: { rate: 0.1, appliedInMonth: 1 } }),
    );
    const before = result.months.find((month) => month.month === '2026-12');
    const after = result.months.find((month) => month.month === '2027-01');
    expect(before?.contribution.total).toBe(185_000);
    // $5,500 a month at 37% = $2,035.
    expect(after?.contribution.total).toBe(203_500);
  });

  it('counts the annual ceilings per calendar year, not per projection year', () => {
    // A wage at the ceiling for a whole year uses $96,000 of the $102,000
    // annual allowance, so nothing is ever curtailed and January starts fresh.
    const ceiling = CURRENT_RULE_SET.wageCeilings.ordinaryWageCeiling * 100;
    const result = project(input({ monthlyOrdinaryWage: ceiling, startAge: 30, endAge: 33 }));
    const januaries = result.months.filter((month) => month.month.endsWith('-01'));
    expect(januaries.length).toBeGreaterThan(1);
    for (const month of result.months) {
      expect(month.contribution.ordinaryWageSubjectToCpf).toBe(ceiling);
    }
  });
});

describe('allocation through the loop', () => {
  it('credits each month exactly its contribution, split by account', () => {
    // From 30; across the age-55 transition from 54; and buying a flat at 31.
    const buyer: Partial<ProjectionInput> = {
      housing: {
        purchaseAge: 31,
        price: 50_000_000,
        downpaymentFromOrdinaryAccount: 2_000_000,
        downpaymentFromCash: 8_000_000,
        loan: { kind: 'hdb-concessionary', principal: 40_000_000, tenureYears: 25 },
        instalmentsPaidFrom: 'ordinary-account',
      },
    };
    for (const [startAge, extra] of [[30, {}], [54, {}], [30, buyer]] as const) {
      const result = project(input({ startAge, endAge: startAge + 2, ...extra }));
      for (const month of result.months) {
        const { allocation, total } = month.contribution;
        expect(allocation.ordinary + allocation.special + allocation.medisave + allocation.retirement).toBe(total);
        for (const account of ['ordinary', 'special', 'medisave', 'retirement'] as const) {
          // Interest lands in December; the MediSave overflow moves money out of
          // MediSave into the account it is routed to; the age-55 rules move
          // money between accounts; housing payments leave the OA.
          const overflow = month.medisaveOverflow;
          const moved = account === 'medisave' ? -overflow.amount : overflow.to[account];
          const housing = account === 'ordinary' ? (month.housing?.withdrawnFromOrdinaryAccount ?? 0) : 0;
          expect(month.closingBalances[account] - month.openingBalances[account], `${month.month} ${account}`).toBe(
            allocation[account] + month.interest.credited[account] + moved + month.retirementTransfers[account] - housing,
          );
        }
      }
    }
  });

  it('allocates $1,850 at 30 as MediSave, then Special, then the rest to Ordinary', () => {
    const [first] = project(input({ startAge: 30, endAge: 31 })).months;
    // $1,850 x 21.62% = $399.97, x 16.21% = $299.885, which rounds up.
    expect(first?.contribution.allocation).toEqual({
      medisave: 39_997,
      special: 29_989,
      ordinary: 185_000 - 39_997 - 29_989,
      retirement: 0,
    });
  });

  it('routes the second share to Ordinary once the Retirement Account holds the FRS', () => {
    // 57 in January 2026: this member turned 55 in 2024, and that cohort's
    // FRS is the one that applies, not 2026's.
    const fullRetirementSum = retirementSumsForCohort(CURRENT_RULE_SET, 2024).fullRetirementSum * 100;
    const result = project(
      input({
        startAge: 57,
        endAge: 58,
        openingBalances: { ordinary: 0, special: 0, medisave: 0, retirement: fullRetirementSum },
      }),
    );
    for (const month of result.months) {
      expect(month.contribution.allocation.retirement).toBe(0);
      expect(month.contribution.allocation.special).toBe(0);
      // Interest may take the Retirement Account past the sum; contributions may not.
      expect(month.closingBalances.retirement - month.openingBalances.retirement).toBe(
        month.interest.credited.retirement,
      );
    }
  });
});

describe('interest through the loop', () => {
  const ACCOUNTS = ['ordinary', 'special', 'medisave', 'retirement'] as const;
  const { interest: rates } = CURRENT_RULE_SET;

  it('accrues on each month’s opening balance, so a contribution earns from the next month', () => {
    const result = project(input({ startAge: 30, endAge: 31 }));
    for (const month of result.months) {
      for (const account of ACCOUNTS) {
        // A month reports the change in the rounded year-to-date figure, so it
        // is within a cent of the exact twelfth of the annual rate.
        const exact = (month.openingBalances[account] * rates[account]) / 12;
        expect(Math.abs(month.interest.baseAccrued[account] - exact)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('credits the year’s interest in December only, and it compounds from January', () => {
    const result = project(input({ startMonth: '2026-01', startAge: 30, endAge: 32 }));
    const byYear = new Map<string, number>();
    for (const month of result.months) {
      const year = month.month.slice(0, 4);
      const credited = ACCOUNTS.reduce((sum, account) => sum + month.interest.credited[account], 0);
      if (!month.month.endsWith('-12')) {
        expect(credited, month.month).toBe(0);
        continue;
      }
      // Base interest on each account plus extra interest by where it lands.
      const accrued = result.months
        .filter((each) => each.month.startsWith(year))
        .reduce(
          (sum, each) =>
            sum +
            ACCOUNTS.reduce(
              (s, a) => s + each.interest.baseAccrued[a] + each.interest.extraAccruedTo[a],
              0,
            ),
          0,
        );
      expect(credited, month.month).toBe(accrued);
      byYear.set(year, credited);
    }
    expect(byYear.size).toBe(2);
    // January's opening balance includes December's credit, so it earns on it.
    const january = result.months.find((month) => month.month === '2027-01');
    const december = result.months.find((month) => month.month === '2026-12');
    expect(january?.openingBalances).toEqual(december?.closingBalances);
  });

  it('matches a hand computation for the first year of a projection', () => {
    // Opening OA $20,000, SA $10,000 and MA $5,000, each receiving its share of
    // $1,850 every month. Combined balances stay under the $60,000 tier all
    // year, and OA stays at or above its $20,000 cap, so the tier counts
    // $20,000 of OA plus all of SA and MA.
    const result = project(input({ startMonth: '2026-01', startAge: 30, endAge: 31 }));
    const december = result.months.find((month) => month.month === '2026-12')!;
    const share = result.months[0]!.contribution.allocation.special;
    const [tier] = rates.extraTiersBelow55;
    const cap = rates.ordinaryAccountExtraInterestCap * 100;
    // Month m (1-12) earns on the opening balance plus (m - 1) shares.
    let base = 0;
    let extraToSpecial = 0;
    for (let m = 1; m <= 12; m++) {
      const special = 1_000_000 + (m - 1) * share;
      base += (special * rates.special) / 12;
      // SA keeps its own extra interest and receives the OA's.
      extraToSpecial += ((special + cap) * tier!.rate) / 12;
    }
    expect(december.interest.credited.special).toBe(Math.round(base) + Math.round(extraToSpecial));
  });

  it('credits only the months covered when the projection starts mid-year', () => {
    const result = project(input({ startMonth: '2026-10', startAge: 30, endAge: 31 }));
    const december = result.months.find((month) => month.month === '2026-12')!;
    const covered = result.months.filter((month) => month.month <= '2026-12');
    expect(covered).toHaveLength(3);
    // OA is credited only its own base interest; its extra interest goes to SA.
    expect(december.interest.credited.ordinary).toBe(
      covered.reduce((sum, month) => sum + month.interest.baseAccrued.ordinary, 0),
    );
  });

  it('never credits extra interest to the Ordinary Account', () => {
    for (const startAge of [30, 57]) {
      for (const month of project(input({ startAge, endAge: startAge + 2 })).months) {
        expect(month.interest.extraAccruedOn.ordinary).toBeGreaterThan(0);
        expect(month.interest.extraAccruedTo.ordinary).toBe(0);
      }
    }
  });

  it('routes the Ordinary Account’s extra interest to SA below 55 and RA from 55', () => {
    const below = project(input({ startAge: 30, endAge: 31 })).months[0]!;
    // OA is at its $20,000 cap: 1% a year on it, a twelfth a month.
    expect(below.interest.extraAccruedOn.ordinary).toBe(1_667);
    expect(below.interest.extraAccruedTo.special).toBe(
      below.interest.extraAccruedOn.special + below.interest.extraAccruedOn.ordinary,
    );

    const above = project(
      input({
        startAge: 57,
        endAge: 58,
        openingBalances: { ordinary: 2_000_000, special: 0, medisave: 500_000, retirement: 1_000_000 },
      }),
    ).months[0]!;
    expect(above.interest.extraAccruedTo.retirement).toBe(
      above.interest.extraAccruedOn.retirement + above.interest.extraAccruedOn.ordinary,
    );
    expect(above.interest.extraAccruedTo.special).toBe(0);
  });

  it('earns less extra interest when the Ordinary Account holds under $20,000', () => {
    const firstYearExtra = (ordinary: number) => {
      const openingBalances = { ordinary, special: 1_000_000, medisave: 500_000, retirement: 0 };
      return project(input({ startAge: 30, endAge: 31, openingBalances }))
        .months.filter((month) => month.month.startsWith('2026'))
        .reduce(
          (sum, month) => sum + ACCOUNTS.reduce((s, a) => s + month.interest.extraAccruedOn[a], 0),
          0,
        );
    };
    // Above the cap, more OA earns no more extra interest; below it, less OA earns less.
    expect(firstYearExtra(3_000_000)).toBe(firstYearExtra(2_000_000));
    expect(firstYearExtra(500_000)).toBeLessThan(firstYearExtra(2_000_000));
  });

  it('totals the interest credited in the summary', () => {
    const result = project(input({ startAge: 30, endAge: 40 }));
    const credited = result.months.reduce(
      (sum, month) => sum + ACCOUNTS.reduce((s, a) => s + month.interest.credited[a], 0),
      0,
    );
    expect(credited).toBeGreaterThan(0);
    expect(result.summary.totals.interest).toBe(credited);
  });
});

describe('Basic Healthcare Sum through the loop', () => {
  const BHS_2026 = 7_900_000;
  const nothing = { ordinary: 0, special: 0, medisave: 0, retirement: 0 };
  /** A 40-year-old a little under the 2026 BHS, whose first contribution tips MediSave over. */
  const nearTheCap = input({
    startMonth: '2026-01',
    startAge: 40,
    endAge: 45,
    openingBalances: { ordinary: 2_000_000, special: 1_000_000, medisave: 7_890_000, retirement: 0 },
  });

  it('moves the excess to the Special Account below 55', () => {
    const [first] = project(nearTheCap).months;
    // $1,850 x 24.32% = $449.92 to MediSave, taking it to $79,349.92: $349.92 over.
    expect(first?.medisaveOverflow).toEqual({
      basicHealthcareSum: BHS_2026,
      amount: 34_992,
      to: { ...nothing, special: 34_992 },
    });
    expect(first?.closingBalances.medisave).toBe(BHS_2026);
  });

  it('moves it to the Ordinary Account below 55 once SA holds this year’s FRS', () => {
    const [first] = project(
      input({
        ...nearTheCap,
        openingBalances: { ordinary: 0, special: 22_040_000, medisave: 7_890_000, retirement: 0 },
      }),
    ).months;
    expect(first?.medisaveOverflow.to).toEqual({ ...nothing, ordinary: 34_992 });
  });

  it('moves it to the Retirement Account from 55, up to the cohort FRS', () => {
    // 57 in 2026: turned 55 in 2024, FRS $205,800. $1,700 x 30.88% = $524.96 to MediSave.
    const [first] = project(
      input({
        startMonth: '2026-01',
        startAge: 57,
        endAge: 58,
        openingBalances: { ordinary: 0, special: 0, medisave: BHS_2026, retirement: 10_000_000 },
      }),
    ).months;
    expect(first?.medisaveOverflow.to).toEqual({ ...nothing, retirement: 52_496 });
  });

  it('moves it to the Ordinary Account from 55 once RA holds the cohort FRS', () => {
    const [first] = project(
      input({
        startMonth: '2026-01',
        startAge: 57,
        endAge: 58,
        openingBalances: { ordinary: 0, special: 0, medisave: BHS_2026, retirement: 20_580_000 },
      }),
    ).months;
    expect(first?.medisaveOverflow.to).toEqual({ ...nothing, ordinary: 52_496 });
    expect(first?.closingBalances.retirement).toBe(20_580_000);
  });

  it('never lets MediSave close a month above the cap, interest included', () => {
    const result = project(nearTheCap);
    for (const month of result.months) {
      expect(month.closingBalances.medisave, month.month).toBeLessThanOrEqual(
        month.medisaveOverflow.basicHealthcareSum,
      );
    }
    // December's credit takes MediSave over as well, and is moved on with the contribution.
    const december = result.months.find((month) => month.month === '2026-12')!;
    expect(december.interest.credited.medisave).toBeGreaterThan(0);
    expect(december.medisaveOverflow.amount).toBeGreaterThan(
      december.contribution.allocation.medisave,
    );
  });

  it('takes the BHS for each year from the escalation assumption', () => {
    const result = project(nearTheCap);
    const capIn = (stamp: string) =>
      result.months.find((month) => month.month === stamp)!.medisaveOverflow.basicHealthcareSum;
    expect(capIn('2026-12')).toBe(BHS_2026);
    // $79,000 x 1.047, to the nearest $100.
    expect(capIn('2027-01')).toBe(8_270_000);
    expect(capIn('2030-06')).toBe(basicHealthcareSumInYear(CURRENT_RULE_SET, 2030).amount * 100);
  });

  it('fixes the BHS at the value in force in the year the member turns 65', () => {
    // 64 in January 2026 turns 65 in January 2027, so the 2027 BHS holds from then on.
    const result = project(input({ startMonth: '2026-01', startAge: 64, endAge: 66 }));
    const capIn = (stamp: string) =>
      result.months.find((month) => month.month === stamp)!.medisaveOverflow.basicHealthcareSum;
    expect(capIn('2026-06')).toBe(BHS_2026);
    expect(capIn('2027-06')).toBe(8_270_000);
    expect(capIn('2028-01')).toBe(8_270_000);
    expect(basicHealthcareSumInYear(CURRENT_RULE_SET, 2028).amount * 100).toBeGreaterThan(8_270_000);
  });

  it('emits the BHS reached event once, the first month MediSave reaches it', () => {
    const result = project(nearTheCap);
    const reached = result.months.flatMap((month) =>
      month.events
        .filter((event) => event.kind === 'basic-healthcare-sum-reached')
        .map((event) => ({ month: month.month, event })),
    );
    // The BHS rises every January, so MediSave dips under it and refills each
    // year; only the first time is a milestone.
    expect(reached).toEqual([
      {
        month: '2026-01',
        event: {
          kind: 'basic-healthcare-sum-reached',
          basicHealthcareSum: BHS_2026,
          overflow: 34_992,
          overflowTo: { ...nothing, special: 34_992 },
        },
      },
    ]);
  });

  it('emits no event when MediSave never reaches the BHS', () => {
    const result = project(input({ startAge: 30, endAge: 32 }));
    for (const month of result.months) {
      expect(month.events).toEqual([]);
      expect(month.medisaveOverflow.amount).toBe(0);
    }
  });
});

describe('age-55 transition through the loop', () => {
  // 54 in January 2026 turns 55 in January 2027: cohort FRS $228,200.
  const COHORT_FRS = 22_820_000;
  const turning55 = input({
    startMonth: '2026-01',
    startAge: 54,
    endAge: 57,
    openingBalances: { ordinary: 10_000_000, special: 15_000_000, medisave: 5_000_000, retirement: 0 },
  });
  const result = project(turning55);
  const at = (stamp: string) => result.months.find((month) => month.month === stamp)!;
  const transitions = result.months.flatMap((month) =>
    month.events.filter((event) => event.kind === 'age-55-transition').map((event) => ({ month, event })),
  );

  it('runs once, in the month the member turns 55', () => {
    expect(transitions).toHaveLength(1);
    expect(transitions[0]!.month.month).toBe('2027-01');
    expect(transitions[0]!.month.ageInMonths).toBe(55 * 12);
  });

  it('fills the Retirement Account from SA, then OA, up to the cohort FRS', () => {
    const { month, event } = transitions[0]!;
    expect(event).toMatchObject({
      kind: 'age-55-transition',
      fullRetirementSum: COHORT_FRS,
      fullRetirementSumSetAside: true,
      retirementAccount: COHORT_FRS,
      specialAccountRemainderToOrdinary: 0,
      from55RulesApplyFrom: '2027-02',
    });
    // Everything the SA held at the end of the month went in first, and the OA made up the rest.
    expect(event.kind === 'age-55-transition' && event.transferredFromSpecial).toBe(-month.retirementTransfers.special);
    expect(event.kind === 'age-55-transition' && event.transferredFromOrdinary).toBe(-month.retirementTransfers.ordinary);
    expect(month.retirementTransfers.retirement).toBe(COHORT_FRS);
    expect(month.closingBalances.retirement).toBe(COHORT_FRS);
  });

  it('conserves balances across the transition', () => {
    const { month } = transitions[0]!;
    const { ordinary, special, medisave, retirement } = month.retirementTransfers;
    expect(ordinary + special + medisave + retirement).toBe(0);
    expect(medisave).toBe(0);
  });

  it('closes the Special Account from that month on', () => {
    for (const month of result.months.filter((each) => each.month >= '2027-01')) {
      expect(month.closingBalances.special, month.month).toBe(0);
      // The birthday month's own share still lands in SA before it closes.
      if (month.month > '2027-01') expect(month.contribution.allocation.special, month.month).toBe(0);
    }
  });

  it('keeps the 55-and-below rules in the birthday month and switches the month after', () => {
    // The birthday month's contribution is still on the 55-and-below band, lands in SA, and moves with it.
    expect(at('2027-01').contribution.allocation.special).toBeGreaterThan(0);
    expect(at('2027-01').contribution.total).toBe(185_000);
    // From February: the above-55 rates (34%), and the second share goes to RA, or to OA with RA full.
    expect(at('2027-02').contribution.total).toBe(170_000);
    expect(at('2027-02').contribution.allocation.special).toBe(0);
  });

  it('moves the SA’s December interest on, since the account is closed', () => {
    // The SA earned interest in January 2027 before it closed. It is credited
    // in December 2027 and, with the RA at the FRS, goes to the OA.
    const december = at('2027-12');
    expect(december.interest.credited.special).toBeGreaterThan(0);
    expect(december.retirementTransfers.special).toBe(-december.interest.credited.special);
    expect(december.retirementTransfers.ordinary).toBe(december.interest.credited.special);
    expect(december.closingBalances.special).toBe(0);
  });

  it('exposes the withdrawable amount without withdrawing it', () => {
    const { month, event } = transitions[0]!;
    const withdrawable = event.kind === 'age-55-transition' ? event.withdrawable : -1;
    // FRS set aside, so the whole OA may be withdrawn, and it is still there.
    expect(withdrawable).toBe(month.closingBalances.ordinary);
    expect(withdrawable).toBeGreaterThan(0);
    expect(at('2027-02').openingBalances.ordinary).toBe(month.closingBalances.ordinary);
    expect(result.summary.atAge55?.withdrawable).toBe(withdrawable);
    expect(result.summary.atAge55?.retirementAccount).toBe(COHORT_FRS);
  });

  it('keeps $5,000 withdrawable in the OA when the FRS is out of reach', () => {
    const short = project(
      input({
        ...turning55,
        openingBalances: { ordinary: 1_000_000, special: 5_000_000, medisave: 5_000_000, retirement: 0 },
      }),
    );
    const month = short.months.find((each) => each.ageInMonths === 55 * 12)!;
    const event = month.events.find((each) => each.kind === 'age-55-transition');
    expect(event).toMatchObject({ fullRetirementSumSetAside: false, withdrawable: 500_000 });
    expect(month.closingBalances.ordinary).toBe(500_000);
  });

  it('runs in the first month when the projection starts in the birthday month', () => {
    const fromFiftyFive = project(input({ startMonth: '2026-01', startAge: 55, endAge: 56 }));
    expect(fromFiftyFive.months[0]!.events.map((event) => event.kind)).toContain('age-55-transition');
  });

  it('does not run when the projection starts after 55', () => {
    const later = project(input({ startMonth: '2026-01', startAge: 57, endAge: 60 }));
    for (const month of later.months) {
      expect(month.events.map((event) => event.kind)).not.toContain('age-55-transition');
    }
    expect(later.summary.atAge55).toBeUndefined();
  });
});

describe('housing loan through the loop', () => {
  /** Bought at 32 for $500,000, $100,000 down and $400,000 borrowed. */
  const housing = (loan: LoanTerms): HousingPlan => ({
    purchaseAge: 32,
    price: 50_000_000,
    downpaymentFromOrdinaryAccount: 5_000_000,
    downpaymentFromCash: 5_000_000,
    loan,
    instalmentsPaidFrom: 'ordinary-account',
  });
  const hdbLoan: LoanTerms = { kind: 'hdb-concessionary', principal: 40_000_000, tenureYears: 25 };
  // 30 in January 2026: buys in January 2028, clears 25 years later in January 2053, at 57.
  const withLoan = input({ startMonth: '2026-01', startAge: 30, endAge: 65, housing: housing(hdbLoan) });
  const result = project(withLoan);
  const at = (stamp: string) => result.months.find((month) => month.month === stamp)!;

  it('draws the loan in the purchase month and starts instalments the month after', () => {
    expect(at('2027-12').loan).toBeUndefined();
    expect(at('2028-01').loan).toMatchObject({ drawn: 40_000_000, instalment: 0, closingBalance: 40_000_000 });
    expect(at('2028-02').loan).toMatchObject({ openingBalance: 40_000_000, instalment: 181_468 });
  });

  it('charges the HDB rate derived from the OA rate in the rule set', () => {
    const expected = CURRENT_RULE_SET.interest.ordinary + CURRENT_RULE_SET.housing.concessionaryLoanSpread;
    for (const month of result.months.filter((each) => each.loan)) {
      expect(month.loan!.rate).toBeCloseTo(expected, 10);
    }
  });

  it('carries the balance month to month until it is cleared', () => {
    const loanMonths = result.months.filter((month) => month.loan);
    for (let index = 1; index < loanMonths.length; index++) {
      expect(loanMonths[index]!.loan!.openingBalance).toBe(loanMonths[index - 1]!.loan!.closingBalance);
    }
    // The purchase month and 300 instalments.
    expect(loanMonths).toHaveLength(301);
    expect(loanMonths.at(-1)!.month).toBe('2053-01');
    expect(loanMonths.at(-1)!.loan!.closingBalance).toBe(0);
    expect(at('2053-02').loan).toBeUndefined();
  });

  it('emits the loan cleared event once, with the last instalment', () => {
    const cleared = result.months.flatMap((month) =>
      month.events.filter((event) => event.kind === 'housing-loan-cleared').map((event) => ({ month, event })),
    );
    expect(cleared).toHaveLength(1);
    expect(cleared[0]!.month.month).toBe('2053-01');
    const totalInterest = result.months.reduce((sum, month) => sum + (month.loan?.interest ?? 0), 0);
    expect(cleared[0]!.event).toEqual({
      kind: 'housing-loan-cleared',
      principal: 40_000_000,
      instalmentsPaid: 300,
      totalInterestPaid: totalInterest,
    });
  });

  it('charges a bank loan its own rate', () => {
    const bankLoan: LoanTerms = { kind: 'bank', principal: 40_000_000, tenureYears: 25, interestRate: 0.03 };
    const months = project(input({ ...withLoan, housing: housing(bankLoan) })).months;
    const first = months.find((month) => month.month === '2028-02')!;
    expect(first.loan!.rate).toBe(0.03);
    expect(first.loan!.instalment).toBe(levelInstalment(40_000_000, 0.03, 300));
  });

  it('emits no event when the loan outlives the projection', () => {
    const short = project(input({ ...withLoan, endAge: 40 }));
    expect(short.months.at(-1)!.loan!.closingBalance).toBeGreaterThan(0);
    for (const month of short.months) {
      expect(month.events.map((event) => event.kind)).not.toContain('housing-loan-cleared');
    }
  });

  it('draws no loan for a purchase without one', () => {
    const cash = project(input({ ...withLoan, housing: housing({ ...hdbLoan, principal: 0 }) }));
    expect(cash.months.some((month) => month.loan)).toBe(false);
  });

});

describe('housing withdrawals through the loop', () => {
  const hdbLoan: LoanTerms = { kind: 'hdb-concessionary', principal: 40_000_000, tenureYears: 25 };
  /** Bought at 32 in January 2028: $30,000 of the downpayment from OA, $70,000 in cash. */
  const plan = (overrides: Partial<HousingPlan> = {}): HousingPlan => ({
    purchaseAge: 32,
    price: 50_000_000,
    downpaymentFromOrdinaryAccount: 3_000_000,
    downpaymentFromCash: 7_000_000,
    loan: hdbLoan,
    instalmentsPaidFrom: 'ordinary-account',
    ...overrides,
  });
  const buyer = (overrides: Partial<HousingPlan> = {}) =>
    project(input({ startMonth: '2026-01', startAge: 30, endAge: 65, housing: plan(overrides) }));
  const result = buyer();
  const at = (stamp: string) => result.months.find((month) => month.month === stamp)!;
  const owning = result.months.filter((month) => month.housing);

  it('draws the OA share of the downpayment in the purchase month', () => {
    const purchase = at('2028-01');
    expect(at('2027-12').housing).toBeUndefined();
    expect(purchase.housing).toMatchObject({
      withdrawnFromOrdinaryAccount: 3_000_000,
      paidInCash: 7_000_000,
      shortfallToCash: 0,
      principalUsed: 3_000_000,
    });
    expect(purchase.events).toContainEqual({
      kind: 'property-purchased',
      fromOrdinaryAccount: 3_000_000,
      fromCash: 7_000_000,
      loanPrincipal: 40_000_000,
    });
  });

  it('draws each instalment from the OA when the member chose to', () => {
    for (const month of owning.filter((each) => each.loan && each.loan.instalment > 0)) {
      const { withdrawnFromOrdinaryAccount, shortfallToCash } = month.housing!;
      expect(withdrawnFromOrdinaryAccount + shortfallToCash, month.month).toBe(month.loan!.instalment);
    }
  });

  it('pays each instalment in cash when the member chose to, leaving the OA alone', () => {
    const cash = buyer({ instalmentsPaidFrom: 'cash' });
    for (const month of cash.months.filter((each) => each.housing && each.month > '2028-01')) {
      expect(month.housing!.withdrawnFromOrdinaryAccount).toBe(0);
      expect(month.housing!.paidInCash).toBe(month.loan?.instalment ?? 0);
    }
  });

  it('never takes the OA negative, and records the shortfall that falls to cash', () => {
    // A member with nothing in OA, buying at once: the OA share cannot be met.
    const broke = project(
      input({
        startMonth: '2026-01',
        startAge: 30,
        endAge: 35,
        openingBalances: { ordinary: 0, special: 0, medisave: 0, retirement: 0 },
        housing: plan({ purchaseAge: 30 }),
      }),
    );
    const purchase = broke.months[0]!;
    // Only this month's Ordinary share was there to draw on.
    expect(purchase.housing!.withdrawnFromOrdinaryAccount).toBe(purchase.contribution.allocation.ordinary);
    expect(purchase.housing!.shortfallToCash).toBe(3_000_000 - purchase.contribution.allocation.ordinary);
    expect(purchase.housing!.paidInCash).toBe(7_000_000 + purchase.housing!.shortfallToCash);
    for (const month of broke.months) expect(month.closingBalances.ordinary, month.month).toBeGreaterThanOrEqual(0);
    // Instalments larger than the monthly Ordinary share run short every month.
    expect(broke.months[1]!.housing!.shortfallToCash).toBeGreaterThan(0);
  });

  it('respects the HDB $20,000 retention, capping a larger request at it', () => {
    const retaining = buyer({ ordinaryAccountRetention: 5_000_000 });
    for (const month of retaining.months.filter((each) => each.housing)) {
      expect(month.housing!.ordinaryAccountRetention).toBe(2_000_000);
      if (month.housing!.withdrawnFromOrdinaryAccount > 0) {
        const left = month.openingBalances.ordinary + month.contribution.allocation.ordinary;
        expect(left - month.housing!.withdrawnFromOrdinaryAccount, month.month).toBeGreaterThanOrEqual(2_000_000);
      }
    }
    // Retaining more leaves more in OA than paying from it freely does.
    const withdrawnTotal = (months: typeof result.months) =>
      months.reduce((sum, month) => sum + (month.housing?.withdrawnFromOrdinaryAccount ?? 0), 0);
    expect(withdrawnTotal(retaining.months)).toBeLessThan(withdrawnTotal(result.months));
  });

  it('respects a bank-loan buyer’s retention of any amount', () => {
    const bank = buyer({
      loan: { kind: 'bank', principal: 40_000_000, tenureYears: 25, interestRate: 0.03 },
      ordinaryAccountRetention: 5_000_000,
    });
    for (const month of bank.months.filter((each) => each.housing)) {
      expect(month.housing!.ordinaryAccountRetention).toBe(5_000_000);
      if (month.housing!.withdrawnFromOrdinaryAccount > 0) {
        const left = month.openingBalances.ordinary + month.contribution.allocation.ordinary;
        expect(left - month.housing!.withdrawnFromOrdinaryAccount, month.month).toBeGreaterThanOrEqual(5_000_000);
      }
    }
  });

  it('records every withdrawal as CPF principal used for housing', () => {
    let running = 0;
    for (const month of owning) {
      running += month.housing!.withdrawnFromOrdinaryAccount;
      expect(month.housing!.principalUsed, month.month).toBe(running);
    }
    expect(result.summary.totals.housingWithdrawals).toBe(running);
    // The refund due is the principal plus the interest it has accrued.
    const last = owning.at(-1)!.housing!;
    expect(last.refundable).toBe(running + last.accruedInterest);
  });

  it('keeps recording the principal used after the loan is cleared', () => {
    const afterLoan = owning.filter((month) => month.month > '2053-01');
    expect(afterLoan.length).toBeGreaterThan(0);
    for (const month of afterLoan) {
      expect(month.housing!.withdrawnFromOrdinaryAccount).toBe(0);
      expect(month.housing!.principalUsed).toBe(at('2053-01').housing!.principalUsed);
    }
  });

  it('accrues interest on the principal from the purchase month', () => {
    // A month of 2.5% on the $30,000 downpayment from OA: $62.50.
    expect(at('2028-01').housing).toMatchObject({ principalUsed: 3_000_000, accruedInterest: 6_250 });
  });

  it('compounds the accrued interest annually, at the rule set’s rate', () => {
    // At each December, the year's accrued interest is within rounding of a
    // year of the rate on the principal and the interest credited before it.
    const decembers = owning.filter((month) => month.month.endsWith('-12'));
    for (let index = 1; index < decembers.length; index++) {
      const previous = decembers[index - 1]!.housing!;
      const current = decembers[index]!.housing!;
      const yearOnPrevious = previous.refundable * CURRENT_RULE_SET.housing.accruedInterestRate;
      const accruedThisYear = current.accruedInterest - previous.accruedInterest;
      // The year's withdrawals also earn for the months they were out, so the
      // year earns at least a full year on what was already refundable.
      expect(accruedThisYear, current.principalUsed.toString()).toBeGreaterThanOrEqual(Math.floor(yearOnPrevious));
    }
  });

  it('keeps accruing after the loan is cleared', () => {
    const afterLoan = owning.filter((month) => month.month > '2053-01');
    for (let index = 1; index < afterLoan.length; index++) {
      expect(afterLoan[index]!.housing!.accruedInterest).toBeGreaterThan(afterLoan[index - 1]!.housing!.accruedInterest);
    }
  });

  it('reports the refund due on a sale in the last month in the summary', () => {
    const last = owning.at(-1)!.housing!;
    expect(result.summary.atEnd.housingRefundable).toBe(last.refundable);
    expect(last.accruedInterest).toBeGreaterThan(0);
  });

  it('stops money withdrawn earning interest from the month it leaves', () => {
    const purchase = at('2028-01');
    const earning = purchase.openingBalances.ordinary - purchase.housing!.withdrawnFromOrdinaryAccount;
    const exact = (Math.max(0, earning) * CURRENT_RULE_SET.interest.ordinary) / 12;
    expect(Math.abs(purchase.interest.baseAccrued.ordinary - exact)).toBeLessThanOrEqual(1);
  });

  it('draws down the OA compared with not buying', () => {
    const renter = project(input({ startMonth: '2026-01', startAge: 30, endAge: 65 }));
    expect(result.summary.atEnd.balances.ordinary).toBeLessThan(renter.summary.atEnd.balances.ordinary);
  });
});

describe('summary', () => {
  it('reports the closing position and the figures at 55', () => {
    const result = project(input({ startAge: 30, endAge: 65 }));
    expect(result.summary.atEnd.balances).toEqual(result.months.at(-1)?.closingBalances);
  });

  it('reports the retirement sums fixed for the year the member turns 55', () => {
    // 30 in January 2026 turns 55 in January 2051, past the last published
    // cohort, so the sums are carried forward by the stated assumption.
    const result = project(input({ startMonth: '2026-01', startAge: 30, endAge: 65 }));
    const cohort = retirementSumsForCohort(CURRENT_RULE_SET, 2051);
    expect(result.summary.atAge55?.basicRetirementSum).toBe(cohort.basicRetirementSum * 100);
    expect(result.summary.atAge55?.fullRetirementSum).toBe(cohort.fullRetirementSum * 100);
    expect(result.summary.atAge55?.retirementSumsBasis).toBe('assumed');
    expect(result.summary.atAge55!.fullRetirementSum).toBeGreaterThan(
      CURRENT_RULE_SET.thresholds.fullRetirementSum * 100,
    );
  });

  it('uses the published sums for a cohort CPF Board has announced', () => {
    // 54 in January 2026 turns 55 in January 2027: FRS $228,200, as published.
    const result = project(input({ startMonth: '2026-01', startAge: 54, endAge: 56 }));
    expect(result.summary.atAge55?.fullRetirementSum).toBe(22_820_000);
    expect(result.summary.atAge55?.basicRetirementSum).toBe(11_410_000);
    expect(result.summary.atAge55?.retirementSumsBasis).toBe('published');
  });

  it('caps the Retirement Account at the cohort FRS, not the 2026 one', () => {
    // Turning 55 in 2024, FRS $205,800. With $205,000 in RA there is $800 of
    // room, which the first month's Retirement share fills and no more.
    const result = project(
      input({
        startMonth: '2026-01',
        startAge: 57,
        endAge: 58,
        openingBalances: { ordinary: 0, special: 0, medisave: 0, retirement: 20_500_000 },
      }),
    );
    const contributed = result.months.reduce((sum, month) => sum + month.contribution.allocation.retirement, 0);
    expect(contributed).toBe(80_000);
  });

  it('omits the figures at 55 when the projection never reaches it', () => {
    const result = project(input({ startAge: 30, endAge: 40 }));
    expect(result.summary.atAge55).toBeUndefined();
  });
});

describe('engine purity', () => {
  it('never mentions Date or performance outside its comments', () => {
    // The strongest guarantee available: the engine cannot read a clock it
    // never names. Calendar arithmetic is integer maths on YYYY-MM stamps.
    // Comments are stripped first, since they discuss the very thing being
    // banned. The stripping is naive, which is safe here because no engine
    // source holds a string containing a comment marker.
    const stripComments = (source: string) =>
      source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
    const root = join(process.cwd(), 'src', 'engine');
    const offenders: string[] = [];
    const walk = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          walk(path);
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
          const source = stripComments(readFileSync(path, 'utf8'));
          if (/\bDate\b|\bperformance\b/.test(source)) offenders.push(path);
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });

  it('holds no rate of its own anywhere', () => {
    // Rates, escalation assumptions and ratios are parameters in the rule set.
    // A fractional literal in the calculation path is one that would silently
    // survive a change to the rules, so none is allowed outside comments.
    const stripComments = (source: string) =>
      source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
    const root = join(process.cwd(), 'src', 'engine');
    const offenders: string[] = [];
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) continue;
      const source = stripComments(readFileSync(join(root, entry.name), 'utf8'));
      if (/\b0?\.\d+\b/.test(source)) offenders.push(entry.name);
    }
    expect(offenders).toEqual([]);
  });
});

describe('calendar', () => {
  it('steps forwards and backwards across year boundaries', () => {
    expect(addMonths('2026-01', 0)).toBe('2026-01');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-03', -14)).toBe('2025-01');
    expect(addMonths('2026-01', 421)).toBe('2061-02');
  });

  it('measures whole months between stamps', () => {
    expect(monthsBetween('2026-01', '2026-01')).toBe(0);
    expect(monthsBetween('2026-01', '2027-01')).toBe(12);
    expect(monthsBetween('2027-01', '2026-11')).toBe(-2);
  });

  it('rejects a malformed stamp', () => {
    expect(() => parseMonth('2026-13')).toThrow(RangeError);
    expect(() => parseMonth('2026-1')).toThrow(RangeError);
    expect(() => parseMonth('not-a-month')).toThrow(RangeError);
  });
});
