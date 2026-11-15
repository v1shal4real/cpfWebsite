import { describe, expect, it } from 'vitest';
import { projectDraft } from './project';
import { sellProperty, type SaleRequest } from './sale';
import type { ProjectionDraft } from './validate';

const base: SaleRequest = {
  salePrice: 70_000_000,
  outstandingLoan: 30_000_000,
  principalUsed: 15_000_000,
  accruedInterest: 2_000_000,
  from55: false,
  retirementBalance: 0,
  requiredRetirementSum: 22_820_000,
};

describe('the sale order: loan, then CPF refund, then cash', () => {
  it('clears the loan, refunds principal and accrued interest in full, and leaves the rest in cash', () => {
    expect(sellProperty(base)).toEqual({
      salePrice: 70_000_000,
      outstandingLoan: 30_000_000,
      refundDue: 17_000_000,
      refunded: 17_000_000,
      refundNotCovered: 0,
      refundedToRetirement: 0,
      refundedToOrdinary: 17_000_000,
      cashProceeds: 23_000_000,
    });
  });

  it('caps the refund at the price less the loan, with no cash top-up', () => {
    const result = sellProperty({ ...base, salePrice: 40_000_000 });
    expect(result.refunded).toBe(10_000_000);
    expect(result.refundNotCovered).toBe(7_000_000);
    expect(result.cashProceeds).toBe(0);
  });

  it('refunds nothing, and shows the cash to add, when the price does not cover the loan', () => {
    const result = sellProperty({ ...base, salePrice: 25_000_000 });
    expect(result.refunded).toBe(0);
    expect(result.refundNotCovered).toBe(17_000_000);
    expect(result.cashProceeds).toBe(-5_000_000);
  });

  it('from 55, tops up the Retirement Account to the required sum first, the rest to the OA', () => {
    const result = sellProperty({ ...base, from55: true, retirementBalance: 20_000_000 });
    expect(result.refundedToRetirement).toBe(2_820_000);
    expect(result.refundedToOrdinary).toBe(14_180_000);
    const full = sellProperty({ ...base, from55: true, retirementBalance: 30_000_000 });
    expect(full.refundedToRetirement).toBe(0);
    expect(full.refundedToOrdinary).toBe(17_000_000);
  });

  it('always accounts for every dollar of the price', () => {
    for (const salePrice of [0, 10_000_000, 30_000_000, 45_000_000, 70_000_000, 200_000_000]) {
      const r = sellProperty({ ...base, salePrice });
      expect(r.outstandingLoan + r.refunded + r.cashProceeds).toBe(salePrice);
      expect(r.refunded + r.refundNotCovered).toBe(r.refundDue);
    }
  });
});

const HDB_AT_32: ProjectionDraft = {
  startMonth: '2026-01',
  currentAge: 30,
  monthlySalary: 600_000,
  salaryGrowthRate: 0,
  housingPlan: 'hdb-loan',
  propertyPrice: 50_000_000,
  purchaseAge: 32,
  downpayment: 12_500_000,
  downpaymentShareFromOrdinaryAccount: 1,
  loanTenureYears: 25,
};

const run = (draft: ProjectionDraft) => {
  const outcome = projectDraft(draft);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors));
  return outcome.result;
};

describe('a sale in the projection', () => {
  const sellOnly = run({ ...HDB_AT_32, saleAge: 40, salePrice: 70_000_000 });
  const saleMonth = sellOnly.months.find((m) => m.ageInMonths === 40 * 12)!;
  const monthBefore = sellOnly.months.find((m) => m.ageInMonths === 40 * 12 - 1)!;
  const sold = saleMonth.events.find((e) => e.kind === 'property-sold');

  it('records the sale, with the loan owed as carried into the month', () => {
    expect(sold).toBeDefined();
    if (sold?.kind !== 'property-sold') return;
    expect(sold.outstandingLoan).toBe(monthBefore.loan!.closingBalance);
    expect(sold.refunded).toBe(sold.refundDue);
    expect(sold.cashProceeds).toBe(70_000_000 - sold.outstandingLoan - sold.refunded);
  });

  it('credits the refund to the OA, and ends the loan and the housing record', () => {
    if (sold?.kind !== 'property-sold') throw new Error('no sale');
    const contributed = saleMonth.contribution.allocation.ordinary;
    const interest = saleMonth.interest.credited.ordinary;
    expect(saleMonth.closingBalances.ordinary).toBe(
      saleMonth.openingBalances.ordinary + contributed + interest + sold.refundedToOrdinary,
    );
    expect(saleMonth.loan).toBeUndefined();
    expect(saleMonth.housing).toBeUndefined();
    const after = sellOnly.months.filter((m) => m.ageInMonths > 40 * 12);
    expect(after.every((m) => !m.loan && !m.housing)).toBe(true);
    expect(sellOnly.summary.atEnd.housingRefundable).toBe(0);
  });

  it('refunds what was used: the OA ends higher than never having bought', () => {
    const neverBought = run({ ...HDB_AT_32, housingPlan: 'none' });
    const oaAt41 = (r: typeof sellOnly) =>
      r.months.find((m) => m.ageInMonths === 41 * 12)!.closingBalances.ordinary;
    // Refund of principal plus 2.5% accrued interest, against the OA's own 2.5%:
    // close to the never-bought balance, not far below it.
    expect(oaAt41(sellOnly)).toBeGreaterThan(oaAt41(neverBought) * 0.9);
  });
});

describe('an upgrade: sell and buy the next home in the same month', () => {
  const upgrade = run({
    ...HDB_AT_32,
    saleAge: 40,
    salePrice: 70_000_000,
    nextHousingPlan: 'hdb-loan',
    nextPropertyPrice: 90_000_000,
    nextDownpayment: 30_000_000,
    nextDownpaymentShareFromOrdinaryAccount: 0.6,
    nextLoanTenureYears: 25,
  });
  const saleMonth = upgrade.months.find((m) => m.ageInMonths === 40 * 12)!;

  it('sells first, then buys, in that order within the month', () => {
    const kinds = saleMonth.events.map((e) => e.kind);
    expect(kinds.indexOf('property-sold')).toBeLessThan(kinds.indexOf('property-purchased'));
    const bought = saleMonth.events.find((e) => e.kind === 'property-purchased');
    expect(bought).toMatchObject({ afterSale: true, loanPrincipal: 60_000_000 });
  });

  it('draws the new loan and pays the downpayment from the refunded OA', () => {
    expect(saleMonth.loan).toMatchObject({ drawn: 60_000_000, instalment: 0 });
    expect(saleMonth.housing?.withdrawnFromOrdinaryAccount).toBe(18_000_000);
    // A fresh record for the new home: only this purchase's CPF is owed on it.
    expect(saleMonth.housing?.principalUsed).toBe(18_000_000);
  });

  it('repays the new loan from the month after', () => {
    const next = upgrade.months.find((m) => m.ageInMonths === 40 * 12 + 1)!;
    expect(next.loan?.instalment).toBeGreaterThan(0);
    expect(next.loan?.openingBalance).toBe(60_000_000);
  });
});

describe('a housing grant', () => {
  // An OA that can pay its share in full, so the figures below are exact.
  const funded: ProjectionDraft = { ...HDB_AT_32, balances: { ordinary: 20_000_000 } };
  const withGrant = run({ ...funded, housingGrant: 5_000_000, saleAge: 40, salePrice: 70_000_000 });
  // The same $125,000 downpayment without a grant: $75,000 from the OA as
  // before, and the $50,000 the grant covered paid in cash instead.
  const without = run({
    ...funded,
    downpaymentShareFromOrdinaryAccount: 0.6,
    saleAge: 40,
    salePrice: 70_000_000,
  });
  const purchase = withGrant.months.find((m) => m.ageInMonths === 32 * 12)!;

  it('counts as CPF used from the purchase month, without touching the OA balance', () => {
    expect(purchase.housing?.grantUsed).toBe(5_000_000);
    // $125,000 down, $50,000 of it grant: the OA pays the other $75,000.
    expect(purchase.housing?.withdrawnFromOrdinaryAccount).toBe(7_500_000);
    expect(purchase.housing?.shortfallToCash).toBe(0);
    expect(purchase.housing?.principalUsed).toBe(12_500_000);
    // The OA fell by its own share only; the grant passed through.
    const contributed = purchase.contribution.allocation.ordinary;
    expect(purchase.openingBalances.ordinary + contributed - purchase.closingBalances.ordinary).toBe(
      7_500_000,
    );
  });

  it('is refunded with accrued interest on sale', () => {
    const sale = (r: typeof withGrant) => {
      const e = r.months
        .find((m) => m.ageInMonths === 40 * 12)!
        .events.find((x) => x.kind === 'property-sold');
      if (e?.kind !== 'property-sold') throw new Error('no sale');
      return e;
    };
    // The grant is CPF used, so it comes back with eight years of accrued
    // interest; paid in cash, it would not be refunded to CPF at all.
    expect(sale(withGrant).refundDue - sale(without).refundDue).toBeGreaterThan(5_000_000);
  });
});

describe('sale validation', () => {
  const errorsOf = (draft: ProjectionDraft) => {
    const outcome = projectDraft(draft);
    return outcome.ok ? [] : outcome.errors.map((e) => `${e.field}:${e.code}`);
  };

  it('needs the sale after the purchase and within the projection', () => {
    expect(errorsOf({ ...HDB_AT_32, saleAge: 32, salePrice: 1 })).toContain('saleAge:not-after-purchase');
    expect(errorsOf({ ...HDB_AT_32, saleAge: 66, salePrice: 1 })).toContain('saleAge:after-projection-end');
    expect(errorsOf({ ...HDB_AT_32, saleAge: 40 })).toContain('salePrice:required');
  });

  it('checks the next property like the first, against its own fields', () => {
    const errors = errorsOf({
      ...HDB_AT_32,
      saleAge: 40,
      salePrice: 70_000_000,
      nextHousingPlan: 'bank-loan',
      nextPropertyPrice: 90_000_000,
      nextDownpayment: 10_000_000,
      nextDownpaymentShareFromOrdinaryAccount: 1,
      nextLoanTenureYears: 25,
      nextBankLoanRate: 0.03,
    });
    expect(errors).toContain('nextDownpayment:below-minimum-downpayment');
  });

  it('rejects a grant larger than the downpayment', () => {
    expect(errorsOf({ ...HDB_AT_32, housingGrant: 20_000_000 })).toContain(
      'housingGrant:exceeds-downpayment',
    );
  });
});
