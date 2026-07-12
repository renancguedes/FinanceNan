import type { ZodTypeAny, output } from "zod";
import { UnprocessableEntity } from "./errors.js";

/** Validate `data` against `schema`, returning the parsed OUTPUT type
 *  (defaults applied, refinements enforced). Throws 422 on failure. */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): output<S> {
  const result = schema.safeParse(data);
  if (!result.success) throw UnprocessableEntity("Validation failed", result.error.flatten());
  return result.data;
}
