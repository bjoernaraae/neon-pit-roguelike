/**
 * Combat Text System
 * 
 * Handles floating combat text (damage numbers, coin pickups, etc.)
 */

import { rand } from "../../utils/math.js";

/**
 * Push floating combat text to the screen
 * @param {Object} s - Game state
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {string} text - Text to display
 * @param {string} col - Color
 * @param {Object} opts - Options {life, size, crit}
 */
export function pushCombatText(s, x, y, text, col, opts = {}) {
  s.floaters.push({
    x: x + rand(-10, 10),
    y: y + rand(-10, 6),
    text,
    t: 0,
    life: opts.life ?? 0.75,
    col,
    size: opts.size ?? 12,
    crit: !!opts.crit,
  });
}
