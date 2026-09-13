import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useTheme, type ThemePreference } from '@/theme/ThemeProvider';

/** Light / System / Dark. Icons are labelled for assistive tech via `srLabel`. */
export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();

  return (
    <SegmentedControl<ThemePreference>
      label="Colour theme"
      size="sm"
      value={preference}
      onValueChange={setPreference}
      className={className}
      options={[
        { value: 'light', srLabel: 'Light', label: <SunIcon /> },
        { value: 'system', srLabel: 'Match system', label: <MonitorIcon /> },
        { value: 'dark', srLabel: 'Dark', label: <MoonIcon /> },
      ]}
    />
  );
}

const iconProps = {
  width: 14,
  height: 14,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

function SunIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.4 3.4l.85.85M11.75 11.75l.85.85M3.4 12.6l.85-.85M11.75 4.25l.85-.85" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg {...iconProps}>
      <rect x="1.75" y="2.5" width="12.5" height="8.5" rx="1.25" />
      <path d="M5.5 14h5M8 11v3" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg {...iconProps}>
      <path d="M13.5 9.6A5.75 5.75 0 0 1 6.4 2.5a5.75 5.75 0 1 0 7.1 7.1Z" />
    </svg>
  );
}
