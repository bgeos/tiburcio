import { z } from "zod";
import { PROJECT_STATUSES } from "@/lib/domain/projects";
import { SUBPROJECT_COLORS } from "@/lib/domain/subproject-colors";

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
  color: z.enum(SUBPROJECT_COLORS, "Choose a colour."),
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

const wholeDays = (min: number, message: string) =>
  z.coerce.number(message).int(message).min(min, message).max(3650, "Use at most 3650 days.");

/** Add or update a task. Duration and waiting days are calendar days. */
export const taskSchema = z.object({
  name: z.string().trim().min(1, "Enter a task name.").max(200, "Use at most 200 characters."),
  durationDays: wholeDays(1, "Enter a whole number of days, 1 or more."),
  delayDays: wholeDays(0, "Enter a whole number of days, 0 or more.").default(0),
  reason: z.string().trim().max(1000, "Use at most 1000 characters.").default(""),
});

export const progressSchema = z.coerce
  .number("Enter a number from 0 to 100.")
  .int("Enter a whole number from 0 to 100.")
  .min(0, "Enter a number from 0 to 100.")
  .max(100, "Enter a number from 0 to 100.");

/** A subproject material: free text, e.g. "Steel cable, 8 mm" (no units yet, D-019). */
export const materialSchema = z.object({
  description: z.string().trim().min(1, "Describe the material.").max(300, "Use at most 300 characters."),
});

/** A crew member of a subproject (people on site, not app users; D-025). */
export const crewSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(120, "Use at most 120 characters."),
  role: z.string().trim().max(80, "Use at most 80 characters.").default(""),
});

/** Milestone form (create and edit, D-030). Same limits as the milestones table. */
export const milestoneSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(120, "Use at most 120 characters."),
  date: isoDate,
});

export type MilestoneInput = z.input<typeof milestoneSchema>;
