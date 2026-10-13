/**
 * Input validation: from what the user typed to what the engine runs.
 *
 * The engine takes a complete, well-formed `ProjectionInput` and trusts it.
 * This module stands between the form and the engine. It takes a draft in
 * the shape of the spec's §3.1 inputs, where any field may be missing or out
 * of range, and returns either a valid `ProjectionInput` or a list of typed
 * errors, each naming the field it belongs to so the interface can show it in
 * place. It never throws: the interface calls it on every keystroke.
 *
 * Three kinds of outcome, kept apart so the interface can treat them
 * differently:
 *
 *   - Errors. The draft cannot be projected: a required field is missing, or a
 *     value is outside what the engine supports. No input is produced.
 *   - Adjustments. A value was out of range but has one obvious correction,
 *     so it is clamped and the projection runs, with a notice saying what
 *     changed. Only used where the rule itself is a cap, such as the HDB
 *     retention limit.
 *   - Defaults. A field the spec makes optional and left empty, filled with a
 *     stated value: opening balances default to zero, the annual raise lands
 *     in January, and instalments are paid from the Ordinary Account.
 *
 * Rules that come from CPF Board, such as the wage below which graduated
 * contribution rates apply and the HDB retention cap, are read from the rule
 * set in force at the start month. The limits in `INPUT_LIMITS` are not CPF
 * rules; they are the bounds this tool supports, stated in one place so the
 * form can use the same ones.
 */

import { resolveRuleSet, ruleSetById, type RuleSet } from '@/rules';
import { lowestWage } from './salary';
import type { Cents, Fraction, HousingPlan, LoanTerms, MonthStamp, ProjectionInput } from './types';

const CENTS_PER_DOLLAR = 100;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * The bounds this tool supports. Not CPF rules, except where a comment says
 * where the figure comes from.
 */
export const INPUT_LIMITS = {
  /** Spec §3.1: current age, 16 to 70. */
  minimumAge: 16,
  maximumAge: 70,
  /** Spec §3.2: a projection runs to 65 at least, or from the current age if older. */
  projectionEndAge: 65,
  /** Annual salary growth the tool will project, in whole percent: a fall of 10% to a rise of 20%. */
  minimumSalaryGrowthPercent: -10,
  maximumSalaryGrowthPercent: 20,
  /** The highest bank loan rate the tool will project, in whole percent. */
  maximumBankLoanRatePercent: 20,
  /**
   * Longest loan tenure, in years, by kind of loan.
   *
   * Not yet verified against a primary source. HDB's published maximum for its
   * own loans is widely reported as 25 years, and the longest bank housing
   * loan as 35 years (for private property; 30 for an HDB flat), but neither
   * figure was found on a page the source registry accepts. The "source housing
   * loan parameters" ticket should verify these and move them into the rule
   * set alongside the loan-to-value limits.
   */
  maximumTenureYears: { 'hdb-concessionary': 25, bank: 35 },
} as const;

export type HousingPlanChoice = 'none' | 'hdb-loan' | 'bank-loan';

/**
 * The §3.1 inputs as the form holds them: anything may be missing.
 *
 * Money is in cents and rates are fractions, as everywhere in the engine; the
 * form converts from what the user typed. `startMonth` is not typed by the
 * user. The interface supplies it, which keeps the engine off the clock.
 */
export interface ProjectionDraft {
  startMonth: MonthStamp;
  currentAge?: number;
  /** Gross monthly salary: Ordinary Wages only in v1. */
  monthlySalary?: Cents;
  salaryGrowthRate?: Fraction;
  /** The month of the year the annual raise lands in, 1 to 12. Defaults to January. */
  salaryRaiseMonth?: number;
  /** Opening balances. Each defaults to zero. */
  balances?: { ordinary?: Cents; special?: Cents; medisave?: Cents };
  housingPlan: HousingPlanChoice;
  /* The fields below are read only when a housing plan is selected. */
  propertyPrice?: Cents;
  purchaseAge?: number;
  /** The whole downpayment; the loan is the price less this. */
  downpayment?: Cents;
  /** The share of the downpayment paid from the Ordinary Account, 0 to 1. */
  downpaymentShareFromOrdinaryAccount?: Fraction;
  loanTenureYears?: number;
  /** Bank loans only. */
  bankLoanRate?: Fraction;
  /** Ordinary Account balance kept back from housing payments. Defaults to none. */
  ordinaryAccountRetention?: Cents;
  /** Defaults to the Ordinary Account. */
  instalmentsPaidFrom?: 'ordinary-account' | 'cash';
  /** The newest rule set the projection may use, by id. Absent means every rule set known. */
  rulesAsAt?: string;
}

export type ProjectionField =
  | 'startMonth'
  | 'currentAge'
  | 'monthlySalary'
  | 'salaryGrowthRate'
  | 'salaryRaiseMonth'
  | 'balances.ordinary'
  | 'balances.special'
  | 'balances.medisave'
  | 'propertyPrice'
  | 'purchaseAge'
  | 'downpayment'
  | 'downpaymentShareFromOrdinaryAccount'
  | 'loanTenureYears'
  | 'bankLoanRate'
  | 'ordinaryAccountRetention'
  | 'rulesAsAt';

export type ValidationErrorCode =
  | 'required'
  | 'not-a-number'
  | 'not-a-whole-number'
  | 'below-minimum'
  | 'above-maximum'
  | 'invalid-month'
  /** Monthly wages at or below this figure attract graduated rates, which the tool does not model. */
  | 'graduated-rates-not-modelled'
  | 'before-current-age'
  | 'after-projection-end'
  | 'exceeds-property-price'
  | 'unknown-rule-set';

export interface FieldError {
  field: ProjectionField;
  code: ValidationErrorCode;
  /** Plain-language explanation, worded as a statement about the projection. */
  message: string;
  /** The bound that was crossed, where there is one, in the field's own units. */
  limit?: number;
}

export interface FieldAdjustment {
  field: ProjectionField;
  code: 'clamped-to-maximum';
  from: number;
  to: number;
  message: string;
}

export type ValidationResult =
  | { ok: true; input: ProjectionInput; adjustments: FieldAdjustment[] }
  | { ok: false; errors: FieldError[] };

const PERCENT = 100;

/** Whole dollars with thousands separators, without depending on the runtime's locale. */
function dollars(cents: Cents): string {
  const whole = Math.round(cents / CENTS_PER_DOLLAR);
  return `$${String(whole).replace(/B(?=(d{3})+(?!d))/g, ',')}`;
}

function percent(fraction: Fraction): string {
  return `${Math.round(fraction * PERCENT * 10) / 10}%`;
}

/** Collects errors field by field, so each field reports at most its first problem. */
class Checker {
  readonly errors: FieldError[] = [];
  readonly adjustments: FieldAdjustment[] = [];

  fail(field: ProjectionField, code: ValidationErrorCode, message: string, limit?: number): undefined {
    if (!this.errors.some((error) => error.field === field)) {
      this.errors.push(limit === undefined ? { field, code, message } : { field, code, message, limit });
    }
    return undefined;
  }

  /** A finite number, or an error. `label` names the field in the message. */
  number(field: ProjectionField, value: number | undefined, label: string, required: boolean): number | undefined {
    // Forms often hold an empty field as null rather than undefined.
    if (value === undefined || value === null) {
      return required ? this.fail(field, 'required', `${label} is needed for the projection.`) : undefined;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return this.fail(field, 'not-a-number', `${label} must be a number.`);
    }
    return value;
  }

  wholeNumber(field: ProjectionField, value: number | undefined, label: string, required: boolean) {
    const checked = this.number(field, value, label, required);
    if (checked === undefined) return undefined;
    if (!Number.isInteger(checked)) return this.fail(field, 'not-a-whole-number', `${label} must be a whole number.`);
    return checked;
  }

  /** An amount of money, never negative, rounded to the cent. */
  money(field: ProjectionField, value: Cents | undefined, label: string, required: boolean): Cents | undefined {
    const checked = this.number(field, value, label, required);
    if (checked === undefined) return undefined;
    if (checked < 0) return this.fail(field, 'below-minimum', `${label} cannot be negative.`, 0);
    return Math.round(checked);
  }

  range(field: ProjectionField, value: number | undefined, min: number, max: number, describe: (n: number) => string, label: string) {
    if (value === undefined) return undefined;
    if (value < min) return this.fail(field, 'below-minimum', `${label} must be at least ${describe(min)}.`, min);
    if (value > max) return this.fail(field, 'above-maximum', `${label} must be at most ${describe(max)}.`, max);
    return value;
  }
}

/** Checks a draft and, if it can be projected, builds the engine's input. */
export function validateProjectionInput(draft: ProjectionDraft): ValidationResult {
  const check = new Checker();

  if (typeof draft.startMonth !== 'string' || !MONTH_PATTERN.test(draft.startMonth)) {
    // Supplied by the interface, not the user, so this is a programming error
    // surfaced as data rather than a throw.
    check.fail('startMonth', 'invalid-month', 'The start month must be a YYYY-MM month.');
    return { ok: false, errors: check.errors };
  }
  if (draft.rulesAsAt !== undefined && !ruleSetById(draft.rulesAsAt)) {
    // Also supplied by the interface, which falls back before it gets here.
    check.fail('rulesAsAt', 'unknown-rule-set', `No rule set is known by the id "${draft.rulesAsAt}".`);
    return { ok: false, errors: check.errors };
  }
  const rules: RuleSet = resolveRuleSet(`${draft.startMonth}-01`, draft.rulesAsAt);

  // Age.
  const age = check.range(
    'currentAge',
    check.wholeNumber('currentAge', draft.currentAge, 'Current age', true),
    INPUT_LIMITS.minimumAge,
    INPUT_LIMITS.maximumAge,
    String,
    'Current age',
  );
  const endAge = age === undefined ? undefined : Math.max(INPUT_LIMITS.projectionEndAge, age);

  // Salary. At or below the threshold CPF Board applies graduated rates,
  // which no rule set encodes; the engine would refuse such a wage.
  const salary = check.money('monthlySalary', draft.monthlySalary, 'Monthly salary', true);
  const graduatedUpTo = rules.contributionRates.fullRatesFromMonthlyWage * CENTS_PER_DOLLAR;
  if (salary !== undefined && salary <= graduatedUpTo) {
    check.fail(
      'monthlySalary',
      'graduated-rates-not-modelled',
      `Monthly salaries of ${dollars(graduatedUpTo)} or less attract graduated CPF rates, which this projection does not model.`,
      graduatedUpTo,
    );
  }

  const growth = check.range(
    'salaryGrowthRate',
    check.number('salaryGrowthRate', draft.salaryGrowthRate, 'Salary growth', true),
    INPUT_LIMITS.minimumSalaryGrowthPercent / PERCENT,
    INPUT_LIMITS.maximumSalaryGrowthPercent / PERCENT,
    percent,
    'Salary growth',
  );
  const raiseMonth =
    check.range(
      'salaryRaiseMonth',
      check.wholeNumber('salaryRaiseMonth', draft.salaryRaiseMonth, 'Raise month', false),
      1,
      12,
      String,
      'Raise month',
    ) ?? (draft.salaryRaiseMonth === undefined ? 1 : undefined);

  // Opening balances, each optional and zero by default.
  const ordinary = check.money('balances.ordinary', draft.balances?.ordinary, 'Ordinary Account balance', false) ?? 0;
  const special = check.money('balances.special', draft.balances?.special, 'Special Account balance', false) ?? 0;
  const medisave = check.money('balances.medisave', draft.balances?.medisave, 'MediSave Account balance', false) ?? 0;

  // Housing, only when a plan is selected: nothing below is read otherwise,
  // so leftover values in hidden fields cannot block a projection.
  const housing = draft.housingPlan === 'none' ? undefined : validateHousing(draft, rules, check, age, endAge);

  if (check.errors.length > 0 || age === undefined || endAge === undefined || salary === undefined) {
    return { ok: false, errors: check.errors };
  }

  const input: ProjectionInput = {
    startMonth: draft.startMonth,
    startAge: age,
    endAge,
    openingBalances: { ordinary, special, medisave, retirement: 0 },
    monthlyOrdinaryWage: salary,
    salaryGrowth: { rate: growth!, appliedInMonth: raiseMonth! },
    ...(housing && { housing }),
    ...(draft.rulesAsAt !== undefined && { rulesAsAt: draft.rulesAsAt }),
  };

  // A pay cut each year can take the wage down to the graduated-rate
  // threshold partway through, where the engine would refuse it. Checked on
  // the engine's own wage path, so the two cannot disagree.
  const lowest = lowestWage(input);
  if (lowest <= graduatedUpTo) {
    check.fail(
      'salaryGrowthRate',
      'graduated-rates-not-modelled',
      `With this salary growth, the monthly salary falls to ${dollars(graduatedUpTo)} or less during the projection, where graduated CPF rates apply, which this projection does not model.`,
      graduatedUpTo,
    );
    return { ok: false, errors: check.errors };
  }
  return { ok: true, input, adjustments: check.adjustments };
}

function validateHousing(
  draft: ProjectionDraft,
  rules: RuleSet,
  check: Checker,
  age: number | undefined,
  endAge: number | undefined,
): HousingPlan | undefined {
  const kind: LoanTerms['kind'] = draft.housingPlan === 'hdb-loan' ? 'hdb-concessionary' : 'bank';

  const price = check.money('propertyPrice', draft.propertyPrice, 'Property price', true);
  if (price === 0) check.fail('propertyPrice', 'below-minimum', 'Property price must be more than zero.', 0);

  let purchaseAge = check.wholeNumber('purchaseAge', draft.purchaseAge, 'Purchase age', true);
  if (purchaseAge !== undefined && age !== undefined && purchaseAge < age) {
    purchaseAge = check.fail('purchaseAge', 'before-current-age', 'Purchase age cannot be before your current age.', age);
  }
  if (purchaseAge !== undefined && endAge !== undefined && purchaseAge > endAge) {
    purchaseAge = check.fail(
      'purchaseAge',
      'after-projection-end',
      `Purchase age must be no later than ${endAge}, when the projection ends.`,
      endAge,
    );
  }

  let downpayment = check.money('downpayment', draft.downpayment, 'Downpayment', true);
  if (downpayment !== undefined && price !== undefined && downpayment > price) {
    downpayment = check.fail('downpayment', 'exceeds-property-price', 'The downpayment cannot be more than the price.', price);
  }

  const share = check.range(
    'downpaymentShareFromOrdinaryAccount',
    check.number('downpaymentShareFromOrdinaryAccount', draft.downpaymentShareFromOrdinaryAccount, 'Share from the Ordinary Account', true),
    0,
    1,
    percent,
    'Share from the Ordinary Account',
  );

  // A loan, and so a tenure and a rate, only if the downpayment leaves one.
  const principal = price !== undefined && downpayment !== undefined ? price - downpayment : undefined;
  const borrowing = principal === undefined || principal > 0;

  const maxTenure = INPUT_LIMITS.maximumTenureYears[kind];
  const tenure = borrowing
    ? check.range(
        'loanTenureYears',
        check.wholeNumber('loanTenureYears', draft.loanTenureYears, 'Loan tenure', true),
        1,
        maxTenure,
        (years) => `${years} years`,
        'Loan tenure',
      )
    : 0;

  const rate =
    kind === 'bank' && borrowing
      ? check.range(
          'bankLoanRate',
          check.number('bankLoanRate', draft.bankLoanRate, 'Bank loan rate', true),
          0,
          INPUT_LIMITS.maximumBankLoanRatePercent / PERCENT,
          percent,
          'Bank loan rate',
        )
      : undefined;

  // Retention: an HDB-loan buyer may keep up to the rule set's cap, so a
  // larger figure has one obvious correction, and is clamped to it.
  let retention = check.money('ordinaryAccountRetention', draft.ordinaryAccountRetention, 'Retained amount', false);
  const retentionCap = rules.housing.hdbLoanRetentionCap * CENTS_PER_DOLLAR;
  if (retention !== undefined && kind === 'hdb-concessionary' && retention > retentionCap) {
    check.adjustments.push({
      field: 'ordinaryAccountRetention',
      code: 'clamped-to-maximum',
      from: retention,
      to: retentionCap,
      message: `HDB-loan buyers may retain up to ${dollars(retentionCap)} in the Ordinary Account, so the projection uses ${dollars(retentionCap)}.`,
    });
    retention = retentionCap;
  }

  if (
    price === undefined ||
    purchaseAge === undefined ||
    downpayment === undefined ||
    share === undefined ||
    principal === undefined ||
    tenure === undefined ||
    (kind === 'bank' && borrowing && rate === undefined)
  ) {
    return undefined;
  }

  const fromOrdinaryAccount = Math.round(downpayment * share);
  const loan: LoanTerms =
    kind === 'bank'
      ? { kind, principal, tenureYears: tenure, interestRate: rate ?? 0 }
      : { kind, principal, tenureYears: tenure };

  return {
    purchaseAge,
    price,
    downpaymentFromOrdinaryAccount: fromOrdinaryAccount,
    downpaymentFromCash: downpayment - fromOrdinaryAccount,
    loan,
    instalmentsPaidFrom: draft.instalmentsPaidFrom ?? 'ordinary-account',
    ...(retention !== undefined && { ordinaryAccountRetention: retention }),
  };
}
