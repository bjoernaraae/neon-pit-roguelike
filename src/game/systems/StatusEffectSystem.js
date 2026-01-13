import { pushCombatText as pushCombatTextFn } from "../effects/CombatText.js";

/**
 * Update status effects on enemies (poison, burn, slow, elite abilities)
 */
export function updateEnemyStatusEffects(s, dt, pushCombatTextFn) {
  for (const e of s.enemies) {
    // Update hit flash and contact cooldown
    if (e.hitT > 0) e.hitT = Math.max(0, e.hitT - dt);
    if (e.contactCd > 0) e.contactCd = Math.max(0, e.contactCd - dt);

    // Poison damage over time
    if (e.poisonT > 0) {
      e.poisonT = Math.max(0, e.poisonT - dt);
      if (e.poisonDps > 0) {
        const dmg = e.poisonDps * dt;
        e.hp -= dmg;
        e.hitT = Math.max(e.hitT, 0.03);
        // Combat text for poison DoT (every 0.5 seconds)
        if (!e._lastPoisonText || e._lastPoisonText <= 0) {
          pushCombatTextFn(s, e.x, e.y - 14, `-${Math.round(dmg * 10)}`, "#4dff88", { size: 9, life: 0.4 });
          e._lastPoisonText = 0.5;
        } else {
          e._lastPoisonText -= dt;
        }
      }
    }
    
    // Burn damage over time
    if (e.burnT > 0) {
      e.burnT = Math.max(0, e.burnT - dt);
      if (e.burnDps > 0) {
        let dmg = e.burnDps * dt;
        // Elite armor reduces DoT damage too
        if (e.isElite && e.eliteArmor > 0) {
          dmg *= (1 - e.eliteArmor);
        }
        e.hp -= dmg;
        e.hitT = Math.max(e.hitT, 0.03);
        // Combat text for burn DoT (every 0.5 seconds)
        if (!e._lastBurnText || e._lastBurnText <= 0) {
          pushCombatTextFn(s, e.x, e.y - 14, `-${Math.round(dmg * 10)}`, "#ff7a3d", { size: 9, life: 0.4 });
          e._lastBurnText = 0.5;
        } else {
          e._lastBurnText -= dt;
        }
      }
    }
    
    // Slow effect timer
    if (e.slowT > 0) {
      e.slowT = Math.max(0, e.slowT - dt);
    }
    
    // Freeze effect timer (now just slows)
    if (e.freezeT > 0) {
      e.freezeT = Math.max(0, e.freezeT - dt);
    }
    
    // Elite regeneration (if elite has regen ability)
    if (e.isElite && e.eliteAbility === "regen") {
      if (!e.eliteRegenT) e.eliteRegenT = 0;
      e.eliteRegenT += dt;
      if (e.eliteRegenT >= 1.0) { // Regen every 1 second
        const regenAmount = e.maxHp * 0.02; // 2% max HP per second
        e.hp = Math.min(e.maxHp, e.hp + regenAmount);
        e.eliteRegenT = 0;
      }
    }
    
    // Elite teleport (if elite has teleport ability)
    if (e.isElite && e.eliteAbility === "teleport") {
      if (!e.eliteTeleportT) e.eliteTeleportT = 0;
      e.eliteTeleportT += dt;
      if (e.eliteTeleportT >= 5.0) { // Teleport every 5 seconds
        // Teleport to a random position near the player
        const p = s.player;
        const angle = Math.random() * Math.PI * 2;
        const distance = 100 + Math.random() * 100;
        e.x = p.x + Math.cos(angle) * distance;
        e.y = p.y + Math.sin(angle) * distance;
        e.eliteTeleportT = 0;
      }
    }
    
    // Update phase animation
    e.phase += dt * (e.tier === "runner" ? 8 : 3);
  }
}

/**
 * Update per-enemy hit cooldowns (for orbiting blades and other repeated hits)
 */
export function updateEnemyHitCooldowns(s, dt) {
  for (const e of s.enemies) {
    // Find and update all hit cooldown keys (e.g., "orbitHit_orbiting_blades_...")
    for (const key in e) {
      if (key.startsWith("orbitHit_") && typeof e[key] === "number" && e[key] > 0) {
        e[key] = Math.max(0, e[key] - dt);
      }
    }
  }
}
