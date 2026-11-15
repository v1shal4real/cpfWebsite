import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { InfoTip } from '@/components/ui/Tooltip';
import { CURRENT_RULE_SET, ruleSetsFrom, type RuleSet } from '@/rules';

/**
 * The rules-as-at stamp.
 *
 * Required on every view and in every export, so a screenshot shared in a
 * forum thread carries the date its figures were true. While the rule set is
 * unverified against its primary sources, the stamp says that too — out loud,
 * not in a footnote.
 *
 * Given the projection's start month, it names the rules in force then, and
 * any rule changes the projection already includes after it: "Rules as at
 * 1 January 2026, with changes from 1 January 2027". Without one it names
 * the set itself.
 */
export function RulesStamp({
  ruleSet = CURRENT_RULE_SET,
  from,
  compact = false,
  className,
}: {
  ruleSet?: RuleSet;
  /** The projection's first month, `YYYY-MM`. */
  from?: string;
  /** Drops the "CPF" prefix for tight header rows. */
  compact?: boolean;
  className?: string;
}) {
  const { inForce, scheduled } = from
    ? ruleSetsFrom(ruleSet, `${from}-01`)
    : { inForce: ruleSet, scheduled: [] as RuleSet[] };
  const verified = [inForce, ...scheduled].every((set) => set.verified);

  return (
    <span
      className={cn('inline-flex flex-wrap items-center gap-1.5 text-[0.75rem] text-ink-muted', className)}
    >
      <span>
        {compact ? 'Rules as at ' : 'CPF rules as at '}
        <time dateTime={inForce.effectiveFrom} className="font-medium text-ink">
          {inForce.label}
        </time>
        {scheduled.map((set, index) => (
          <span key={set.id}>
            {index === 0 ? ', with changes from ' : ' and '}
            <time dateTime={set.effectiveFrom} className="font-medium text-ink">
              {set.label}
            </time>
          </span>
        ))}
      </span>
      {verified ? null : (
        <>
          <Badge tone="warning">Unverified</Badge>
          <InfoTip label="unverified rules" side="bottom">
            The parameters in this rule set were transcribed from the build specification and have not yet
            been re-checked against the CPF Board pages they cite. Treat every figure as provisional until
            this notice is gone.
          </InfoTip>
        </>
      )}
    </span>
  );
}
