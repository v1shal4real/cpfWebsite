/**
 * Selling the property: where the sale price goes.
 *
 * CPF Board, "CPF refund when selling or transferring property" (source
 * `housingRefund`, read on 15 November 2026): "the sale proceeds will be used
 * to pay off the outstanding housing loan taken and refund the CPF amount".
 * In that order:
 *
 *   1. The outstanding housing loan is repaid.
 *   2. The CPF refund: "the CPF principal amount you withdrew (P) and the
 *      accrued interest (I)". Housing grants are part of the principal and are
 *      refunded with their interest (source `housingGrantRefund`). For a sale
 *      at market value, "you will only need to refund the selling price less
 *      the outstanding housing loan … You do not need to top up the CPF
 *      housing refund shortfall in cash."
 *   3. What remains is the owner's, in cash.
 *
 * Where the refund goes: below 55, "your housing refunds will be credited to
 * your Ordinary Account". From 55, they are "first used to top up your
 * Retirement Account (RA) to meet your required retirement sum and the
 * balance refunds will remain in your OA". The required sum is taken as the
 * member's cohort Full Retirement Sum, the sum the RA is formed to.
 *
 * A price below the outstanding loan is reported as negative cash proceeds:
 * the cash the owner must add to clear the loan. No CPF is refunded then.
 *
 * Not modelled: the reduced refund for members who were 55 before 2013 and
 * had set aside the FRS then, a pledge, and cash option money.
 */

import type { Cents } from './types';

export interface SaleRequest {
  salePrice: Cents;
  /** Owed on the housing loan at completion. */
  outstandingLoan: Cents;
  /** CPF principal used for the property, grants included. */
  principalUsed: Cents;
  /** Accrued interest on it to completion. */
  accruedInterest: Cents;
  /** Whether the from-55 refund routing applies: RA first, then OA. */
  from55: boolean;
  /** The Retirement Account balance before the refund. */
  retirementBalance: Cents;
  /** The sum the RA is topped up to, from 55: the member's cohort FRS. */
  requiredRetirementSum: Cents;
}

export interface SaleResult {
  salePrice: Cents;
  outstandingLoan: Cents;
  /** Principal plus accrued interest: the full refund due. */
  refundDue: Cents;
  /** What the proceeds actually refunded to CPF: the due amount, capped at price less loan. */
  refunded: Cents;
  /** The part of the refund due that the proceeds did not cover, and need not be topped up. */
  refundNotCovered: Cents;
  refundedToRetirement: Cents;
  refundedToOrdinary: Cents;
  /** What is left for the owner in cash. Negative when the price did not cover the loan. */
  cashProceeds: Cents;
}

export function sellProperty({
  salePrice,
  outstandingLoan,
  principalUsed,
  accruedInterest,
  from55,
  retirementBalance,
  requiredRetirementSum,
}: SaleRequest): SaleResult {
  const afterLoan = salePrice - outstandingLoan;
  const refundDue = principalUsed + accruedInterest;
  const refunded = Math.min(refundDue, Math.max(0, afterLoan));
  const refundedToRetirement = from55
    ? Math.min(refunded, Math.max(0, requiredRetirementSum - retirementBalance))
    : 0;

  return {
    salePrice,
    outstandingLoan,
    refundDue,
    refunded,
    refundNotCovered: refundDue - refunded,
    refundedToRetirement,
    refundedToOrdinary: refunded - refundedToRetirement,
    cashProceeds: afterLoan - refunded,
  };
}
