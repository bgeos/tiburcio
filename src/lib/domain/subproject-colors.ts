/**
 * Subproject colours (D-027). Validated as a colour-blind-safe set in this order, light
 * and dark. No red (it means overlap) and no orange (too close to red). Several are
 * below 3:1 on the page, so a colour always sits next to the subproject's name.
 */
export const SUBPROJECT_COLORS = ["blue", "aqua", "yellow", "magenta", "green", "violet"] as const;

export type SubprojectColor = (typeof SUBPROJECT_COLORS)[number];

export const SUBPROJECT_COLOR_LABELS: Record<SubprojectColor, string> = {
  blue: "Blue",
  aqua: "Aqua",
  yellow: "Yellow",
  magenta: "Magenta",
  green: "Green",
  violet: "Violet",
};

export function isSubprojectColor(value: unknown): value is SubprojectColor {
  return typeof value === "string" && (SUBPROJECT_COLORS as readonly string[]).includes(value);
}

/** The least-used colour in the project, earliest in the palette on a tie. */
export function nextSubprojectColor(used: SubprojectColor[]): SubprojectColor {
  const count = (c: SubprojectColor) => used.filter((u) => u === c).length;
  return SUBPROJECT_COLORS.reduce((best, c) => (count(c) < count(best) ? c : best));
}
