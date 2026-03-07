import { Form } from "react-router";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "~/components/ui/button";

interface ImpersonationBannerProps {
  impersonatedUserName: string;
}

export function ImpersonationBanner({ impersonatedUserName }: ImpersonationBannerProps) {
  return (
    <div className="bg-yellow-500 text-yellow-950 px-4 py-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="text-sm font-medium">
            You are impersonating <strong>{impersonatedUserName}</strong>
          </span>
        </div>
        <Form method="post" action="/resources/impersonate">
          <input type="hidden" name="_action" value="stop" />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="w-full sm:w-auto bg-yellow-600 border-yellow-700 text-yellow-950 hover:bg-yellow-700"
          >
            <X className="size-3.5 mr-1" />
            Exit Impersonation
          </Button>
        </Form>
      </div>
    </div>
  );
}
