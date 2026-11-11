"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { compareValues, type SortDirection, type SortableValue } from "@/lib/sort";
import { cn } from "@/lib/utils";

export type DataTableColumn<Row> = {
  id: string;
  header: string;
  cell: (row: Row) => React.ReactNode;
  /** Provide to make the column sortable. */
  sortValue?: (row: Row) => SortableValue;
  className?: string;
  align?: "left" | "right";
};

type SortState = { columnId: string; direction: SortDirection } | null;

/**
 * Small generic table with client-side sorting. Server-side pagination,
 * filtering and URL-synced state arrive with real data in Phase 3 (P3-07).
 */
export function DataTable<Row>({
  rows,
  columns,
  getRowId,
  caption,
  empty,
  initialSort = null,
}: {
  rows: Row[];
  columns: DataTableColumn<Row>[];
  getRowId: (row: Row) => string;
  /** Describes the table for screen readers. */
  caption: string;
  /** Rendered in place of the body when there are no rows. */
  empty: React.ReactNode;
  initialSort?: SortState;
}) {
  const [sort, setSort] = useState<SortState>(initialSort);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.id === sort.columnId);
    if (!column?.sortValue) return rows;
    const getValue = column.sortValue;
    return [...rows].sort((a, b) =>
      compareValues(getValue(a), getValue(b), sort.direction),
    );
  }, [rows, columns, sort]);

  function toggleSort(columnId: string) {
    setSort((current) => {
      if (current?.columnId !== columnId) return { columnId, direction: "asc" };
      if (current.direction === "asc") return { columnId, direction: "desc" };
      return null;
    });
  }

  if (rows.length === 0) return <>{empty}</>;

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => {
              const isSorted = sort?.columnId === column.id;
              const ariaSort = isSorted
                ? sort.direction === "asc"
                  ? "ascending"
                  : "descending"
                : column.sortValue
                  ? "none"
                  : undefined;
              const SortIcon = !isSorted
                ? ArrowUpDown
                : sort.direction === "asc"
                  ? ArrowUp
                  : ArrowDown;
              return (
                <TableHead
                  key={column.id}
                  aria-sort={ariaSort}
                  className={cn(
                    "h-10 px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase",
                    column.align === "right" && "text-right",
                    column.className,
                  )}
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.id)}
                      className={cn(
                        "-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 uppercase hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        isSorted && "text-foreground",
                      )}
                    >
                      {column.header}
                      <SortIcon aria-hidden="true" className="size-3.5" />
                    </button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row) => (
            <TableRow key={getRowId(row)}>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  className={cn(
                    "px-3 py-2.5",
                    column.align === "right" && "text-right tabular-nums",
                    column.className,
                  )}
                >
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
