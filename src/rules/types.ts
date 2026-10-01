/**
 * Rule-set types.
 *
 * A projection spanning forty years cannot hardcode one set of rules, so every
 * parameter the engine reads is dated data resolved by effective date. The
 * engine is handed a `RuleSet` and may not reach outside it — no magic numbers
 * in the calculation path, and no reading of the current date inside a
 * calculation. That is a structural property, not a convention: if the engine
 * only ever receives a `RuleSet`, it cannot accidentally use today's figures
 * for a step in 2041.
 */

import type { SourceId } from './sources';

/**
 * A group of parameters and the page it was read from.
 *
 * `sourceId` is the page for the group as a whole. CPF Board does not always
 * publish a group on one page, so a field stated somewhere else names its own
 * page in `fieldSources`. Resolve a single figure's source with `sourceFor`
 * rather than reading `sourceId` directly, or a figure from another page will
 * be attributed to the wrong one.
 */
export interface Sourced<Field extends string = never> {
  sourceId: SourceId;
  fieldSources?: Partial<Record<Field, SourceId>>;
}

/** Wage ceilings and the annual contribution cap. */
export interface WageCeilings extends Sourced<'annualLimit'> {
  /** Ordinary Wages subject to CPF, per month. */
  ordinaryWageCeiling: number;
  /** Ordinary plus additional wages subject to CPF, per calendar year. */
  annualSalaryCeiling: number;
  /** Maximum total mandatory and voluntary contributions per calendar year. */
  annualLimit: number;
}

/** Employee and employer contribution rates for one age band. */
export interface ContributionBand {
  /** Inclusive upper bound of the band in years. `null` means no upper bound. */
  throughAge: number | null;
  /** Employee share, as a fraction of wages. */
  employee: number;
  /** Employer share, as a fraction of wages. */
  employer: number;
}

export interface ContributionRates extends Sourced<'fullRatesFromMonthlyWage'> {
  bands: ContributionBand[];
  /**
   * Monthly total wages above which the rates in `bands` apply in full.
   *
   * At or below this figure CPF Board publishes graduated rates instead: no
   * contribution at all on $50 or less, employer-only below $500, and a
   * tapering employee share up to this threshold. Those brackets are not
   * encoded here, so the engine refuses a wage at or below it rather than
   * applying the full rates to a wage they do not cover.
   */
  fullRatesFromMonthlyWage: number;
}

/**
 * Allocation of the total contribution across accounts, by age band.
 *
 * The published ordering matters and the engine must reproduce it: MediSave is
 * computed first, then Special or Retirement, and the remainder falls to the
 * Ordinary Account. Computing OA directly from its own ratio would drift by a
 * cent or two against CPF Board's own worked examples.
 */
export interface AllocationBand {
  throughAge: number | null;
  ordinary: number;
  /** Special Account below 55; Retirement Account at 55 and above. */
  specialOrRetirement: number;
  medisave: number;
}

export interface Allocation extends Sourced {
  bands: AllocationBand[];
}

/** One step of the extra-interest tier structure. */
export interface ExtraInterestTier {
  /** Size of the tier in dollars of combined balance. */
  amount: number;
  /** Additional rate applied to that tier, as a fraction. */
  rate: number;
}

/** The accounts the extra-interest tiers count, by the names CPF Board uses. */
export type ExtraInterestAccount = 'retirement' | 'ordinary' | 'special' | 'medisave';

export interface InterestRules extends Sourced<'extraInterestCountingOrder'> {
  /** Base floors, as fractions per annum. */
  ordinary: number;
  special: number;
  medisave: number;
  retirement: number;
  /** Tiers below age 55, applied in order from the first dollar. */
  extraTiersBelow55: ExtraInterestTier[];
  /** Tiers at age 55 and above. */
  extraTiersFrom55: ExtraInterestTier[];
  /**
   * The order accounts are counted towards the combined balance that fills the
   * tiers, first to last. It decides which account's balance earns the higher
   * tier from 55, and which accounts miss out when the tiers run out, so it is
   * a rule rather than an implementation detail.
   */
  extraInterestCountingOrder: readonly ExtraInterestAccount[];
  /** How much of the extra-interest tier may be drawn from the Ordinary Account. */
  ordinaryAccountExtraInterestCap: number;
  /**
   * Extra interest earned on Ordinary Account savings is credited to the
   * Special Account, or to the Retirement Account from age 55 — not back to
   * the Ordinary Account. Recorded here so the routing is data, not folklore.
   */
  extraInterestOnOrdinaryCreditedTo: 'special-or-retirement';
}

export interface Thresholds
  extends Sourced<'basicHealthcareSum' | 'basicRetirementSum' | 'enhancedRetirementSum'> {
  /** Cap on MediSave. Revised annually below 65, then fixed for life at 65. */
  basicHealthcareSum: number;
  /** Fixed for life by the year the member turns 55. */
  basicRetirementSum: number;
  /** Twice the BRS. Fixed for life by the year the member turns 55. */
  fullRetirementSum: number;
  /**
   * Twice the current year's FRS. Unlike the BRS and FRS it is not fixed per
   * cohort: it applies to every member aged 55 and above in that year.
   */
  enhancedRetirementSum: number;
}

/**
 * A figure CPF Board publishes year by year, carried past its last published
 * year by a stated assumption.
 *
 * Every year that has a published figure uses it. After the last one, each
 * year's figure is the previous year's raised by `assumedAnnualRise` and
 * rounded to the nearest `roundTo` dollars, compounding year on year. Rounding
 * each year rather than once is how CPF Board's own figures step: the retirement
 * sums from 2023 to 2027 are each the previous year's raised 3.5% and rounded
 * to the nearest $100.
 */
export interface EscalatingSeries {
  /** Published figures in dollars, by calendar year, for consecutive years. */
  published: Readonly<Record<number, number>>;
  /** Annual rise assumed after the last published year, as a fraction. */
  assumedAnnualRise: number;
  /** Each escalated year is rounded to the nearest multiple of this, in dollars. */
  roundTo: number;
  /**
   * Why this rate, in the words the assumptions panel shows. It must read as
   * an assumption for illustration, never as a forecast of what CPF Board or
   * the Ministry of Health will decide.
   */
  basis: string;
}

/**
 * How the cohort sums are carried into the years a projection reaches.
 *
 * A 30-year-old turns 55 a quarter of a century after the figures in
 * `thresholds` were published, and the sum fixed for them then will not be
 * today's. These series hold every figure CPF Board has published, and the
 * assumption used beyond them.
 */
export interface Escalation extends Sourced<'basicHealthcareSum'> {
  /**
   * Basic Retirement Sum by the year a cohort turns 55. The Full and Enhanced
   * Retirement Sums follow from it by the ratios in `thresholds`: CPF Board
   * escalates the BRS and sets the FRS at twice it.
   */
  basicRetirementSum: EscalatingSeries;
  /**
   * Basic Healthcare Sum in force in each year. It is also the sum fixed for
   * the cohort turning 65 that year, which is how CPF Board publishes it.
   */
  basicHealthcareSum: EscalatingSeries;
}

export interface HousingRules extends Sourced<'hdbLoanRetentionCap' | 'concessionaryLoanRate'> {
  /**
   * Rate at which CPF used for property accrues interest, compounded annually.
   * CPF Board defines it as what the savings would have earned had they stayed
   * in the account, so it tracks the prevailing Ordinary Account rate. It is
   * recorded separately so a rule set can say so explicitly, and a test holds
   * the two equal.
   */
  accruedInterestRate: number;
  /** Ordinary Account balance an HDB-loan buyer may elect to retain. */
  hdbLoanRetentionCap: number;
  /** HDB concessionary loan rate, pegged 0.1 points above the Ordinary Account rate. */
  concessionaryLoanRate: number;
}

export interface RuleSet {
  /** Stable identifier, e.g. `sg-cpf-2026-01`. */
  id: string;
  /** Human label for the rules-as-at stamp, e.g. `1 January 2026`. */
  label: string;
  /** ISO date from which this set applies. */
  effectiveFrom: string;
  /** ISO date after which it no longer applies, or `null` if it is the latest. */
  effectiveTo: string | null;
  /**
   * Whether every figure present in this set has been checked against the page
   * its source names. The interface says so when this is false.
   *
   * This is a statement about correctness, not completeness. A set can be
   * verified and still be missing figures — those gaps are marked TODO in the
   * set itself, and the engine must refuse to run into them.
   */
  verified: boolean;
  wageCeilings: WageCeilings;
  contributionRates: ContributionRates;
  allocation: Allocation;
  interest: InterestRules;
  thresholds: Thresholds;
  escalation: Escalation;
  housing: HousingRules;
}
