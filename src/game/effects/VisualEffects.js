/**
 * Visual Effects System
 * 
 * Handles screen shake, particles, explosions, and hit flashes.
 * All functions mutate the state object's effect arrays.
 */

import { rand } from "../../utils/math.js";

/**
 * Trigger screen shake effect
 * @param {Object} state - Game state object
 * @param {number} magnitude - Shake intensity
 * @param {number} time - Shake duration in seconds
 */
export function bumpShake(state, magnitude, time) {
  state.shakeMag = Math.max(state.shakeMag, magnitude);
  state.shakeT = Math.max(state.shakeT, time);
  state.shakeDur = Math.max(state.shakeDur, time);
}

/**
 * Add particle effect
 * @param {Object} state - Game state object
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} n - Number of particles (default 6)
 * @param {number|null} hue - Hue value or null for random
 * @param {Object} opts - Options: size, speed, lifeMult, gravity, glow, trail
 */
export function addParticle(state, x, y, n = 6, hue = null, opts = {}) {
  const size = opts.size || rand(1.5, 3.6);
  const speed = opts.speed || 1;
  const lifeMult = opts.lifeMult || 1;
  const gravity = opts.gravity !== false;
  
  for (let i = 0; i < n; i++) {
    state.particles.push({
      x,
      y,
      vx: rand(-160, 160) * speed,
      vy: rand(-210, 110) * speed,
      r: rand(size * 0.8, size * 1.2),
      t: 0,
      life: rand(0.22, 0.55) * lifeMult,
      hue,
      glow: opts.glow || false,
      trail: opts.trail || false,
    });
  }
}

/**
 * Add explosion particle burst
 * @param {Object} state - Game state object
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} size - Explosion size multiplier (default 1)
 * @param {number|null} hue - Hue value or null for random
 */
export function addExplosion(state, x, y, size = 1, hue = null) {
  const count = Math.round(12 * size);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const speed = rand(180, 320) * size;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: rand(2, 5) * size,
      t: 0,
      life: rand(0.3, 0.7),
      hue: hue || rand(0, 360),
      glow: true,
    });
  }
}

/**
 * Add hit flash effect (brief white flash on hit)
 * @param {Object} state - Game state object
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {string} color - Flash color (default "#ffffff")
 */
export function addHitFlash(state, x, y, color = "#ffffff") {
  state.hitFlashes = state.hitFlashes || [];
  state.hitFlashes.push({
    x,
    y,
    t: 0,
    life: 0.15,
    color,
    size: 1,
  });
}
