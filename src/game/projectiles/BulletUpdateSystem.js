import { dist2, clamp } from "../../utils/math.js";
import { isPointWalkable } from "../world/WalkabilitySystem.js";
import { addParticle, addExplosion, addHitFlash, bumpShake } from "../effects/VisualEffects.js";
import { pushCombatText as pushCombatTextFn } from "../effects/CombatText.js";
import { playBeep as playBeepFn, sfxHit as sfxHitFn, sfxCrit as sfxCritFn } from "../../audio/SoundEffects.js";

/**
 * Update all bullets: physics, collision, effects
 * This is the largest system in the update loop (~838 lines)
 */
export function updateBullets(s, dt, levelW, levelH, padding, applyPlayerDamageFn, audioRef) {
  const p = s.player;

  for (const b of s.bullets) {
    b.t += dt;
    b.px = b.x;
    b.py = b.y;
    
    // Update rotation for bone bullets
    if (b.isBone) {
      b.rotation += dt * 8; // Rotate 8 radians per second (fast spinning)
    }
    
    // Update rotation for boomerang (bananarang) - spinning effect
    if (b.boomerang) {
      if (!b.rotation) b.rotation = 0;
      b.rotation += dt * 12; // Fast spinning for visibility
    }
    
    // Boomerang return logic
    if (b.boomerang && !b.enemy) {
      const distFromStart = Math.hypot(b.x - b.startX, b.y - b.startY);
      const distFromPlayer = Math.hypot(b.x - p.x, b.y - p.y);
      
      // Track if we're in return phase
      // Return if: traveled max distance OR been alive for 3 seconds (fallback)
      if (!b.returning) {
        const wasReturning = b.returning;
        b.returning = distFromStart > b.maxDist || b.t > 3.0;
        // When starting to return, create a separate set for return hits
        if (b.returning && !wasReturning) {
          b.returnHitEnemies = new Set(); // Track enemies hit on return trip
        }
      }
      
      if (b.returning) {
        // Return to player with fixed speed (don't multiply - use original bullet speed)
        const dx = p.x - b.x;
        const dy = p.y - b.y;
        const dist = Math.hypot(dx, dy) || 1;
        // Use the original bullet speed (stored when created) with weapon's return speed multiplier
        const baseReturnSpeed = b.originalSpeed || 400;
        // Get return speed multiplier from weapon if available
        const weapon = p.weapons?.find(w => w.id === b.weaponId);
        const returnSpeedMult = weapon?.boomerangReturnSpeedMult || 1;
        const returnSpeed = baseReturnSpeed * returnSpeedMult;
        b.vx = (dx / dist) * returnSpeed;
        b.vy = (dy / dist) * returnSpeed;
      }
      
      // If close enough to player during return phase, destroy bullet and start weapon cooldown
      // BUT don't destroy explosive bullets (they need to inject onto enemies)
      if (distFromPlayer < 25 && b.returning && !b.explosive) {
        // Destroy the bullet first
        b.t = b.life + 1;
        
        // Reset weapon cooldown when banana returns (allow immediate firing)
        if (b.weaponId === "bananarang") {
          const weapon = p.weapons?.find(w => w.id === "bananarang");
          if (weapon) {
            weapon.attackT = 0; // Reset cooldown - can fire again immediately
          }
        }
        continue;
      }
      // If not returning yet, bullet continues with its original velocity (handled in normal movement below)
    }
    
    // Handle explosive bullets that seek and inject onto enemies
    if (b.explosive && !b.injected && b.seeking) {
      // Find nearest enemy to seek
      let nearestEnemy = null;
      let nearestD2 = Infinity;
      for (const ee of s.enemies) {
        if (ee.hp <= 0) continue;
        const d2 = dist2(ee.x, ee.y, b.x, b.y);
        if (d2 < nearestD2) {
          nearestD2 = d2;
          nearestEnemy = ee;
        }
      }
      // Also check boss
      if (s.boss.active && s.boss.hp > 0) {
        const bossD2 = dist2(s.boss.x, s.boss.y, b.x, b.y);
        if (bossD2 < nearestD2) {
          nearestEnemy = s.boss;
        }
      }
      
      // Home in on nearest enemy
      if (nearestEnemy) {
        const dx = nearestEnemy.x - b.x;
        const dy = nearestEnemy.y - b.y;
        const dist = Math.hypot(dx, dy) || 1;
        const speed = Math.hypot(b.vx, b.vy);
        // Gradually turn toward target
        const turnRate = 8.0; // How fast it turns (radians per second)
        const currentAngle = Math.atan2(b.vy, b.vx);
        const targetAngle = Math.atan2(dy, dx);
        let angleDiff = targetAngle - currentAngle;
        // Normalize angle difference to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        const newAngle = currentAngle + clamp(angleDiff, -turnRate * dt, turnRate * dt);
        b.vx = Math.cos(newAngle) * speed;
        b.vy = Math.sin(newAngle) * speed;
      } else {
        // No target found - bullet should just continue moving in its current direction
        // It will expire after maxSeekTime (handled in bullet filter)
        // Don't do anything special, just let it move normally
      }
    }
    
    // If injected, follow the enemy's position
    if (b.explosive && b.injected && b.injectedEnemy) {
      // Check if enemy still exists and is alive
      if (b.injectedEnemy.hp > 0) {
        b.x = b.injectedEnemy.x;
        b.y = b.injectedEnemy.y;
        // Countdown to explosion
        b.explodeAfter -= dt;
        
        // Add visual tick effect - pulsing particles during countdown
        if (Math.random() < 0.4) { // 40% chance per frame to add particle
          const angle = Math.random() * Math.PI * 2;
          const dist = b.injectedEnemy.r + 5;
          s.particles.push({
            x: b.injectedEnemy.x + Math.cos(angle) * dist,
            y: b.injectedEnemy.y + Math.sin(angle) * dist,
            vx: Math.cos(angle) * 25,
            vy: Math.sin(angle) * 25,
            r: 3,
            t: 0,
            life: 0.4,
            hue: 40, // Orange
            glow: true,
          });
        }
      } else {
        // Enemy died, explode immediately
        b.explodeAfter = 0;
      }
    } else {
      // Normal bullet movement
      const newX = b.x + b.vx * dt;
      const newY = b.y + b.vy * dt;
      
      // Check wall collision for all bullets (they can't go through walls)
      if (s.levelData) {
        // Use bullet radius for wall check
        const bulletRadius = b.r || 4;
        if (!isPointWalkable(newX, newY, s.levelData, bulletRadius)) {
          // Hit a wall, destroy bullet
          // For splash weapons, trigger splash damage on wall hit
          if (!b.enemy && b.splashR > 0) {
            const r2 = b.splashR * b.splashR;
            let hitAny = false;
            for (const ee of s.enemies) {
              if (ee.hp <= 0) continue;
              if (dist2(ee.x, ee.y, b.x, b.y) <= r2) {
                ee.hp -= b.dmg * 0.65;
                ee.hitT = 0.12;
                hitAny = true;
                const dealt = Math.max(1, Math.round(b.dmg * 0.65));
                pushCombatTextFn(s, ee.x, ee.y - 14, String(dealt), "#ff7a3d", { size: 12, life: 0.75 });
                
                // Apply poison to all enemies hit by splash (for poison flask)
                if (b.effect === "poison") {
                  const poisonDuration = 3.5;
                  const poisonDpsMult = 0.4;
                  ee.poisonT = Math.max(ee.poisonT || 0, poisonDuration);
                  ee.poisonDps = Math.max(ee.poisonDps || 0, Math.max(3, b.dmg * poisonDpsMult));
                }
              }
            }
            if (s.boss.active) {
              const bossD2 = dist2(s.boss.x, s.boss.y, b.x, b.y);
              if (bossD2 <= r2) {
                s.boss.hp -= b.dmg * 0.65;
                hitAny = true;
                const dealt = Math.max(1, Math.round(b.dmg * 0.65));
                pushCombatTextFn(s, s.boss.x, s.boss.y - s.boss.r - 10, String(dealt), "#ff7a3d", { size: 12, life: 0.75 });
                
                // Apply poison to boss hit by splash (for poison flask)
                if (b.effect === "poison") {
                  // Boss poison handling would go here if needed
                }
              }
            }
            if (hitAny) {
              addParticle(s, b.x, b.y, 10, 30);
            }
          }
          b.t = b.life + 1;
          continue;
        }
      }
      
      // Apply bullet movement
      b.x = newX;
      b.y = newY;
    }

    // Handle explosion (either after injection timer or if enemy died)
    // Check BEFORE other destruction conditions
    // IMPORTANT: Only explode if injected onto an ENEMY (not player), and enemy still exists
    if (b.explosive && b.injected && b.injectedEnemy && 
        b.injectedEnemy !== p && // Never explode if injected onto player (shouldn't happen, but safety check)
        (b.injectedEnemy.hp !== undefined || b.injectedEnemy === s.boss) && // Must be an enemy or boss
        b.explodeAfter !== undefined && b.explodeAfter <= 0) {
      // Time to explode!
      const explosionR = b.explosionRadius || 120;
      const explosionDmg = b.explosionDmg || b.dmg * 0.8;
      const r2 = explosionR * explosionR;
      const explosionX = b.x;
      const explosionY = b.y;
      
      // Damage all enemies in explosion radius
      let hitAny = false;
      for (const ee of s.enemies) {
        if (ee.hp <= 0) continue;
        if (dist2(ee.x, ee.y, explosionX, explosionY) <= r2) {
          ee.hp -= explosionDmg;
          ee.hitT = 0.15;
          hitAny = true;
          const dealt = Math.max(1, Math.round(explosionDmg));
          pushCombatTextFn(s, ee.x, ee.y - 14, String(dealt), "#ffaa00", { size: 16, life: 0.9, crit: true });
          
          // Apply knockback
          const dx = ee.x - explosionX;
          const dy = ee.y - explosionY;
          const dd = Math.hypot(dx, dy) || 1;
          ee.x += (dx / dd) * 40; // Moderate knockback
          ee.y += (dy / dd) * 40;
        }
      }
      
      // Damage boss if in range
      if (s.boss.active && s.boss.hp > 0) {
        const bossD2 = dist2(s.boss.x, s.boss.y, explosionX, explosionY);
        if (bossD2 <= r2) {
          s.boss.hp -= explosionDmg;
          hitAny = true;
          const dealt = Math.max(1, Math.round(explosionDmg));
          pushCombatTextFn(s, s.boss.x, s.boss.y - s.boss.r - 10, String(dealt), "#ffaa00", { size: 16, life: 0.9, crit: true });
        }
      }
      
      // Always show explosion effect, even if no enemies hit
      // Massive explosion effect
      addExplosion(s, explosionX, explosionY, 3.0, 40); // Larger orange explosion
      addParticle(s, explosionX, explosionY, 40, 40, { size: 5, speed: 2.0, glow: true });
      
      // Add multiple shockwave rings for visibility
      for (let i = 0; i < 3; i++) {
        s.floaters.push({
          x: explosionX,
          y: explosionY,
          t: i * 0.05,
          life: 0.5,
          type: "shockwave",
          r: explosionR * (0.2 + i * 0.3),
          color: i === 0 ? "#ffaa00" : i === 1 ? "#ff8800" : "#ff6600",
        });
      }
      
      bumpShake(s, 12, 0.2); // Stronger shake
      s.hitStopT = Math.max(s.hitStopT, 0.05); // Longer hit stop
      
      // Sound effect
      const xNorm = clamp((explosionX / (s.arena.w || 1)) * 2 - 1, -1, 1);
      if (isFinite(xNorm)) {
        playBeepFn(audioRef, { type: "square", f0: 80, f1: 40, dur: 0.3, gain: 0.3, pan: xNorm * 0.3 });
      }
      
      // Destroy bullet after explosion
      b.t = b.life + 1;
      continue;
    }

    // Wall bounce (only if no enemy bounce happened)
    if (!b.enemy && b.bounces > 0 && !b.boomerang) {
      let bounced = false;
      if (b.x < padding) {
        b.x = padding;
        b.vx = Math.abs(b.vx);
        bounced = true;
      } else if (b.x > levelW - padding) {
        b.x = levelW - padding;
        b.vx = -Math.abs(b.vx);
        bounced = true;
      }
      if (b.y < padding) {
        b.y = padding;
        b.vy = Math.abs(b.vy);
        bounced = true;
      } else if (b.y > levelH - padding) {
        b.y = levelH - padding;
        b.vy = -Math.abs(b.vy);
        bounced = true;
      }
      if (bounced) b.bounces -= 1;
    }

    // Apply splash damage when bullet expires or goes out of bounds (for splash weapons - player bullets only)
    if (!b.enemy && b.splashR > 0 && (b.t >= b.life || b.x < padding - 60 || b.x > levelW - padding + 60 || b.y < padding - 60 || b.y > levelH - padding + 60)) {
      const r2 = b.splashR * b.splashR;
      let hitAny = false;
      for (const ee of s.enemies) {
        if (ee.hp <= 0) continue;
        if (dist2(ee.x, ee.y, b.x, b.y) <= r2) {
          ee.hp -= b.dmg * 0.65;
          ee.hitT = 0.12;
          hitAny = true;
          const dealt = Math.max(1, Math.round(b.dmg * 0.65));
          pushCombatTextFn(s, ee.x, ee.y - 14, String(dealt), "#ff7a3d", { size: 12, life: 0.75 });
          
          // Apply poison to all enemies hit by splash (for poison flask)
          if (b.effect === "poison") {
            const poisonDuration = 3.5;
            const poisonDpsMult = 0.4;
            ee.poisonT = Math.max(ee.poisonT || 0, poisonDuration);
            ee.poisonDps = Math.max(ee.poisonDps || 0, Math.max(3, b.dmg * poisonDpsMult));
          }
        }
      }
      if (s.boss.active) {
        const bossD2 = dist2(s.boss.x, s.boss.y, b.x, b.y);
        if (bossD2 <= r2) {
          s.boss.hp -= b.dmg * 0.65;
          hitAny = true;
          const dealt = Math.max(1, Math.round(b.dmg * 0.65));
          pushCombatTextFn(s, s.boss.x, s.boss.y - s.boss.r - 10, String(dealt), "#ff7a3d", { size: 12, life: 0.75 });
          
          // Apply poison to boss hit by splash (for poison flask)
          if (b.effect === "poison") {
            // Boss poison handling would go here if needed
          }
        }
      }
      if (hitAny) {
        addParticle(s, b.x, b.y, 10, 30);
      }
    }

    // Don't destroy boomerang bullets at boundaries - they return to player
    if (!b.boomerang && (b.x < padding - 60 || b.x > levelW - padding + 60 || b.y < padding - 60 || b.y > levelH - padding + 60)) {
      b.t = b.life + 1;
    }

    if (b.enemy) {
      const rr = (p.r + b.r) * (p.r + b.r);
      if (p.hp > 0 && dist2(p.x, p.y, b.x, b.y) < rr) {
        const xNorm = clamp((p.x / (s.arena.w || 1)) * 2 - 1, -1, 1);
        const did = applyPlayerDamageFn(s, b.dmg, "projectile", { shakeMag: 4.8, shakeTime: 0.08, hitStop: 0, fromX: b.x, fromY: b.y }); // No hitStop for boss bullets to prevent freeze
        if (did && isFinite(xNorm)) {
          sfxHitFn(audioRef, xNorm);
          addHitFlash(s, p.x, p.y, "#ff5d5d");
          
          // Apply knockback to player (away from bullet direction)
          const dd = Math.hypot(b.x - p.x, b.y - p.y) || 1;
          const knockbackForce = 200; // Knockback force for bullets
          if (!p.knockbackVx) p.knockbackVx = 0;
          if (!p.knockbackVy) p.knockbackVy = 0;
          // Knockback in direction bullet was traveling (or away from player if at same position)
          if (dd > 0.1) {
            p.knockbackVx += ((p.x - b.x) / dd) * knockbackForce;
            p.knockbackVy += ((p.y - b.y) / dd) * knockbackForce;
          } else {
            // Use bullet velocity direction if positions are too close
            const bSpeed = Math.hypot(b.vx || 0, b.vy || 0) || 1;
            p.knockbackVx += ((b.vx || 0) / bSpeed) * knockbackForce;
            p.knockbackVy += ((b.vy || 0) / bSpeed) * knockbackForce;
          }
        }
        b.t = b.life + 1;
      }
      continue;
    }

    let hitSomething = false;

    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      // Skip already hit enemies
      // For boomerang: check outbound hits when going out, return hits when returning
      if (b.boomerang) {
        if (!b.returning && b.hitEnemies && b.hitEnemies.has(e)) {
          continue; // Already hit on outbound trip
        }
        if (b.returning && b.returnHitEnemies && b.returnHitEnemies.has(e)) {
          continue; // Already hit on return trip
        }
      } else if (b.hitEnemies && b.hitEnemies.has(e) && b.pierce === 0) {
        continue; // Regular bullet already hit this enemy
      }
      
      const rr = (e.r + b.r) * (e.r + b.r);
      if (dist2(e.x, e.y, b.x, b.y) < rr) {
        // Special handling for explosive bullets - check if it's seeking (delayed) or immediate (explosive mode)
        if (b.explosive && !b.injected) {
          // Check if this is a seeking explosive (injected) or immediate explosive (explosive mode weapon)
          if (b.seeking) {
            // Seeking explosive - inject onto enemy for delayed explosion
            b.injected = true;
            b.injectedEnemy = e;
            b.vx = 0; // Stop movement
            b.vy = 0;
            b.x = e.x; // Snap to enemy position
            b.y = e.y;
            b.explodeAfter = 2.0; // Start 2 second countdown
            hitSomething = true;
          } else {
            // Immediate explosive (grenade launcher) - explode on impact
            const explosionR = b.splashR || 80;
            const explosionDmg = b.dmg;
            const r2 = explosionR * explosionR;
            const explosionX = b.x;
            const explosionY = b.y;
            
            // Damage all enemies in explosion radius
            for (const ee of s.enemies) {
              if (ee.hp <= 0) continue;
              const d2 = dist2(ee.x, ee.y, explosionX, explosionY);
              if (d2 <= r2) {
                const dist = Math.sqrt(d2);
                const falloff = dist > 0 ? Math.max(0.3, 1 - (dist / explosionR)) : 1;
                const dmg = explosionDmg * falloff;
                ee.hp -= dmg;
                ee.hitT = 0.12;
                const dealt = Math.max(1, Math.round(dmg));
                pushCombatTextFn(s, ee.x, ee.y - 14, String(dealt), "#ffaa00", { size: 12, life: 0.75 });
                
                // Knockback
                if (p.knockback > 0) {
                  const dx = ee.x - explosionX;
                  const dy = ee.y - explosionY;
                  const dd = Math.hypot(dx, dy) || 1;
                  ee.x += (dx / dd) * p.knockback * 0.12;
                  ee.y += (dy / dd) * p.knockback * 0.12;
                }
              }
            }
            
            // Damage boss if in range
            if (s.boss.active && s.boss.hp > 0) {
              const bossD2 = dist2(s.boss.x, s.boss.y, explosionX, explosionY);
              if (bossD2 <= r2) {
                const dist = Math.sqrt(bossD2);
                const falloff = dist > 0 ? Math.max(0.3, 1 - (dist / explosionR)) : 1;
                s.boss.hp -= explosionDmg * falloff;
                const dealt = Math.max(1, Math.round(explosionDmg * falloff));
                pushCombatTextFn(s, s.boss.x, s.boss.y - s.boss.r - 10, String(dealt), "#ffaa00", { size: 16, life: 0.9, crit: true });
              }
            }
            
            // Explosion effect
            addExplosion(s, explosionX, explosionY, 2.0, 30);
            addParticle(s, explosionX, explosionY, 30, 30, { size: 4, speed: 1.5, glow: true });
            bumpShake(s, 8, 0.15);
            s.hitStopT = Math.max(s.hitStopT, 0.04);
            
            // Destroy bullet
            b.t = b.life + 1;
            hitSomething = true;
            continue;
          }
        }
        
        if (b.explosive && b.injected) {
          // Already injected, skip normal hit logic
          continue;
        }
        
        hitSomething = true;
        
        hitSomething = true;
        
        // Check for Big Bonk proc BEFORE applying damage
        let finalDmg = b.dmg;
        let isBigBonk = false;
        if (p.bigBonkChance > 0 && Math.random() < p.bigBonkChance) {
          finalDmg = b.dmg * (p.bigBonkMult || 1);
          isBigBonk = true;
        }
        
        // Apply elite weaknesses (extra damage)
        if (e.isElite && e.eliteWeakness) {
          if (e.eliteWeakness === "fire" && (b.effect === "burn" || b.glow)) {
            finalDmg *= 1.5; // 50% more damage from fire
          } else if (e.eliteWeakness === "poison" && b.effect === "poison") {
            finalDmg *= 1.5; // 50% more damage from poison
          } else if (e.eliteWeakness === "melee" && b.melee) {
            finalDmg *= 1.5; // 50% more damage from melee
          }
        }
        
        // Apply elite armor (damage reduction)
        if (e.isElite && e.eliteArmor > 0) {
          finalDmg *= (1 - e.eliteArmor);
        }
        
        e.hp -= finalDmg;
        e.hitT = 0.12;
        
        // Apply lifesteal if player has it
        if (p.lifesteal > 0) {
          const healAmount = finalDmg * p.lifesteal;
          p.hp = Math.min(p.maxHp, p.hp + healAmount);
          // Visual feedback for lifesteal
          if (healAmount > 0.5) {
            pushCombatTextFn(s, p.x, p.y - 30, `+${Math.round(healAmount)}`, "#4dff88", { size: 10, life: 0.6 });
          }
        }

        // Add hit flash
        addHitFlash(s, e.x, e.y, (isBigBonk || b.crit) ? "#ffd44a" : "#ffffff");

        const dealt = Math.max(1, Math.round(finalDmg));
        const hitXNorm = clamp((e.x / (s.arena.w || 1)) * 2 - 1, -1, 1);
        if (isBigBonk) {
          // Big Bonk visual feedback
          pushCombatTextFn(s, e.x, e.y - 14, `BIG BONK! ${dealt}`, "#ff0000", { size: 18, life: 1.2, crit: true });
          addExplosion(s, e.x, e.y, 1.5, 0); // Red explosion
          bumpShake(s, 6, 0.1);
          sfxCritFn(audioRef, hitXNorm);
        } else if (b.crit) {
          pushCombatTextFn(s, e.x, e.y - 14, String(dealt), "#ffd44a", { size: 14, life: 0.85, crit: true });
          addExplosion(s, e.x, e.y, 0.6, 50);
          sfxCritFn(audioRef, hitXNorm);
        } else {
          pushCombatTextFn(s, e.x, e.y - 14, String(dealt), "#ffffff", { size: 12, life: 0.75 });
          addParticle(s, e.x, e.y, 4, null, { size: 2, speed: 0.8 });
          sfxHitFn(audioRef, hitXNorm, Math.floor(Math.random() * 3));
        }

        // Poison effect always applies if bullet has poison effect, or chance-based
        const procPoison = b.effect === "poison" || (p.poisonChance > 0 && Math.random() < p.poisonChance);
        // Changed freeze to slow effect (less OP)
        let procSlow = false;
        if (b.effect === "freeze") {
          procSlow = true;
        } else if (p.iceCrystalFreezeChance && Math.random() < p.iceCrystalFreezeChance) {
          procSlow = true;
        } else if (p.freezeChance > 0 && Math.random() < p.freezeChance) {
          procSlow = true;
        }
        const procBurn = b.effect === "burn";

        if (procPoison) {
          // Poison DoT: longer duration and higher DPS for poison flask
          const poisonDuration = b.effect === "poison" ? 3.5 : 2.4;
          const poisonDpsMult = b.effect === "poison" ? 0.4 : 0.32;
          e.poisonT = Math.max(e.poisonT || 0, poisonDuration);
          e.poisonDps = Math.max(e.poisonDps || 0, Math.max(3, b.dmg * poisonDpsMult));
        }
        
        if (procSlow) {
          const slowDuration = p.iceCrystalFreezeChance ? (p.iceCrystalFreezeDuration || 1.2) : 1.05;
          const slowAmount = 0.5; // 50% speed reduction
          e.slowT = Math.max(e.slowT || 0, slowDuration);
          e.slowMult = slowAmount; // Store slow multiplier
          
          // Ice Crystal AoE slow - slow nearby enemies
          if (p.iceCrystalFreezeRadius && p.iceCrystalFreezeChance && Math.random() < p.iceCrystalFreezeChance) {
            const slowR2 = p.iceCrystalFreezeRadius * p.iceCrystalFreezeRadius;
            for (const ee of s.enemies) {
              if (ee.hp <= 0 || ee === e) continue;
              if (dist2(ee.x, ee.y, e.x, e.y) <= slowR2) {
                ee.slowT = Math.max(ee.slowT || 0, slowDuration);
                ee.slowMult = slowAmount;
              }
            }
          }
        }
        if (procBurn) {
          e.burnT = Math.max(e.burnT || 0, 2.0);
          e.burnDps = Math.max(e.burnDps || 0, Math.max(3, b.dmg * 0.22));
        }

        // For thrown weapons (poison flask), trigger splash on hit
        if (b.splashR > 0 && b.effect === "poison") {
          const r2 = b.splashR * b.splashR;
          for (const ee of s.enemies) {
            if (ee.hp <= 0) continue;
            if (ee === e) continue; // Already hit the main target
            if (dist2(ee.x, ee.y, b.x, b.y) <= r2) {
              ee.hp -= b.dmg * 0.65;
              ee.hitT = 0.12;
              const dealt = Math.max(1, Math.round(b.dmg * 0.65));
              pushCombatTextFn(s, ee.x, ee.y - 14, String(dealt), "#4dff88", { size: 12, life: 0.75 });
              
              // Apply poison to all enemies hit by splash
              const poisonDuration = 3.5;
              const poisonDpsMult = 0.4;
              ee.poisonT = Math.max(ee.poisonT || 0, poisonDuration);
              let poisonDps = Math.max(3, b.dmg * poisonDpsMult);
              // Elite weakness to poison increases poison damage
              if (ee.isElite && ee.eliteWeakness === "poison") {
                poisonDps *= 1.5;
              }
              ee.poisonDps = Math.max(ee.poisonDps || 0, poisonDps);
            }
          }
          if (s.boss.active) {
            const bossD2 = dist2(s.boss.x, s.boss.y, b.x, b.y);
            if (bossD2 <= r2) {
              s.boss.hp -= b.dmg * 0.65;
              const dealt = Math.max(1, Math.round(b.dmg * 0.65));
              pushCombatTextFn(s, s.boss.x, s.boss.y - s.boss.r - 10, String(dealt), "#4dff88", { size: 12, life: 0.75 });
            }
          }
          // Green poison splash effect
          addParticle(s, b.x, b.y, 15, 120, { size: 4, speed: 1.0 });
          // Remove bullet after splash
          b.t = b.life + 1;
        } else if (b.splashR > 0) {
          // Regular splash (non-poison) - only on expiration
          const r2 = b.splashR * b.splashR;
          for (const ee of s.enemies) {
            if (ee.hp <= 0) continue;
            if (ee === e) continue;
            if (dist2(ee.x, ee.y, b.x, b.y) <= r2) {
              ee.hp -= b.dmg * 0.65;
              ee.hitT = 0.12;
              const dealt = Math.max(1, Math.round(b.dmg * 0.65));
              pushCombatTextFn(s, ee.x, ee.y - 14, String(dealt), "#ff7a3d", { size: 12, life: 0.75 });
            }
          }
          if (s.boss.active) {
            const bossD2 = dist2(s.boss.x, s.boss.y, b.x, b.y);
            if (bossD2 <= r2) {
              s.boss.hp -= b.dmg * 0.65;
              const dealt = Math.max(1, Math.round(b.dmg * 0.65));
              pushCombatTextFn(s, s.boss.x, s.boss.y - s.boss.r - 10, String(dealt), "#ff7a3d", { size: 12, life: 0.75 });
            }
          }
          addParticle(s, b.x, b.y, 10, 30);
        }

        // Apply knockback from player's knockback stat
        if (p.knockback > 0) {
          const dx = e.x - b.x;
          const dy = e.y - b.y;
          const dd = Math.hypot(dx, dy) || 1;
          // Increased knockback multiplier from 0.03 to 0.15 (5x stronger)
          e.x += (dx / dd) * p.knockback * 0.15;
          e.y += (dy / dd) * p.knockback * 0.15;
        }
        
        // Sound already played above for crit/normal hits

        // Track hit enemies for boomerang and bounce (to prevent re-hitting)
        if (b.boomerang) {
          // For boomerang, track hits separately for outbound and return trips
          if (!b.returning) {
            // Outbound trip - track in hitEnemies
            if (!b.hitEnemies) {
              b.hitEnemies = new Set();
            }
            b.hitEnemies.add(e);
          } else {
            // Return trip - track in returnHitEnemies
            if (!b.returnHitEnemies) {
              b.returnHitEnemies = new Set();
            }
            b.returnHitEnemies.add(e);
          }
        } else {
          // Regular bullets - track in hitEnemies
          if (!b.hitEnemies) {
            b.hitEnemies = new Set();
          }
          b.hitEnemies.add(e);
        }
        
        // Handle pierce (boomerang pierces all, regular pierce has count)
        if (b.boomerang || b.pierce > 0) {
          if (b.pierce > 0 && !b.boomerang) {
            b.pierce -= 1;
          }
          // Continue to next enemy (don't break) - boomerang always pierces
        } else if (b.bounces > 0) {
          // Always bounce - find nearest enemy that hasn't been hit
          let nearestEnemy = null;
          let nearestD2 = Infinity;
          for (const ee of s.enemies) {
            if (ee.hp <= 0 || ee === e || b.hitEnemies.has(ee)) continue; // Skip dead, current, and already hit enemies
            const d2 = dist2(ee.x, ee.y, b.x, b.y);
            if (d2 < nearestD2) {
              nearestD2 = d2;
              nearestEnemy = ee;
            }
          }
          // Also check boss
          if (s.boss.active && s.boss.hp > 0 && !b.hitEnemies.has(s.boss)) {
            const bossD2 = dist2(s.boss.x, s.boss.y, b.x, b.y);
            if (bossD2 < nearestD2) {
              nearestEnemy = s.boss;
            }
          }
          
          if (nearestEnemy) {
            // Bounce to nearest enemy - redirect bullet immediately
            const dx = nearestEnemy.x - b.x;
            const dy = nearestEnemy.y - b.y;
            const dist = Math.hypot(dx, dy) || 1;
            const speed = Math.hypot(b.vx, b.vy);
            b.vx = (dx / dist) * speed;
            b.vy = (dy / dist) * speed;
            b.bounces -= 1;
            // Move bullet slightly toward target to ensure it hits
            b.x += (dx / dist) * 5;
            b.y += (dy / dist) * 5;
            // Continue to hit the bounced target (don't break)
            // The bullet will hit nearestEnemy in this same frame
          } else {
            // No more targets, destroy bullet
            b.t = b.life + 1;
            break;
          }
          // Continue loop to hit bounced target immediately
        } else {
          // No pierce, no bounces - destroy bullet
          b.t = b.life + 1;
          break;
        }
      }
    }

    if (!hitSomething && s.boss.active && b.t <= b.life) {
      const rr = (s.boss.r + b.r) * (s.boss.r + b.r);
      if (dist2(s.boss.x, s.boss.y, b.x, b.y) < rr) {
        // Special handling for explosive bullets - inject onto boss instead of dealing damage
        if (b.explosive && !b.injected) {
          // Inject bullet onto boss
          b.injected = true;
          b.injectedEnemy = s.boss;
          b.vx = 0; // Stop movement
          b.vy = 0;
          b.x = s.boss.x; // Snap to boss position
          b.y = s.boss.y;
          b.explodeAfter = 2.0; // Start 2 second countdown
          
          // Cooldown is now started immediately when ability is used, not when bullet injects
          // Remove old cooldown logic
          
          // Visual feedback for injection
          addParticle(s, s.boss.x, s.boss.y, 8, 40, { size: 2, speed: 0.6 });
          pushCombatTextFn(s, s.boss.x, s.boss.y - s.boss.r - 10, "INJECTED", "#ffaa00", { size: 12, life: 0.8 });
          
          // Don't destroy bullet, don't deal damage - it will explode later
          continue; // Skip rest of hit processing
        }
        
        s.boss.hp -= b.dmg;
        b.t = b.life + 1;

        const dealt = Math.max(1, Math.round(b.dmg));
        if (b.crit) pushCombatTextFn(s, s.boss.x, s.boss.y - s.boss.r - 10, String(dealt), "#ffd44a", { size: 14, life: 0.85, crit: true });
        else pushCombatTextFn(s, s.boss.x, s.boss.y - s.boss.r - 10, String(dealt), "#ffffff", { size: 12, life: 0.75 });

        const xNorm = clamp((b.x / (s.arena.w || 1)) * 2 - 1, -1, 1);
        if (isFinite(xNorm)) {
          sfxHitFn(audioRef, xNorm);
        }
      }
    }
  }

  // Filter out bullets, but keep explosive bullets (seeking or injected) that haven't exploded yet
  s.bullets = s.bullets.filter((b) => {
    // Keep explosive bullets even if their life expired:
    // - Injected bullets explode on timer (explodeAfter), not life
    // - Seeking bullets need to find a target, so keep them alive longer
    if (b.explosive) {
      if (b.injected && b.injectedEnemy && b.explodeAfter !== undefined && b.explodeAfter > 0) {
        return true; // Injected bullet waiting to explode
      }
      if (b.seeking && !b.injected) {
        // Seeking bullet - explode after 8 seconds if it hasn't found a target (matches ability cooldown)
        const maxSeekTime = 8.0; // Match ability cooldown (8 seconds)
        if (b.t > maxSeekTime) {
          // Bullet expired - explode it now
          const explosionR = b.explosionRadius || 120;
          const explosionDmg = b.explosionDmg || b.dmg * 0.8;
          const r2 = explosionR * explosionR;
          const explosionX = b.x;
          const explosionY = b.y;
          const p = s.player; // Get player reference for knockback
          
          // Damage all enemies in explosion radius
          for (const ee of s.enemies) {
            if (ee.hp <= 0) continue;
            const d2 = dist2(ee.x, ee.y, explosionX, explosionY);
            if (d2 <= r2) {
              const dist = Math.sqrt(d2);
              const falloff = dist > 0 ? Math.max(0.3, 1 - (dist / explosionR)) : 1;
              const dmg = explosionDmg * falloff;
              ee.hp -= dmg;
              ee.hitT = 0.12;
              const dealt = Math.max(1, Math.round(dmg));
              pushCombatTextFn(s, ee.x, ee.y - 14, String(dealt), "#ffaa00", { size: 12, life: 0.75 });
              
              // Knockback
              if (p && p.knockback > 0) {
                const dx = ee.x - explosionX;
                const dy = ee.y - explosionY;
                const dd = Math.hypot(dx, dy) || 1;
                ee.x += (dx / dd) * p.knockback * 0.12;
                ee.y += (dy / dd) * p.knockback * 0.12;
              }
            }
          }
          
          // Damage boss if in range
          if (s.boss.active && s.boss.hp > 0) {
            const bossD2 = dist2(s.boss.x, s.boss.y, explosionX, explosionY);
            if (bossD2 <= r2) {
              const dist = Math.sqrt(bossD2);
              const falloff = dist > 0 ? Math.max(0.3, 1 - (dist / explosionR)) : 1;
              s.boss.hp -= explosionDmg * falloff;
              const dealt = Math.max(1, Math.round(explosionDmg * falloff));
              pushCombatTextFn(s, s.boss.x, s.boss.y - s.boss.r - 10, String(dealt), "#ffaa00", { size: 16, life: 0.9, crit: true });
            }
          }
          
          // Explosion effect
          addExplosion(s, explosionX, explosionY, 2.0, 30);
          addParticle(s, explosionX, explosionY, 30, 30, { size: 4, speed: 1.5, glow: true });
          bumpShake(s, 8, 0.15);
          s.hitStopT = Math.max(s.hitStopT, 0.04);
          
          return false; // Destroy the bullet after explosion
        }
        return true; // Still seeking, keep it alive
      }
    }
    // Boomerang bullets persist until they return to player (handled in update loop)
    // But if they're marked for destruction (b.t > b.life), destroy them
    if (b.boomerang) {
      return b.t <= b.life; // Keep boomerang bullets alive until they return (then b.t > b.life)
    }
    // Normal bullets are destroyed when life expires
    return b.t <= b.life;
  });
}
