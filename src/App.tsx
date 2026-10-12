import { Suspense, lazy, useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { currentMonth } from '@/lib/clock';
import { defaultDraft } from '@/pages/projection/defaults';
import { ProjectionPage } from '@/pages/ProjectionPage';
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
  // The month the projection starts from: read once, here, never in the engine.
  // TODO: the input panel ticket turns this into editable state.
  const draft = useMemo(() => defaultDraft(currentMonth()), []);

  return (
    <AppShell>
      {route === 'design-system' && DesignSystemPage ? (
        <Suspense fallback={null}>
          <DesignSystemPage />
        </Suspense>
      ) : (
        <ProjectionPage draft={draft} />
      )}
    </AppShell>
  );
}
