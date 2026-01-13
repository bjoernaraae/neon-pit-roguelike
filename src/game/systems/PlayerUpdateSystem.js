import { isPointWalkable, findNearestWalkable } from "../world/WalkabilitySystem.js";
import { ISO_MODE } from "../../data/constants.js";
import { transformInputForIsometric } from "../../rendering/IsometricRenderer.js";
import { clamp } from "../../utils/math.js";
import { computeSpeed } from "../../utils/gameMath.js";

/**
 * Update player movement with knockback and collision
 */
export function updatePlayerMovement(s, dt, keysRef) {
  const p = s.player;
  const keys = keysRef.current;
  
  let mx = (keys.has("ArrowRight") || keys.has("d") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("a") ? 1 : 0);
  let my = (keys.has("ArrowDown") || keys.has("s") ? 1 : 0) - (keys.has("ArrowUp") || keys.has("w") ? 1 : 0);
  
  // Transform input directions for isometric mode
  let dirX, dirY;
  if (ISO_MODE && (mx !== 0 || my !== 0)) {
    const transformed = transformInputForIsometric(mx, my);
    dirX = transformed.x;
    dirY = transformed.y;
  } else {
    const len = Math.hypot(mx, my) || 1;
    dirX = len ? mx / len : 1;
    dirY = len ? my / len : 0;
  }

  const baseV = computeSpeed(p);
  const baseVx = dirX * baseV;
  const baseVy = dirY * baseV;
  
  // Apply knockback (decay over time)
  if (!p.knockbackVx) p.knockbackVx = 0;
  if (!p.knockbackVy) p.knockbackVy = 0;
  // Decay knockback velocity
  p.knockbackVx *= (1 - dt * 4.0); // Decay rate
  p.knockbackVy *= (1 - dt * 4.0);
  // Stop if very small
  if (Math.abs(p.knockbackVx) < 1) p.knockbackVx = 0;
  if (Math.abs(p.knockbackVy) < 1) p.knockbackVy = 0;

  // Try to move player (movement + knockback)
  // Separate movement and knockback to ensure knockback respects walls
  const playerRadius = p.r || 12;
  
  // First, try regular movement
  const newX = p.x + baseVx * dt;
  const newY = p.y + baseVy * dt;
  
  // Check collision for X movement
  if (s.levelData) {
    if (isPointWalkable(newX, p.y, s.levelData, playerRadius)) {
      p.x = newX;
    }
    // Check collision for Y movement
    if (isPointWalkable(p.x, newY, s.levelData, playerRadius)) {
      p.y = newY;
    }
  } else {
    // Fallback: no level data, allow movement
    p.x = newX;
    p.y = newY;
  }
  
  // Apply knockback, but only if it doesn't push through walls
  if (p.knockbackVx !== 0 || p.knockbackVy !== 0) {
    const knockbackX = p.x + p.knockbackVx * dt;
    const knockbackY = p.y + p.knockbackVy * dt;
    
    if (s.levelData) {
      // Try knockback X movement
      if (isPointWalkable(knockbackX, p.y, s.levelData, playerRadius)) {
        p.x = knockbackX;
      } else {
        // Knockback hit a wall, stop knockback in that direction
        p.knockbackVx = 0;
      }
      // Try knockback Y movement
      if (isPointWalkable(p.x, knockbackY, s.levelData, playerRadius)) {
        p.y = knockbackY;
      } else {
        // Knockback hit a wall, stop knockback in that direction
        p.knockbackVy = 0;
      }
    } else {
      // Fallback: apply knockback
      p.x = knockbackX;
      p.y = knockbackY;
    }
  }
  
  // Final safety check: if player ended up in a wall, find nearest walkable position
  if (s.levelData && !isPointWalkable(p.x, p.y, s.levelData, playerRadius)) {
    const walkable = findNearestWalkable(p.x, p.y, s.levelData, playerRadius);
    p.x = walkable.x;
    p.y = walkable.y;
  }
}

/**
 * Update weapon cooldowns and handle orbiting blades
 */
export function updateWeaponCooldowns(s, dt, pushCombatTextFn) {
  const p = s.player;
  const haste = p.buffHasteT > 0 ? p.buffHasteMult : 1;
  
  // Update weapon cooldowns
  if (p.weapons) {
    for (const weapon of p.weapons) {
      weapon.attackT = Math.max(0, weapon.attackT - dt * haste);
      
      // Update orbiting blades (continuous attack, not on cooldown)
      if (weapon.id === "orbiting_blades" && weapon.weaponMode === "orbit") {
        // Initialize orbit angle if not set
        if (weapon.orbitAngle === undefined) weapon.orbitAngle = 0;
        
        // Update orbit angle (rotation speed)
        weapon.orbitAngle += dt * 3.5;
        if (weapon.orbitAngle > Math.PI * 2) weapon.orbitAngle -= Math.PI * 2;
        
        // Calculate blade positions and check for enemy hits
        const orbitRadius = Math.max(40, (weapon.weaponMeleeR || 60) * p.sizeMult);
        // Reduced floor damage scaling from +3% to +1.5% per floor
        const baseDmg = weapon.weaponDamage || 1;
        const floorMult = 0.84 + 0.015 * (s.floor || 0);
        const dmgBase = (isNaN(baseDmg) ? 1 : baseDmg) * (isNaN(floorMult) ? 1 : floorMult);
        
        // Apply berserker damage multiplier (based on missing HP)
        let berserkerBonus = 1.0;
        if (p.berserkerMult > 0 && !isNaN(p.berserkerMult)) {
          const hpPercent = (p.hp || 0) / Math.max(1, p.maxHp || 1);
          const missingHpPercent = 1 - hpPercent;
          berserkerBonus = 1 + (p.berserkerMult * missingHpPercent);
          if (isNaN(berserkerBonus)) berserkerBonus = 1.0;
        }
        
        // Apply speed demon damage multiplier (based on movement speed)
        let speedBonus = 1.0;
        if (p.speedDamageMult > 0 && !isNaN(p.speedDamageMult)) {
          const currentSpeed = (p.speedBase || 0) + (p.speedBonus || 0);
          speedBonus = 1 + (p.speedDamageMult * (currentSpeed / 100));
          if (isNaN(speedBonus)) speedBonus = 1.0;
        }
        
        const dmgWithBonuses = dmgBase * berserkerBonus * speedBonus;
        if (isNaN(dmgWithBonuses) || dmgWithBonuses <= 0) {
          continue; // Skip this weapon if damage is invalid
        }
        const crit = Math.random() < clamp(p.critChance || 0, 0, 0.8);
        const dmg = crit ? dmgWithBonuses * 1.6 : dmgWithBonuses;
        if (isNaN(dmg) || dmg <= 0) continue;
        
        const bladeCount = weapon.orbitBlades || 2;
        const angleStep = (Math.PI * 2) / bladeCount;
        
        for (let i = 0; i < bladeCount; i++) {
          const bladeAngle = weapon.orbitAngle + angleStep * i;
          const bladeX = p.x + Math.cos(bladeAngle) * orbitRadius;
          const bladeY = p.y + Math.sin(bladeAngle) * orbitRadius;
          
          // Check for enemies in range
          for (const e of s.enemies) {
            if (e.hp <= 0) continue;
            const dist2 = (bladeX - e.x) ** 2 + (bladeY - e.y) ** 2;
            const hitRadius = 20; // Blade hit radius
            if (dist2 <= (hitRadius + e.r) ** 2) {
              // Check cooldown per enemy (prevent spam) - use weapon-specific key
              // Longer cooldown (1.5s) ensures each enemy is only hit once per full rotation
              // Rotation speed is 3.5 rad/s, so full rotation takes ~1.8s
              const enemyKey = `orbitHit_${weapon.id}_${e.id || e.x}_${e.y}`;
              if (!e[enemyKey] || e[enemyKey] <= 0) {
                e[enemyKey] = 1.5; // 1.5s cooldown per enemy - prevents multiple hits per rotation
                
                let finalDmg = dmg;
                if (p.bigBonkChance > 0 && Math.random() < p.bigBonkChance) {
                  finalDmg = dmg * (p.bigBonkMult || 1);
                }
                
                e.hp -= finalDmg;
                e.hitT = 0.12;
                const dealt = Math.max(1, Math.round(finalDmg));
                pushCombatTextFn(s, e.x, e.y - 14, String(dealt), crit ? "#ffd44a" : "#ffffff", { size: crit ? 14 : 12, life: 0.75, crit });
                
                // Apply effects
                if (p.poisonChance > 0 && Math.random() < p.poisonChance) {
                  e.poisonT = Math.max(e.poisonT, 2.4);
                  e.poisonDps = Math.max(e.poisonDps, Math.max(3, finalDmg * 0.3));
                }
                if (p.lifesteal > 0) {
                  const healAmount = finalDmg * p.lifesteal;
                  p.hp = Math.min(p.maxHp, p.hp + healAmount);
                }
                if (p.iceCrystalFreezeChance && Math.random() < p.iceCrystalFreezeChance) {
                  e.freezeT = Math.max(e.freezeT, p.iceCrystalFreezeDuration || 1.2);
                } else if (p.freezeChance > 0 && Math.random() < p.freezeChance) {
                  e.freezeT = Math.max(e.freezeT, 1.05);
                }
              } else {
                // Update cooldown
                e[enemyKey] = Math.max(0, e[enemyKey] - dt);
              }
            }
          }
        }
      }
    }
  }
}
