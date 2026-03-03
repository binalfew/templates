import { isRouteErrorResponse, useRouteError, useRevalidator } from "react-router";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

interface RouteErrorBoundaryProps {
  context?: string;
}

export function RouteErrorBoundary({ context }: RouteErrorBoundaryProps) {
  const error = useRouteError();
  const revalidator = useRevalidator();

  let title = "Something went wrong";
  let message = "An unexpected error occurred. Please try again.";
  let statusCode: number | undefined;

  if (isRouteErrorResponse(error)) {
    statusCode = error.status;
    switch (error.status) {
      case 404:
        title = "Not found";
        message = "The page you're looking for doesn't exist.";
        break;
      case 403:
        title = "Access denied";
        message = "You don't have permission to access this resource.";
        break;
      case 401:
        title = "Unauthorized";
        message = "Please log in to continue.";
        break;
      default:
        message = error.data?.message || error.statusText || message;
    }
  } else if (error instanceof Error) {
    message = error.message;
  }

  const handleRetry = () => {
    revalidator.revalidate();
  };

  return (
    <div className="flex items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>
            {statusCode && <span className="mr-2 text-muted-foreground">{statusCode}</span>}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">{message}</p>
          {context && (
            <p className="text-xs text-muted-foreground">Context: {context}</p>
          )}
          <Button
            onClick={handleRetry}
            disabled={revalidator.state === "loading"}
            className="w-full"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${revalidator.state === "loading" ? "animate-spin" : ""}`} />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
