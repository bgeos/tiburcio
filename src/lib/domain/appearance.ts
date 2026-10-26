/**
 * Personal appearance (D-027): a theme colour and light/dark mode per person.
 * Same choices as the database checks on profiles. There is no red: red means overlap.
 */
export const ACCENT_COLORS = ["green", "teal", "blue", "violet", "pink", "slate"] as const;

export type AccentColor = (typeof ACCENT_COLORS)[number];

export const ACCENT_LABELS: Record<AccentColor, string> = {
  green: "Green",
  teal: "Teal",
  blue: "Blue",
  violet: "Violet",
  pink: "Pink",
  slate: "Slate",
};

export const DEFAULT_ACCENT: AccentColor = "green";

export const THEME_MODES = ["system", "light", "dark"] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

export const THEME_MODE_LABELS: Record<ThemeMode, string> = {
  system: "Device",
  light: "Light",
  dark: "Dark",
};

/** Browser storage key: lets the page paint in the person's colour before it loads their profile. */
export const ACCENT_STORAGE_KEY = "jupigenio-accent";

export function isAccentColor(value: unknown): value is AccentColor {
  return typeof value === "string" && (ACCENT_COLORS as readonly string[]).includes(value);
}
