import { Callout, Card, CardBody, CardHeader, SourceLink } from '@/components/ui';
import type { ProjectionResult } from '@/engine/types';
import { CURRENT_RULE_SET, ruleSetById, type RuleSet } from '@/rules';
import { assumptionGroup, effectiveRange, ruleSetGroups, type AssumptionGroup } from './assumptions';

/**
 * Every parameter the projection used, with its effective date and source.
 *
 * Visible by default: this is the evidence behind every figure above, so it
 * is not tucked behind a disclosure. A projection that crosses a rule change
 * shows one section per rule set, oldest first.
 */
export function AssumptionsPanel({ result }: { result: ProjectionResult }) {
  const ruleSets: RuleSet[] = result.ruleSetIds.map((id) => ruleSetById(id) ?? CURRENT_RULE_SET);
  const latest = ruleSets.at(-1) ?? CURRENT_RULE_SET;

  return (
    <Card>
      <CardHeader
        as="h3"
        title={<span id="assumptions-heading">Assumptions and sources</span>}
        description="Every CPF parameter this projection used, when it took effect, and where it is published. Figures marked yours are your inputs."
      />
      <CardBody className="flex flex-col gap-6">
        {ruleSets.length > 1 ? (
          <Callout tone="info" title={`This projection uses ${ruleSets.length} rule sets`}>
            <p>
              CPF rules change during the projection. Each month uses the rules in force then:{' '}
              {ruleSets.map((rules) => `${rules.label} (${effectiveRange(rules).toLowerCase()})`).join(', then ')}.
            </p>
          </Callout>
        ) : null}

        <Group group={assumptionGroup(result.input, latest)} />

        {ruleSets.map((rules) => (
          <section key={rules.id} aria-label={`CPF rules as at ${rules.label}`} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-line pb-1">
              <h4 className="text-[0.9375rem] font-semibold text-ink">CPF rules as at {rules.label}</h4>
              <span className="text-[0.75rem] text-ink-subtle">{effectiveRange(rules)}</span>
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 xl:grid-cols-2">
              {ruleSetGroups(rules).map((group) => (
                <Group key={group.id} group={group} />
              ))}
            </div>
          </section>
        ))}
      </CardBody>
    </Card>
  );
}

function Group({ group }: { group: AssumptionGroup }) {
  return (
    <section aria-label={group.title} className="flex min-w-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="text-[0.8125rem] font-semibold text-ink">{group.title}</h5>
        {group.sourceId ? <SourceLink sourceId={group.sourceId} variant="chip" /> : null}
      </div>
      <dl className="flex flex-col">
        {group.rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-0.5 border-b border-line py-1.5 last:border-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <dt className="text-[0.8125rem] text-ink-muted">{row.label}</dt>
            <dd className="flex flex-wrap items-baseline gap-2 text-[0.8125rem] text-ink sm:justify-end sm:text-right">
              <span data-numeric>{row.value}</span>
              {row.sourceId ? <SourceLink sourceId={row.sourceId} variant="chip" /> : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
