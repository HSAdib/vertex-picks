/**
 * Generates a collision-safe unique ID.
 * Uses crypto.randomUUID() when available (modern browsers, Node 14+),
 * falls back to a high-entropy base-36 timestamp + random suffix.
 */
export function generateUniqueId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}
