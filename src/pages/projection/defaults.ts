/**
 * The draft a visitor lands on.
 *
 * Spec §1.4: a projection to 65 within thirty seconds of landing, without an
 * account. So the page never opens on an empty form: it opens on a projection
 * of the default form values, which the visitor then edits. The values and
 * the reasoning behind them live with the form, in `form.ts`.
 */

import type { MonthStamp } from '@/engine/types';
import type { ProjectionDraft } from '@/engine/validate';
import { DEFAULT_FORM, toDraft } from './form';

export function defaultDraft(startMonth: MonthStamp): ProjectionDraft {
  return toDraft(DEFAULT_FORM, startMonth);
}
