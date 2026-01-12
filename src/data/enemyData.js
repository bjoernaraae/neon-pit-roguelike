/**
 * Enemy Types and Stats Configuration
 * 
 * Defines all enemy types, their base stats, and tier weights
 */

export const ENEMY_TYPES = {
  GRUNT: "grunt",
  BRUTE: "brute",
  RUNNER: "runner",
  SPITTER: "spitter",
  SHOCKER: "shocker",
  TANK: "tank"
};

/**
 * Base stats for each enemy type
 */
export const ENEMY_BASE_STATS = {
  [ENEMY_TYPES.GRUNT]: {
    hp: 60,
    speed: 74,
    radius: 14,
    xp: 4,
    baseCoin: 2
  },
  [ENEMY_TYPES.BRUTE]: {
    hp: 110,
    speed: 47,
    radius: 18,
    xp: 7,
    baseCoin: 3
  },
  [ENEMY_TYPES.RUNNER]: {
    hp: 56,
    speed: 113,
    radius: 12,
    xp: 5,
    baseCoin: 2
  },
  [ENEMY_TYPES.SPITTER]: {
    hp: 64,
    speed: 59,
    radius: 15,
    xp: 6,
    baseCoin: 2
  },
  [ENEMY_TYPES.SHOCKER]: {
    hp: 72,
    speed: 69,
    radius: 14,
    xp: 6,
    baseCoin: 2
  },
  [ENEMY_TYPES.TANK]: {
    hp: 180,
    speed: 34,
    radius: 22,
    xp: 8,
    baseCoin: 4
  }
};

/**
 * Get enemy tier weights based on floor number
 * @param {number} floor - Current floor number
 * @returns {Array} Array of weighted enemy types
 */
export function getEnemyTierWeights(floor) {
  const weights = [
    { w: 74, t: ENEMY_TYPES.GRUNT },
    { w: 16, t: ENEMY_TYPES.BRUTE },
  ];
  
  // Runner appears starting floor 3
  if (floor >= 3) {
    weights.push({ w: Math.max(0, -6 + floor * 1.2), t: ENEMY_TYPES.RUNNER });
  }
  
  // Spitter appears starting floor 5
  if (floor >= 5) {
    weights.push({ w: Math.max(0, -10 + floor * 1.1), t: ENEMY_TYPES.SPITTER });
  }
  
  // Shocker appears starting floor 7 (new enemy type - electric)
  if (floor >= 7) {
    weights.push({ w: Math.max(0, -8 + floor * 0.8), t: ENEMY_TYPES.SHOCKER });
  }
  
  // Tank appears starting floor 9 (new enemy type - slow but tanky)
  if (floor >= 9) {
    weights.push({ w: Math.max(0, -5 + floor * 0.6), t: ENEMY_TYPES.TANK });
  }
  
  return weights;
}

/**
 * Elite enemy configuration
 */
export const ELITE_CONFIG = {
  BASE_CHANCE: 0.05, // 5% base chance
  FLOOR_SCALING: 0.01, // Increases 1% per floor
  
  GOLDEN_BASE_CHANCE: 0.01, // 1% base chance for golden elite
  GOLDEN_FLOOR_SCALING: 0.005, // Increases 0.5% per floor
  
  HP_MULTIPLIER: 3.0,
  SIZE_MULTIPLIER: 1.4,
  SPEED_MULTIPLIER: 1.5,
  COIN_MULTIPLIER: 2.5,
  GOLDEN_COIN_MULTIPLIER: 3.0,
  XP_MULTIPLIER: 2.0,
  
  ARMOR: {
    SHIELD: 0.3 // 30% damage reduction
  }
};

/**
 * Elite abilities
 */
export const ELITE_ABILITIES = {
  REGENERATION: "regeneration", // Heals over time
  SHIELD: "shield", // Damage reduction
  TELEPORT: "teleport", // Can teleport/dash
  RAGE: "rage" // Gets faster and stronger as HP drops
};

/**
 * Elite weaknesses
 */
export const ELITE_WEAKNESSES = {
  FIRE: "fire", // Weak to fire/burn damage
  POISON: "poison", // Weak to poison damage
  MELEE: "melee" // Weak to melee attacks
};

/**
 * Get random elite ability
 * @returns {string} Elite ability
 */
export function getRandomEliteAbility() {
  const roll = Math.random();
  if (roll < 0.25) return ELITE_ABILITIES.REGENERATION;
  if (roll < 0.5) return ELITE_ABILITIES.SHIELD;
  if (roll < 0.75) return ELITE_ABILITIES.TELEPORT;
  return ELITE_ABILITIES.RAGE;
}

/**
 * Get random elite weakness
 * @returns {string} Elite weakness
 */
export function getRandomEliteWeakness() {
  const roll = Math.random();
  if (roll < 0.33) return ELITE_WEAKNESSES.FIRE;
  if (roll < 0.66) return ELITE_WEAKNESSES.POISON;
  return ELITE_WEAKNESSES.MELEE;
}
