import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RULE_SETS, RULE_SET_2026, RULE_SET_2027, ruleSetsFrom, type RuleSet } from '@/rules';
import { RulesStamp } from './RulesStamp';

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

describe('ruleSetsFrom', () => {
  it('names the set in force on the date and the ones scheduled after it', () => {
    expect(ruleSetsFrom(RULE_SET_2027, '2026-11-01')).toEqual({
      inForce: RULE_SET_2026,
      scheduled: [RULE_SET_2027],
    });
    expect(ruleSetsFrom(RULE_SET_2027, '2027-03-01')).toEqual({ inForce: RULE_SET_2027, scheduled: [] });
  });

  it('never looks past the set a link is pinned to', () => {
    expect(ruleSetsFrom(RULE_SET_2026, '2026-11-01')).toEqual({ inForce: RULE_SET_2026, scheduled: [] });
    expect(ruleSetsFrom(RULE_SET_2026, '2030-01-01')).toEqual({ inForce: RULE_SET_2026, scheduled: [] });
  });

  it('lists several scheduled sets in order', () => {
    const later: RuleSet = {
      ...RULE_SET_2027,
      id: 'test-2028',
      label: '1 January 2028',
      effectiveFrom: '2028-01-01',
    };
    const sets = [...RULE_SETS, later];
    expect(ruleSetsFrom(later, '2026-06-01', sets).scheduled.map((s) => s.id)).toEqual([
      'sg-cpf-2027-01',
      'test-2028',
    ]);
  });
});

describe('RulesStamp', () => {
  it('names the rules in force at the start and the change already scheduled', () => {
    const html = renderToString(<RulesStamp compact ruleSet={RULE_SET_2027} from="2026-11" />);
    expect(text(html)).toBe('Rules as at 1 January 2026, with changes from 1 January 2027');
    expect(html).toContain('dateTime="2026-01-01"');
    expect(html).toContain('dateTime="2027-01-01"');
  });

  it('names one set once the change has taken effect, or for a link pinned before it', () => {
    expect(text(renderToString(<RulesStamp compact ruleSet={RULE_SET_2027} from="2027-02" />))).toBe(
      'Rules as at 1 January 2027',
    );
    expect(text(renderToString(<RulesStamp ruleSet={RULE_SET_2026} from="2026-11" />))).toBe(
      'CPF rules as at 1 January 2026',
    );
  });

  it('flags unverified rules when any set it names is unverified', () => {
    const unverified = { ...RULE_SET_2027, verified: false };
    const sets = [RULE_SET_2026, unverified];
    expect(ruleSetsFrom(unverified, '2026-11-01', sets).scheduled[0]?.verified).toBe(false);
  });
});
