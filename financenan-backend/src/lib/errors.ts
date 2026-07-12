export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = "APP_ERROR",
    public details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const BadRequest = (m: string, d?: unknown) => new AppError(400, m, "BAD_REQUEST", d);
export const Unauthorized = (m = "Unauthorized") => new AppError(401, m, "UNAUTHORIZED");
export const Forbidden = (m = "Forbidden") => new AppError(403, m, "FORBIDDEN");
export const NotFound = (m = "Not found") => new AppError(404, m, "NOT_FOUND");
export const Conflict = (m: string) => new AppError(409, m, "CONFLICT");
export const UnprocessableEntity = (m: string, d?: unknown) => new AppError(422, m, "UNPROCESSABLE", d);
