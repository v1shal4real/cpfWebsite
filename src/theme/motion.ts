import type { Transition, Variants } from 'framer-motion';

/**
 * Motion tokens.
 *
 * The spec's rule for animation is that motion carries the comparison rather
 * than decorating it: when a scenario changes, the eye should be able to track
 * which curve moved and by how much. That means short, unidirectional,
 * interruptible transitions — never a bounce, never a stagger long enough to
 * outlive a user's attention on a number.
 *
 * Every consumer must respect `prefers-reduced-motion`. Use `useReducedMotion`
 * from framer-motion and fall back to `instant` below.
 */

export const duration = {
  /** Hover, focus, colour. Barely perceptible. */
  instant: 0.08,
  /** Disclosure open/close, tooltip in. */
  fast: 0.16,
  /** Panel transitions, tab content. */
  base: 0.24,
  /** Chart series re-draw between scenarios. Long enough to follow a curve. */
  slow: 0.4,
} as const;

export const easing = {
  /** Decelerating. The default for anything entering. */
  out: [0.22, 1, 0.36, 1],
  /** Symmetrical. For anything that moves between two known states. */
  inOut: [0.65, 0, 0.35, 1],
} as const;

export const transition = {
  instant: { duration: duration.instant, ease: easing.out },
  fast: { duration: duration.fast, ease: easing.out },
  base: { duration: duration.base, ease: easing.out },
  slow: { duration: duration.slow, ease: easing.inOut },
  /** Used where a value is being re-settled rather than moved, e.g. a stat tile. */
  spring: { type: 'spring', stiffness: 380, damping: 34, mass: 0.9 },
} satisfies Record<string, Transition>;

/** Standard enter/exit for panels, popovers and disclosure bodies. */
export const fadeSlide: Variants = {
  hidden: { opacity: 0, y: -4 },
  visible: { opacity: 1, y: 0, transition: transition.fast },
  exit: { opacity: 0, y: -4, transition: transition.instant },
};

/** Height animation for a disclosure. Pair with `overflow: hidden`. */
export const collapse: Variants = {
  hidden: { height: 0, opacity: 0, transition: transition.fast },
  visible: { height: 'auto', opacity: 1, transition: transition.base },
};
