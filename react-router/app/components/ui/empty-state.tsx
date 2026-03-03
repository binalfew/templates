import type { LucideIcon } from "lucide-react";
import { cn } from "~/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("rounded-lg border border-dashed p-12 text-center", className)}>
      {Icon && <Icon className="mx-auto mb-3 size-10 text-muted-foreground/40" />}
      <p className="font-medium text-muted-foreground">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
