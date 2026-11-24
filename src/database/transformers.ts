import { ValueTransformer } from 'typeorm';

/** MySQL devuelve DECIMAL como texto; esto lo convierte a número. */
export const decimal: ValueTransformer = {
  to: (v?: number | null) => v,
  from: (v?: string | null) => (v === null || v === undefined ? v : Number(v)),
};
