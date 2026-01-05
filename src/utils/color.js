/**
 * Color utility functions
 */

import { lerp } from './math.js';

/**
 * Convert hex color to RGB object
 * @param {string} hex - Hex color string (with or without #)
 * @returns {{r: number, g: number, b: number}|null} RGB object or null if invalid
 */
export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Linear interpolation between two colors
 * @param {string} color1 - First color (hex)
 * @param {string} color2 - Second color (hex)
 * @param {number} t - Interpolation factor (0-1)
 * @returns {string} Interpolated RGB color string
 */
export function lerpColor(color1, color2, t) {
  // Simple hex color lerp
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  if (!c1 || !c2) return color1;
  const r = Math.round(lerp(c1.r, c2.r, t));
  const g = Math.round(lerp(c1.g, c2.g, t));
  const b = Math.round(lerp(c1.b, c2.b, t));
  return `rgb(${r},${g},${b})`;
}

/**
 * Adjust brightness of a hex color
 * @param {string} color - Hex color string
 * @param {number} amount - Brightness adjustment (-1 to 1, where -1 is black, 1 is white)
 * @returns {string} Adjusted RGB color string
 */
export function adjustBrightness(color, amount) {
  // Simple brightness adjustment for hex colors
  // amount: -1 (black) to 1 (white)
  const num = parseInt(color.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + amount * 255));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount * 255));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount * 255));
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}
