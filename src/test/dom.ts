/**
 * Shared setup for component interaction tests.
 *
 * Import this first in any test file that renders into a DOM, and mark the
 * file with `// @vitest-environment jsdom`. The engine's tests stay on the
 * plain Node environment, which is much faster; only these files pay for a
 * simulated browser.
 *
 * - Adds jest-dom's matchers (`toHaveAccessibleDescription`, `toHaveFocus`, ...).
 * - Unmounts everything after each test, since Vitest globals are off and
 *   Testing Library cannot register that cleanup itself.
 * - Stubs `matchMedia`, which jsdom lacks. It reports
 *   `prefers-reduced-motion: reduce`, so components skip their animations
 *   (they already honour that setting) and tests never depend on how long an
 *   animation takes on a busy machine.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

export { render, screen, act, waitFor } from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
