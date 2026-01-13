/**
 * Bullet Factory
 * 
 * Creates bullet/projectile objects with various configurations.
 */

import { clamp, rand } from "../../utils/math.js";

/**
 * Create and shoot a bullet
 * @param {Object} s - Game state
 * @param {number} x - Start X position
 * @param {number} y - Start Y position
 * @param {number} angle - Bullet angle (radians)
 * @param {number} dmg - Damage
 * @param {number} speed - Bullet speed
 * @param {Object} opts - Options (pierce, enemy, color, crit, etc.)
 * @param {Function} sfxShootFn - Sound effect function for shooting
 * @returns {Object} Created bullet
 */
export function shootBullet(s, x, y, angle, dmg, speed, opts, sfxShootFn) {
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;

  const bullet = {
    x,
    y,
    px: x,
    py: y,
    vx,
    vy,
    r: opts?.r ?? 4,
    life: opts?.life ?? 1.05,
    t: 0,
    dmg,
    pierce: opts?.pierce ?? 0,
    enemy: !!opts?.enemy,
    color: opts?.color ?? "#e6e8ff",
    crit: !!opts?.crit,
    knock: opts?.knock ?? 0,
    bounces: opts?.bounces ?? 0,
    effect: opts?.effect ?? null,
    splashR: opts?.splashR ?? 0,
    glow: opts?.glow ?? false, // For firey effects
    boomerang: opts?.boomerang ?? false, // For boomerang weapons
    startX: x, // For boomerang return
    startY: y, // For boomerang return
    maxDist: opts?.maxDist ?? 400, // Max distance before returning
    originalSpeed: speed, // Store original speed for return phase
    hitEnemies: new Set(), // Track hit enemies for pierce/boomerang
    isBone: opts?.isBone ?? false, // For bone rotation
    rotation: opts?.isBone ? angle : (opts?.boomerang ? 0 : angle), // Initial rotation angle
    weaponId: opts?.weaponId, // Track which weapon this belongs to
    explosive: opts?.explosive || false, // Delayed explosive bullet
    injected: opts?.injected || false, // Whether bullet is injected onto enemy
    injectedEnemy: opts?.injectedEnemy || null, // Reference to enemy bullet is attached to
    explodeAfter: opts?.explodeAfter || 0, // Time until explosion
    explosionRadius: opts?.explosionRadius || 0, // Explosion AoE radius
    explosionDmg: opts?.explosionDmg || 0, // Explosion damage
    seeking: opts?.seeking || false, // Whether bullet seeks nearest enemy
  };

  s.bullets.push(bullet);

  const xNorm = clamp((x / (s.arena.w || 1)) * 2 - 1, -1, 1);
  if (!opts?.enemy && isFinite(xNorm)) {
    const soundVariant = opts?.soundVariant ?? Math.floor(Math.random() * 3);
    sfxShootFn(xNorm, soundVariant);
  }

  return bullet;
}
