/**
 * Engine benchmarks. Run with `npm run bench`.
 *
 * These report timings; they do not fail. The budget itself is asserted by
 * `performance.test.ts`, which runs with the rest of the suite.
 */

import { bench, describe } from 'vitest';
import { SCENARIO_A, SCENARIO_B } from './__fixtures__/scenarios';
import { project, projectDraft } from './project';
import { validateProjectionInput } from './validate';

const inputA = validateProjectionInput(SCENARIO_A);
const inputB = validateProjectionInput(SCENARIO_B);
if (!inputA.ok || !inputB.ok) throw new Error('benchmark scenarios must be valid');

describe('full recomputation: 22 to 65, two scenarios', () => {
  bench('validate and project both scenarios (what the interface does)', () => {
    projectDraft(SCENARIO_A);
    projectDraft(SCENARIO_B);
  });
});

describe('parts', () => {
  bench('project one scenario, already validated', () => {
    project(inputA.input);
  });

  bench('validate one scenario', () => {
    validateProjectionInput(SCENARIO_A);
  });
});
