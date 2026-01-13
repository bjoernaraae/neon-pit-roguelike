import { clamp, dist2 } from "../../utils/math.js";
import { bumpShake, addParticle } from "../effects/VisualEffects.js";
import { pushCombatText as pushCombatTextFn } from "../effects/CombatText.js";

/**
 * Update and collect loot: XP gems, coins, consumables (with magnet pickup)
 */
export function updateLoot(s, dt, awardXPFn, sfxCoinFn, audioRef) {
  const p = s.player;
  const { w, h, padding } = s.arena;
  const pickRadius = 100 * p.magnet;

  // Update and collect XP gems
  for (const g of s.gems) {
    g.t += dt;
    // No gravity or movement - XP stays where it drops
    // (removed all velocity/physics code)

    // Clamp to level bounds (but no bouncing since there's no velocity)
    if (s.levelData) {
      g.x = clamp(g.x, padding, s.levelData.w - padding);
      g.y = clamp(g.y, padding, s.levelData.h - padding);
    } else {
      g.x = clamp(g.x, padding, w - padding);
      g.y = clamp(g.y, padding, h - padding);
    }

    // Magnet pull effect
    const dd = Math.hypot(p.x - g.x, p.y - g.y);
    if (dd < pickRadius) {
      const ux = (p.x - g.x) / (dd || 1);
      const uy = (p.y - g.y) / (dd || 1);
      g.x += ux * (560 * dt) * (1 - dd / pickRadius);
      g.y += uy * (560 * dt) * (1 - dd / pickRadius);
    }

    // Pickup
    const rr = (p.r + g.r) * (p.r + g.r);
    if (dist2(p.x, p.y, g.x, g.y) < rr) {
      const leveled = awardXPFn(s, g.v, g.x, g.y);
      g.t = g.life + 1;
      if (leveled) {
        s.gems = s.gems.filter((gg) => gg.t <= gg.life);
        return; // Exit early if leveled up (to trigger upgrade sequence)
      }
    }
  }
  s.gems = s.gems.filter((g) => g.t <= g.life);

  // Update and collect coins
  for (const c of s.coins) {
    c.t += dt;
    // No gravity or movement - coins stay where they drop
    // (removed all velocity/physics code)

    // Clamp coins to level bounds
    if (s.levelData) {
      c.x = clamp(c.x, padding, s.levelData.w - padding);
      c.y = clamp(c.y, padding, s.levelData.h - padding);
    } else {
      c.x = clamp(c.x, padding, w - padding);
      c.y = clamp(c.y, padding, h - padding);
    }

    // Magnet pull effect
    const dd = Math.hypot(p.x - c.x, p.y - c.y);
    if (dd < pickRadius) {
      const ux = (p.x - c.x) / (dd || 1);
      const uy = (p.y - c.y) / (dd || 1);
      c.x += ux * (520 * dt) * (1 - dd / pickRadius);
      c.y += uy * (520 * dt) * (1 - dd / pickRadius);
    }

    // Pickup
    const rr = (p.r + c.r) * (p.r + c.r);
    if (dist2(p.x, p.y, c.x, c.y) < rr) {
      // Apply current goldGain and goldBoost when picked up (not when created)
      // c.v is the base coin value, multiply by current goldGain and goldBoost
      const goldMult = (p.goldGain || 1) * (p.goldBoostMult || 1);
      const actualGold = Math.round(c.v * goldMult);
      p.coins += actualGold;
      s.score += actualGold * 3;
      pushCombatTextFn(s, c.x, c.y - 14, `+${actualGold}`, "#ffd44a", { size: 11, life: 0.7 });
      c.t = c.life + 1;
      const arenaW = s.arena?.w || 1;
      const xNorm = (c.x && arenaW) ? clamp((c.x / arenaW) * 2 - 1, -1, 1) : 0;
      if (isFinite(xNorm)) {
        sfxCoinFn(audioRef, xNorm);
      }
    }
  }
  s.coins = s.coins.filter((c) => c.t <= c.life);

  // Update and collect consumables
  for (const cons of s.consumables) {
    cons.t += dt;
    
    // Clamp to level bounds
    if (s.levelData) {
      cons.x = clamp(cons.x, padding, s.levelData.w - padding);
      cons.y = clamp(cons.y, padding, s.levelData.h - padding);
    } else {
      cons.x = clamp(cons.x, padding, w - padding);
      cons.y = clamp(cons.y, padding, h - padding);
    }

    // Magnet pull effect
    const dd = Math.hypot(p.x - cons.x, p.y - cons.y);
    if (dd < pickRadius) {
      const ux = (p.x - cons.x) / (dd || 1);
      const uy = (p.y - cons.y) / (dd || 1);
      cons.x += ux * (560 * dt) * (1 - dd / pickRadius);
      cons.y += uy * (560 * dt) * (1 - dd / pickRadius);
    }

    // Pickup and consume
    const rr = (p.r + cons.r) * (p.r + cons.r);
    if (dist2(p.x, p.y, cons.x, cons.y) < rr) {
      // Consume the potion
      if (cons.type === "speed") {
        p.buffHasteT = Math.max(p.buffHasteT, 6);
        p.buffHasteMult = Math.max(p.buffHasteMult, 1.25);
        bumpShake(s, 2, 0.06);
        addParticle(s, p.x, p.y, 20, 120, { size: 3, speed: 1.2 });
        pushCombatTextFn(s, p.x, p.y - 30, `SPEED BOOST +${Math.round((p.buffHasteMult - 1) * 100)}%`, "#4dff88", { size: 16, life: 1.2 });
      } else if (cons.type === "heal") {
        const heal = Math.round(p.maxHp * 0.35);
        p.hp = Math.min(p.maxHp, p.hp + heal);
        addParticle(s, p.x, p.y, 18, 160);
        pushCombatTextFn(s, p.x, p.y - 30, `+${heal} HP`, "#4dff88", { size: 16, life: 1.2 });
      } else if (cons.type === "magnet") {
        p.magnetT = Math.max(p.magnetT || 0, 10.0);
        p.magnet = Math.max(p.magnet || 1, 50);
        bumpShake(s, 2, 0.06);
        addParticle(s, p.x, p.y, 20, 120, { size: 3, speed: 1.2 });
        pushCombatTextFn(s, p.x, p.y - 30, "MAGNET ACTIVATED", "#ffd44a", { size: 16, life: 1.2 });
      } else if (cons.type === "gold") {
        // Temporary gold gain boost (30 seconds, +50% gold gain)
        p.goldBoostT = Math.max(p.goldBoostT || 0, 30.0);
        p.goldBoostMult = Math.max(p.goldBoostMult || 1, 1.5);
        bumpShake(s, 2, 0.06);
        addParticle(s, p.x, p.y, 20, 60, { size: 3, speed: 1.2 });
        pushCombatTextFn(s, p.x, p.y - 30, "+50% GOLD GAIN", "#ffd44a", { size: 16, life: 1.2 });
      }
      cons.t = cons.life + 1; // Mark for removal
    }
  }
  s.consumables = s.consumables.filter((c) => c.t <= c.life);
}
