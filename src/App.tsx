import { AppShell } from '@/components/layout/AppShell';
import { DesignSystemPage } from '@/pages/DesignSystemPage';

/**
 * Until the projection engine and its page exist, the app renders the design
 * system preview. Swap this for the projection page when it lands.
 */
export function App() {
  return (
    <AppShell>
      <DesignSystemPage />
    </AppShell>
  );
}
