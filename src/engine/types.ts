/**
 * Engine types.
 *
 * Three shapes make up the engine's contract: what a projection is given
 * (`ProjectionInput`), what it records for each month it steps through
 * (`ProjectionMonth`), and what it hands back (`ProjectionResult`).
 *
 * Two properties are structural rather than conventional, and the types are
 * arranged to keep them that way:
 *
 *   1. The engine is pure. Everything it depends on is in `ProjectionInput`,
 *      including the date the projection starts from, so it never reads the
 *      clock and the same input always gives the same output.
 *   2. Every month says which rules produced it. A projection spanning forty
 *      years crosses rule changes, so `ruleSetId` on each month is what makes
 *      a figure explainable years later, and what a pinned shared link checks
 *      itself against.
 *
 * Money is in cents, everywhere, as whole numbers. CPF's own rules round to
 * the cent and to the dollar at defined points, and a projection that carried
 * fractional cents would drift away from CPF Board's worked examples.
 */

/** A whole number of cents. `123_45` is $123.45. */
export type Cents = number;

/** A rate as a fraction, matching the rule set: `0.025` is 2.5%. */
export type Fraction = number;

/** A calendar month, `YYYY-MM`. Days never matter to the engine: it steps monthly. */
export type MonthStamp = string;

/**
 * The four CPF accounts. The Special Account exists below 55 and the
 * Retirement Account from 55; both are present in the type because a
 * projection spans the transition.
 */
export type AccountName = 'ordinary' | 'special' | 'medisave' | 'retirement';

/** An amount held in each account. */
export type AccountAmounts = Record<AccountName, Cents>;

/* Input -------------------------------------------------------------------- */

export type LoanKind = 'hdb-concessionary' | 'bank';

/**
 * How the member pays for a property.
 *
 * Absent means no property in the projection, which is a supported scenario
 * and the baseline the housing scenarios are compared against.
 */
export interface HousingPlan {
  /** Age at which the property is bought. Never before the member's age at the start. */
  purchaseAge: number;
  price: Cents;
  /** The part of the downpayment taken from the Ordinary Account, decided by the user. */
  downpaymentFromOrdinaryAccount: Cents;
  /** Downpayment paid in cash. Recorded so the two sources add up to the downpayment. */
  downpaymentFromCash: Cents;
  loan: {
    kind: LoanKind;
    principal: Cents;
    tenureYears: number;
    /**
     * Bank loans only. An HDB concessionary loan takes its rate from the rule
     * set, where it is pegged to the Ordinary Account rate, so passing one
     * here would let a caller contradict the published peg.
     */
    interestRate?: Fraction;
  };
  /** Whether monthly instalments are paid from the Ordinary Account or in cash. */
  instalmentsPaidFrom: 'ordinary-account' | 'cash';
  /**
   * Ordinary Account balance the member elects to keep rather than spend on
   * the property. An HDB-loan buyer may retain up to the rule set's
   * `hdbLoanRetentionCap`; a bank-loan buyer may retain any amount.
   */
  ordinaryAccountRetention?: Cents;
}

export interface ProjectionInput {
  /**
   * The month the projection starts from. An explicit input, never
   * `Date.now()`: it is what makes a run reproducible and a shared link
   * render the same figures tomorrow.
   */
  startMonth: MonthStamp;
  /**
   * Age in years at `startMonth`, 16 to 70.
   *
   * This fixes the birthday month: the member is taken to turn `startAge` in
   * `startMonth`, and so to turn 55 exactly `(55 - startAge) * 12` months
   * later. The age-55 transition lands on that month, and CPF applies a new
   * age band's rates from the month after it. Asking for a birth date instead
   * would be more precise and more intrusive, so the engine takes the age the
   * interface already collects and states what it assumes.
   */
  startAge: number;
  /**
   * Age at which the projection stops, inclusive. v1 runs to 65.
   */
  endAge: number;
  openingBalances: AccountAmounts;
  /** Ordinary Wages for a month, before any ceiling. */
  monthlyOrdinaryWage: Cents;
  salaryGrowth: {
    /** Annual growth as a fraction. Zero is a valid, and honest, assumption. */
    rate: Fraction;
    /**
     * The month of the year the raise lands in. Stated rather than assumed,
     * because applying it in January or in the member's birthday month moves
     * the contribution figures by a visible amount over forty years.
     */
    appliedInMonth: number;
  };
  housing?: HousingPlan;
}

/* Monthly state ------------------------------------------------------------ */

/**
 * Contributions for one month.
 *
 * `total` is not always `employee + employer` of the uncapped wage: the wage
 * ceilings and the Annual Limit bite first, and CPF's rounding assigns the
 * remainder to the employer. The three are recorded as computed rather than
 * derived on display.
 */
export interface MonthlyContribution {
  /** Ordinary Wages actually subject to CPF this month, after the ceiling. */
  ordinaryWageSubjectToCpf: Cents;
  total: Cents;
  employee: Cents;
  employer: Cents;
  /** How the total was split across accounts: MediSave, then SA or RA, then the remainder. */
  allocation: AccountAmounts;
}

/**
 * Interest for one month.
 *
 * CPF computes interest monthly but credits it annually, so a month holds two
 * different things: what it earned, and what was actually paid into the
 * accounts that month. Only the crediting month has a non-zero `credited`,
 * and balances change only then.
 */
export interface MonthlyInterest {
  /** Earned this month on each account's own balance. */
  baseAccrued: AccountAmounts;
  /**
   * Extra interest earned this month, by the account whose balance earned it.
   * This is not where it lands: interest earned on the Ordinary Account is
   * credited to the Special Account, or to the Retirement Account from 55.
   */
  extraAccruedOn: AccountAmounts;
  /** Extra interest earned this month, by the account it will be credited to. */
  extraAccruedTo: AccountAmounts;
  /** Interest paid into the accounts this month, base and extra together. */
  credited: AccountAmounts;
}

/** Housing position for one month. */
export interface MonthlyHousing {
  /** Taken from the Ordinary Account this month, for downpayment or instalment. */
  withdrawnFromOrdinaryAccount: Cents;
  /**
   * Paid in cash this month. A member who chose to pay from CPF still falls
   * back to cash when the Ordinary Account runs dry, and the projection has to
   * show that rather than let the account go negative.
   */
  paidInCash: Cents;
  outstandingLoan: Cents;
  /** Cumulative CPF principal used for the property, which is what must be refunded. */
  principalUsed: Cents;
  /** Interest that principal would have earned, compounded annually. */
  accruedInterest: Cents;
  /** `principalUsed + accruedInterest`: the refund due if the property were sold this month. */
  refundable: Cents;
}

/* Events ------------------------------------------------------------------- */

/**
 * Things that happen to a projection, as data.
 *
 * The interface renders these as markers and row highlights, and the tests
 * assert on them, so they are values rather than log lines or side effects.
 * Each carries the figures that make it explainable on its own.
 */
export type ProjectionEvent =
  | {
      kind: 'property-purchased';
      fromOrdinaryAccount: Cents;
      fromCash: Cents;
      loanPrincipal: Cents;
    }
  | {
      /**
       * The six rule changes at 55, recorded as one event because they happen
       * together and in a fixed order: the Retirement Account is created, the
       * Special Account is transferred into it up to the Full Retirement Sum,
       * then the Ordinary Account tops it up, the Special Account closes, and
       * the contribution rates, allocation ratios and interest tiers change.
       */
      kind: 'age-55-transition';
      transferredFromSpecial: Cents;
      transferredFromOrdinary: Cents;
      /** The Full Retirement Sum for this member's cohort, which fixes at 55. */
      fullRetirementSum: Cents;
      /**
       * Savings above the retirement sum the member may withdraw. Reported,
       * never withdrawn: whether to take it is the member's decision, and a
       * projection that spent it would be answering a question nobody asked.
       */
      withdrawable: Cents;
    }
  | {
      kind: 'basic-healthcare-sum-reached';
      basicHealthcareSum: Cents;
      overflow: Cents;
      /** Special Account below 55, Retirement Account from 55, then Ordinary. */
      overflowTo: AccountName;
    }
  | {
      kind: 'housing-loan-cleared';
      /** Total interest paid over the life of the loan, cash and CPF together. */
      totalInterestPaid: Cents;
    };

export type ProjectionEventKind = ProjectionEvent['kind'];

/* Monthly record ----------------------------------------------------------- */

export interface ProjectionMonth {
  month: MonthStamp;
  /**
   * Age in whole months, because the rules change on month boundaries rather
   * than birthdays: CPF applies a new age band's rates from the month after
   * the birthday month. Age in years is `Math.floor(ageInMonths / 12)`.
   */
  ageInMonths: number;
  /**
   * The rule set this month was computed under. Required on every month: the
   * engine resolves its rules per step, so a projection crossing a rule change
   * has months computed under different sets, and a figure that cannot name
   * its rules cannot be explained or re-checked.
   */
  ruleSetId: string;
  openingBalances: AccountAmounts;
  closingBalances: AccountAmounts;
  /** Ordinary Wages for this month, before the ceiling. */
  ordinaryWage: Cents;
  contribution: MonthlyContribution;
  interest: MonthlyInterest;
  housing?: MonthlyHousing;
  /** Empty in most months. Ordered as they occurred within the month. */
  events: readonly ProjectionEvent[];
}

/* Result ------------------------------------------------------------------- */

/** The headline figures the interface leads with, all drawn from the months below. */
export interface ProjectionSummary {
  /** Absent if the projection ends before 55. */
  atAge55?: {
    balances: AccountAmounts;
    /** Retirement Account against the sums in force for this cohort. */
    retirementAccount: Cents;
    basicRetirementSum: Cents;
    fullRetirementSum: Cents;
    withdrawable: Cents;
  };
  atEnd: {
    balances: AccountAmounts;
    /** What would still be owed to CPF if the property were sold in the last month. */
    housingRefundable: Cents;
  };
  totals: {
    contributions: Cents;
    interest: Cents;
    /** CPF principal put into property over the projection. */
    housingWithdrawals: Cents;
  };
}

export interface ProjectionResult {
  /** Echoed back so a result is self-contained: a chart can be redrawn from it alone. */
  input: ProjectionInput;
  months: readonly ProjectionMonth[];
  summary: ProjectionSummary;
  /**
   * Every rule set used, oldest first, for the rules-as-at stamp. Usually one
   * entry; more than one means the projection crossed a rule change and the
   * interface says so.
   */
  ruleSetIds: readonly string[];
}
