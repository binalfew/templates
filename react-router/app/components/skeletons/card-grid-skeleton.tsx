import { Skeleton } from "~/components/ui/skeleton";

interface CardGridSkeletonProps {
  cards?: number;
}

export function CardGridSkeleton({ cards = 6 }: CardGridSkeletonProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-1 h-4 w-3/4" />
          <Skeleton className="mt-3 h-3 w-32" />
          <Skeleton className="mt-1 h-3 w-24" />
          <div className="mt-4 flex gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
