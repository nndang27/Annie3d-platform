import { uuidv7 } from 'uuidv7';

/**
 * Client-generated, time-ordered ids (UUIDv7, RFC 9562).
 * Why: records can be created offline and optimistically without a server round trip
 * (Figma: "How Figma's multiplayer technology works"), and v7's time prefix keeps B-tree
 * inserts append-mostly in Postgres (RFC 9562 §5.7; Postgres 18 ships uuidv7()).
 */
export function newId(): string {
  return uuidv7();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}
