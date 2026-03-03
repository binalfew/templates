import { Skeleton } from "~/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-card p-6 shadow">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-3 h-8 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
