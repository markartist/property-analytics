/** Generate a new random UUID. */
export function newId(): string {
  return crypto.randomUUID();
}
