import { describe, expect, it } from 'vitest';
import { DESIGN_SYSTEM_PATH, routeFor } from './routes';

describe('routes', () => {
  it('lands on the projection, whatever the path', () => {
    for (const path of ['/', '', '/anything', '/?age=30', '/design', '/design-system/extra']) {
      expect(routeFor(path, false), path).toBe('projection');
      expect(routeFor(path, true), path).toBe('projection');
    }
  });

  it('serves the design system preview in development only', () => {
    expect(routeFor(DESIGN_SYSTEM_PATH, true)).toBe('design-system');
    expect(routeFor(`${DESIGN_SYSTEM_PATH}/`, true)).toBe('design-system');
    expect(routeFor(DESIGN_SYSTEM_PATH, false)).toBe('projection');
  });
});
