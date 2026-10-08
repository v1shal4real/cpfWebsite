import { describe, expect, it } from 'vitest';
import { CURRENT_RULE_SET } from '@/rules';
import { capMedisave, type MedisaveCapRequest } from './medisave';
import type { AccountAmounts } from './types';

const BHS = CURRENT_RULE_SET.thresholds.basicHealthcareSum * 100;
const FRS = CURRENT_RULE_SET.thresholds.fullRetirementSum * 100;

const balances = (given: Partial<AccountAmounts> = {}): AccountAmounts => ({
  ordinary: 0,
  special: 0,
  medisave: 0,
  retirement: 0,
  ...given,
});

const total = (amounts: AccountAmounts) =>
  amounts.ordinary + amounts.special + amounts.medisave + amounts.retirement;

const request = (overrides: Partial<MedisaveCapRequest> = {}): MedisaveCapRequest => ({
  rules: CURRENT_RULE_SET,
  ageInMonths: 40 * 12,
  balances: balances(),
  basicHealthcareSum: BHS,
  fullRetirementSum: FRS,
  ...overrides,
});

describe('below the Basic Healthcare Sum', () => {
  it('leaves every balance alone and records the cap that applied', () => {
    const held = balances({ ordinary: 100_000, special: 200_000, medisave: BHS - 1 });
    const result = capMedisave(request({ balances: held }));
    expect(result.balances).toEqual(held);
    expect(result.overflow).toEqual({ basicHealthcareSum: BHS, amount: 0, to: balances() });
  });

  it('moves nothing when MediSave lands exactly on the cap', () => {
    const result = capMedisave(request({ balances: balances({ medisave: BHS }) }));
    expect(result.overflow.amount).toBe(0);
    expect(result.balances.medisave).toBe(BHS);
  });
});

describe('below 55', () => {
  it('moves the excess to the Special Account while it is under the FRS', () => {
    const result = capMedisave(request({ balances: balances({ special: 1_000_000, medisave: BHS + 50_000 }) }));
    expect(result.overflow.to).toEqual(balances({ special: 50_000 }));
    expect(result.balances).toEqual(balances({ special: 1_050_000, medisave: BHS }));
  });

  it('fills the Special Account to the FRS and sends the rest to the Ordinary Account', () => {
    const result = capMedisave(
      request({ balances: balances({ special: FRS - 20_000, medisave: BHS + 50_000 }) }),
    );
    expect(result.overflow.to).toEqual(balances({ special: 20_000, ordinary: 30_000 }));
    expect(result.balances.special).toBe(FRS);
  });

  it('sends it all to the Ordinary Account once the Special Account holds the FRS', () => {
    const result = capMedisave(request({ balances: balances({ special: FRS + 1, medisave: BHS + 50_000 }) }));
    expect(result.overflow.to).toEqual(balances({ ordinary: 50_000 }));
  });

  it('still uses the Special Account in the 55th birthday month', () => {
    // The from-55 rules start the month after, as every age band does.
    const result = capMedisave(request({ ageInMonths: 55 * 12, balances: balances({ medisave: BHS + 100 }) }));
    expect(result.overflow.to).toEqual(balances({ special: 100 }));
  });
});

describe('from 55', () => {
  const ageInMonths = 55 * 12 + 1;

  it('moves the excess to the Retirement Account while it is under the FRS', () => {
    const result = capMedisave(
      request({ ageInMonths, balances: balances({ retirement: 1_000_000, medisave: BHS + 50_000 }) }),
    );
    expect(result.overflow.to).toEqual(balances({ retirement: 50_000 }));
    expect(result.balances.special).toBe(0);
  });

  it('fills the Retirement Account to the FRS and sends the rest to the Ordinary Account', () => {
    const result = capMedisave(
      request({ ageInMonths, balances: balances({ retirement: FRS - 20_000, medisave: BHS + 50_000 }) }),
    );
    expect(result.overflow.to).toEqual(balances({ retirement: 20_000, ordinary: 30_000 }));
    expect(result.balances.retirement).toBe(FRS);
  });

  it('ignores any Special Account balance, which is not where the overflow goes from 55', () => {
    const result = capMedisave(
      request({ ageInMonths, balances: balances({ special: 5_000_000, medisave: BHS + 50_000 }) }),
    );
    expect(result.overflow.to).toEqual(balances({ retirement: 50_000 }));
  });

  it('sends it all to the Ordinary Account once the Retirement Account holds the FRS', () => {
    const result = capMedisave(
      request({ ageInMonths, balances: balances({ retirement: FRS, medisave: BHS + 50_000 }) }),
    );
    expect(result.overflow.to).toEqual(balances({ ordinary: 50_000 }));
  });
});

describe('conservation', () => {
  it('moves money between accounts without creating or losing a cent', () => {
    for (const ageInMonths of [30 * 12, 55 * 12, 55 * 12 + 1, 64 * 12]) {
      for (const room of [0, 1, 25_000, 10_000_000]) {
        const held = balances({
          ordinary: 123_456,
          special: FRS - room,
          medisave: BHS + 77_777,
          retirement: FRS - room,
        });
        const result = capMedisave(request({ ageInMonths, balances: held }));
        expect(total(result.balances)).toBe(total(held));
        expect(total(result.overflow.to)).toBe(result.overflow.amount);
        expect(result.overflow.to.medisave).toBe(0);
        expect(result.balances.medisave).toBe(BHS);
      }
    }
  });
});
