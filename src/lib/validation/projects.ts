import { z } from "zod";
import { PROJECT_STATUSES } from "@/lib/domain/projects";

/** Project form (create and edit). Same limits as the projects table. */
export const projectSchema = z.object({
  name: z.string().trim().min(1, "Enter a project name.").max(120, "Use at most 120 characters."),
  description: z.string().trim().max(2000, "Use at most 2000 characters.").default(""),
  status: z.enum(PROJECT_STATUSES, "Choose a status."),
});

export type ProjectInput = z.input<typeof projectSchema>;

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v), "Choose a valid date.");

/** Subproject form (create and edit). The reason is saved in the history. */
export const subprojectSchema = z.object({
  name: z.string().trim().min(1, "Enter a subproject name.").max(120, "Use at most 120 characters."),
  startDate: isoDate,
  reason: z.string().trim().max(1000, "Use at most 1000 characters.").default(""),
});

export type SubprojectInput = z.input<typeof subprojectSchema>;

/** "successor starts after predecessor finishes". */
export const dependencySchema = z
  .object({
    successorId: z.uuid("Choose a subproject."),
    predecessorId: z.uuid("Choose a subproject."),
  })
  .refine((v) => v.successorId !== v.predecessorId, {
    path: ["predecessorId"],
    message: "A subproject can't wait for itself.",
  });
