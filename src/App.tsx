import { Suspense, lazy, useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { currentMonth } from '@/lib/clock';
import { ProjectionPage } from '@/pages/ProjectionPage';
import { decodeUrlState } from '@/pages/projection/urlState';
import { ruleSetById } from '@/rules';
import { routeFor } from '@/routes';

/**
 * The design system preview, in development builds only. `import.meta.env.DEV`
 * is `false` in production, so the branch, the dynamic import and the page
 * itself are removed from the bundle.
 */
const DesignSystemPage = import.meta.env.DEV
  ? lazy(() => import('@/pages/DesignSystemPage').then((module) => ({ default: module.DesignSystemPage })))
  : null;

export function App() {
  const route = routeFor(window.location.pathname, import.meta.env.DEV);
  // A shared link carries its own state, start month and rule set; a bare URL
  // starts this month on the defaults. Read once, here: the clock is never
  // read in the engine.
  const link = useMemo(() => decodeUrlState(window.location.search, { startMonth: currentMonth() }), []);

  return (
    <AppShell ruleSet={route === 'projection' ? ruleSetById(link.state.rulesAsAt) : undefined}>
      {route === 'design-system' && DesignSystemPage ? (
        <Suspense fallback={null}>
          <DesignSystemPage />
        </Suspense>
      ) : (
        <ProjectionPage
          startMonth={link.state.startMonth}
          initialForm={link.state.form}
          rulesAsAt={link.state.rulesAsAt}
          linkNotices={link.notices}
        />
      )}
    </AppShell>
  );
}
