"use client";

import { useId } from "react";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type BaseProps = {
  name: string;
  label: string;
  description?: string;
  /** Validation messages for this field (from Zod `flattenError`). */
  errors?: string[];
  required?: boolean;
};

function useFieldIds(name: string) {
  const id = `${name}-${useId()}`;
  return { id, descriptionId: `${id}-description`, errorId: `${id}-error` };
}

function describedBy(ids: string[], hasDescription: boolean, hasError: boolean) {
  const [descriptionId, errorId] = ids;
  return (
    [hasDescription && descriptionId, hasError && errorId].filter(Boolean).join(" ") ||
    undefined
  );
}

/**
 * Labelled text input wired for accessibility: label ↔ input, description
 * and error linked via aria-describedby, aria-invalid on error.
 */
export function TextField({
  name,
  label,
  description,
  errors,
  required,
  ...inputProps
}: BaseProps & Omit<React.ComponentProps<typeof Input>, "name" | "id">) {
  const { id, descriptionId, errorId } = useFieldIds(name);
  const hasError = Boolean(errors?.length);

  return (
    <Field data-invalid={hasError || undefined}>
      <FieldLabel htmlFor={id}>
        {label}
        {required ? <span className="text-destructive" aria-hidden="true">*</span> : null}
      </FieldLabel>
      <Input
        id={id}
        name={name}
        required={required}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy([descriptionId, errorId], Boolean(description), hasError)}
        {...inputProps}
      />
      {description ? <FieldDescription id={descriptionId}>{description}</FieldDescription> : null}
      <FieldError id={errorId} errors={errors?.map((message) => ({ message }))} />
    </Field>
  );
}

export function TextareaField({
  name,
  label,
  description,
  errors,
  required,
  ...textareaProps
}: BaseProps & Omit<React.ComponentProps<typeof Textarea>, "name" | "id">) {
  const { id, descriptionId, errorId } = useFieldIds(name);
  const hasError = Boolean(errors?.length);

  return (
    <Field data-invalid={hasError || undefined}>
      <FieldLabel htmlFor={id}>
        {label}
        {required ? <span className="text-destructive" aria-hidden="true">*</span> : null}
      </FieldLabel>
      <Textarea
        id={id}
        name={name}
        required={required}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy([descriptionId, errorId], Boolean(description), hasError)}
        {...textareaProps}
      />
      {description ? <FieldDescription id={descriptionId}>{description}</FieldDescription> : null}
      <FieldError id={errorId} errors={errors?.map((message) => ({ message }))} />
    </Field>
  );
}
