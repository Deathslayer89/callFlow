export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const NotFound = (resource: string, id?: string) =>
  new AppError(404, `${resource.toUpperCase()}_NOT_FOUND`, id ? `${resource} ${id} not found` : `${resource} not found`);
