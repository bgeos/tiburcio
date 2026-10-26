import { z } from "zod";

export type FieldErrors = Record<string, string[] | undefined>;

export type FormState<T> =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: FieldErrors; values: Partial<Record<keyof T, string>> }
  | { status: "error"; message: string; values: Partial<Record<keyof T, string>> }
  | { status: "success"; message: string };

/** Read the string entries of a FormData into a plain object. */
export function formDataToObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") result[key] = value;
  }
  return result;
}

/**
 * Validate FormData against a Zod schema. Used identically by client-side
 * form handlers and server actions so both report the same messages.
 */
export function parseForm<Schema extends z.ZodType>(
  schema: Schema,
  formData: FormData,
):
  | { success: true; data: z.infer<Schema> }
  | { success: false; fieldErrors: FieldErrors; values: Record<string, string> } {
  const values = formDataToObject(formData);
  const result = schema.safeParse(values);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    fieldErrors: z.flattenError(result.error).fieldErrors as FieldErrors,
    values,
  };
}
