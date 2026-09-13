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

/** A group of parameters that came from one published page. */
export interface Sourced {
  /** The CPF Board (or MOH) page this group was transcribed from. */
  sourceId: SourceId;
}

/** Wage ceilings and the annual contribution cap. */
export interface WageCeilings extends Sourced {
  /** Ordinary Wages subject to CPF, per month. */
  ordinaryWageCeiling: number;
  /** Ordinary plus additional wages subject to CPF, per calendar year. */
  annualSalaryCeiling: number;
  /** Maximum total mandatory contribution per calendar year. */
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

export interface Thresholds extends Sourced {
  /** Cap on MediSave. Revised annually below 65, then fixed for life at 65. */
  basicHealthcareSum: number;
  basicRetirementSum: number;
  fullRetirementSum: number;
  enhancedRetirementSum: number;
}

export interface HousingRules extends Sourced {
  /** Rate at which CPF used for property accrues notional interest, compounded annually. */
  accruedInterestRate: number;
  /** Ordinary Account balance an HDB-loan buyer may elect to retain. */
  hdbLoanRetentionCap: number;
  /** HDB concessionary loan rate, pegged above the Ordinary Account rate. */
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
   * Whether every figure in this set has been re-checked against its primary
   * source. The interface must say so when this is false.
   */
  verified: boolean;
  wageCeilings: WageCeilings;
  contributionRates: ContributionRates;
  allocation: Allocation;
  interest: InterestRules;
  thresholds: Thresholds;
  housing: HousingRules;
}
