import { dist2 } from "../../utils/math.js";
import { rollEvasion, mitigateDamage } from "../../utils/gameMath.js";
import { bumpShake, addParticle } from "../effects/VisualEffects.js";
import { pushCombatText as pushCombatTextFn } from "../effects/CombatText.js";

/**
 * Record damage taken by player for UI display
 */
export function recordDamage(p, src, amt) {
  p.lastDamage = { src, amt: Math.round(amt) };
}

/**
 * Apply damage to the player with shield, evasion, thorns, and knockback
 */
export function applyPlayerDamage(s, amount, src, opts = {}) {
  const p = s.player;
  if (p.iFrames > 0 || p.hp <= 0) return false;

  if (rollEvasion(p.evasion)) {
    p.iFrames = 0.25;
    pushCombatTextFn(s, p.x, p.y - 22, "EVADE", "#2ea8ff", { size: 12, life: 0.7 });
    return true;
  }

  const shakeMag = opts.shakeMag ?? 7;
  const shakeTime = opts.shakeTime ?? 0.09;
  const hitStop = opts.hitStop ?? 0.03;

  // Calculate damage after armor
  const dmg = mitigateDamage(amount, p.armor);
  
  // Shield blocks a percentage of damage (60-80% based on shield amount)
  if (p.shield > 0) {
    const shieldBlockPercent = Math.min(0.8, 0.6 + (p.shield / Math.max(1, p.maxShield || 50)) * 0.2); // 60-80% block
    const blockedDmg = dmg * shieldBlockPercent;
    const actualDmg = dmg - blockedDmg;
    
    // Shield: 1 hit = 1 charge removed (simplified)
    p.shield = Math.max(0, p.shield - 1);
    
    // Apply remaining damage to HP
    if (actualDmg > 0) {
      p.hp -= actualDmg;
      p.iFrames = 0.75;
      s.lastHitT = s.t;
      bumpShake(s, Math.min(7, shakeMag), shakeTime);
      if (hitStop > 0) s.hitStopT = Math.max(s.hitStopT, Math.min(0.02, hitStop));
      addParticle(s, p.x, p.y, 12, 200);
      recordDamage(p, src, Math.round(actualDmg));
    } else {
      // Shield blocked all damage
      p.iFrames = 0.6;
      bumpShake(s, Math.min(7, shakeMag * 0.7), shakeTime);
      if (hitStop > 0) s.hitStopT = Math.max(s.hitStopT, Math.min(0.02, hitStop * 0.7));
      addParticle(s, p.x, p.y, 12, 165);
      pushCombatTextFn(s, p.x, p.y - 22, `SHIELD -${Math.round(blockedDmg)}`, "#9cffd6", { size: 12, life: 0.7 });
      recordDamage(p, `${src} (shield)`, 0);
    }
    return true;
  }

  // No shield - take full damage
  p.hp -= dmg;
  p.iFrames = 0.75;
  s.lastHitT = s.t;

  // Apply thorns damage to attacker if player has thorns
  if (p.thorns > 0 && opts.fromX !== undefined && opts.fromY !== undefined) {
    // Find nearest enemy to the damage source
    let nearestEnemy = null;
    let nearestD2 = Infinity;
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      const d2 = dist2(opts.fromX, opts.fromY, e.x, e.y);
      if (d2 < nearestD2 && d2 < 100) { // Only if within 100 units
        nearestD2 = d2;
        nearestEnemy = e;
      }
    }
    // Also check boss
    if (s.boss.active && s.boss.hp > 0) {
      const bossD2 = dist2(opts.fromX, opts.fromY, s.boss.x, s.boss.y);
      if (bossD2 < nearestD2 && bossD2 < 100) {
        nearestEnemy = s.boss;
      }
    }
    
    if (nearestEnemy) {
      const thornsDmg = dmg * p.thorns;
      nearestEnemy.hp -= thornsDmg;
      if (nearestEnemy.hitT !== undefined) nearestEnemy.hitT = 0.12;
      pushCombatTextFn(s, nearestEnemy.x, nearestEnemy.y - 14, `THORNS ${Math.round(thornsDmg)}`, "#ff7a3d", { size: 12, life: 0.8 });
      addParticle(s, nearestEnemy.x, nearestEnemy.y, 6, 20, { size: 2, speed: 0.6 });
    }
  }

  // Screen shake and push back on hit
  bumpShake(s, Math.max(shakeMag, 3.5), shakeTime); // Ensure minimum shake
  if (hitStop > 0) s.hitStopT = Math.max(s.hitStopT, Math.min(0.05, hitStop)); // Cap hitStop to prevent freeze
  
  // Push player back from damage source
  if (opts.pushBack !== false) {
    const pushDist = 25;
    // Try to find damage source direction
    if (opts.fromX !== undefined && opts.fromY !== undefined) {
      const dx = p.x - opts.fromX;
      const dy = p.y - opts.fromY;
      const dist = Math.hypot(dx, dy) || 1;
      p.x += (dx / dist) * pushDist;
      p.y += (dy / dist) * pushDist;
    } else {
      // Random push back if no source
      const angle = Math.random() * Math.PI * 2;
      p.x += Math.cos(angle) * pushDist;
      p.y += Math.sin(angle) * pushDist;
    }
  }
  
  addParticle(s, p.x, p.y, 16, 350);

  pushCombatTextFn(s, p.x, p.y - 22, `-${Math.round(dmg)}`, "#ff5d5d", { size: 12, life: 0.85 });
  recordDamage(p, src, dmg);

  return true;
}
