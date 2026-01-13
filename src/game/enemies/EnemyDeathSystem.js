import { rand, clamp } from "../../utils/math.js";
import { pickWeighted } from "../../utils/data.js";
import { addExplosion, addParticle } from "../effects/VisualEffects.js";

/**
 * Handle enemy death - loot drops, scoring, and death effects
 */
export function handleEnemyDeath(s, e, sfxKillFn) {
  const x = e.x;
  const y = e.y;

  s.score += Math.round(20 + s.floor * 4);

  // XP and Gold drop at enemy death location (no velocity, stay in place)
  // Add small random offset to prevent overlapping
  const gemOffset = 12;
  const gemX = e.x + rand(-gemOffset, gemOffset);
  const gemY = e.y + rand(-gemOffset, gemOffset);
  s.gems.push({ x: gemX, y: gemY, r: 8, v: e.xp, vx: 0, vy: 0, t: 0, life: 18 });

  // Always drop gold (removed chance-based drop)
  // Store base coin value and goldGain at creation time
  // Gold gain will be applied when picked up
  // Add offset to prevent overlapping with gems
  const coinOffset = 12;
  const coinX = e.x + rand(-coinOffset, coinOffset);
  const coinY = e.y + rand(-coinOffset, coinOffset);
  s.coins.push({ 
    x: coinX, 
    y: coinY, 
    r: 8, 
    v: e.coin, // Base coin value (will be multiplied by current goldGain when picked up)
    vx: 0, 
    vy: 0, 
    t: 0, 
    life: 18 
  });

  // Drop consumable potions from enemies (rare drop)
  if (Math.random() < 0.025) { // 2.5% chance for rare consumable drop
    const consumableType = pickWeighted([
      { w: 1, t: "speed" }, // Speed potion
      { w: 1, t: "heal" }, // Heal potion
      { w: 1, t: "magnet" }, // Magnet potion
      { w: 1, t: "gold" }, // Gold boost potion (new)
    ]).t;
    const potionOffset = 12;
    const potionX = e.x + rand(-potionOffset, potionOffset);
    const potionY = e.y + rand(-potionOffset, potionOffset);
    s.consumables.push({
      x: potionX,
      y: potionY,
      r: 10,
      type: consumableType,
      vx: 0,
      vy: 0,
      t: 0,
      life: 25, // Longer life than coins/gems
    });
  }

  // Enhanced death effects
  const deathHue = e.tier === "brute" ? 0 : e.tier === "runner" ? 48 : e.tier === "spitter" ? 140 : e.tier === "shocker" ? 180 : e.tier === "tank" ? 30 : 210;
  addExplosion(s, x, y, 1.2, deathHue);
  addParticle(s, x, y, 20, deathHue, { size: 2.5, speed: 1.2, glow: true });
  const xNorm = clamp((x / (s.arena.w || 1)) * 2 - 1, -1, 1);
  sfxKillFn(xNorm);
}

/**
 * Filter out dead enemies and handle their deaths
 */
export function processEnemyDeaths(s, sfxKillFn) {
  s.enemies = s.enemies.filter((e) => {
    if (e.hp > 0) return true;
    handleEnemyDeath(s, e, sfxKillFn);
    return false;
  });
}
