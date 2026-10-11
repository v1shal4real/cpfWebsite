/**
 * The housing loan: monthly instalments and the outstanding balance.
 *
 * Standard amortisation with monthly rest, the convention for both HDB and
 * Singapore bank housing loans: each month's interest is a twelfth of the
 * annual rate on the balance owed at the start of the month, the instalment
 * is the level payment that clears the loan over the remaining months, and
 * whatever the instalment does not spend on interest repays principal.
 *
 *   instalment = balance x r / (1 - (1 + r) ^ -n)
 *
 * where r is the monthly rate and n the instalments left. No government page
 * found states the monthly-rest convention in so many words, so it is stated
 * here as the engine's assumption.
 *
 * Rates:
 *
 *   - HDB concessionary: the Ordinary Account rate plus the rule set's peg,
 *     read from the rule set in force each month. CPF Board's news release
 *     for the first quarter of 2026 (source `newsRelease2026Q1`): the rate
 *     "is pegged at 0.1% above the OA interest rate". If a later rule set
 *     moves the OA rate, the loan rate moves with it from that month, and the
 *     instalment is recomputed over the months that remain, as a lender would
 *     on a rate change.
 *   - Bank: the rate given with the loan, held for the whole tenure. Whether
 *     that is a user input or a stated assumption is a product decision
 *     outside this module.
 *
 * Timing. The loan is drawn in the month of purchase. The first instalment
 * falls due the month after, and there are `tenureYears x 12` of them, so the
 * loan is cleared in the month `tenureYears` years after the purchase.
 *
 * Rounding is provisional: no published rule was found. Interest is rounded to
 * the nearest cent, half a cent up. The instalment is rounded up to the cent,
 * so rounding never pushes the loan past its tenure, and the last instalment
 * is whatever clears the balance exactly, a few cents less than the others.
 */

import type { RuleSet } from '@/rules';
import type { Cents, Fraction, LoanTerms, MonthlyLoan } from './types';

const MONTHS_PER_YEAR = 12;

/** Rates are held as whole millionths so the interest arithmetic stays exact. */
const MILLIONTHS = 1_000_000;

/** One cent, in the units monthly interest is computed in: cents x millionths / 12. */
const CENT = MILLIONTHS * MONTHS_PER_YEAR;

/** The annual rate charged on this loan in a month governed by these rules. */
export function loanRate(terms: LoanTerms, rules: RuleSet): Fraction {
  switch (terms.kind) {
    case 'hdb-concessionary':
      return rules.interest.ordinary + rules.housing.concessionaryLoanSpread;
    case 'bank':
      return terms.interestRate;
  }
}

function toMillionths(rate: Fraction): number {
  return Math.round(rate * MILLIONTHS);
}

/** A month's interest on a balance, to the nearest cent, half a cent up. */
function monthlyInterest(balance: Cents, rateInMillionths: number): Cents {
  return Math.floor((balance * rateInMillionths + CENT / 2) / CENT);
}

/**
 * The level instalment that clears a balance over `months` at this rate,
 * rounded up to the cent. At a zero rate it is the balance shared equally.
 */
export function levelInstalment(balance: Cents, rate: Fraction, monthsLeft: number): Cents {
  // A tenure of zero is for input validation to reject; here it clears at once.
  const months = Math.max(1, monthsLeft);
  const rateInMillionths = toMillionths(rate);
  if (rateInMillionths === 0) return Math.ceil(balance / months);
  const monthly = rateInMillionths / CENT;
  const exact = (balance * monthly) / (1 - (1 + monthly) ** -months);
  // A hair of tolerance, so a result that floating point lands a fraction of
  // a cent above a whole number is not pushed up to the next cent.
  return Math.ceil(exact - 1e-9);
}

/** Where a loan stands between months. */
export interface LoanState {
  terms: LoanTerms;
  balance: Cents;
  instalmentsLeft: number;
  /** The instalment in force, and the rate it was computed at. Absent until the first is due. */
  instalment?: { amount: Cents; rateInMillionths: number };
  instalmentsPaid: number;
  totalInterestPaid: Cents;
}

export interface LoanMonth {
  state: LoanState;
  record: MonthlyLoan;
  /** True in the month the last instalment clears the balance. */
  cleared: boolean;
}

/** The month of purchase: the loan is drawn, and nothing is due yet. */
export function drawLoan(terms: LoanTerms, rules: RuleSet): LoanMonth {
  return {
    state: {
      terms,
      balance: terms.principal,
      instalmentsLeft: terms.tenureYears * MONTHS_PER_YEAR,
      instalmentsPaid: 0,
      totalInterestPaid: 0,
    },
    record: {
      rate: loanRate(terms, rules),
      openingBalance: 0,
      drawn: terms.principal,
      instalment: 0,
      interest: 0,
      principal: 0,
      closingBalance: terms.principal,
    },
    cleared: false,
  };
}

/**
 * One month of repayment, at the rate the rules in force give.
 *
 * Call it for each month after the purchase until it reports `cleared`. The
 * instalment is worked out at the first repayment, and again only if the rate
 * changes.
 */
export function repayLoan(state: LoanState, rules: RuleSet): LoanMonth {
  const rate = loanRate(state.terms, rules);
  const rateInMillionths = toMillionths(rate);

  let instalment = state.instalment;
  if (!instalment || instalment.rateInMillionths !== rateInMillionths) {
    instalment = {
      amount: levelInstalment(state.balance, rate, state.instalmentsLeft),
      rateInMillionths,
    };
  }

  const interest = monthlyInterest(state.balance, rateInMillionths);
  const owed = state.balance + interest;
  // The last instalment, or any that would overpay, clears exactly what is owed.
  const payment = state.instalmentsLeft <= 1 || owed <= instalment.amount ? owed : instalment.amount;
  const principal = payment - interest;
  const closingBalance = state.balance - principal;

  return {
    state: {
      terms: state.terms,
      balance: closingBalance,
      instalmentsLeft: state.instalmentsLeft - 1,
      instalment,
      instalmentsPaid: state.instalmentsPaid + 1,
      totalInterestPaid: state.totalInterestPaid + interest,
    },
    record: {
      rate,
      openingBalance: state.balance,
      drawn: 0,
      instalment: payment,
      interest,
      principal,
      closingBalance,
    },
    cleared: closingBalance === 0,
  };
}
