import { z } from "zod";
import { ACCENT_COLORS, THEME_MODES } from "@/lib/domain/appearance";

/** Profile form (D-027). Same limits as the profiles table. */
export const profileSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name.").max(120, "Use at most 120 characters."),
  accentColor: z.enum(ACCENT_COLORS, "Choose a theme colour."),
  themeMode: z.enum(THEME_MODES, "Choose light, dark or device."),
});

export type ProfileInput = z.input<typeof profileSchema>;
