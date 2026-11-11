"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/dal/auth";
import { THEME_MODES, type ThemeMode } from "@/lib/domain/appearance";
import { createClient } from "@/lib/supabase/server";
import { formDataToObject, parseForm, type FieldErrors } from "@/lib/validation/form";
import { profileSchema } from "@/lib/validation/profile";

export type ProfileFormState =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: FieldErrors; values: Record<string, string> }
  | { status: "error"; message: string; values: Record<string, string> }
  | { status: "saved"; savedAt: number };

const SIGNED_OUT = "Your session has ended. Sign in again.";

/** Save the signed-in person's own name and appearance. RLS limits the update to their row. */
export async function updateProfile(_previous: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const parsed = parseForm(profileSchema, formData);
  if (!parsed.success) return { status: "invalid", fieldErrors: parsed.fieldErrors, values: parsed.values };
  const values = formDataToObject(formData);

  const user = await getCurrentUser();
  if (!user) return { status: "error", message: SIGNED_OUT, values };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, accent_color: parsed.data.accentColor, theme_mode: parsed.data.themeMode })
    .eq("id", user.id);
  if (error) return { status: "error", message: "Couldn't save your profile. Try again.", values };

  refresh();
  return { status: "saved", savedAt: Date.now() };
}

/** The top bar's light/dark switch: remembered on the profile, so every device follows it. */
export async function saveThemeMode(mode: ThemeMode): Promise<{ ok: boolean }> {
  if (!(THEME_MODES as readonly string[]).includes(mode)) return { ok: false };
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ theme_mode: mode }).eq("id", user.id);
  return { ok: !error };
}
