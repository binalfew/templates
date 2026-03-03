import { useEffect, useState } from "react";
import { Loader2, Check, X } from "lucide-react";
import { Button, type buttonVariants } from "~/components/ui/button";
import type { VariantProps } from "class-variance-authority";

type ButtonStatus = "idle" | "loading" | "success" | "error";

interface StatusButtonProps
  extends Omit<React.ComponentProps<"button">, "children">, VariantProps<typeof buttonVariants> {
  status?: ButtonStatus;
  children: React.ReactNode;
  asChild?: boolean;
}

export function StatusButton({ status = "idle", children, disabled, ...props }: StatusButtonProps) {
  const [displayStatus, setDisplayStatus] = useState<ButtonStatus>(status);

  useEffect(() => {
    setDisplayStatus(status);
    if (status === "success") {
      const timer = setTimeout(() => setDisplayStatus("idle"), 2000);
      return () => clearTimeout(timer);
    }
    if (status === "error") {
      const timer = setTimeout(() => setDisplayStatus("idle"), 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  return (
    <Button disabled={disabled || displayStatus === "loading"} {...props}>
      {displayStatus === "loading" && <Loader2 className="size-4 animate-spin" />}
      {displayStatus === "success" && <Check className="size-4" />}
      {displayStatus === "error" && <X className="size-4" />}
      {children}
    </Button>
  );
}
