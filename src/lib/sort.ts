export type SortDirection = "asc" | "desc";

export type SortableValue = string | number | Date | null | undefined;

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function isEmpty(value: SortableValue): value is null | undefined | "" {
  return value === null || value === undefined || value === "";
}

/**
 * Compare two cell values for table sorting.
 *
 * - Empty values (null, undefined, "") always sort last, in both directions,
 *   so "no due date" never floats to the top of a list.
 * - Strings compare accent- and case-insensitively with numeric awareness
 *   ("Área 2" < "area 10"), which matters for Portuguese names.
 * - Dates compare chronologically; numbers numerically.
 */
export function compareValues(
  a: SortableValue,
  b: SortableValue,
  direction: SortDirection = "asc",
): number {
  const aEmpty = isEmpty(a);
  const bEmpty = isEmpty(b);
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  let result: number;
  if (a instanceof Date && b instanceof Date) {
    result = a.getTime() - b.getTime();
  } else if (typeof a === "number" && typeof b === "number") {
    result = a - b;
  } else {
    result = collator.compare(String(a), String(b));
  }

  if (result === 0) return 0;
  return direction === "asc" ? Math.sign(result) : -Math.sign(result);
}
