import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { projectDraft } from '@/engine/project';
import { formatMoney } from '@/lib/format';
import { CpfLifeCard } from './CpfLifeCard';
import { DEFAULT_FORM, toDraft } from './form';

const outcome = projectDraft(toDraft(DEFAULT_FORM, '2026-10'));
if (!outcome.ok) throw new Error('should project');
const { result } = outcome;
const text = renderToString(<CpfLifeCard result={result} />)
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#x27;|&#39;/g, "'")
  .replace(/\s+/g, ' ');

describe('CpfLifeCard', () => {
  it('labels every payout as an estimate', () => {
    expect(text).toContain('CPF LIFE monthly payouts from 65: estimates');
    expect(text).toContain('Estimates, not quotes');
    // Standard from 65, Standard from 70, and Escalating from 65.
    expect(text.match(/about \$[\d,]+ a month/g)?.length).toBe(3);
  });

  it('shows the Standard and Escalating figures from the summary', () => {
    const e = result.summary.cpfLife!;
    expect(text).toContain(`about ${formatMoney(e.standardFrom65 / 100)} a month`);
    expect(text).toContain(`about ${formatMoney(e.escalatingFrom65 / 100)} a month`);
    expect(text).toContain(formatMoney(e.premiumAt65 / 100));
  });

  it('says plainly that the Basic Plan is not estimated, and why', () => {
    expect(text).toContain('Basic Plan Not estimated');
    expect(text).toContain('publishes no figures for it that scale to a balance');
  });

  it('presents no plan as the better choice', () => {
    expect(text).not.toMatch(/\b(better|best|recommend\w*|should|worse|ideal)\b/i);
  });

  it('renders nothing when the projection does not reach 65', () => {
    const { cpfLife: _omit, ...summary } = result.summary;
    expect(renderToString(<CpfLifeCard result={{ ...result, summary }} />)).toBe('');
  });
});
