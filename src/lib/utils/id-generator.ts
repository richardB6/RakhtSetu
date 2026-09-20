/**
 * Generate a unique emergency request ID.
 * Format: RS-YYYY-NNNNNN (e.g., RS-2026-004821)
 */

let counter = 0;

export function generateRequestId(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now();
  counter = (counter + 1) % 999999;
  const seq = String(timestamp % 100000 + counter).padStart(6, '0');
  return `RS-${year}-${seq}`;
}

/**
 * Generate a short unique ID for notifications, matches, etc.
 */
export function generateShortId(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}
