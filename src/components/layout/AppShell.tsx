import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { RulesStamp } from './RulesStamp';
import { ThemeToggle } from './ThemeToggle';

/**
 * Page chrome: skip link, header, main landmark, footer.
 *
 * The header carries the rules-as-at stamp so it is on every view. The footer
 * carries the framing statement. Neither is optional, which is why they live in
 * the shell and not on individual pages.
 */

export function Container({
  size = 'wide',
  className,
  ...props
}: ComponentPropsWithRef<'div'> & { size?: 'narrow' | 'wide' }) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 sm:px-6',
        size === 'wide' ? 'max-w-7xl' : 'max-w-3xl',
        className,
      )}
      {...props}
    />
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className={cn(
          'sr-only-abs focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100]',
          'focus:h-auto focus:w-auto focus:rounded-md focus:bg-surface-inverse focus:px-3 focus:py-2',
          'focus:text-sm focus:font-medium focus:text-ink-inverse focus:[clip-path:none]',
        )}
      >
        Skip to projection
      </a>

      <Header />

      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>

      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
      <Container className="flex h-14 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-inverse">
            <LogoMark />
          </span>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold text-ink">CPF Projection</span>
            <span className="hidden truncate text-[0.6875rem] text-ink-subtle sm:block">
              An illustrative calculation, not advice
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <RulesStamp compact className="hidden md:inline-flex" />
          <ThemeToggle />
        </div>
      </Container>
      {/* Below md, the stamp gets its own row rather than disappearing. */}
      <Container className="flex h-8 items-center border-t border-line md:hidden">
        <RulesStamp compact />
      </Container>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <Container className="flex flex-col gap-3 py-6 text-[0.75rem] leading-relaxed text-ink-subtle sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-2xl">
          This tool produces projections, not advice. Every figure is an illustrative calculation
          based on published CPF Board parameters and the inputs you provide. It makes no
          recommendation and suggests no course of action. Rules change; check the current figures
          with CPF Board before relying on any of them.
        </p>
        <RulesStamp className="shrink-0" />
      </Container>
    </footer>
  );
}

function LogoMark() {
  // Four stacked bars in the four account hues: a quiet nod to the chart, and
  // the only place the series colours appear outside of data.
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect x="1" y="7" width="2.25" height="6" rx="0.6" fill="var(--series-oa)" />
      <rect x="4.25" y="4" width="2.25" height="9" rx="0.6" fill="var(--series-sa)" />
      <rect x="7.5" y="5.5" width="2.25" height="7.5" rx="0.6" fill="var(--series-ma)" />
      <rect x="10.75" y="1" width="2.25" height="12" rx="0.6" fill="var(--series-ra)" />
    </svg>
  );
}
