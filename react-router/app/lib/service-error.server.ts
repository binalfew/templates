export class ServiceError extends Error {
  constructor(
    message: string,
    public status: number = 400,
    public code?: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
