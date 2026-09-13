import {
  createContext,
  useContext,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { transition } from '@/theme/motion';

/**
 * Tabs, following the WAI-ARIA tabs pattern with automatic activation.
 *
 * Only the selected tab is in the tab order; arrow keys move between tabs and
 * select as they go, Home and End jump to the ends. Panels are rendered only
 * when selected, which keeps a hidden chart from recomputing its layout.
 *
 * Intended use: Chart / Table views of the same projection, and Scenario A /
 * Scenario B on narrow screens where side-by-side does not fit.
 */

interface TabsContextValue {
  baseId: string;
  value: string;
  setValue: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs(): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) throw new Error('Tab components must be used within <Tabs>');
  return context;
}

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  children: ReactNode;
}

export function Tabs({ value, onValueChange, className, children }: TabsProps) {
  const baseId = useId();
  return (
    <TabsContext.Provider value={{ baseId, value, setValue: onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabList({
  label,
  className,
  children,
}: {
  /** Names the tab list for assistive tech. */
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const { baseId } = useTabs();

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const tabs = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])') ?? [],
    );
    const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) return;

    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    if (next === null) return;

    event.preventDefault();
    tabs[next]?.focus();
    tabs[next]?.click();
  }

  return (
    <LayoutGroup id={baseId}>
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className={cn('flex gap-1 border-b border-line', className)}
      >
        {children}
      </div>
    </LayoutGroup>
  );
}

export function Tab({
  value,
  disabled,
  className,
  children,
}: {
  value: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { baseId, value: selectedValue, setValue } = useTabs();
  const reduceMotion = useReducedMotion();
  const selected = value === selectedValue;

  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${value}`}
      aria-controls={`${baseId}-panel-${value}`}
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      onClick={() => setValue(value)}
      className={cn(
        'relative -mb-px inline-flex h-9 items-center px-3 text-[0.8125rem] font-medium',
        'transition-colors duration-100 disabled:pointer-events-none disabled:opacity-45',
        selected ? 'text-ink' : 'text-ink-subtle hover:text-ink',
        className,
      )}
    >
      {children}
      {selected ? (
        <motion.span
          layoutId="tab-indicator"
          aria-hidden="true"
          className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-ink"
          transition={reduceMotion ? { duration: 0 } : transition.fast}
        />
      ) : null}
    </button>
  );
}

export function TabPanel({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: ReactNode;
}) {
  const { baseId, value: selectedValue } = useTabs();
  if (value !== selectedValue) return null;
  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      tabIndex={0}
      className={cn('pt-4 focus-visible:outline-offset-4', className)}
    >
      {children}
    </div>
  );
}
