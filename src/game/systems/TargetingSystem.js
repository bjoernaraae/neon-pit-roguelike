/**
 * Targeting System
 * 
 * Handles target acquisition for weapons and abilities.
 */

import { dist2 } from "../../utils/math.js";

/**
 * Acquire nearest target (enemy or boss)
 * @param {Object} s - Game state
 * @param {number} fromX - Source X position
 * @param {number} fromY - Source Y position
 * @returns {Object|null} Target {x, y, kind} or null
 */
export function acquireTarget(s, fromX, fromY) {
  let best = null;
  let bestD2 = Infinity;

  if (s.boss.active) {
    best = { x: s.boss.x, y: s.boss.y, kind: "boss" };
    bestD2 = dist2(fromX, fromY, s.boss.x, s.boss.y);
  }

  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    const d2v = dist2(fromX, fromY, e.x, e.y);
    if (d2v < bestD2) {
      bestD2 = d2v;
      best = { x: e.x, y: e.y, kind: "enemy" };
    }
  }

  return best;
}
