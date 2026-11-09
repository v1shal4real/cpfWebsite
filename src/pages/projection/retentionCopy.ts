import { formatMoney } from '@/lib/format';
import type { RuleSet } from '@/rules';
import type { HousingPlanChoice } from '@/engine/validate';

/**
 * Copy for the Ordinary Account retention option and the note explaining why
 * the HDB cap and the extra-interest sub-cap are the same figure.
 *
 * Framing: this states what the rules do and what the projection does with
 * the choice. It does not say which choice to make, rank one as better, or
 * describe either as a gain or a loss. Every figure is read from the rule set.
 */

const pct = (fraction: number) => `${Number((fraction * 100).toFixed(2))}%`;

export function retentionHint(rules: RuleSet, plan: HousingPlanChoice): string {
  const cap = formatMoney(rules.housing.hdbLoanRetentionCap);
  return plan === 'hdb-loan'
    ? `Optional. Ordinary Account savings set aside rather than used for the property: up to ${cap} with an HDB loan. Leave blank to use the Ordinary Account for the property as far as it goes.`
    : 'Optional. Ordinary Account savings set aside rather than used for the property. With a bank loan any amount may be set aside. Leave blank to use the Ordinary Account for the property as far as it goes.';
}

export interface RetentionNote {
  title: string;
  paragraphs: string[];
}

export function retentionNote(rules: RuleSet, plan: HousingPlanChoice): RetentionNote {
  const cap = rules.housing.hdbLoanRetentionCap;
  const subCap = rules.interest.ordinaryAccountExtraInterestCap;
  const below55 = rules.interest.extraTiersBelow55[0];
  const same = cap === subCap;

  const extra = below55
    ? `CPF pays extra interest on the first ${formatMoney(below55.amount)} of combined balances, of which at most ${formatMoney(subCap)} can come from the Ordinary Account. Below 55 that is ${pct(below55.rate)} a year more, credited to the Special Account.`
    : `CPF counts at most ${formatMoney(subCap)} of the Ordinary Account towards extra interest.`;

  const paragraphs = [
    plan === 'hdb-loan'
      ? `With an HDB loan, up to ${formatMoney(cap)} of Ordinary Account savings may be set aside instead of being used for the property.`
      : `With a bank loan, any amount of Ordinary Account savings may be set aside instead of being used for the property. HDB loans allow up to ${formatMoney(cap)}.`,
    extra,
    same
      ? `The two limits are the same figure, ${formatMoney(cap)}, by design. An Ordinary Account balance kept at that level stays inside the extra-interest sub-cap; savings used for the property stop earning interest, and accrued interest on them is owed back to CPF if the property is sold.`
      : `Savings used for the property stop earning interest, and accrued interest on them is owed back to CPF if the property is sold.`,
    'The projection applies whatever is entered here; the balances and the accrued-interest figure in the results show the effect.',
  ];

  return { title: same ? `Why ${formatMoney(cap)}?` : 'Keeping Ordinary Account savings', paragraphs };
}

/** One line under the downpayment share, pointing to the note. */
export function shareInterestHint(): string {
  return 'Ordinary Account savings used for the downpayment stop earning interest. See the note on setting savings aside below.';
}
