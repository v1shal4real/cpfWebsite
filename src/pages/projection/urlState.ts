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
 *   bo  annual bonus (months of salary)    bp  bonus month (1-12)
 *   ob  OA balance ($)              sb  SA balance ($)      mb  MA balance ($)
 *   h   housing plan: n (none), hdb (HDB loan), bank (bank loan)
 *   p   property price ($)          pa  age at purchase
 *   d   downpayment ($)             os  share of downpayment from OA (%)
 *   t   loan tenure (years)         br  bank loan rate (%)
 *   rt  OA set aside ($)            hg  housing grant ($)
 *   sl  1 when the home is sold     sla sale age            slp sale price ($)
 *   nh  next home's plan: n, hdb, bank (bought the month of the sale)
 *   np  next price ($)   nd  next downpayment ($)   nos next share from OA (%)
 *   nt  next tenure (years)         nbr next bank loan rate (%)
 *   vra voluntary housing refund: age     vrm amount ($)
 *
 * Empty fields are left out, and so is every field that does not apply
 * (`appliesTo` in form.ts): housing keys only with a plan, sale keys only when
 * selling, next-home keys only when buying again.
 *
 * Scenario B, when there is one:
 *
 *   B    1 when the link carries a scenario B
 *   b.*  B's value for any key above (h, a, s, ... rt) where it differs from
 *        A; an empty value means B leaves that field empty. Keys B shares
 *        with A are not repeated, so a B that changes one field adds two keys.
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
import {
  DEFAULT_FORM,
  NEXT_FIELDS,
  SALE_FIELDS,
  appliesTo,
  errorsByField,
  normalised,
  toDraft,
  type FormField,
  type FormValues,
} from './form';
import { singleScenario, type Scenarios } from './scenarios';

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
  bonusMonths: 'bo',
  bonusPaidInMonth: 'bp',
  ordinaryBalance: 'ob',
  specialBalance: 'sb',
  medisaveBalance: 'mb',
  propertyPrice: 'p',
  purchaseAge: 'pa',
  downpayment: 'd',
  ordinaryAccountSharePercent: 'os',
  loanTenureYears: 't',
  bankLoanRatePercent: 'br',
  retainedOrdinaryAccount: 'rt',
  housingGrant: 'hg',
  saleAge: 'sla',
  salePrice: 'slp',
  nextPropertyPrice: 'np',
  nextDownpayment: 'nd',
  nextOrdinaryAccountSharePercent: 'nos',
  nextLoanTenureYears: 'nt',
  nextBankLoanRatePercent: 'nbr',
  voluntaryRefundAge: 'vra',
  voluntaryRefundAmount: 'vrm',
} as const satisfies Partial<Record<FormField, string>>;

type NumericField = keyof typeof NUMERIC_KEYS;

/** The first property's details, which stand or fall together in a link. */
const HOUSING_FIELDS: readonly FormField[] = [
  'propertyPrice',
  'purchaseAge',
  'downpayment',
  'ordinaryAccountSharePercent',
  'loanTenureYears',
  'bankLoanRatePercent',
  'retainedOrdinaryAccount',
  'housingGrant',
];

/** The voluntary refund, which also stands or falls on its own. */
const REFUND_GROUP: readonly FormField[] = ['voluntaryRefundAge', 'voluntaryRefundAmount'];

/** The sale and the next home, which also stand or fall together. */
const SALE_GROUP: readonly FormField[] = ['selling', ...SALE_FIELDS, ...NEXT_FIELDS];

const PLAN_CODES: Record<HousingPlanChoice, string> = { none: 'n', 'hdb-loan': 'hdb', 'bank-loan': 'bank' };

/** How each field is named in a notice. */
const FIELD_NAMES: Record<FormField, string> = {
  currentAge: 'current age',
  monthlySalary: 'monthly salary',
  salaryGrowthPercent: 'salary growth',
  bonusMonths: 'annual bonus',
  bonusPaidInMonth: 'bonus month',
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
  retainedOrdinaryAccount: 'Ordinary Account kept back',
  housingGrant: 'housing grant',
  selling: 'sale',
  saleAge: 'sale age',
  salePrice: 'sale price',
  nextHousingPlan: 'next home',
  nextPropertyPrice: 'next home price',
  nextDownpayment: 'next home downpayment',
  nextOrdinaryAccountSharePercent: 'next home share from the Ordinary Account',
  nextLoanTenureYears: 'next home loan tenure',
  nextBankLoanRatePercent: 'next home bank loan rate',
  voluntaryRefundAge: 'refund age',
  voluntaryRefundAmount: 'refund amount',
};

const planFor = (code: string | null) =>
  (Object.entries(PLAN_CODES) as [HousingPlanChoice, string][]).find(([, each]) => each === code)?.[0];

const ALL_KEYS = new Set<string>(['v', 'r', 'm', 'h', 'sl', 'nh', 'B', ...Object.values(NUMERIC_KEYS)]);
const B_PREFIX = 'b.';
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
  if (appliesTo('selling', form) && form.selling) params.set('sl', '1');
  if (appliesTo('nextHousingPlan', form)) params.set('nh', PLAN_CODES[form.nextHousingPlan]);
  for (const [field, key] of Object.entries(NUMERIC_KEYS) as [NumericField, string][]) {
    if (!appliesTo(field, form)) continue;
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
  const plan = (Object.entries(PLAN_CODES) as [HousingPlanChoice, string][]).find(
    ([, code]) => code === planCode,
  )?.[0];
  if (plan) {
    form.housingPlan = plan;
  } else {
    notices.push('The housing plan in this link could not be read, so the projection shows no property.');
  }

  form.selling = params.get('sl') === '1';
  const nextCode = params.get('nh');
  if (nextCode !== null) {
    const next = planFor(nextCode);
    if (next) form.nextHousingPlan = next;
    else notices.push('The next home in this link could not be read, so the projection shows the sale only.');
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
  fallback: FormValues = DEFAULT_FORM,
  label = '',
): FormValues {
  const say = (sentence: string) => notices.push(label ? `${label}: ${sentence}` : sentence);
  const validate = (values: FormValues) =>
    validateProjectionInput({ ...toDraft(values, startMonth), rulesAsAt });

  const first = validate(form);
  if (first.ok) return form;

  const repaired: FormValues = { ...form };
  const invalid = Object.keys(errorsByField(first.errors)) as FormField[];

  // Property details stand or fall together: dropping one would leave a
  // purchase the visitor never described. The sale and next home go with it.
  const reset = (fields: readonly FormField[]) => {
    for (const field of fields) (repaired as Record<FormField, unknown>)[field] = DEFAULT_FORM[field];
  };
  if (invalid.some((field) => HOUSING_FIELDS.includes(field))) {
    repaired.housingPlan = 'none';
    reset([...HOUSING_FIELDS, ...SALE_GROUP, ...REFUND_GROUP]);
    say('The property details in this link could not be used, so the projection shows no property.');
  } else {
    if (invalid.some((field) => SALE_GROUP.includes(field))) {
      // Likewise the sale and the next home: the first home is kept, unsold.
      reset(SALE_GROUP);
      say('The sale details in this link could not be used, so the projection keeps the first home.');
    }
    if (invalid.some((field) => REFUND_GROUP.includes(field))) {
      reset(REFUND_GROUP);
      say('The voluntary refund in this link could not be used, so the projection leaves it out.');
    }
  }
  for (const field of invalid) {
    if (HOUSING_FIELDS.includes(field) || SALE_GROUP.includes(field) || REFUND_GROUP.includes(field))
      continue;
    (repaired as Record<FormField, unknown>)[field] = DEFAULT_FORM[field];
    say(
      `The ${FIELD_NAMES[field]} in this link is outside what the projection supports, so the default is used.`,
    );
  }

  if (validate(repaired).ok) return repaired;
  // Only reachable if the defaults themselves combine badly with what is left.
  say('The rest of this link could not be used together, so the projection shows the default inputs.');
  return fallback;
}

/* Scenarios A and B ------------------------------------------------------ */

export interface ScenariosUrlState {
  scenarios: Scenarios;
  startMonth: MonthStamp;
  rulesAsAt: string;
}

export interface DecodedScenariosUrlState {
  state: ScenariosUrlState;
  notices: string[];
  fromLink: boolean;
}

/** The query string for both scenarios. Without a B it is exactly `encodeUrlState` for A. */
export function encodeScenariosUrl({ scenarios, startMonth, rulesAsAt }: ScenariosUrlState): string {
  const base = encodeUrlState({ form: scenarios.a, startMonth, rulesAsAt });
  const { b } = scenarios;
  if (!b) return base;
  const a = normalised(scenarios.a);
  const params = new URLSearchParams(base);
  params.set('B', '1');
  if (b.housingPlan !== a.housingPlan) params.set(`${B_PREFIX}h`, PLAN_CODES[b.housingPlan]);
  if (b.selling !== a.selling) params.set(`${B_PREFIX}sl`, b.selling ? '1' : '0');
  if (b.nextHousingPlan !== a.nextHousingPlan) params.set(`${B_PREFIX}nh`, PLAN_CODES[b.nextHousingPlan]);
  for (const [field, key] of Object.entries(NUMERIC_KEYS) as [NumericField, string][]) {
    if (b[field] === a[field]) continue;
    params.set(`${B_PREFIX}${key}`, b[field] === null ? '' : compact(b[field]));
  }
  return `?${params.toString()}`;
}

/** Reads both scenarios. Never throws; B's notices are labelled "Scenario B". */
export function decodeScenariosUrl(
  search: string,
  fallback: { startMonth: MonthStamp; rulesAsAt?: string },
): DecodedScenariosUrlState {
  const decodedA = decodeUrlState(search, fallback);
  const { form: a, startMonth, rulesAsAt } = decodedA.state;
  const params = new URLSearchParams(search);
  const notices = [...decodedA.notices];
  if (!decodedA.fromLink || params.get('B') !== '1' || params.get('v') !== URL_SCHEMA_VERSION) {
    return {
      state: { scenarios: singleScenario(a), startMonth, rulesAsAt },
      notices,
      fromLink: decodedA.fromLink,
    };
  }

  const label = 'Scenario B';
  const b: FormValues = { ...normalised(a) };
  const planCode = params.get(`${B_PREFIX}h`);
  if (planCode !== null) {
    const plan = (Object.entries(PLAN_CODES) as [HousingPlanChoice, string][]).find(
      ([, code]) => code === planCode,
    )?.[0];
    if (plan) b.housingPlan = plan;
    else notices.push(`${label}: the housing plan in this link could not be read, so it keeps scenario A's.`);
  }
  const selling = params.get(`${B_PREFIX}sl`);
  if (selling !== null) b.selling = selling === '1';
  const nextCode = params.get(`${B_PREFIX}nh`);
  if (nextCode !== null) {
    const next = planFor(nextCode);
    if (next) b.nextHousingPlan = next;
    else notices.push(`${label}: the next home in this link could not be read, so it keeps scenario A's.`);
  }
  for (const [field, key] of Object.entries(NUMERIC_KEYS) as [NumericField, string][]) {
    const raw = params.get(`${B_PREFIX}${key}`);
    if (raw === null) continue;
    if (raw === '') {
      b[field] = null as never;
      continue;
    }
    if (!NUMBER_PATTERN.test(raw)) {
      notices.push(
        `${label}: the ${FIELD_NAMES[field]} in this link could not be read, so scenario A's is used.`,
      );
      continue;
    }
    b[field] = Number(raw);
  }
  // ordinaryAccountSharePercent is never empty in the form; an empty value falls back to A's.
  if (b.ordinaryAccountSharePercent === null) b.ordinaryAccountSharePercent = a.ordinaryAccountSharePercent;

  const checkedB = fallBackWhereInvalid(b, startMonth, rulesAsAt, notices, a, label);
  return {
    state: { scenarios: { a, b: checkedB, active: 'a' }, startMonth, rulesAsAt },
    notices,
    fromLink: true,
  };
}
