"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/dal/auth";
import { getMembership } from "@/lib/dal/organizations";
import { MY_TASK_STATUSES, type MyTaskStatus } from "@/lib/domain/my-tasks";
import { createClient } from "@/lib/supabase/server";
import { formDataToObject, parseForm, type FieldErrors } from "@/lib/validation/form";
import { myTaskSchema } from "@/lib/validation/my-tasks";

export type MyTaskFormState =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: FieldErrors; values: Record<string, string> }
  | { status: "error"; message: string; values: Record<string, string> }
  | { status: "saved"; savedAt: number };

type Result = { ok: true } | { ok: false; message: string };

const NOT_A_MEMBER = "You're no longer a member of this organization.";
const GONE = "This task no longer exists.";

// Any member (external collaborators too) keeps their own tasks. RLS limits every
// read and write to the person's own rows, so an id from someone else matches nothing.

export async function createMyTask(orgSlug: string, _previous: MyTaskFormState, formData: FormData): Promise<MyTaskFormState> {
  const parsed = parseForm(myTaskSchema, formData);
  if (!parsed.success) return { status: "invalid", fieldErrors: parsed.fieldErrors, values: parsed.values };
  const values = formDataToObject(formData);

  await requireUser();
  const org = await getMembership(orgSlug);
  if (!org) return { status: "error", message: NOT_A_MEMBER, values };

  const supabase = await createClient();
  const { dueDate, ...rest } = parsed.data;
  const { error } = await supabase.from("personal_tasks").insert({ organization_id: org.id, ...rest, due_date: dueDate });
  if (error) return { status: "error", message: "Couldn't add the task. Try again.", values };
  refresh();
  return { status: "saved", savedAt: Date.now() };
}

export async function updateMyTask(
  orgSlug: string,
  taskId: string,
  _previous: MyTaskFormState,
  formData: FormData,
): Promise<MyTaskFormState> {
  const parsed = parseForm(myTaskSchema, formData);
  if (!parsed.success) return { status: "invalid", fieldErrors: parsed.fieldErrors, values: parsed.values };
  const values = formDataToObject(formData);

  await requireUser();
  const org = await getMembership(orgSlug);
  if (!org) return { status: "error", message: NOT_A_MEMBER, values };

  const supabase = await createClient();
  const { dueDate, ...rest } = parsed.data;
  const { data, error } = await supabase
    .from("personal_tasks")
    .update({ ...rest, due_date: dueDate })
    .eq("id", taskId)
    .eq("organization_id", org.id)
    .select("id");
  if (error) return { status: "error", message: "Couldn't save the task. Try again.", values };
  if (data.length === 0) return { status: "error", message: GONE, values };
  refresh();
  return { status: "saved", savedAt: Date.now() };
}

export async function setMyTaskStatus(orgSlug: string, taskId: string, status: MyTaskStatus): Promise<Result> {
  if (!(MY_TASK_STATUSES as readonly string[]).includes(status)) return { ok: false, message: "Choose a status." };
  await requireUser();
  const org = await getMembership(orgSlug);
  if (!org) return { ok: false, message: NOT_A_MEMBER };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("personal_tasks")
    .update({ status })
    .eq("id", taskId)
    .eq("organization_id", org.id)
    .select("id");
  if (error) return { ok: false, message: "Couldn't change the status. Try again." };
  if (data.length === 0) return { ok: false, message: GONE };
  refresh();
  return { ok: true };
}

/** Personal tasks aren't part of any plan or history, so removing one deletes it. */
export async function deleteMyTask(orgSlug: string, taskId: string): Promise<Result> {
  await requireUser();
  const org = await getMembership(orgSlug);
  if (!org) return { ok: false, message: NOT_A_MEMBER };

  const supabase = await createClient();
  const { error } = await supabase.from("personal_tasks").delete().eq("id", taskId).eq("organization_id", org.id);
  if (error) return { ok: false, message: "Couldn't delete the task. Try again." };
  refresh();
  return { ok: true };
}
