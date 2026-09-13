/**
 * Shared Recharts styling.
 *
 * Every value is a CSS custom property, so a chart follows a theme change
 * without re-rendering. Chart furniture is recessive by rule: thin axis, faint
 * grid, no tick marks, muted tick text. The data marks are the only saturated
 * things in the plot.
 */

export const CHART_FONT_SIZE = 11;

export const axisTick = {
  fill: 'var(--ink-subtle)',
  fontSize: CHART_FONT_SIZE,
} as const;

export const axisLine = { stroke: 'var(--axis)', strokeWidth: 1 } as const;

export const gridProps = {
  stroke: 'var(--grid)',
  strokeDasharray: '0',
  vertical: false,
} as const;

/** The crosshair drawn under the pointer on line and area charts. */
export const cursorProps = { stroke: 'var(--line-strong)', strokeWidth: 1 } as const;

/** Line marks are 2px. Thicker lines read as emphasis and flatten the hierarchy. */
export const LINE_WIDTH = 2;

/** Hover marker: at least 8px across, with a surface ring so it lifts off crossing lines. */
export const activeDotProps = {
  r: 4.5,
  strokeWidth: 2,
  stroke: 'var(--surface)',
} as const;

/** Chart margins that leave room for the y-axis tick labels at 360px. */
export const chartMargin = { top: 8, right: 12, bottom: 4, left: 0 } as const;

/** Width reserved for compact currency ticks such as "$1.2M". */
export const Y_AXIS_WIDTH = 52;

/** Reference-line styling for events such as the age-55 transition. */
export const referenceLineProps = {
  stroke: 'var(--ink-subtle)',
  strokeWidth: 1,
  strokeDasharray: '3 3',
} as const;
