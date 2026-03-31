function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function stableHash(parts: Array<string | number | null | undefined>): string {
  return fnv1a32(parts.map((part) => String(part ?? "")).join("|"));
}

