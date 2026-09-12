/** Deterministic, seeded id generation so fixtures and tests are stable. */
export function createIdFactory(seed = 1) {
  let counter = seed;
  return (prefix: string): string => {
    counter += 1;
    return `${prefix}_${counter.toString(36).padStart(6, '0')}`;
  };
}

/** Random-enough client operation ids (not security tokens). */
export function newOperationId(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return `op_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}
