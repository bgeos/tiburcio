import "server-only";
import { sortMyTasks, type MyTask, type MyTaskStatus, type MyTaskTag } from "@/lib/domain/my-tasks";
import { createClient } from "@/lib/supabase/server";
import type { Membership } from "./organizations";

type Row = { id: string; name: string; description: string; status: MyTaskStatus; tag: MyTaskTag; created_at: string };

/** The signed-in person's own tasks in this organization (RLS: nobody else's). */
export async function listMyTasks(org: Membership): Promise<MyTask[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("personal_tasks")
    .select("id, name, description, status, tag, created_at")
    .eq("organization_id", org.id)
    .returns<Row[]>();
  if (error) throw new Error(`Could not load your tasks: ${error.message}`);
  return sortMyTasks(
    data.map((r) => ({ id: r.id, name: r.name, description: r.description, status: r.status, tag: r.tag, createdAt: r.created_at })),
  );
}
