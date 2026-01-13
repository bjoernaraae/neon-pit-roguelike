import { clamp } from "../../utils/math.js";
import { bumpShake, addExplosion, addParticle } from "../effects/VisualEffects.js";
import { pushCombatText as pushCombatTextFn } from "../effects/CombatText.js";
import { resolveKinematicOverlap } from "./CollisionSystem.js";
import { LineDashAbility, BOSS_ABILITY_STATE } from "./BossAbilitySystem.js";

/**
 * Update boss: abilities, movement, collision, phase transitions
 */
export function updateBoss(s, dt, applyPlayerDamageFn, sfxHitFn) {
  if (!s.boss.active) return;

  const p = s.player;
  const { w, h, padding } = s.arena;

  // Update boss timer
  s.boss.timeLeft = Math.max(0, s.boss.timeLeft - dt);

  // Check phase transition (Phase 2 at 50% HP)
  const wasPhase2 = s.boss.enraged;
  const isPhase2 = s.boss.hp / s.boss.maxHp <= 0.5;
  if (isPhase2 && !wasPhase2) {
    // Phase 2 transition effect
    s.boss.enraged = true;
    bumpShake(s, 12, 0.15);
    addExplosion(s, s.boss.x, s.boss.y, 3.0, 200);
    addParticle(s, s.boss.x, s.boss.y, 50, 100, { size: 6, speed: 2.0, glow: true });
    pushCombatTextFn(s, s.boss.x, s.boss.y - s.boss.r - 20, "ENRAGED!", "#ff0000", { size: 20, life: 2.0, crit: true });
  }

  // Update boss controller (handles abilities and rotation)
  if (s.boss.controller) {
    try {
      s.boss.controller.update(p, dt, s.floor, s.levelData);
      
      // Check for ability hits
      const hitResult = s.boss.controller.checkHits(p, s.floor);
      if (hitResult) {
        const did = applyPlayerDamageFn(s, hitResult.damage, hitResult.ability.name, {
          shakeMag: 2.5,
          shakeTime: 0.08,
          hitStop: 0.02,
          fromX: s.boss.x,
          fromY: s.boss.y
        });
        if (did) {
          const xNorm = clamp((p.x / (s.arena.w || 1)) * 2 - 1, -1, 1);
          if (isFinite(xNorm)) {
            sfxHitFn(xNorm);
          }
        }
      }
      
      // Handle burning ground from phase 2 abilities
      if (s.boss.controller.abilities) {
        for (const ability of s.boss.controller.abilities) {
          if (ability && ability.burningGround && ability.burningGround.life > 0) {
            ability.burningGround.t += dt;
            ability.burningGround.life -= dt;
            
            if (ability.burningGround.life > 0) {
              // Check if player is in burning ground
              const dx = p.x - ability.burningGround.x;
              const dy = p.y - ability.burningGround.y;
              const dist = Math.hypot(dx, dy);
              const angle = Math.atan2(dy, dx);
              let angleDiff = angle - ability.burningGround.angle;
              // Normalize angle difference
              while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
              while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
              
              if (dist <= ability.burningGround.range && Math.abs(angleDiff) <= ability.burningGround.angleWidth / 2) {
                ability.burningGround.lastTick = (ability.burningGround.lastTick || 0) + dt;
                if (ability.burningGround.lastTick >= ability.burningGround.tickRate) {
                  ability.burningGround.lastTick = 0;
                  const did = applyPlayerDamageFn(s, ability.burningGround.dmg, "burning ground", {
                    shakeMag: 0.5,
                    shakeTime: 0.02,
                    hitStop: 0,
                    fromX: ability.burningGround.x,
                    fromY: ability.burningGround.y
                  });
                }
              }
            } else {
              // Remove expired burning ground
              ability.burningGround = null;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in boss controller update:', error);
      // Reset controller on error to prevent freeze
      s.boss.controller = null;
    }
  }

  // Boss movement (only when not in active ability state that controls movement)
  // Line Dash ability handles its own movement, so skip normal movement during it
  const isDashing = s.boss.controller && s.boss.controller.currentAbility && 
                    s.boss.controller.currentAbility instanceof LineDashAbility &&
                    s.boss.controller.currentAbility.state === BOSS_ABILITY_STATE.ACTIVE;
  const currentState = s.boss.controller?.getCurrentState();
  if (currentState !== BOSS_ABILITY_STATE.ACTIVE || isDashing) {
    const dx = p.x - s.boss.x;
    const dy = p.y - s.boss.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;

    const enr = s.boss.hp / s.boss.maxHp < 0.5; // Phase 2 at 50%
    s.boss.enraged = enr;
    const bossSpeed = (84 + s.floor * 3.5) * (enr ? 1.2 : 1);

    let newX = s.boss.x + ux * bossSpeed * dt;
    let newY = s.boss.y + uy * bossSpeed * dt;
    
    // Clamp boss to walkable areas (rooms/corridors)
    if (s.levelData && s.boss.controller) {
      const clamped = s.boss.controller.clampToWalkable(newX, newY, s.levelData);
      newX = clamped.x;
      newY = clamped.y;
    } else {
      // Fallback to simple bounds
      if (s.levelData) {
        newX = clamp(newX, padding, s.levelData.w - padding);
        newY = clamp(newY, padding, s.levelData.h - padding);
      } else {
        newX = clamp(newX, padding, w - padding);
        newY = clamp(newY, padding, h - padding);
      }
    }
    
    s.boss.x = newX;
    s.boss.y = newY;
  }

  // Boss collision with player
  const bossBounds = s.levelData ? {
    w: s.levelData.w,
    h: s.levelData.h,
    padding: padding
  } : s.arena;
  
  // Always check collision - resolveKinematicOverlap handles jump safety
  // Only skip if in landing grace period
  if (p.jumpLandingGrace !== undefined && p.jumpLandingGrace > 0) {
    // Just landed, skip collision during grace period
  } else {
    const overlapped = resolveKinematicOverlap(p, s.boss, bossBounds, s.levelData);
    if (overlapped) {
      const xNorm = clamp((p.x / (s.arena.w || 1)) * 2 - 1, -1, 1);
      const did = applyPlayerDamageFn(s, 30 + s.floor * 1.1, "boss contact", { shakeMag: 2.2, shakeTime: 0.07, hitStop: 0.01, fromX: s.boss.x, fromY: s.boss.y });
      if (did && isFinite(xNorm)) {
        sfxHitFn(xNorm);
        
        // Apply knockback to player (away from boss)
        const dd = Math.hypot(s.boss.x - p.x, s.boss.y - p.y) || 1;
        const knockbackForce = 220; // Stronger knockback from boss
        if (!p.knockbackVx) p.knockbackVx = 0;
        if (!p.knockbackVy) p.knockbackVy = 0;
        p.knockbackVx += ((p.x - s.boss.x) / dd) * knockbackForce;
        p.knockbackVy += ((p.y - s.boss.y) / dd) * knockbackForce;
      }
    }
  }
}
