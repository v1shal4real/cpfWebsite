/**
 * The draft a visitor lands on.
 *
 * Spec §1.4: a projection to 65 within thirty seconds of landing, without an
 * account. So the page never opens on an empty form: it opens on a projection
 * of these inputs, which the visitor then edits. They are illustrative, not a
 * typical member and not a suggestion, and the page shows them in full.
 *
 * No housing plan by default. Picking one would put a particular purchase in
 * front of every visitor, which is the kind of nudge the framing constraint
 * rules out; the no-property projection is also the baseline any housing
 * scenario is compared against.
 *
 * The salary growth figure is provisional: the input panel ticket states the
 * default growth assumption and its basis, and should replace it here.
 */

import type { ProjectionDraft } from '@/engine/validate';
import type { MonthStamp } from '@/engine/types';

export function defaultDraft(startMonth: MonthStamp): ProjectionDraft {
  return {
    startMonth,
    currentAge: 30,
    monthlySalary: 500_000,
    salaryGrowthRate: 300 / 10_000,
    housingPlan: 'none',
  };
}
