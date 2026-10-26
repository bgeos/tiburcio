import { z } from "zod";
import { PROJECT_STATUSES } from "@/lib/domain/projects";

/** Project form (create and edit). Same limits as the projects table. */
export const projectSchema = z.object({
  name: z.string().trim().min(1, "Enter a project name.").max(120, "Use at most 120 characters."),
  description: z.string().trim().max(2000, "Use at most 2000 characters.").default(""),
  status: z.enum(PROJECT_STATUSES, "Choose a status."),
});

export type ProjectInput = z.input<typeof projectSchema>;
