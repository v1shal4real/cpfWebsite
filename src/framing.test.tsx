import { readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppShell } from '@/components/layout/AppShell';
import { ProjectionPage } from '@/pages/ProjectionPage';
import { DEFAULT_FORM, type FormValues } from '@/pages/projection/form';
import { CURRENT_RULE_SET } from '@/rules';
import { ThemeProvider } from '@/theme/ThemeProvider';

/*
 * The framing constraint, checked on everything a visitor can see: every
 * state of the projection view (default, each housing plan, inputs that
 * cannot be projected, a link that could not be fully used) and the share
 * preview. Code comments are not scanned; rendered text and page metadata are.
 */

/** Advice, a verdict on the figures, or a suggested action. */
const ADVICE =
  /\b(should|ought|recommend\w*|we suggest|suggested|advis(e|able)|best|better|worse|good|bad|smart|wise|optimal|ideal|on track|enough|afford\w*|cheap\w*|lose|losing|loss|gain\w*|benefit\w*|penalt\w*|waste\w*|save more|consider|top up|invest(ing|ment)? in)\b/i;
/** Named lenders, insurers or products: no comparison or placement. */
const PRODUCTS =
  /\b(DBS|POSB|OCBC|UOB|Maybank|HSBC|Standard Chartered|Citibank|Citi|CIMB|RHB|Bank of China|Syfe|Endowus|StashAway|Income|Great Eastern|Prudential|AIA)\b/;

/** Lines the footer and headline use to say the tool gives no advice; allowed by design. */
const DISCLAIMERS = [
  /not advice/gi,
  /no recommendation/gi,
  /suggests no course of action/gi,
  /not financial advice/gi,
];

const textOf = (html: string) => {
  let text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
  for (const allowed of DISCLAIMERS) text = text.replace(allowed, ' ');
  return text;
};

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

const VIEWS: Record<string, { form: FormValues; notices?: string[]; b?: FormValues }> = {
  'two scenarios side by side': { form: DEFAULT_FORM, b: HDB },
  'default projection': { form: DEFAULT_FORM },
  'HDB loan': { form: HDB },
  'bank loan': {
    form: { ...HDB, housingPlan: 'bank-loan', bankLoanRatePercent: 3, retainedOrdinaryAccount: null },
  },
  'inputs that cannot be projected': { form: { ...DEFAULT_FORM, monthlySalary: null } },
  'housing errors': { form: { ...HDB, downpayment: 50_000 } },
  'link that could not be fully used': {
    form: DEFAULT_FORM,
    notices: ['The housing plan in this link could not be read, so the projection shows no property.'],
  },
};

const render = ({ form, notices = [], b }: { form: FormValues; notices?: string[]; b?: FormValues }) =>
  renderToString(
    <ThemeProvider>
      <AppShell ruleSet={CURRENT_RULE_SET}>
        <ProjectionPage
          startMonth="2026-10"
          initialForm={form}
          initialScenarios={b ? { a: form, b, active: 'b' } : undefined}
          linkNotices={notices}
        />
      </AppShell>
    </ThemeProvider>,
  );

describe.each(Object.entries(VIEWS))('%s', (_, view) => {
  const html = render(view);
  const text = textOf(html);

  it('gives no advice, verdict or suggested course of action', () => {
    expect(text.match(ADVICE)?.[0] ?? null).toBeNull();
  });

  it('names no product or provider', () => {
    expect(text.match(PRODUCTS)?.[0] ?? null).toBeNull();
  });

  it('carries the rules-as-at stamp', () => {
    expect(text).toContain(`Rules as at ${CURRENT_RULE_SET.label}`);
  });

  it('keeps the projection framing on screen', () => {
    expect(html).toMatch(/projection, not advice/i);
  });
});

describe('the checks themselves', () => {
  it('catch advice and product names', () => {
    expect('You should top up your account.').toMatch(ADVICE);
    expect('A smaller flat is better for retirement.').toMatch(ADVICE);
    expect('Compare DBS and OCBC home loans.').toMatch(PRODUCTS);
  });

  it('see the stale-inputs notice, so error copy is scanned too', () => {
    expect(textOf(render(VIEWS['housing errors']!))).toContain('downpayment must be at least $125,000');
  });
});

describe('share preview', () => {
  const head = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const meta = [
    ...head.matchAll(/<meta\s+(?:name|property)="(?:description|og:description)"\s+content="([^"]+)"/g),
  ].map((m) => m[1]!);

  it('describes a projection, not advice, in every description', () => {
    expect(meta.length).toBeGreaterThanOrEqual(2);
    for (const content of meta) {
      expect(content).toMatch(/not financial advice/i);
      expect(textOf(content).match(ADVICE)?.[0] ?? null).toBeNull();
      expect(content).not.toMatch(PRODUCTS);
    }
  });
});
