import { Skeleton } from "~/components/ui/skeleton";
import { Separator } from "~/components/ui/separator";

export function FormSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      <Separator />

      {/* Section: Basic Information */}
      <div className="space-y-4">
        <Skeleton className="h-5 w-36" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
        <FieldSkeleton wide />
      </div>

      <Separator />

      {/* Section: Type */}
      <div className="space-y-4">
        <Skeleton className="h-5 w-24" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
      </div>

      <Separator />

      {/* Section: Constraints */}
      <div className="space-y-4">
        <Skeleton className="h-5 w-28" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ToggleSkeleton />
          <ToggleSkeleton />
          <ToggleSkeleton />
          <ToggleSkeleton />
        </div>
      </div>

      <Separator />

      {/* Actions */}
      <div className="flex gap-3">
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-9 w-20 rounded-md" />
      </div>
    </div>
  );
}

function FieldSkeleton({ wide }: { wide?: boolean }) {
  return (
    <div className={wide ? "col-span-full" : ""}>
      <Skeleton className="mb-1.5 h-4 w-20" />
      <Skeleton className="h-9 w-full rounded-md" />
    </div>
  );
}

function ToggleSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-5 w-9 rounded-full" />
    </div>
  );
}
