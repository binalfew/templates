import { data } from "react-router";
import { ServiceError } from "~/utils/errors/service-error.server";

export function handleServiceError(
  error: unknown,
  options: { submission: { reply: (opts?: { formErrors?: string[] }) => unknown } },
): ReturnType<typeof data<{ result: unknown }>>;
export function handleServiceError(error: unknown): ReturnType<typeof data<{ error: string }>>;
export function handleServiceError(
  error: unknown,
  options?: { submission: { reply: (opts?: { formErrors?: string[] }) => unknown } },
) {
  if (error instanceof ServiceError) {
    if (options?.submission) {
      return data(
        { result: options.submission.reply({ formErrors: [error.message] }) },
        { status: error.status },
      );
    }
    // Include currentResource for optimistic lock conflict errors
    const response: Record<string, unknown> = { error: error.message };
    if ("currentResource" in error && error.currentResource) {
      response.currentResource = error.currentResource;
    }
    return data(response, { status: error.status });
  }
  throw error;
}
