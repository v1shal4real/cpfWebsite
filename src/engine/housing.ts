/**
 * Housing payments from the Ordinary Account.
 *
 * In the month of purchase the member pays the downpayment: the share they
 * chose to take from the Ordinary Account, and the rest in cash. Each month
 * after, the loan instalment falls due, and is paid from the Ordinary Account
 * or in cash as the member chose.
 *
 * Two limits apply to every withdrawal, and both are why a payment the member
 * meant to make from CPF can fall partly to cash:
 *
 *   - The Ordinary Account never goes negative. A payment takes what the
 *     account holds and no more; the rest is paid in cash and recorded as a
 *     shortfall, so the projection shows it rather than hiding it.
 *   - The retained amount stays put. CPF Board, "Retain $20,000 in your
 *     Ordinary Account if you are taking a housing loan" (source
 *     `housingLoanRetention`, read on 11 October 2026): members taking an HDB
 *     loan "can choose to retain up to $20,000 in their Ordinary Account", and
 *     buyers taking a bank loan "can choose to retain any amount". Withdrawals
 *     never take the OA below the member's retention, capped at the rule
 *     set's limit for an HDB loan.
 *
 * What a payment can draw on is the OA balance once this month's contribution
 * has landed: the opening balance plus this month's Ordinary share. Money
 * withdrawn stops earning interest from the month it leaves, so the loop
 * subtracts these withdrawals from the balance interest is computed on.
 *
 * Every withdrawal is CPF principal used for housing, the figure that must be
 * refunded to CPF, with accrued interest, if the property is sold.
 *
 * Not modelled. The same CPF Board page says that for an HDB loan "the
 * remainder of your OA savings after retaining up to $20,000 will be used to
 * pay for the down payment", with the loan sized to cover the rest. The spec
 * makes the OA share of the downpayment the member's input instead, and the
 * loan principal is an input too, so the engine pays what it is told to and
 * does not resize the loan. Stamp duty and legal fees, which CPF may also
 * pay, are not inputs in v1.
 */

import type { RuleSet } from '@/rules';
import type { Cents, HousingPlan } from './types';

const CENTS_PER_DOLLAR = 100;

/**
 * The Ordinary Account balance the member keeps back from housing payments:
 * their choice, capped at the rule set's limit for an HDB loan. A bank-loan
 * buyer may retain any amount.
 */
export function ordinaryAccountRetention(rules: RuleSet, plan: HousingPlan): Cents {
  const requested = Math.max(0, plan.ordinaryAccountRetention ?? 0);
  switch (plan.loan.kind) {
    case 'hdb-concessionary':
      return Math.min(requested, rules.housing.hdbLoanRetentionCap * CENTS_PER_DOLLAR);
    case 'bank':
      return requested;
  }
}

export interface HousingPayment {
  /** Taken from the Ordinary Account. */
  fromOrdinaryAccount: Cents;
  /** Of what was asked of the OA, the part it could not cover, paid in cash instead. */
  shortfallToCash: Cents;
}

/**
 * Pays an amount from the Ordinary Account as far as it can without going
 * below the retained amount, and reports the rest as a shortfall to cash.
 */
export function payFromOrdinaryAccount(
  amount: Cents,
  ordinaryAvailable: Cents,
  retention: Cents,
): HousingPayment {
  const usable = Math.max(0, ordinaryAvailable - retention);
  const fromOrdinaryAccount = Math.min(Math.max(0, amount), usable);
  return { fromOrdinaryAccount, shortfallToCash: Math.max(0, amount) - fromOrdinaryAccount };
}

export interface HousingMonthRequest {
  rules: RuleSet;
  plan: HousingPlan;
  /** True in the month of purchase, when the downpayment is paid. */
  isPurchaseMonth: boolean;
  /** The loan instalment due this month, zero if none. */
  instalmentDue: Cents;
  /** The OA balance payments can draw on: opening plus this month's Ordinary share. */
  ordinaryAvailable: Cents;
}

export interface HousingMonthPayments {
  withdrawnFromOrdinaryAccount: Cents;
  paidInCash: Cents;
  shortfallToCash: Cents;
  ordinaryAccountRetention: Cents;
}

/** What the property costs the member this month, and where it is paid from. */
export function housingPayments({
  rules,
  plan,
  isPurchaseMonth,
  instalmentDue,
  ordinaryAvailable,
}: HousingMonthRequest): HousingMonthPayments {
  const retention = ordinaryAccountRetention(rules, plan);

  // What the member asked CPF to pay this month, and what they always pay in cash.
  let askedOfOrdinaryAccount = 0;
  let plannedCash = 0;
  if (isPurchaseMonth) {
    askedOfOrdinaryAccount += plan.downpaymentFromOrdinaryAccount;
    plannedCash += plan.downpaymentFromCash;
  }
  switch (plan.instalmentsPaidFrom) {
    case 'ordinary-account':
      askedOfOrdinaryAccount += instalmentDue;
      break;
    case 'cash':
      plannedCash += instalmentDue;
      break;
  }

  const payment = payFromOrdinaryAccount(askedOfOrdinaryAccount, ordinaryAvailable, retention);
  return {
    withdrawnFromOrdinaryAccount: payment.fromOrdinaryAccount,
    paidInCash: plannedCash + payment.shortfallToCash,
    shortfallToCash: payment.shortfallToCash,
    ordinaryAccountRetention: retention,
  };
}
