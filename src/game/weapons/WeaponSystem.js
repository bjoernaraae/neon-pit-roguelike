/**
 * Weapon System
 * 
 * Handles weapon firing logic for all weapon types.
 */

import { clamp, lerp, rand, dist2 } from "../../utils/math.js";
import { hasLineOfSight } from "../world/WalkabilitySystem.js";
import { addParticle, addExplosion } from "../effects/VisualEffects.js";

/**
 * Fire all equipped weapons
 * @param {Object} s - Game state
 * @param {Function} acquireTargetFn - Function to acquire nearest target
 * @param {Function} shootBulletFn - Function to create bullets
 * @param {Function} pushCombatTextFn - Function to show combat text
 * @param {Function} bumpShakeFn - Screen shake function
 * @param {Function} sfxShootFn - Shoot sound effect
 */
export function fireWeapon(s, acquireTargetFn, shootBulletFn, pushCombatTextFn, bumpShakeFn, sfxShootFn) {
  const p = s.player;
  if (!p.weapons || p.weapons.length === 0) return;

  // Check if we have any aura weapons (they don't need targets or line of sight)
  const hasAuraWeapons = p.weapons.some(w => w.weaponMode === "aura");

  const tgt = acquireTargetFn(s, p.x, p.y);
  // Only require target if we don't have aura weapons
  if (!tgt && !hasAuraWeapons) return;

  // Only check line of sight if we don't have aura weapons (aura weapons don't need it)
  if (s.levelData && tgt && !hasAuraWeapons && !hasLineOfSight(p.x, p.y, tgt.x, tgt.y, s.levelData, 10)) {
    return; // No line of sight, can't shoot
  }

  const dx = tgt.x - p.x;
  const dy = tgt.y - p.y;
  const baseA = Math.atan2(dy, dx);

  const speed = 580 * p.projectileSpeed; // Reduced from 740 for slower-paced gameplay
  const bulletR = 4.1 * p.sizeMult;
  const knock = p.knockback;

    // Fire each weapon
    for (const weapon of p.weapons) {
      // For bananarang, check if there's already an active boomerang FIRST (before cooldown check)
      // This prevents firing even if cooldown is 0
      if (weapon.id === "bananarang" && weapon.weaponMode === "boomerang") {
        // Count active boomerangs for this weapon (not marked for destruction)
        // Check both t <= life AND that it hasn't returned yet (returning flag doesn't mean it's back)
        const activeBoomerangs = s.bullets.filter(bb => 
          bb.boomerang && 
          bb.weaponId === "bananarang" && 
          bb.t <= bb.life // Not marked for destruction (b.t > b.life means destroyed)
        );
        
        // Only fire if there are no active boomerangs (only 1 at a time)
        if (activeBoomerangs.length > 0) {
          continue; // Wait for boomerang to return - don't check cooldown, don't fire
        }
      }
      
      if (weapon.attackT > 0) continue; // Weapon is on cooldown

      // Flamewalker - spawn fire under player feet (independent of combat)
      if (weapon.id === "flamewalker" && weapon.weaponMode === "aura") {
        // Use a shared timer for all Flamewalkers to prevent simultaneous spawning
        if (s.flamewalkerGlobalTimer === undefined) {
          s.flamewalkerGlobalTimer = 0;
        }

        // Only the first Flamewalker handles the aura effect
        const isFirstFlamewalker = p.weapons.filter(w => w.id === "flamewalker").indexOf(weapon) === 0;

        if (isFirstFlamewalker) {
          // Update shared timer (runs every frame)
          s.flamewalkerGlobalTimer -= s.dt || 0.016;

          // Spawn fire when timer reaches 0
          if (s.flamewalkerGlobalTimer <= 0) {
            // Reset timer to attack cooldown
            s.flamewalkerGlobalTimer = weapon.attackCooldown;

            // Scale damage by number of Flamewalkers equipped
            const flamewalkerCount = p.weapons.filter(w => w.id === "flamewalker").length;

            // Reduced floor damage scaling from +3% to +1.5% per floor
            const baseDmg = weapon.weaponDamage || 1;
            const floorMult = 0.84 + 0.015 * (s.floor || 0);
            const dmgBase = (isNaN(baseDmg) ? 1 : baseDmg) * (isNaN(floorMult) ? 1 : floorMult) * flamewalkerCount;

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
            const fireRadius = Math.max(45, (weapon.weaponMeleeR || 50) * p.sizeMult);

            // Spawn burning area under player
            s.burningAreas.push({
              x: p.x,
              y: p.y,
              t: 0,
              life: 4.0, // Duration in seconds
              r: fireRadius,
              dmg: dmg * 0.18, // Damage per tick
              tickRate: 0.4, // Damage every 0.4 seconds
              lastTick: 0,
            });

            // Visual effect
            addParticle(s, p.x, p.y, 12, 20, { size: 3, speed: 0.8 });
          }
        }

        // Don't use normal weapon cooldown - Flamewalker manages its own timing
        weapon.attackT = 0; // Keep cooldown at 0 so it doesn't block other weapons
        continue;
      }

      // Orbiting Blades - auto-attack nearby enemies (continuous, not on cooldown)
      if (weapon.id === "orbiting_blades" && weapon.weaponMode === "orbit") {
        // Initialize orbit angle if not set
        if (weapon.orbitAngle === undefined) weapon.orbitAngle = 0;
        
        // Orbit angle is updated in the main game loop, not here
        // This weapon doesn't use attackT cooldown - it attacks continuously
        weapon.attackT = 0; // Keep cooldown at 0 so it doesn't block other weapons
        continue; // Skip normal firing logic
      }

      if (weapon.weaponMode === "melee") {
      const r = Math.max(34, (weapon.weaponMeleeR || 60) * p.sizeMult);
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
      if (isNaN(dmgWithBonuses)) {
        console.warn("NaN damage detected in melee, using fallback");
        continue;
      }
    const crit = Math.random() < clamp(p.critChance || 0, 0, 0.8);
    const dmg = crit ? dmgWithBonuses * 1.6 : dmgWithBonuses;
    if (isNaN(dmg) || dmg <= 0) continue;

    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      if (dist2(p.x, p.y, e.x, e.y) <= (r + e.r) * (r + e.r)) {
          // Calculate slice angle from player to this specific enemy
          const dx = e.x - p.x;
          const dy = e.y - p.y;
          const sliceAngle = Math.atan2(dy, dx);
          
          // Add slice visual effect in direction of this enemy
          s.floaters.push({
            x: p.x,
            y: p.y,
            t: 0,
            life: 0.25,
            angle: sliceAngle,
            length: r * 1.5,
            type: "slice",
            color: crit ? "#ffd44a" : "#ffffff",
          });
          
          // Check for Big Bonk proc on melee
          let finalDmg = dmg;
          let isBigBonk = false;
          if (p.bigBonkChance > 0 && Math.random() < p.bigBonkChance) {
            finalDmg = dmg * (p.bigBonkMult || 1);
            isBigBonk = true;
          }
          
          e.hp -= finalDmg;
        e.hitT = 0.12;
          const dealt = Math.max(1, Math.round(finalDmg));
          
          // Apply lifesteal if player has it (melee)
          if (p.lifesteal > 0) {
            const healAmount = finalDmg * p.lifesteal;
            p.hp = Math.min(p.maxHp, p.hp + healAmount);
            // Visual feedback for lifesteal
            if (healAmount > 0.5) {
              pushCombatTextFn(s, p.x, p.y - 30, `+${Math.round(healAmount)}`, "#4dff88", { size: 10, life: 0.6 });
            }
          }
          
          if (isBigBonk) {
            pushCombatTextFn(s, e.x, e.y - 14, `BIG BONK! ${dealt}`, "#ff0000", { size: 18, life: 1.2, crit: true });
            addExplosion(s, e.x, e.y, 1.5, 0);
            bumpShakeFn(s, 6, 0.1);
          } else {
        pushCombatTextFn(s, e.x, e.y - 14, String(dealt), crit ? "#ffd44a" : "#ffffff", { size: crit ? 14 : 12, life: 0.75, crit });
          }

          if (knock > 0) {
            const dx2 = e.x - p.x;
            const dy2 = e.y - p.y;
            const dd = Math.hypot(dx2, dy2) || 1;
            // Increased knockback multiplier from 0.03 to 0.15 (5x stronger)
            e.x += (dx2 / dd) * knock * 0.15;
            e.y += (dy2 / dd) * knock * 0.15;
        }

        if (p.poisonChance > 0 && Math.random() < p.poisonChance) {
          e.poisonT = Math.max(e.poisonT, 2.4);
          e.poisonDps = Math.max(e.poisonDps, Math.max(3, dmg * 0.3));
        }
          // Ice Crystal gives chance-based freeze, or regular freeze chance
          if (p.iceCrystalFreezeChance && Math.random() < p.iceCrystalFreezeChance) {
            e.freezeT = Math.max(e.freezeT, p.iceCrystalFreezeDuration || 1.2);
          } else if (p.freezeChance > 0 && Math.random() < p.freezeChance) {
          e.freezeT = Math.max(e.freezeT, 1.05);
        }
          
          // Flamewalker removed from melee - now uses aura mode
      }
    }

    addParticle(s, p.x, p.y, 4, 220);
      weapon.attackT = weapon.attackCooldown;
      continue;
    }

    // Ranged weapon
    const spread = weapon.weaponSpread;
    const isBoomerang = weapon.weaponMode === "boomerang";
    // For boomerang weapons, always fire only 1 projectile at a time
    const count = isBoomerang ? 1 : Math.max(1, weapon.projectiles);

    // Reduced floor damage scaling from +3% to +1.5% per floor
    const baseDmg = weapon.weaponDamage || 1;
    const floorMult = 0.84 + 0.015 * (s.floor || 0);
    const dmgBase = (isNaN(baseDmg) ? 1 : baseDmg) * (isNaN(floorMult) ? 1 : floorMult);
    
    // Apply berserker damage multiplier (based on missing HP)
    let berserkerBonus = 1.0;
    if (p.berserkerMult > 0 && !isNaN(p.berserkerMult)) {
      const hpPercent = (p.hp || 0) / Math.max(1, p.maxHp || 1);
      const missingHpPercent = 1 - hpPercent;
      berserkerBonus = 1 + (p.berserkerMult * missingHpPercent); // More damage the lower your HP
      if (isNaN(berserkerBonus)) berserkerBonus = 1.0;
    }
    
    // Apply speed demon damage multiplier (based on movement speed)
    let speedBonus = 1.0;
    if (p.speedDamageMult > 0 && !isNaN(p.speedDamageMult)) {
      const currentSpeed = (p.speedBase || 0) + (p.speedBonus || 0);
      speedBonus = 1 + (p.speedDamageMult * (currentSpeed / 100)); // Damage per 100 speed
      if (isNaN(speedBonus)) speedBonus = 1.0;
    }
    
    const dmgWithBonuses = dmgBase * berserkerBonus * speedBonus;
    if (isNaN(dmgWithBonuses) || dmgWithBonuses <= 0) {
      console.warn("NaN or invalid damage detected in ranged weapon, skipping");
      continue;
    }
  const crit = Math.random() < clamp(p.critChance || 0, 0, 0.8);
  const dmg = crit ? dmgWithBonuses * 1.6 : dmgWithBonuses;
  if (isNaN(dmg) || dmg <= 0) continue;

    // Weapon-specific colors and visuals
    let color = "#e6e8ff";
    let bulletSpeed = speed;
    let bulletSize = bulletR;
    let soundVariant = 0;
    let hasGlow = false;
    
    // Apply weapon-specific speed and size multipliers (from base or weapon object)
    const speedMult = weapon.bulletSpeedMult || weapon.weaponBulletSpeedMult || 1;
    const sizeMult = weapon.bulletSizeMult || weapon.weaponBulletSizeMult || 1;
    bulletSpeed *= speedMult;
    bulletSize *= sizeMult;
    
    if (weapon.weaponEffect === "poison") {
      color = "#4dff88"; // Green poison color
      soundVariant = 1; // Different sound for poison
      bulletSize *= 1.2; // Larger flask visual
      hasGlow = true; // Glow effect for poison flask
    } else if (weapon.weaponEffect === "freeze") {
      color = "#7bf1ff";
      soundVariant = 2;
      bulletSpeed *= 1.15; // Faster freeze bullets
      bulletSize *= 0.9;
    } else if (weapon.weaponEffect === "burn") {
      color = "#ff7a3d";
      soundVariant = 3; // Fire sound
      bulletSpeed *= 0.65; // Slower fireballs
      bulletSize *= 1.3; // Bigger fireballs
      hasGlow = true; // Firey glow effect
    } else if (weapon.id === "revolver") {
      color = "#ffd44a";
      soundVariant = 0;
      bulletSpeed *= 1.1;
    } else if (weapon.id === "bone") {
      color = "#ffffff";
      soundVariant = 4;
      bulletSpeed *= 0.4; // Much slower travel speed
    } else if (weapon.id === "lightning_staff") {
      color = "#ffff00";
      soundVariant = 2;
      bulletSpeed *= 1.3;
    } else if (weapon.id === "bow") {
      color = "#8b4513";
      soundVariant = 0;
    } else if (weapon.id === "bananarang") {
      color = "#ffd700";
      soundVariant = 0;
    } else if (weapon.id === "crossbow") {
      color = "#8b4513";
      soundVariant = 0;
      bulletSpeed *= 1.4;
    } else if (weapon.id === "chain_lightning") {
      color = "#ffff00";
      soundVariant = 2;
      bulletSpeed *= 1.5;
      hasGlow = true;
    } else if (weapon.id === "throwing_knives") {
      color = "#c0c0c0";
      soundVariant = 0;
      bulletSpeed *= 1.3;
    } else if (weapon.id === "grenade_launcher") {
      color = "#ff4500";
      soundVariant = 3;
      bulletSpeed *= 0.7;
      bulletSize *= 1.5;
      hasGlow = true;
    }

    // Splash radius for splash, thrown, and explosive modes
    const splashR = (weapon.weaponMode === "splash" || weapon.weaponMode === "thrown" || weapon.weaponMode === "explosive") 
      ? Math.max(26, (weapon.weaponSplashR || weapon.weaponSplashR || 80) * p.sizeMult) 
      : 0;

    // For boomerang weapons, set cooldown to prevent firing until banana returns
    // The main cooldown will be reset when the boomerang returns
    if (isBoomerang) {
      // Set a longer cooldown to ensure banana must return before next shot
      // This acts as a safety net in case the active boomerang check fails
      weapon.attackT = 5.0; // Long cooldown - will be reset to 2.0 when banana returns
    } else {
      weapon.attackT = weapon.attackCooldown;
    }

  if (count === 1) {
      // Single projectile - shoot straight forward
      shootBulletFn(s, p.x, p.y, baseA, dmg, bulletSpeed, {
        r: bulletSize * (isBoomerang ? 1.8 : 1), // Larger for bananarang visibility
        pierce: weapon.pierce,
      color,
      crit,
      knock,
        bounces: weapon.bounces,
        effect: weapon.weaponEffect,
      splashR,
        soundVariant,
        glow: hasGlow,
        boomerang: isBoomerang,
        explosive: weapon.weaponMode === "explosive", // Mark explosive mode bullets
        maxDist: isBoomerang ? (weapon.boomerangMaxDist || 250) : undefined, // Use weapon-specific max distance
        weaponId: isBoomerang ? weapon.id : undefined, // Track which weapon this belongs to
        life: isBoomerang ? 10.0 : undefined, // Long life for boomerang to complete round trip
      }, sfxShootFn);
    } else {
      // Multiple projectiles - first one straight forward, rest spread out with offset
      // First shot always straight forward (no spread, no offset)
      shootBulletFn(s, p.x, p.y, baseA, dmg, bulletSpeed, {
        r: bulletSize,
        pierce: weapon.pierce,
        color,
        crit,
        knock,
        bounces: weapon.bounces,
        effect: weapon.weaponEffect,
        splashR,
        soundVariant,
        glow: hasGlow,
        boomerang: isBoomerang,
        maxDist: isBoomerang ? (weapon.boomerangMaxDist || 250) : undefined,
        isBone: weapon.id === "bone", // Mark bone bullets for rotation
        life: weapon.id === "bone" ? 4.0 : undefined, // Longer life for bone bullets
      }, sfxShootFn);
      
      // Additional shots spread out in an arc - consistent angle progression
      // For 2 projectiles: small spread, for 3+: same angle increment per projectile
      const baseArc = 0.15; // Base arc for 2 projectiles
      const arcIncrement = 0.08; // Additional angle per extra projectile
      const arc = Math.min(0.4, baseArc + (count - 2) * arcIncrement); // Cap at 0.4 rad max
      const offsetDist = 12; // Distance to offset perpendicular to direction
      
      for (let i = 1; i < count; i++) {
        // Even distribution across arc
        const t = (count - 1) === 1 ? 0.5 : (i - 1) / (count - 1);
        // Spread angle with minimal randomness
        const spreadAngle = lerp(-arc, arc, t) + rand(-spread * 0.2, spread * 0.2);
        const a = baseA + spreadAngle;
        
        // Offset position perpendicular to the base angle to prevent overlap
        // This creates a fan pattern where projectiles don't spawn on top of each other
        const perpAngle = baseA + Math.PI / 2;
        const offsetX = Math.cos(perpAngle) * offsetDist * (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2);
        const offsetY = Math.sin(perpAngle) * offsetDist * (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2);
        
        // Also add a small forward offset so they don't overlap at spawn
        const forwardOffset = 6 * i;
        const forwardX = Math.cos(baseA) * forwardOffset;
        const forwardY = Math.sin(baseA) * forwardOffset;
        
        shootBulletFn(s, p.x + offsetX + forwardX, p.y + offsetY + forwardY, a, dmg, bulletSpeed, {
          r: bulletSize,
          pierce: weapon.pierce,
      color,
      crit,
      knock,
          bounces: weapon.bounces,
          effect: weapon.weaponEffect,
          splashR,
          soundVariant,
          glow: hasGlow,
          boomerang: isBoomerang,
          maxDist: isBoomerang ? (weapon.boomerangMaxDist || 250) : undefined,
          isBone: weapon.id === "bone", // Mark bone bullets for rotation
          life: weapon.id === "bone" ? 4.0 : undefined, // Longer life for bone bullets
          explosive: weapon.weaponMode === "explosive", // Mark explosive mode bullets
        }, sfxShootFn);
      }
    }

    // Only set weapon cooldown if it's NOT a boomerang weapon
    // Boomerang weapons get their cooldown when the boomerang returns
    if (!isBoomerang) {
      weapon.attackT = weapon.attackCooldown;
    }
  }
}
