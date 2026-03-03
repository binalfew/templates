import { Skeleton } from "~/components/ui/skeleton";

export function DesignerSkeleton() {
  return (
    <div className="-m-4 flex h-[calc(100vh-3rem)] flex-col md:-m-6">
      {/* Toolbar */}
      <div className="flex h-12 items-center gap-2 border-b bg-background px-3">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mx-1 h-5 w-px" />
        <Skeleton className="h-8 w-16 rounded-md" />
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="mx-1 h-5 w-px" />
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="mx-1 h-5 w-px" />
        <Skeleton className="h-8 w-48 rounded-md" />
        <div className="ml-auto">
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      {/* Three-panel body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Field palette */}
        <div className="flex w-[250px] shrink-0 flex-col border-r">
          <div className="border-b px-3 py-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="mt-2 h-7 w-full rounded-md" />
          </div>
          <div className="space-y-2 p-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full rounded" />
            ))}
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex flex-1 flex-col">
          <div className="flex items-center border-b bg-muted/30 px-3 py-1">
            <Skeleton className="h-6 w-16 rounded" />
            <Skeleton className="ml-2 h-6 w-16 rounded" />
            <Skeleton className="ml-2 size-5 rounded" />
          </div>
          <div className="flex-1 space-y-4 p-4">
            <SectionSkeleton />
            <SectionSkeleton />
          </div>
        </div>

        {/* Right: Properties */}
        <div className="w-[280px] shrink-0 space-y-4 border-l p-4">
          <Skeleton className="h-5 w-24" />
          <div className="space-y-3">
            <div>
              <Skeleton className="mb-1.5 h-3 w-12" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
            <div>
              <Skeleton className="mb-1.5 h-3 w-16" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
            <div>
              <Skeleton className="mb-1.5 h-3 w-14" />
              <Skeleton className="h-20 w-full rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex gap-1">
          <Skeleton className="size-5 rounded" />
          <Skeleton className="size-5 rounded" />
          <Skeleton className="size-5 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-12 gap-2 p-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="col-span-6">
            <Skeleton className="h-12 w-full rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
