/**
 * The input panel's form state, and its translation to the engine's draft.
 *
 * The form holds values the way people type them: dollars, and percentages as
 * percentage points. The engine works in cents and fractions. Converting in one
 * pure function, here, keeps the components free of unit arithmetic and lets
 * the conversion be tested on its own.
 *
 * An empty field is `null`, a real state rather than zero: the validator then
 * reports it as required where it is required, and applies the stated default
 * where the spec makes the field optional.
 */

import type { MonthStamp } from '@/engine/types';
import type { FieldError, HousingPlanChoice, ProjectionDraft, ProjectionField } from '@/engine/validate';

const CENTS_PER_DOLLAR = 100;
const PERCENT = 100;

export interface FormValues {
  currentAge: number | null;
  /** Dollars a month. */
  monthlySalary: number | null;
  /** Percentage points a year: 3 is 3%. */
  salaryGrowthPercent: number | null;
  /** Annual bonus in months of salary. Optional; empty means none. */
  bonusMonths: number | null;
  /** Calendar month the bonus is paid, 1 to 12. */
  bonusPaidInMonth: number;
  /** Dollars. Optional; empty means zero. */
  ordinaryBalance: number | null;
  specialBalance: number | null;
  medisaveBalance: number | null;
  housingPlan: HousingPlanChoice;
  /* Read only when a housing plan is selected. */
  propertyPrice: number | null;
  purchaseAge: number | null;
  /** Dollars: the whole downpayment. The loan is the price less this. */
  downpayment: number | null;
  /** Percentage points, 0 to 100, of the downpayment paid from the Ordinary Account. */
  ordinaryAccountSharePercent: number;
  loanTenureYears: number | null;
  /** Percentage points. Bank loans only. */
  bankLoanRatePercent: number | null;
  /** Dollars of Ordinary Account savings kept back from the property. Optional; empty means none. */
  retainedOrdinaryAccount: number | null;
  /** Dollars of housing grant, part of the downpayment. Optional; empty means none. */
  housingGrant: number | null;
  /* Selling this home later, and the next one bought the same month. */
  selling: boolean;
  saleAge: number | null;
  /** Dollars: the expected sale price. */
  salePrice: number | null;
  /** 'none' sells without buying again. */
  nextHousingPlan: HousingPlanChoice;
  nextPropertyPrice: number | null;
  nextDownpayment: number | null;
  nextOrdinaryAccountSharePercent: number;
  nextLoanTenureYears: number | null;
  nextBankLoanRatePercent: number | null;
}

export type FormField = keyof FormValues;

/**
 * The salary growth a visitor starts with: none. The salary is held flat at
 * today's figure, which makes no forecast; the hint says so, and the visitor
 * can enter their own expectation.
 */
export const DEFAULT_SALARY_GROWTH_PERCENT = 0;

/** December: when most annual bonuses, and the 13th-month payment, are paid. Editable. */
export const DEFAULT_BONUS_MONTH = 12;

/**
 * What a visitor lands on: illustrative values, not a typical member and not
 * a suggestion. No housing plan, so no particular purchase is put in front of
 * every visitor; the no-property projection is also the baseline any housing
 * scenario is compared against.
 */
export const DEFAULT_FORM: FormValues = {
  currentAge: 30,
  monthlySalary: 5_000,
  salaryGrowthPercent: DEFAULT_SALARY_GROWTH_PERCENT,
  bonusMonths: null,
  bonusPaidInMonth: DEFAULT_BONUS_MONTH,
  ordinaryBalance: null,
  specialBalance: null,
  medisaveBalance: null,
  housingPlan: 'none',
  propertyPrice: null,
  purchaseAge: null,
  downpayment: null,
  ordinaryAccountSharePercent: 100,
  loanTenureYears: null,
  bankLoanRatePercent: null,
  retainedOrdinaryAccount: null,
  housingGrant: null,
  selling: false,
  saleAge: null,
  salePrice: null,
  nextHousingPlan: 'none',
  nextPropertyPrice: null,
  nextDownpayment: null,
  nextOrdinaryAccountSharePercent: 100,
  nextLoanTenureYears: null,
  nextBankLoanRatePercent: null,
};

const cents = (dollars: number | null) =>
  dollars === null ? undefined : Math.round(dollars * CENTS_PER_DOLLAR);
const fraction = (percent: number | null) => (percent === null ? undefined : percent / PERCENT);
const optional = <T>(value: T | null) => (value === null ? undefined : value);

/** The form as the engine's draft: cents, fractions, and `undefined` for empty. */
export function toDraft(form: FormValues, startMonth: MonthStamp): ProjectionDraft {
  return {
    startMonth,
    currentAge: optional(form.currentAge),
    monthlySalary: cents(form.monthlySalary),
    salaryGrowthRate: fraction(form.salaryGrowthPercent),
    annualBonusMonths: optional(form.bonusMonths),
    bonusPaidInMonth: form.bonusPaidInMonth,
    balances: {
      ordinary: cents(form.ordinaryBalance),
      special: cents(form.specialBalance),
      medisave: cents(form.medisaveBalance),
    },
    housingPlan: form.housingPlan,
    propertyPrice: cents(form.propertyPrice),
    purchaseAge: optional(form.purchaseAge),
    downpayment: cents(form.downpayment),
    downpaymentShareFromOrdinaryAccount: form.ordinaryAccountSharePercent / PERCENT,
    loanTenureYears: optional(form.loanTenureYears),
    bankLoanRate: fraction(form.bankLoanRatePercent),
    ordinaryAccountRetention: cents(form.retainedOrdinaryAccount),
    housingGrant: cents(form.housingGrant),
    ...(form.selling && {
      saleAge: optional(form.saleAge),
      salePrice: cents(form.salePrice),
      nextHousingPlan: form.nextHousingPlan,
      nextPropertyPrice: cents(form.nextPropertyPrice),
      nextDownpayment: cents(form.nextDownpayment),
      nextDownpaymentShareFromOrdinaryAccount: form.nextOrdinaryAccountSharePercent / PERCENT,
      nextLoanTenureYears: optional(form.nextLoanTenureYears),
      nextBankLoanRate: fraction(form.nextBankLoanRatePercent),
    }),
  };
}

/** Fields that only count with a housing plan. */
const HOUSING_FIELDS: readonly FormField[] = [
  'propertyPrice',
  'purchaseAge',
  'downpayment',
  'ordinaryAccountSharePercent',
  'loanTenureYears',
  'bankLoanRatePercent',
  'retainedOrdinaryAccount',
  'housingGrant',
  'selling',
];

/** Fields that only count when selling. */
export const SALE_FIELDS: readonly FormField[] = ['saleAge', 'salePrice', 'nextHousingPlan'];

/** Fields that only count when buying again after the sale. */
export const NEXT_FIELDS: readonly FormField[] = [
  'nextPropertyPrice',
  'nextDownpayment',
  'nextOrdinaryAccountSharePercent',
  'nextLoanTenureYears',
  'nextBankLoanRatePercent',
];

/**
 * Whether a field takes part in a projection with these values. One rule, used
 * by the link (what it carries), scenario B (what counts as changed) and the
 * panel (what it shows): a field that does not apply is neither shown,
 * shared nor compared.
 */
export function appliesTo(field: FormField, form: FormValues): boolean {
  const housing = form.housingPlan !== 'none';
  const selling = housing && form.selling;
  const buyingAgain = selling && form.nextHousingPlan !== 'none';
  if (HOUSING_FIELDS.includes(field)) {
    return housing && (field !== 'bankLoanRatePercent' || form.housingPlan === 'bank-loan');
  }
  if (SALE_FIELDS.includes(field)) return selling;
  if (NEXT_FIELDS.includes(field)) {
    return buyingAgain && (field !== 'nextBankLoanRatePercent' || form.nextHousingPlan === 'bank-loan');
  }
  if (field === 'bonusPaidInMonth') return form.bonusMonths !== null;
  return true;
}

/** The values with every field that does not apply reset to its default. */
export function normalised(form: FormValues): FormValues {
  const out = { ...form } as Record<FormField, unknown>;
  for (const field of Object.keys(DEFAULT_FORM) as FormField[]) {
    if (!appliesTo(field, form)) out[field] = DEFAULT_FORM[field];
  }
  return out as unknown as FormValues;
}

/** Which form field each of the validator's fields is shown against. */
const FORM_FIELD_FOR: Record<ProjectionField, FormField | undefined> = {
  // Supplied by the page, not the visitor; never shown against a field.
  startMonth: undefined,
  currentAge: 'currentAge',
  monthlySalary: 'monthlySalary',
  salaryGrowthRate: 'salaryGrowthPercent',
  // The raise month is not a v1 input; it always takes its default.
  salaryRaiseMonth: undefined,
  annualBonusMonths: 'bonusMonths',
  bonusPaidInMonth: 'bonusPaidInMonth',
  'balances.ordinary': 'ordinaryBalance',
  'balances.special': 'specialBalance',
  'balances.medisave': 'medisaveBalance',
  propertyPrice: 'propertyPrice',
  purchaseAge: 'purchaseAge',
  downpayment: 'downpayment',
  downpaymentShareFromOrdinaryAccount: 'ordinaryAccountSharePercent',
  loanTenureYears: 'loanTenureYears',
  bankLoanRate: 'bankLoanRatePercent',
  ordinaryAccountRetention: 'retainedOrdinaryAccount',
  housingGrant: 'housingGrant',
  saleAge: 'saleAge',
  salePrice: 'salePrice',
  nextPropertyPrice: 'nextPropertyPrice',
  nextDownpayment: 'nextDownpayment',
  nextDownpaymentShareFromOrdinaryAccount: 'nextOrdinaryAccountSharePercent',
  nextLoanTenureYears: 'nextLoanTenureYears',
  nextBankLoanRate: 'nextBankLoanRatePercent',
  // Supplied by the page from the link, which falls back before validating.
  rulesAsAt: undefined,
};

export type FormErrors = Partial<Record<FormField, FieldError>>;

/** The validator's errors, keyed by the form field each belongs beside. */
export function errorsByField(errors: readonly FieldError[]): FormErrors {
  const byField: FormErrors = {};
  for (const error of errors) {
    const field = FORM_FIELD_FOR[error.field];
    if (field && !byField[field]) byField[field] = error;
  }
  return byField;
}

/**
 * Whether to show a field's error beside it yet.
 *
 * A wrong value is shown at once, so the visitor sees why the figures did not
 * update. A missing value is shown only once the visitor has been to the field
 * and left it, so a form they have not reached yet is not a wall of "required".
 */
export function shouldShowError(error: FieldError | undefined, touched: boolean): boolean {
  if (!error) return false;
  return error.code !== 'required' || touched;
}
