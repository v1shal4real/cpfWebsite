import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Buttons are neutral by design.
 *
 * The primary action is near-black ink on the light surface and near-white on
 * the dark one — no brand hue. Colour in this product belongs to the data, and
 * a saturated button competing with the chart would be the first thing to go
 * wrong in a screenshot of the tool.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-surface-inverse text-ink-inverse border border-transparent hover:opacity-90 active:opacity-80',
  secondary:
    'bg-surface text-ink border border-line-strong hover:bg-surface-2 active:bg-surface-3',
  ghost: 'bg-transparent text-ink-muted border border-transparent hover:bg-surface-2 hover:text-ink',
  link: 'bg-transparent text-accent border border-transparent underline underline-offset-2 decoration-from-font hover:text-accent-hover px-0',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-[0.8125rem] gap-1.5 rounded-sm',
  md: 'h-9.5 px-3.5 text-sm gap-2 rounded-md',
  lg: 'h-11 px-5 text-[0.9375rem] gap-2 rounded-md',
};

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders before the label. Decorative — give the button a real text label. */
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
  /** Stretches to the container width. Used in the mobile input column. */
  block?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  iconStart,
  iconEnd,
  block = false,
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-medium',
        'transition-[background-color,opacity,border-color] duration-100',
        'disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...props}
    >
      {iconStart ? (
        <span aria-hidden="true" className="shrink-0">
          {iconStart}
        </span>
      ) : null}
      {children}
      {iconEnd ? (
        <span aria-hidden="true" className="shrink-0">
          {iconEnd}
        </span>
      ) : null}
    </button>
  );
}

export interface IconButtonProps extends Omit<ButtonProps, 'iconStart' | 'iconEnd' | 'block'> {
  /**
   * Required. An icon-only control has no visible text, so the accessible name
   * has to come from here — there is no sensible default.
   */
  label: string;
}

const ICON_SIZES: Record<ButtonSize, string> = {
  sm: 'size-8 rounded-sm',
  md: 'size-9.5 rounded-md',
  lg: 'size-11 rounded-md',
};

export function IconButton({
  label,
  variant = 'ghost',
  size = 'md',
  className,
  type = 'button',
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center',
        'transition-[background-color,opacity,border-color] duration-100',
        'disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        ICON_SIZES[size],
        className,
      )}
      {...props}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
