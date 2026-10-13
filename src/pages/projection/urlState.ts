/**
 * Projection state in the URL.
 *
 * A projection is shared by its link, with no account, storage or server: the
 * query string carries every input, the month the projection starts from and
 * the rule set it was made with, so the link renders the same figures for
 * whoever opens it, whenever they open it.
 *
 * Schema, version 1. Keys are short so a link fits in a chat message; values
 * are plain numbers in the units the form shows, dollars and percentage points.
 *
 *   v   schema version, always 1
 *   r   rule set id the link is pinned to, e.g. sg-cpf-2026-01
 *   m   month the projection starts from, YYYY-MM
 *   a   current age                 s   monthly salary ($)
 *   g   salary growth (%)
 *   ob  OA balance ($)              sb  SA balance ($)      mb  MA balance ($)
 *   h   housing plan: n (none), hdb (HDB loan), bank (bank loan)
 *   p   property price ($)          pa  age at purchase
 *   d   downpayment ($)             os  share of downpayment from OA (%)
 *   t   loan tenure (years)         br  bank loan rate (%)
 *
 * Empty fields are left out; housing keys appear only with a housing plan.
 *
 * Reading a link never fails. Anything missing, malformed, from an unknown
 * schema version or rule set, or out of the range the engine accepts falls
 * back to its default, and each fallback adds a plain-language notice for the
 * page to show, so a visitor is never handed figures from inputs they did not
 * know were changed.
 */

import { CURRENT_RULE_SET, ruleSetById } from '@/rules';
import type { MonthStamp } from '@/engine/types';
import { validateProjectionInput, type HousingPlanChoice } from '@/engine/validate';
import { DEFAULT_FORM, errorsByField, toDraft, type FormField, type FormValues } from './form';

export const URL_SCHEMA_VERSION = '1';

export interface UrlState {
  form: FormValues;
  startMonth: MonthStamp;
  /** The rule set id the projection is pinned to. */
  rulesAsAt: string;
}

export interface DecodedUrlState {
  state: UrlState;
  /** One plain-language sentence per value the link carried but could not be used. */
  notices: string[];
  /** Whether the URL carried any projection state at all. */
  fromLink: boolean;
}

const NUMERIC_KEYS = {
  currentAge: 'a',
  monthlySalary: 's',
  salaryGrowthPercent: 'g',
  ordinaryBalance: 'ob',
  specialBalance: 'sb',
  medisaveBalance: 'mb',
  propertyPrice: 'p',
  purchaseAge: 'pa',
  downpayment: 'd',
  ordinaryAccountSharePercent: 'os',
  loanTenureYears: 't',
  bankLoanRatePercent: 'br',
} as const satisfies Partial<Record<FormField, string>>;

type NumericField = keyof typeof NUMERIC_KEYS;

const HOUSING_FIELDS: readonly NumericField[] = [
  'propertyPrice',
  'purchaseAge',
  'downpayment',
  'ordinaryAccountSharePercent',
  'loanTenureYears',
  'bankLoanRatePercent',
];

const PLAN_CODES: Record<HousingPlanChoice, string> = { none: 'n', 'hdb-loan': 'hdb', 'bank-loan': 'bank' };

/** How each field is named in a notice. */
const FIELD_NAMES: Record<FormField, string> = {
  currentAge: 'current age',
  monthlySalary: 'monthly salary',
  salaryGrowthPercent: 'salary growth',
  ordinaryBalance: 'Ordinary Account balance',
  specialBalance: 'Special Account balance',
  medisaveBalance: 'MediSave Account balance',
  housingPlan: 'housing plan',
  propertyPrice: 'property price',
  purchaseAge: 'age at purchase',
  downpayment: 'downpayment',
  ordinaryAccountSharePercent: 'share of the downpayment from the Ordinary Account',
  loanTenureYears: 'loan tenure',
  bankLoanRatePercent: 'bank loan rate',
};

const ALL_KEYS = new Set<string>(['v', 'r', 'm', 'h', ...Object.values(NUMERIC_KEYS)]);
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;

/** A number as compactly as it can be written: no trailing zeros, no exponent. */
function compact(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** The query string for a state, starting with `?`. */
export function encodeUrlState({ form, startMonth, rulesAsAt }: UrlState): string {
  const params = new URLSearchParams();
  params.set('v', URL_SCHEMA_VERSION);
  params.set('r', rulesAsAt);
  params.set('m', startMonth);
  params.set('h', PLAN_CODES[form.housingPlan]);
  for (const [field, key] of Object.entries(NUMERIC_KEYS) as [NumericField, string][]) {
    if (form.housingPlan === 'none' && HOUSING_FIELDS.includes(field)) continue;
    if (field === 'bankLoanRatePercent' && form.housingPlan !== 'bank-loan') continue;
    const value = form[field];
    if (value !== null) params.set(key, compact(value));
  }
  return `?${params.toString()}`;
}

/** Reads a query string. Never throws; see the module comment. */
export function decodeUrlState(
  search: string,
  fallback: { startMonth: MonthStamp; rulesAsAt?: string },
): DecodedUrlState {
  const params = new URLSearchParams(search);
  const defaults: UrlState = {
    form: DEFAULT_FORM,
    startMonth: fallback.startMonth,
    rulesAsAt: fallback.rulesAsAt ?? CURRENT_RULE_SET.id,
  };

  const fromLink = [...params.keys()].some((key) => ALL_KEYS.has(key));
  if (!fromLink) return { state: defaults, notices: [], fromLink: false };

  if (params.get('v') !== URL_SCHEMA_VERSION) {
    return {
      state: defaults,
      notices: [
        'This link was made by a version of the tool this one cannot read, so the projection shows the default inputs instead.',
      ],
      fromLink: true,
    };
  }

  const notices: string[] = [];

  // The rule set the link was made with, or the current one if unknown.
  let rulesAsAt = params.get('r') ?? '';
  if (!ruleSetById(rulesAsAt)) {
    notices.push(
      rulesAsAt === ''
        ? `This link does not say which CPF rules it was made with, so it uses the rules as at ${CURRENT_RULE_SET.label}.`
        : `This link was made with CPF rules this version does not know (${rulesAsAt}), so it uses the rules as at ${CURRENT_RULE_SET.label}.`,
    );
    rulesAsAt = defaults.rulesAsAt;
  }

  // The start month: a link keeps its own, so its figures do not shift with the calendar.
  let startMonth = params.get('m') ?? '';
  if (!MONTH_PATTERN.test(startMonth)) {
    notices.push('The start month in this link could not be read, so the projection starts this month.');
    startMonth = defaults.startMonth;
  }

  const form: FormValues = { ...DEFAULT_FORM };

  const planCode = params.get('h') ?? PLAN_CODES.none;
  const plan = (Object.entries(PLAN_CODES) as [HousingPlanChoice, string][]).find(([, code]) => code === planCode)?.[0];
  if (plan) {
    form.housingPlan = plan;
  } else {
    notices.push('The housing plan in this link could not be read, so the projection shows no property.');
  }

  for (const [field, key] of Object.entries(NUMERIC_KEYS) as [NumericField, string][]) {
    const raw = params.get(key);
    if (raw === null) continue;
    if (!NUMBER_PATTERN.test(raw)) {
      notices.push(`The ${FIELD_NAMES[field]} in this link could not be read, so the default is used.`);
      continue;
    }
    form[field] = Number(raw);
  }

  // Values that read as numbers but that the engine would reject fall back
  // too: a link should open on a projection, not on a form full of errors.
  const checked = fallBackWhereInvalid(form, startMonth, rulesAsAt, notices);
  return { state: { form: checked, startMonth, rulesAsAt }, notices, fromLink: true };
}

function fallBackWhereInvalid(
  form: FormValues,
  startMonth: MonthStamp,
  rulesAsAt: string,
  notices: string[],
): FormValues {
  const validate = (values: FormValues) => validateProjectionInput({ ...toDraft(values, startMonth), rulesAsAt });

  const first = validate(form);
  if (first.ok) return form;

  const repaired: FormValues = { ...form };
  const invalid = Object.keys(errorsByField(first.errors)) as FormField[];

  // Property details stand or fall together: dropping one would leave a
  // purchase the visitor never described.
  if (invalid.some((field) => (HOUSING_FIELDS as readonly string[]).includes(field))) {
    repaired.housingPlan = 'none';
    for (const field of HOUSING_FIELDS) (repaired as Record<FormField, unknown>)[field] = DEFAULT_FORM[field];
    notices.push('The property details in this link could not be used, so the projection shows no property.');
  }
  for (const field of invalid) {
    if ((HOUSING_FIELDS as readonly string[]).includes(field)) continue;
    (repaired as Record<FormField, unknown>)[field] = DEFAULT_FORM[field];
    notices.push(`The ${FIELD_NAMES[field]} in this link is outside what the projection supports, so the default is used.`);
  }

  if (validate(repaired).ok) return repaired;
  // Only reachable if the defaults themselves combine badly with what is left.
  notices.push('The rest of this link could not be used together, so the projection shows the default inputs.');
  return DEFAULT_FORM;
}
