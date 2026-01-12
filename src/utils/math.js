/**
 * Math utility functions
 */

/**
 * Clamps a value between a minimum and maximum
 * @param {number} v - Value to clamp
 * @param {number} a - Minimum value
 * @param {number} b - Maximum value
 * @returns {number} Clamped value
 */
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * Linear interpolation between two values
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Interpolated value
 */
export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Random number between a and b
 * @param {number} a - Minimum value
 * @param {number} b - Maximum value
 * @returns {number} Random value
 */
export const rand = (a, b) => a + Math.random() * (b - a);

/**
 * Squared distance between two points
 * @param {number} ax - First point x
 * @param {number} ay - First point y
 * @param {number} bx - Second point x
 * @param {number} by - Second point y
 * @returns {number} Squared distance
 */
export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};

/**
 * Format a number with locale string
 * @param {number} n - Number to format
 * @returns {string} Formatted number string
 */
export function format(n) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
