import { z } from "zod";
import { ORG_SLUG_PATTERN, RESERVED_ORG_SLUGS } from "@/lib/domain/organizations";

/** New organization form. Same limits as the organizations table. */
export const organizationSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(100, "Use at most 100 characters."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Use at least 2 characters.")
    .max(50, "Use at most 50 characters.")
    .regex(ORG_SLUG_PATTERN, "Use lowercase letters, numbers and single hyphens, e.g. summer-fest-2027.")
    .refine((slug) => !RESERVED_ORG_SLUGS.includes(slug), "This address is used by the app. Choose another."),
});

export type OrganizationInput = z.input<typeof organizationSchema>;
