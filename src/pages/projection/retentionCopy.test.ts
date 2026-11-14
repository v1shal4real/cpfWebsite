import { describe, expect, it } from 'vitest';
import { CURRENT_RULE_SET } from '@/rules';
import { DEFAULT_FORM, toDraft } from './form';
import { retentionHint, retentionNote, shareInterestHint } from './retentionCopy';

/** Words that would turn a statement of the rules into advice or a verdict. */
const FRAMING =
  /\b(should|recommend|advis|best|better|worse|good|bad|smart|wise|optimal|ideal|must keep|we suggest|you need to|don't|avoid|lose|losing|gain|benefit|penalt|waste)/i;

const allCopy = (plan: 'hdb-loan' | 'bank-loan') => {
  const note = retentionNote(CURRENT_RULE_SET, plan);
  return [retentionHint(CURRENT_RULE_SET, plan), note.title, ...note.paragraphs, shareInterestHint()];
};

describe('retention copy', () => {
  it('explains that the HDB cap and the extra-interest sub-cap are the same figure', () => {
    expect(CURRENT_RULE_SET.housing.hdbLoanRetentionCap).toBe(
      CURRENT_RULE_SET.interest.ordinaryAccountExtraInterestCap,
    );
    const note = retentionNote(CURRENT_RULE_SET, 'hdb-loan');
    expect(note.title).toBe('Why $20,000?');
    expect(note.paragraphs.join(' ')).toContain('The two limits are the same figure, $20,000, by design.');
    expect(note.paragraphs.join(' ')).toContain('1% a year more');
  });

  it('reads its figures from the rule set', () => {
    const rules = {
      ...CURRENT_RULE_SET,
      housing: { ...CURRENT_RULE_SET.housing, hdbLoanRetentionCap: 25_000 },
    };
    const note = retentionNote(rules, 'hdb-loan');
    expect(note.title).toBe('Keeping Ordinary Account savings');
    expect(note.paragraphs[0]).toContain('$25,000');
    expect(retentionHint(rules, 'hdb-loan')).toContain('$25,000');
  });

  it('states the bank-loan rule without a cap', () => {
    expect(retentionHint(CURRENT_RULE_SET, 'bank-loan')).toContain('any amount');
  });

  it.each(['hdb-loan', 'bank-loan'] as const)('stays within the framing constraint (%s)', (plan) => {
    for (const line of allCopy(plan)) expect(line, line).not.toMatch(FRAMING);
  });
});

describe('retention input', () => {
  it('reaches the engine draft in cents, and empty means none', () => {
    expect(
      toDraft({ ...DEFAULT_FORM, retainedOrdinaryAccount: 20_000 }, '2026-10').ordinaryAccountRetention,
    ).toBe(2_000_000);
    expect(toDraft(DEFAULT_FORM, '2026-10').ordinaryAccountRetention).toBeUndefined();
  });
});
