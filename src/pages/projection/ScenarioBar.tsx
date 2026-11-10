import { Button, SegmentedControl } from '@/components/ui';
import { duplicateIntoB, removeB, type ScenarioId, type Scenarios } from './scenarios';

/**
 * Switches the input panel between scenario A and B, creates B as a copy of
 * A, and removes it. The figures beside the panel follow the scenario being
 * edited; comparing the two side by side is a separate view.
 */
export function ScenarioBar({
  scenarios,
  onChange,
  changedCount,
}: {
  scenarios: Scenarios;
  onChange: (next: Scenarios) => void;
  changedCount: number;
}) {
  if (!scenarios.b) {
    return (
      <div className="flex flex-col items-start gap-1.5">
        <Button size="sm" onClick={() => onChange(duplicateIntoB(scenarios))}>
          Add scenario B
        </Button>
        <p className="text-[0.75rem] text-ink-subtle">
          Starts as a copy of these inputs, so you can change one thing and compare.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl<ScenarioId>
          label="Scenario being edited"
          options={[
            { value: 'a', label: 'Scenario A' },
            { value: 'b', label: 'Scenario B' },
          ]}
          value={scenarios.active}
          onValueChange={(active) => onChange({ ...scenarios, active })}
        />
        <Button size="sm" variant="ghost" onClick={() => onChange(removeB(scenarios))}>
          Remove B
        </Button>
      </div>
      <p className="text-[0.75rem] text-ink-subtle" aria-live="polite">
        {scenarios.active === 'b'
          ? changedCount === 0
            ? 'Scenario B matches A. Fields you change are marked.'
            : `${changedCount} ${changedCount === 1 ? 'field differs' : 'fields differ'} from scenario A, marked below.`
          : 'Editing scenario A. Scenario B keeps its own values.'}
      </p>
    </div>
  );
}
