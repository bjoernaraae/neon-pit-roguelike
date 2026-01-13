/**
 * Rarity System
 * 
 * Handles rarity weight calculations, rarity rolling, and rarity multipliers.
 * Used for loot drops, upgrade quality, and stat scaling.
 */

import { clamp } from "../utils/math.js";
import { pickWeighted } from "../utils/data.js";
import { RARITY } from "./constants.js";

/**
 * Calculate rarity weights based on luck stat
 * @param {number} luck - Player's luck stat (0-8+)
 * @returns {Array<{r: string, w: number}>} Array of rarity weights
 */
export function getRarityWeights(luck) {
  const L = clamp(luck, 0, 8);
  const common = Math.max(40, 78 - L * 9);
  const uncommon = 18 + L * 5;
  const rare = 4 + L * 2.6;
  const legendary = 0.7 + L * 0.9;
  
  // Validate weights are positive numbers
  const weights = [
    { r: RARITY.COMMON, w: Math.max(0, common) },
    { r: RARITY.UNCOMMON, w: Math.max(0, uncommon) },
    { r: RARITY.RARE, w: Math.max(0, rare) },
    { r: RARITY.LEGENDARY, w: Math.max(0, legendary) },
  ];
  
  // Ensure at least one weight is positive to prevent pickWeighted errors
  const totalWeight = weights.reduce((sum, w) => sum + w.w, 0);
  if (totalWeight <= 0) {
    // Fallback: all equal weights if something went wrong
    return weights.map(w => ({ ...w, w: 1 }));
  }
  
  return weights;
}

/**
 * Roll a random rarity based on luck
 * @param {number} luck - Player's luck stat
 * @returns {string} Selected rarity (RARITY.COMMON, UNCOMMON, RARE, or LEGENDARY)
 */
export function rollRarity(luck) {
  const weights = getRarityWeights(luck);
  return pickWeighted(weights.map((x) => ({ w: x.w, t: x.r }))).t;
}

/**
 * Get stat multiplier for a given rarity
 * @param {string} rarity - Rarity tier
 * @returns {number} Multiplier (1.0 for common, up to 1.55 for legendary)
 */
export function rarityMult(rarity) {
  if (rarity === RARITY.UNCOMMON) return 1.12;
  if (rarity === RARITY.RARE) return 1.28;
  if (rarity === RARITY.LEGENDARY) return 1.55;
  return 1;
}
