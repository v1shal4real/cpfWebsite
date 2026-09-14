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

export interface ContributionRates extends Sourced {
  bands: ContributionBand[];
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

export interface InterestRules extends Sourced {
  /** Base floors, as fractions per annum. */
  ordinary: number;
  special: number;
  medisave: number;
  retirement: number;
  /** Tiers below age 55, applied in order from the first dollar. */
  extraTiersBelow55: ExtraInterestTier[];
  /** Tiers at age 55 and above. */
  extraTiersFrom55: ExtraInterestTier[];
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
  housing: HousingRules;
}
