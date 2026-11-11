import type { IsoDate } from "./schedule";
import type { StatusCategory } from "./status";

/** Request flow of a subproject material (subproject_materials.status, D-019). */
export const MATERIAL_STATUSES = ["to_request", "requested", "ready_at_warehouse", "on_site"] as const;

export type MaterialStatus = (typeof MATERIAL_STATUSES)[number];

export const MATERIAL_STATUS_LABELS: Record<MaterialStatus, string> = {
  to_request: "To request",
  requested: "Requested",
  ready_at_warehouse: "Ready at warehouse",
  on_site: "On site",
};

/** Drives the badge icon and colour; the label stays the material status. */
export const MATERIAL_STATUS_CATEGORY: Record<MaterialStatus, StatusCategory> = {
  to_request: "todo",
  requested: "in_progress",
  ready_at_warehouse: "in_progress",
  on_site: "done",
};

/** Late: it was needed by a day that has passed and still isn't on site. */
export function isMaterialLate(material: { status: MaterialStatus; neededBy: IsoDate | null }, today: IsoDate): boolean {
  return material.neededBy !== null && material.neededBy < today && material.status !== "on_site";
}
