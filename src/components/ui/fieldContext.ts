import { createContext, useContext, useId } from 'react';

/** The context `Field` provides and every input reads; see `Field.tsx`. */

export interface FieldContextValue {
  controlId: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
}

export const FieldContext = createContext<FieldContextValue | null>(null);

/**
 * Read by input components. Returns the props an input must spread onto its
 * control element to be correctly associated with the surrounding `Field`.
 */
export function useFieldControl(overrides?: {
  id?: string;
  'aria-describedby'?: string;
  required?: boolean;
}) {
  const field = useContext(FieldContext);
  const fallbackId = useId();
  const describedBy =
    [field?.describedBy, overrides?.['aria-describedby']].filter(Boolean).join(' ') || undefined;

  return {
    id: overrides?.id ?? field?.controlId ?? fallbackId,
    'aria-describedby': describedBy,
    'aria-invalid': field?.invalid ? (true as const) : undefined,
    required: overrides?.required ?? field?.required ?? false,
  };
}
