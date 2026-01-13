/**
 * Enemy Spawner
 * 
 * Spawns enemies with tier-based stats, elite variants, and gold scaling.
 */

import { rand } from "../../utils/math.js";
import { pickWeighted } from "../../utils/data.js";
import { 
  ENEMY_BASE_STATS, 
  getEnemyTierWeights, 
  ELITE_CONFIG, 
  getRandomEliteAbility, 
  getRandomEliteWeakness 
} from "../../data/enemyData.js";

/**
 * Spawn an enemy
 * @param {Object} s - Game state
 */
export function spawnEnemy(s) {
  const { w, h, padding } = s.arena;
  const p = s.player;
  const minDistFromPlayer = 120;
  
  let x = 0;
  let y = 0;
  let validSpawn = false;
  let attempts = 0;
  
  // Try to spawn in rooms/corridors if level data exists
  if (s.levelData) {
    // Combine rooms and corridors for spawn selection
    const allAreas = [...(s.levelData.rooms || []), ...(s.levelData.corridors || [])];
    if (allAreas.length > 0) {
      while (!validSpawn && attempts < 50) {
        // Pick a random room or corridor
        const area = allAreas[Math.floor(Math.random() * allAreas.length)];
        x = rand(area.x + 20, area.x + area.w - 20);
        y = rand(area.y + 20, area.y + area.h - 20);
        
        // Check distance from player
        const dist2 = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
        if (dist2 >= minDistFromPlayer * minDistFromPlayer) {
          validSpawn = true;
        }
        attempts++;
      }
    }
  }
  
  // Fallback to edge spawning if no level data or all attempts failed
  if (!validSpawn) {
    attempts = 0;
    while (!validSpawn && attempts < 20) {
      const side = Math.floor(Math.random() * 4);
      const levelW = s.levelData ? s.levelData.w : w;
      const levelH = s.levelData ? s.levelData.h : h;
      
  if (side === 0) {
        x = rand(padding, levelW - padding);
    y = padding;
  } else if (side === 1) {
        x = levelW - padding;
        y = rand(padding, levelH - padding);
  } else if (side === 2) {
        x = rand(padding, levelW - padding);
        y = levelH - padding;
  } else {
    x = padding;
        y = rand(padding, levelH - padding);
      }
      
      // Check distance from player
      const dist2 = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (dist2 >= minDistFromPlayer * minDistFromPlayer) {
        validSpawn = true;
      }
      attempts++;
    }
  }
  
  // Final fallback - spawn anywhere
  if (!validSpawn) {
    const levelW = s.levelData ? s.levelData.w : w;
    const levelH = s.levelData ? s.levelData.h : h;
    x = rand(padding, levelW - padding);
    y = rand(padding, levelH - padding);
  }

  // Get enemy tier weights based on current floor (from enemyData.js)
  const tierWeights = getEnemyTierWeights(s.floor);
  const tier = pickWeighted(tierWeights).t;

  // Determine if this is an elite enemy (using ELITE_CONFIG from enemyData.js)
  const eliteChance = ELITE_CONFIG.BASE_CHANCE + (s.floor - 1) * ELITE_CONFIG.FLOOR_SCALING;
  const isElite = Math.random() < eliteChance;
  
  // Golden elite (drops extra gold)
  const goldenEliteChance = ELITE_CONFIG.GOLDEN_BASE_CHANCE + (s.floor - 1) * ELITE_CONFIG.GOLDEN_FLOOR_SCALING;
  const isGoldenElite = isElite && Math.random() < goldenEliteChance;

  // Get base stats from enemyData.js
  const stats = ENEMY_BASE_STATS[tier];
  const baseHp = stats.hp;
  const baseSp = stats.speed;
  const r = stats.radius;

  // Elite enemies are much tougher (using ELITE_CONFIG multipliers)
  const hpMult = isElite ? ELITE_CONFIG.HP_MULTIPLIER : 1.0;
  const sizeMult = isElite ? ELITE_CONFIG.SIZE_MULTIPLIER : 1.0;
  const speedMult = isElite ? ELITE_CONFIG.SPEED_MULTIPLIER : 1.0;
  const finalHp = Math.round(baseHp * hpMult);
  const finalR = r * sizeMult;
  const finalSpeed = baseSp * speedMult;
  
  // Elite special abilities and weaknesses (from enemyData.js)
  let eliteAbility = null;
  let eliteWeakness = null;
  let eliteArmor = 0; // Damage reduction (0-1)
  
  if (isElite) {
    eliteAbility = getRandomEliteAbility();
    eliteWeakness = getRandomEliteWeakness();
    
    if (eliteAbility === "shield") {
      eliteArmor = ELITE_CONFIG.ARMOR.SHIELD; // 30% damage reduction
    }
  }

  // Coin calculation: base coin from enemyData.js, scales with HP
  let baseCoin = stats.baseCoin;
  
  // Scale coin with HP (harder enemies = more gold)
  const coinFromHp = Math.round(finalHp / 40); // 1 coin per 40 HP
  let finalCoin = baseCoin + coinFromHp;
  
  if (isElite) {
    finalCoin = Math.round(finalCoin * ELITE_CONFIG.COIN_MULTIPLIER); // Elites give 2.5x base
  }
  if (isGoldenElite) {
    finalCoin = Math.round(finalCoin * ELITE_CONFIG.GOLDEN_COIN_MULTIPLIER); // Golden elites give 3x more
  }
  
  // Reduce gold gain by 50%
  finalCoin = Math.round(finalCoin * 0.5);

  s.enemies.push({
    id: Math.random().toString(16).slice(2),
    x,
    y,
    r: finalR,
    hp: finalHp,
    maxHp: finalHp,
    speed: finalSpeed,
    tier,
    isElite,
    isGoldenElite,
    eliteAbility,
    eliteWeakness,
    eliteArmor,
    eliteRegenT: 0, // Regeneration timer
    eliteTeleportT: 0, // Teleport cooldown
    hitT: 0,
    spitT: 0,
    phase: rand(0, Math.PI * 2),
    xp: Math.round(stats.xp * p.difficultyTome * (isElite ? ELITE_CONFIG.XP_MULTIPLIER : 1)),
    coin: finalCoin,
    poisonT: 0,
    poisonDps: 0,
    freezeT: 0, // Keep for backwards compatibility
    slowT: 0, // Slow effect (replaces freeze)
    slowMult: 1.0, // Speed multiplier when slowed
    burnT: 0,
    burnDps: 0,
    contactCd: 0, // Start at 0 so enemies can hit immediately when they touch
    z: 0, // Initialize z position for isometric depth
  });
}
