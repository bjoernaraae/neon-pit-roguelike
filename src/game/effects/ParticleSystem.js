import { dist2 } from "../../utils/math.js";
import { pushCombatText as pushCombatTextFn } from "./CombatText.js";

/**
 * Update all particle effects: particles, hit flashes, floaters, burning areas, auras
 */
export function updateParticles(s, dt) {
  const p = s.player;

  // Update particles (visual effects with physics)
  for (const q of s.particles) {
    q.t += dt;
    if (q.gravity !== false) {
      q.vy += 650 * dt;
    }
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.vx *= 0.98; // Slight friction
  }
  s.particles = s.particles.filter((q) => q.t <= q.life);
  
  // Update hit flashes
  if (s.hitFlashes) {
    for (const flash of s.hitFlashes) {
      flash.t += dt;
    }
    s.hitFlashes = s.hitFlashes.filter((f) => f.t <= f.life);
  }

  // Update floaters (combat text, shockwaves, slices)
  for (const f of s.floaters) {
    f.t += dt;
    if (f.type !== "slice" && f.type !== "shockwave" && f.type !== "particle") {
      f.y -= 26 * dt;
    }
  }
  s.floaters = s.floaters.filter((f) => f.t <= f.life);
  
  // Update burning areas (ground fire from flamewalker)
  if (!s.burningAreas) s.burningAreas = [];
  for (const area of s.burningAreas) {
    area.t += dt;
    if (area.lastTick === undefined) area.lastTick = 0;
    area.lastTick += dt;
    
    // Damage enemies in area and apply burn for duration
    if (area.lastTick >= area.tickRate) {
      area.lastTick = 0;
      const r2 = area.r * area.r;
      for (const e of s.enemies) {
        if (e.hp <= 0) continue;
        if (dist2(e.x, e.y, area.x, area.y) <= r2) {
          const dmg = area.dmg;
          e.hp -= dmg;
          e.hitT = 0.08;
          // Combat text for flamewalker DoT
          pushCombatTextFn(s, e.x, e.y - 14, `-${Math.round(dmg)}`, "#ff7a3d", { size: 10, life: 0.5 });
          // Apply burn for the full duration while in flames
          e.burnT = Math.max(e.burnT || 0, area.life - area.t + 0.5); // Burn for remaining fire duration + buffer
          e.burnDps = Math.max(e.burnDps || 0, Math.max(2, area.dmg * 0.35));
        }
      }
      if (s.boss.active && s.boss.hp > 0) {
        const bossD2 = dist2(s.boss.x, s.boss.y, area.x, area.y);
        if (bossD2 <= r2) {
          s.boss.hp -= area.dmg * 0.5;
        }
      }
    }
  }
  s.burningAreas = s.burningAreas.filter((a) => a.t < a.life);
  
  // Update auras (player AoE effects)
  if (!s.auras) s.auras = [];
  for (const aura of s.auras) {
    aura.t += dt;
    if (aura.lastTick === undefined) aura.lastTick = 0;
    aura.lastTick += dt;
    
    // Damage enemies in aura radius around player
    if (aura.lastTick >= aura.tickRate) {
      aura.lastTick = 0;
      const r2 = aura.r * aura.r;
      for (const e of s.enemies) {
        if (e.hp <= 0) continue;
        if (dist2(e.x, e.y, p.x, p.y) <= r2) {
          e.hp -= aura.dmg;
          e.hitT = 0.08;
          if (aura.effect === "burn") {
            e.burnT = Math.max(e.burnT || 0, 1.5);
            e.burnDps = Math.max(e.burnDps || 0, Math.max(2, aura.dmg * 0.3));
          }
        }
      }
      if (s.boss.active && s.boss.hp > 0) {
        const bossD2 = dist2(s.boss.x, s.boss.y, p.x, p.y);
        if (bossD2 <= r2) {
          s.boss.hp -= aura.dmg * 0.5;
        }
      }
    }
  }
  s.auras = s.auras.filter((a) => a.t < a.life);
}
