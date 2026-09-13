import { twMerge } from 'tailwind-merge';

/**
 * Class-name joiner with Tailwind conflict resolution.
 *
 * Every component accepts a `className` that is meant to override its
 * defaults. Joining strings is not enough for that: when two utilities set the
 * same property (`inline-flex` and `hidden`), the one that wins is whichever
 * Tailwind emits later in the stylesheet, not whichever comes later in the
 * class attribute. `twMerge` drops the earlier conflicting class so the
 * caller's override actually applies.
 */
export type ClassValue = string | number | false | null | undefined | ClassValue[];

export function cn(...values: ClassValue[]): string {
  return twMerge(join(values));
}

function join(values: ClassValue[]): string {
  const out: string[] = [];
  for (const value of values) {
    if (!value && value !== 0) continue;
    if (Array.isArray(value)) {
      const nested = join(value);
      if (nested) out.push(nested);
    } else {
      out.push(String(value));
    }
  }
  return out.join(' ');
}
