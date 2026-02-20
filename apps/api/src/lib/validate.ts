/**
 * Runtime validation helpers.
 * Friday enforcement is a hard validation error per ADR-0002 and 01_System_Contract.md.
 */

/** Check if a YYYY-MM-DD string falls on a Friday. */
export function isFriday(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  return new Date(dateStr + "T00:00:00Z").getUTCDay() === 5;
}

/** Throw if date is not a Friday. Hard validation error per ADR-0002. */
export function assertFriday(dateStr: string, fieldName: string): void {
  if (!isFriday(dateStr)) {
    throw new AppError(400, "VALIDATION_ERROR", `${fieldName} must be a Friday (ADR-0002)`);
  }
}

/** Current UTC timestamp in ISO format. */
export function nowISO(): string {
  return new Date().toISOString();
}

/** Build consistent error JSON per 06_API_Contract.md. */
export function errJson(code: string, message: string, details: unknown[] = []) {
  return { error: { code, message, details } };
}

/** Structured application error that handlers can catch. */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: unknown[] = []
  ) {
    super(message);
  }

  toJSON() {
    return { error: { code: this.code, message: this.message, details: this.details } };
  }
}

/** Email regex for mention scanning. */
export const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
