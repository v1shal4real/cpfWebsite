// @vitest-environment jsdom
import { render } from '@/test/dom';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { AppShell } from '@/components/layout/AppShell';
import { ProjectionPage } from '@/pages/ProjectionPage';
import { DEFAULT_FORM, type FormValues } from '@/pages/projection/form';
import { CURRENT_RULE_SET } from '@/rules';
import { ThemeProvider } from '@/theme/ThemeProvider';

/*
 * axe on the whole page, in every state a visitor can reach, on every push.
 *
 * jsdom has no layout or paint, so axe cannot compute colours here: contrast
 * is checked in a real browser in both themes (docs/accessibility-audit.md).
 * Everything else axe tests (names, roles, ARIA, landmarks, headings, lists,
 * tables, ids) runs here.
 */

const HDB: FormValues = {
  ...DEFAULT_FORM,
  housingPlan: 'hdb-loan',
  propertyPrice: 500_000,
  purchaseAge: 32,
  downpayment: 125_000,
  ordinaryAccountSharePercent: 75,
  loanTenureYears: 25,
  retainedOrdinaryAccount: 20_000,
};

const STATES: Record<string, { form: FormValues; b?: FormValues; notices?: string[] }> = {
  'default projection': { form: DEFAULT_FORM },
  'HDB loan': { form: HDB },
  'bank loan': {
    form: { ...HDB, housingPlan: 'bank-loan', bankLoanRatePercent: 3, retainedOrdinaryAccount: null },
  },
  'two scenarios': { form: DEFAULT_FORM, b: HDB },
  'voluntary refund': { form: { ...HDB, voluntaryRefundAge: 40, voluntaryRefundAmount: 50_000 } },
  'sale and upgrade': {
    form: {
      ...HDB,
      housingGrant: 30_000,
      selling: true,
      saleAge: 40,
      salePrice: 700_000,
      nextHousingPlan: 'bank-loan',
      nextPropertyPrice: 900_000,
      nextDownpayment: 300_000,
      nextOrdinaryAccountSharePercent: 50,
      nextLoanTenureYears: 25,
      nextBankLoanRatePercent: 3,
    },
  },
  'inputs that cannot be projected': { form: { ...DEFAULT_FORM, monthlySalary: null } },
  'link notice': { form: DEFAULT_FORM, notices: ['The housing plan in this link could not be read.'] },
};

const RULE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

async function violations(container: Element) {
  const result = await axe.run(container, {
    runOnly: { type: 'tag', values: RULE_TAGS },
    rules: { 'color-contrast': { enabled: false } },
  });
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

describe.each(Object.entries(STATES))('%s', (_, state) => {
  it('has no axe violations', async () => {
    const { baseElement } = render(
      <ThemeProvider>
        <AppShell ruleSet={CURRENT_RULE_SET}>
          <ProjectionPage
            startMonth="2026-10"
            initialForm={state.form}
            initialScenarios={state.b ? { a: state.form, b: state.b, active: 'b' } : undefined}
            linkNotices={state.notices}
          />
        </AppShell>
      </ThemeProvider>,
    );
    expect(await violations(baseElement)).toEqual([]);
  });
});

describe('the check itself', () => {
  it('reports a real violation', async () => {
    const { container } = render(
      <main>
        {/* Deliberately inaccessible: the check must catch it. */}
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <img src="x.png" />
        <button type="button" />
      </main>,
    );
    const found = await violations(container);
    expect(found.some((v) => v.startsWith('image-alt'))).toBe(true);
    expect(found.some((v) => v.startsWith('button-name'))).toBe(true);
  });
});
