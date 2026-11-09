import type { ProjectionInput } from '@/engine/types';
import { formatEffectiveDate, formatMoney } from '@/lib/format';
import { escalationAssumptions, sourceFor, type LoanLimits, type RuleSet, type SourceId } from '@/rules';

/**
 * Everything the projection rests on, grouped for the assumptions panel.
 *
 * Built from the rule set itself, field by field, so a parameter added to a
 * rule set without a row here is caught by the completeness test rather than
 * going unshown. Each row names its own source when it has one; otherwise it
 * is covered by its group's.
 */

export interface AssumptionRow {
  label: string;
  value: string;
  /** Only when the figure comes from a different page from its group. */
  sourceId?: SourceId;
}

export interface AssumptionGroup {
  id: string;
  title: string;
  sourceId?: SourceId;
  rows: AssumptionRow[];
}

const pct = (fraction: number, digits = 2) => `${Number((fraction * 100).toFixed(digits))}%`;
const ageBand = (from: number | null, through: number | null) =>
  through === null ? `Above ${from}` : from === null ? `${through} and below` : `Above ${from} to ${through}`;

/** Labels each band with the ages it covers, in CPF Board's own "above X to Y" form. */
function bandLabels<T extends { throughAge: number | null }>(bands: readonly T[]): [string, T][] {
  return bands.map((band, i) => [ageBand(i === 0 ? null : bands[i - 1]!.throughAge, band.throughAge), band]);
}

/** Row source: only set when the field's page differs from the group's. */
function own<G extends { sourceId: SourceId; fieldSources?: object }>(
  group: G,
  field: Exclude<keyof G, 'sourceId' | 'fieldSources'>,
): SourceId | undefined {
  const id = sourceFor(group, field);
  return id === group.sourceId ? undefined : id;
}

function loanRows(name: string, limits: LoanLimits): AssumptionRow[] {
  const rows: AssumptionRow[] = [
    { label: `${name}: maximum loan`, value: `${pct(limits.maximumLoanToValue)} of the price` },
    {
      label: `${name}: minimum cash downpayment`,
      value: limits.minimumCashDownpayment > 0 ? `${pct(limits.minimumCashDownpayment)} of the price` : 'None',
    },
    { label: `${name}: longest tenure`, value: `${limits.maximumTenureYears} years` },
  ];
  if (limits.reduced) {
    const r = limits.reduced;
    rows.push({
      label: `${name}: above ${r.aboveTenureYears} years or past age ${r.pastAge}`,
      value: `${pct(r.maximumLoanToValue)} maximum loan, ${pct(r.minimumCashDownpayment)} minimum cash`,
    });
  }
  return rows;
}

export function ruleSetGroups(rules: RuleSet): AssumptionGroup[] {
  const { wageCeilings: w, contributionRates: c, allocation: a, interest: i, thresholds: t, retirementAccount: ra, housing: h } = rules;
  return [
    {
      id: 'wageCeilings',
      title: 'Wage ceilings',
      sourceId: w.sourceId,
      rows: [
        { label: 'Ordinary Wage ceiling', value: `${formatMoney(w.ordinaryWageCeiling)} a month` },
        { label: 'Annual salary ceiling', value: formatMoney(w.annualSalaryCeiling) },
        { label: 'CPF Annual Limit', value: formatMoney(w.annualLimit), sourceId: own(w, 'annualLimit') },
      ],
    },
    {
      id: 'contributionRates',
      title: 'Contribution rates, of wages',
      sourceId: c.sourceId,
      rows: [
        ...bandLabels(c.bands).map(([label, band]) => ({
          label: `Age ${label.toLowerCase()}`,
          value: `${pct(band.employee)} employee + ${pct(band.employer)} employer`,
        })),
        {
          label: 'Full rates apply from',
          value: `${formatMoney(c.fullRatesFromMonthlyWage)} a month`,
          sourceId: own(c, 'fullRatesFromMonthlyWage'),
        },
      ],
    },
    {
      id: 'allocation',
      title: 'Allocation of contributions',
      sourceId: a.sourceId,
      rows: bandLabels(a.bands).map(([label, band]) => ({
        label: `Age ${label.toLowerCase()}`,
        value: `OA ${pct(band.ordinary)} · SA/RA ${pct(band.specialOrRetirement)} · MA ${pct(band.medisave)}`,
      })),
    },
    {
      id: 'interest',
      title: 'Interest',
      sourceId: i.sourceId,
      rows: [
        { label: 'Ordinary Account', value: `${pct(i.ordinary)} a year` },
        { label: 'Special Account', value: `${pct(i.special)} a year` },
        { label: 'MediSave Account', value: `${pct(i.medisave)} a year` },
        { label: 'Retirement Account', value: `${pct(i.retirement)} a year` },
        {
          label: 'Extra interest below 55',
          value: i.extraTiersBelow55.map((tier) => `${pct(tier.rate)} on the first ${formatMoney(tier.amount)}`).join(', '),
          sourceId: own(i, 'extraInterestCountingOrder'),
        },
        {
          label: 'Extra interest from 55',
          value: i.extraTiersFrom55
            .map((tier, n) => `${pct(tier.rate)} on the ${n === 0 ? 'first' : 'next'} ${formatMoney(tier.amount)}`)
            .join(', '),
          sourceId: own(i, 'extraInterestCountingOrder'),
        },
        {
          label: 'Ordinary Account counted for extra interest',
          value: `Up to ${formatMoney(i.ordinaryAccountExtraInterestCap)}; extra interest on it goes to the SA or RA`,
          sourceId: own(i, 'extraInterestCountingOrder'),
        },
      ],
    },
    {
      id: 'thresholds',
      title: 'Retirement and healthcare sums',
      sourceId: t.sourceId,
      rows: [
        { label: 'Basic Healthcare Sum', value: formatMoney(t.basicHealthcareSum), sourceId: own(t, 'basicHealthcareSum') },
        { label: 'Basic Retirement Sum', value: formatMoney(t.basicRetirementSum), sourceId: own(t, 'basicRetirementSum') },
        { label: 'Full Retirement Sum', value: formatMoney(t.fullRetirementSum) },
        { label: 'Enhanced Retirement Sum', value: formatMoney(t.enhancedRetirementSum), sourceId: own(t, 'enhancedRetirementSum') },
        {
          label: 'MediSave above the BHS',
          value: 'Moves to the SA or RA until it holds the FRS, then to the OA',
          sourceId: own(t, 'medisaveOverflowTo'),
        },
      ],
    },
    {
      id: 'retirementAccount',
      title: 'At age 55',
      sourceId: ra.sourceId,
      rows: [
        { label: 'Retirement Account formed from', value: 'Special Account first, then Ordinary Account, up to the FRS' },
        {
          label: 'Special Account savings above the FRS',
          value: 'Move to the Ordinary Account',
          sourceId: own(ra, 'specialAccountRemainderTo'),
        },
        {
          label: 'Withdrawable without the FRS',
          value: formatMoney(ra.withdrawableWithoutFullRetirementSum),
          sourceId: own(ra, 'withdrawableWithoutFullRetirementSum'),
        },
      ],
    },
    {
      id: 'housing',
      title: 'Housing',
      sourceId: h.sourceId,
      rows: [
        { label: 'Accrued interest on CPF used', value: `${pct(h.accruedInterestRate)} a year, compounded` },
        { label: 'HDB loan rate', value: `${pct(h.concessionaryLoanRate)} a year (OA rate + ${pct(h.concessionaryLoanSpread)})`, sourceId: own(h, 'concessionaryLoanRate') },
        { label: 'OA an HDB-loan buyer may retain', value: `Up to ${formatMoney(h.hdbLoanRetentionCap)}`, sourceId: own(h, 'hdbLoanRetentionCap') },
        ...loanRows('HDB loan', h.hdbLoanLimits).map((row) => ({ ...row, sourceId: own(h, 'hdbLoanLimits') })),
        ...loanRows('Bank loan', h.bankLoanLimits).map((row) => ({ ...row, sourceId: own(h, 'bankLoanLimits') })),
      ],
    },
  ];
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The user's own assumptions and the rule set's escalation assumptions. */
export function assumptionGroup(input: ProjectionInput, rules: RuleSet): AssumptionGroup {
  const { salaryGrowth, housing } = input;
  const rows: AssumptionRow[] = [
    {
      label: 'Salary growth (yours)',
      value:
        salaryGrowth.rate === 0
          ? 'None: salary stays as it is today'
          : `${pct(salaryGrowth.rate, 1)} a year, each ${MONTHS[salaryGrowth.appliedInMonth - 1] ?? 'year'}`,
    },
  ];
  if (housing?.loan.kind === 'bank') {
    rows.push({ label: 'Bank loan rate (yours)', value: `${pct(housing.loan.interestRate, 2)} a year, for the whole tenure` });
  }
  for (const a of escalationAssumptions(rules)) {
    rows.push({
      label: `${a.label} rise from ${a.appliesFrom}`,
      value: `${pct(a.assumedAnnualRise, 1)} a year (assumed). ${a.basis}`,
      sourceId: a.sourceId,
    });
  }
  return { id: 'assumptions', title: 'Assumptions', rows };
}

export function effectiveRange(rules: RuleSet): string {
  const from = formatEffectiveDate(rules.effectiveFrom);
  return rules.effectiveTo ? `${from} to ${formatEffectiveDate(rules.effectiveTo)}` : `From ${from}`;
}
