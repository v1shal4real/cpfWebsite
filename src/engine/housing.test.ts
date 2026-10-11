import { describe, expect, it } from 'vitest';
import { CURRENT_RULE_SET } from '@/rules';
import { housingPayments, ordinaryAccountRetention, payFromOrdinaryAccount } from './housing';
import type { HousingPlan, LoanTerms } from './types';

const HDB_CAP = CURRENT_RULE_SET.housing.hdbLoanRetentionCap * 100;

const hdbLoan: LoanTerms = { kind: 'hdb-concessionary', principal: 40_000_000, tenureYears: 25 };
const bankLoan: LoanTerms = { kind: 'bank', principal: 40_000_000, tenureYears: 25, interestRate: 0.03 };

const plan = (overrides: Partial<HousingPlan> = {}): HousingPlan => ({
  purchaseAge: 32,
  price: 50_000_000,
  downpaymentFromOrdinaryAccount: 5_000_000,
  downpaymentFromCash: 5_000_000,
  loan: hdbLoan,
  instalmentsPaidFrom: 'ordinary-account',
  ...overrides,
});

describe('retention', () => {
  it('keeps back nothing unless the member chooses to', () => {
    expect(ordinaryAccountRetention(CURRENT_RULE_SET, plan())).toBe(0);
  });

  it('lets an HDB-loan buyer retain up to $20,000, and no more', () => {
    expect(ordinaryAccountRetention(CURRENT_RULE_SET, plan({ ordinaryAccountRetention: 1_500_000 }))).toBe(1_500_000);
    expect(ordinaryAccountRetention(CURRENT_RULE_SET, plan({ ordinaryAccountRetention: 5_000_000 }))).toBe(HDB_CAP);
  });

  it('lets a bank-loan buyer retain any amount', () => {
    expect(
      ordinaryAccountRetention(CURRENT_RULE_SET, plan({ loan: bankLoan, ordinaryAccountRetention: 5_000_000 })),
    ).toBe(5_000_000);
  });

  it('reads the HDB cap from the rule set', () => {
    const rules = { ...CURRENT_RULE_SET, housing: { ...CURRENT_RULE_SET.housing, hdbLoanRetentionCap: 10_000 } };
    expect(ordinaryAccountRetention(rules, plan({ ordinaryAccountRetention: 5_000_000 }))).toBe(1_000_000);
  });
});

describe('paying from the Ordinary Account', () => {
  it('pays in full when the OA holds enough above the retained amount', () => {
    expect(payFromOrdinaryAccount(100_000, 1_000_000, 0)).toEqual({ fromOrdinaryAccount: 100_000, shortfallToCash: 0 });
  });

  it('pays what it can and records the rest as a shortfall to cash', () => {
    expect(payFromOrdinaryAccount(100_000, 30_000, 0)).toEqual({ fromOrdinaryAccount: 30_000, shortfallToCash: 70_000 });
  });

  it('never takes the OA below the retained amount', () => {
    expect(payFromOrdinaryAccount(100_000, 2_050_000, 2_000_000)).toEqual({
      fromOrdinaryAccount: 50_000,
      shortfallToCash: 50_000,
    });
    expect(payFromOrdinaryAccount(100_000, 1_500_000, 2_000_000)).toEqual({
      fromOrdinaryAccount: 0,
      shortfallToCash: 100_000,
    });
  });

  it('never takes the OA below zero', () => {
    const { fromOrdinaryAccount } = payFromOrdinaryAccount(100_000, 0, 0);
    expect(fromOrdinaryAccount).toBe(0);
  });
});

describe('housing payments in a month', () => {
  it('pays the downpayment in the purchase month: the OA share from OA, the rest in cash', () => {
    expect(
      housingPayments({
        rules: CURRENT_RULE_SET,
        plan: plan(),
        isPurchaseMonth: true,
        instalmentDue: 0,
        ordinaryAvailable: 8_000_000,
      }),
    ).toEqual({
      withdrawnFromOrdinaryAccount: 5_000_000,
      paidInCash: 5_000_000,
      shortfallToCash: 0,
      ordinaryAccountRetention: 0,
    });
  });

  it('falls back to cash for the part of the OA share the account cannot cover', () => {
    const result = housingPayments({
      rules: CURRENT_RULE_SET,
      plan: plan({ ordinaryAccountRetention: 2_000_000 }),
      isPurchaseMonth: true,
      instalmentDue: 0,
      ordinaryAvailable: 4_000_000,
    });
    // $40,000 available, $20,000 retained: $20,000 of the $50,000 OA share is paid from OA.
    expect(result).toEqual({
      withdrawnFromOrdinaryAccount: 2_000_000,
      paidInCash: 5_000_000 + 3_000_000,
      shortfallToCash: 3_000_000,
      ordinaryAccountRetention: 2_000_000,
    });
  });

  it('pays the instalment from the OA when the member chose to', () => {
    const result = housingPayments({
      rules: CURRENT_RULE_SET,
      plan: plan(),
      isPurchaseMonth: false,
      instalmentDue: 181_468,
      ordinaryAvailable: 1_000_000,
    });
    expect(result).toMatchObject({ withdrawnFromOrdinaryAccount: 181_468, paidInCash: 0, shortfallToCash: 0 });
  });

  it('pays the instalment in cash when the member chose to, leaving the OA alone', () => {
    const result = housingPayments({
      rules: CURRENT_RULE_SET,
      plan: plan({ instalmentsPaidFrom: 'cash' }),
      isPurchaseMonth: false,
      instalmentDue: 181_468,
      ordinaryAvailable: 1_000_000,
    });
    expect(result).toMatchObject({ withdrawnFromOrdinaryAccount: 0, paidInCash: 181_468, shortfallToCash: 0 });
  });

  it('asks nothing of anyone in a month with nothing due', () => {
    const result = housingPayments({
      rules: CURRENT_RULE_SET,
      plan: plan(),
      isPurchaseMonth: false,
      instalmentDue: 0,
      ordinaryAvailable: 1_000_000,
    });
    expect(result).toMatchObject({ withdrawnFromOrdinaryAccount: 0, paidInCash: 0, shortfallToCash: 0 });
  });
});
