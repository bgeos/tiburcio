import { StatusBadge } from "@/components/status-badge";
import { MATERIAL_STATUS_CATEGORY, MATERIAL_STATUS_LABELS, type MaterialStatus } from "@/lib/domain/materials";

/** "To request" → "Requested" → "Ready at warehouse" → "On site": icon + text + colour. */
export function MaterialStatusBadge({ status }: { status: MaterialStatus }) {
  return <StatusBadge category={MATERIAL_STATUS_CATEGORY[status]} label={MATERIAL_STATUS_LABELS[status]} />;
}
