import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { InfoTip } from '@/components/ui/Tooltip';
import { CURRENT_RULE_SET, type RuleSet } from '@/rules';

/**
 * The rules-as-at stamp.
 *
 * Required on every view and in every export, so a screenshot shared in a
 * forum thread carries the date its figures were true. While the rule set is
 * unverified against its primary sources, the stamp says that too — out loud,
 * not in a footnote.
 */
export function RulesStamp({
  ruleSet = CURRENT_RULE_SET,
  compact = false,
  className,
}: {
  ruleSet?: RuleSet;
  /** Drops the "CPF" prefix for tight header rows. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1.5 text-[0.75rem] text-ink-muted', className)}>
      <span>
        {compact ? 'Rules as at ' : 'CPF rules as at '}
        <time dateTime={ruleSet.effectiveFrom} className="font-medium text-ink">
          {ruleSet.label}
        </time>
      </span>
      {ruleSet.verified ? null : (
        <>
          <Badge tone="warning">Unverified</Badge>
          <InfoTip label="unverified rules" side="bottom">
            The parameters in this rule set were transcribed from the build specification and have
            not yet been re-checked against the CPF Board pages they cite. Treat every figure as
            provisional until this notice is gone.
          </InfoTip>
        </>
      )}
    </span>
  );
}
