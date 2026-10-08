import { describe, expect, it } from 'vitest';
import { CURRENT_RULE_SET } from '@/rules';
import { closeSpecialAccount, formRetirementAccount, withdrawableFrom55 } from './transition';
import type { AccountAmounts } from './types';

/** A round FRS keeps the arithmetic readable: $200,000. */
const FRS = 20_000_000;
/** What a member short of the FRS may withdraw, and what forming the RA leaves in the OA: $5,000. */
const KEPT = CURRENT_RULE_SET.retirementAccount.withdrawableWithoutFullRetirementSum * 100;

const balances = (given: Partial<AccountAmounts> = {}): AccountAmounts => ({
  ordinary: 0,
  special: 0,
  medisave: 0,
  retirement: 0,
  ...given,
});

const total = (amounts: AccountAmounts) =>
  amounts.ordinary + amounts.special + amounts.medisave + amounts.retirement;

const form = (given: Partial<AccountAmounts>, fullRetirementSum = FRS) =>
  formRetirementAccount({ rules: CURRENT_RULE_SET, balances: balances(given), fullRetirementSum });

describe('forming the Retirement Account', () => {
  it('fills it from the Special Account alone when that is enough, and leaves the OA untouched', () => {
    const result = form({ special: 25_000_000, ordinary: 3_000_000, medisave: 4_000_000 });
    expect(result.transferredFromSpecial).toBe(FRS);
    expect(result.transferredFromOrdinary).toBe(0);
    // The $50,000 the RA had no room for goes to the OA as the SA closes.
    expect(result.specialAccountRemainderToOrdinary).toBe(5_000_000);
    expect(result.balances).toEqual(
      balances({ ordinary: 8_000_000, medisave: 4_000_000, retirement: FRS }),
    );
    expect(result.fullRetirementSumSetAside).toBe(true);
  });

  it('takes the Special Account first, then tops up from the Ordinary Account', () => {
    const result = form({ special: 15_000_000, ordinary: 10_000_000 });
    expect(result.transferredFromSpecial).toBe(15_000_000);
    expect(result.transferredFromOrdinary).toBe(5_000_000);
    expect(result.balances).toEqual(balances({ ordinary: 5_000_000, retirement: FRS }));
    expect(result.fullRetirementSumSetAside).toBe(true);
  });

  it('keeps $5,000 in the OA when the FRS cannot be reached', () => {
    const result = form({ special: 10_000_000, ordinary: 3_000_000 });
    expect(result.transferredFromOrdinary).toBe(3_000_000 - KEPT);
    expect(result.balances).toEqual(balances({ ordinary: KEPT, retirement: 12_500_000 }));
    expect(result.fullRetirementSumSetAside).toBe(false);
    expect(result.withdrawable).toBe(KEPT);
  });

  it('matches CPF Board’s example: short of the FRS with $100,000, and $5,000 left in the OA', () => {
    // "How much CPF savings can I withdraw from age 55 to 64?": turning 55 in
    // 2026 with $100,000 in the RA and $5,000 in the OA, short of the $220,400
    // FRS, the member can withdraw $5,000.
    const result = form({ special: 10_000_000, ordinary: 500_000 }, 22_040_000);
    expect(result.balances.retirement).toBe(10_000_000);
    expect(result.balances.ordinary).toBe(500_000);
    expect(result.withdrawable).toBe(500_000);
  });

  it('takes nothing from an OA holding $5,000 or less when short of the FRS', () => {
    const result = form({ special: 1_000_000, ordinary: 300_000 });
    expect(result.transferredFromOrdinary).toBe(0);
    expect(result.withdrawable).toBe(300_000);
  });

  it('counts savings already in the RA towards the FRS', () => {
    const result = form({ retirement: 18_000_000, special: 5_000_000, ordinary: 1_000_000 });
    expect(result.transferredFromSpecial).toBe(2_000_000);
    expect(result.specialAccountRemainderToOrdinary).toBe(3_000_000);
    expect(result.balances).toEqual(balances({ ordinary: 4_000_000, retirement: FRS }));
  });

  it('always closes the Special Account and never touches MediSave', () => {
    for (const special of [0, 1, 10_000_000, FRS, 40_000_000]) {
      for (const ordinary of [0, KEPT, 30_000_000]) {
        const before = balances({ special, ordinary, medisave: 6_000_000, retirement: 100 });
        const result = formRetirementAccount({ rules: CURRENT_RULE_SET, balances: before, fullRetirementSum: FRS });
        expect(result.balances.special).toBe(0);
        expect(result.balances.medisave).toBe(6_000_000);
        // Conservation: the transition only moves money between accounts.
        expect(total(result.balances)).toBe(total(before));
        expect(result.balances.retirement).toBeLessThanOrEqual(Math.max(FRS, before.retirement));
      }
    }
  });

  it('reports what may be withdrawn and leaves it in the OA', () => {
    const result = form({ special: 25_000_000, ordinary: 3_000_000 });
    expect(result.withdrawable).toBe(8_000_000);
    expect(result.balances.ordinary).toBe(8_000_000);
  });
});

describe('the closed Special Account', () => {
  it('moves anything credited to it into the RA while the RA is under the FRS', () => {
    const result = closeSpecialAccount(CURRENT_RULE_SET, balances({ special: 50_000, retirement: 1_000_000 }), FRS);
    expect(result).toEqual({
      balances: balances({ retirement: 1_050_000 }),
      toRetirement: 50_000,
      toOrdinary: 0,
    });
  });

  it('moves it to the OA once the RA holds the FRS', () => {
    const result = closeSpecialAccount(CURRENT_RULE_SET, balances({ special: 50_000, retirement: FRS }), FRS);
    expect(result.balances).toEqual(balances({ ordinary: 50_000, retirement: FRS }));
  });
});

describe('withdrawable from 55', () => {
  it('is the whole OA with the FRS set aside', () => {
    expect(withdrawableFrom55(CURRENT_RULE_SET, 12_345_678, true)).toBe(12_345_678);
  });

  it('is at most $5,000 without it', () => {
    expect(withdrawableFrom55(CURRENT_RULE_SET, 12_345_678, false)).toBe(KEPT);
    expect(withdrawableFrom55(CURRENT_RULE_SET, 100, false)).toBe(100);
  });
});
