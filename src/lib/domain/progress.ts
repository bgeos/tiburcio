import type { StatusCategory } from "./status";

/**
 * Progress rule (docs/DECISIONS.md D-007, DATA_MODEL): every task counts
 * equally. Done = 100, cancelled is left out, otherwise the manual 0–100
 * value (not set = 0). Nothing to count → null ("—", never a fake 0%).
 */
export type ProgressItem = { status: StatusCategory; progress: number | null };

export function itemProgress(item: ProgressItem): number | null {
  if (item.status === "cancelled") return null;
  if (item.status === "done") return 100;
  return Math.min(100, Math.max(0, item.progress ?? 0));
}

export function rollupProgress(items: ProgressItem[]): number | null {
  const values = items.map(itemProgress).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
