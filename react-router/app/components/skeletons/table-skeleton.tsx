import { Skeleton } from "~/components/ui/skeleton";

interface TableSkeletonProps {
  columns: number;
  rows?: number;
  /** Column width classes (Tailwind), e.g. ["w-[200px]", "w-[80px]", ...] */
  columnWidths?: string[];
}

export function TableSkeleton({ columns, rows = 6, columnWidths }: TableSkeletonProps) {
  return (
    <div className="rounded-lg border bg-card">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-2">
                <Skeleton className={`h-3 ${columnWidths?.[i] ?? "w-20"}`} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx} className="border-b last:border-0">
              {Array.from({ length: columns }).map((_, colIdx) => (
                <td key={colIdx} className="px-4 py-3">
                  <Skeleton className={`h-4 ${columnWidths?.[colIdx] ?? "w-24"}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
