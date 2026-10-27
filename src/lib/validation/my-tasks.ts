import { z } from "zod";
import { MY_TASK_STATUSES, MY_TASK_TAGS } from "@/lib/domain/my-tasks";

/** My task form (create and edit). Same limits as the personal_tasks table. */
export const myTaskSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(200, "Use at most 200 characters."),
  description: z.string().trim().max(2000, "Use at most 2000 characters.").default(""),
  status: z.enum(MY_TASK_STATUSES, "Choose a status."),
  tag: z.enum(MY_TASK_TAGS, "Choose a tag."),
});

export type MyTaskInput = z.input<typeof myTaskSchema>;
