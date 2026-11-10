import { DEFAULT_FORM, type FormField, type FormValues } from './form';

/**
 * Two input sets, A and B, for comparing one decision against another.
 *
 * B is created as an exact copy of A, so the visitor changes only what they
 * want to compare and everything else stays equal. B is optional: a single
 * projection is the common case and carries no B.
 */

export type ScenarioId = 'a' | 'b';

export interface Scenarios {
  a: FormValues;
  b: FormValues | null;
  /** The scenario the input panel is editing. */
  active: ScenarioId;
}

export function singleScenario(form: FormValues = DEFAULT_FORM): Scenarios {
  return { a: form, b: null, active: 'a' };
}

/** Adds B as a copy of A and switches to it. */
export function duplicateIntoB(scenarios: Scenarios): Scenarios {
  return { ...scenarios, b: { ...scenarios.a }, active: 'b' };
}

export function removeB(scenarios: Scenarios): Scenarios {
  return { ...scenarios, b: null, active: 'a' };
}

export function activeForm(scenarios: Scenarios): FormValues {
  return scenarios.active === 'b' && scenarios.b ? scenarios.b : scenarios.a;
}

export function updateActive(scenarios: Scenarios, patch: Partial<FormValues>): Scenarios {
  if (scenarios.active === 'b' && scenarios.b) return { ...scenarios, b: { ...scenarios.b, ...patch } };
  return { ...scenarios, a: { ...scenarios.a, ...patch } };
}

const HOUSING_FIELDS: readonly FormField[] = [
  'propertyPrice',
  'purchaseAge',
  'downpayment',
  'ordinaryAccountSharePercent',
  'loanTenureYears',
  'bankLoanRatePercent',
  'retainedOrdinaryAccount',
];

/** Whether a field takes part in a projection with this housing plan. */
export function appliesTo(field: FormField, form: FormValues): boolean {
  if (form.housingPlan === 'none' && HOUSING_FIELDS.includes(field)) return false;
  if (field === 'bankLoanRatePercent' && form.housingPlan !== 'bank-loan') return false;
  return true;
}

/**
 * The fields where B differs from A, among those that apply to B. A value A
 * holds only for a plan B does not use is not a change: it is not part of B.
 */
export function changedFields(a: FormValues, b: FormValues): ReadonlySet<FormField> {
  const changed = new Set<FormField>();
  for (const field of Object.keys(b) as FormField[]) {
    if (!appliesTo(field, b)) continue;
    const before = appliesTo(field, a) ? a[field] : DEFAULT_FORM[field];
    if (before !== b[field]) changed.add(field);
  }
  return changed;
}
