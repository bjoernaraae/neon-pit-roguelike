import { clamp } from "../../utils/math.js";
import { bumpShake, addParticle, addExplosion } from "../effects/VisualEffects.js";
import { ISO_MODE } from "../../data/constants.js";
import { transformInputForIsometric } from "../../rendering/IsometricRenderer.js";

/**
 * Use player's active ability (blink, quickdraw, slam, flamewalker)
 */
export function useAbility(s, acquireTargetFn, shootBulletFn, playBeepFn, keysRef) {
  const p = s.player;
  if (p.abilityT > 0 || p.hp <= 0) return;

  const keys = keysRef.current;
  let mx = (keys.has("ArrowRight") || keys.has("d") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("a") ? 1 : 0);
  let my = (keys.has("ArrowDown") || keys.has("s") ? 1 : 0) - (keys.has("ArrowUp") || keys.has("w") ? 1 : 0);

  // Transform input directions for isometric mode
  let ux, uy;
  if (ISO_MODE && (mx !== 0 || my !== 0)) {
    const transformed = transformInputForIsometric(mx, my);
    ux = transformed.x;
    uy = transformed.y;
  } else {
    const len = Math.hypot(mx, my) || 1;
    ux = len ? mx / len : 1;
    uy = len ? my / len : 0;
  }

  // BLINK ABILITY
  if (p.abilityId === "blink") {
    const dist = 190;
    // Use levelData bounds if available, otherwise fall back to arena
    const padding = s.arena.padding;
    const maxX = s.levelData ? s.levelData.w - padding : s.arena.w - padding;
    const maxY = s.levelData ? s.levelData.h - padding : s.arena.h - padding;
    p.x = clamp(p.x + ux * dist, padding, maxX);
    p.y = clamp(p.y + uy * dist, padding, maxY);
    p.iFrames = Math.max(p.iFrames, 0.4);
    addParticle(s, p.x, p.y, 16, 190);
    playBeepFn({ type: "triangle", f0: 840, f1: 520, dur: 0.09, gain: 0.14, pan: 0 });
    p.abilityT = p.abilityCd * (p.abilityCdMult || 1);
    return;
  }

  // QUICKDRAW ABILITY (Explosive Shot)
  if (p.abilityId === "quickdraw") {
    // Start cooldown immediately to prevent spamming (8 second cooldown)
    p.abilityT = p.abilityCd * (p.abilityCdMult || 1);

    const tgt = acquireTargetFn(s, p.x, p.y);
    if (tgt) {
      const dx = tgt.x - p.x;
      const dy = tgt.y - p.y;
      const angle = Math.atan2(dy, dx);

      // Reduced damage (1.2x total weapon damage instead of 2.5x)
      const totalDmg = (p.weapons ? p.weapons.reduce((sum, w) => sum + w.weaponDamage, 0) : 0) * 1.2;
      // Guaranteed crit for explosive shot
      const dmg = totalDmg * 1.6;

      // Fire one large explosive bullet that seeks enemies
      const explosiveBullet = shootBulletFn(s, p.x, p.y, angle, dmg, 100, {
        r: 7.0, // Large bullet
        pierce: 0, // No pierce - it will stick to enemy
        color: "#ffaa00", // Orange/gold color
        crit: true, // Always crit
        knock: 0, // No knockback on hit (will explode later)
        bounces: 0,
        effect: null,
        life: 12.0, // Longer life since it's very slow
      });

      // Mark this bullet as injectable explosive
      explosiveBullet.explosive = true;
      explosiveBullet.injected = false; // Not yet injected onto enemy
      explosiveBullet.injectedEnemy = null; // Will store reference to enemy
      explosiveBullet.explodeAfter = 2.0; // Explode 2 seconds after injection
      explosiveBullet.explosionRadius = 120; // Large explosion radius
      explosiveBullet.explosionDmg = dmg * 0.8; // Explosion damage (reduced from 1.2x)
      explosiveBullet.seeking = true; // Bullet seeks nearest enemy
      explosiveBullet.playerAbilityRef = null; // No longer needed since cooldown starts immediately

      // Visual effects
      addParticle(s, p.x, p.y, 20, 40);
      playBeepFn({ type: "square", f0: 200, f1: 120, dur: 0.12, gain: 0.18, pan: 0 }); // Deeper, more powerful sound
    } else {
      // No target found - still fire bullet (it will seek when enemies spawn)
      const totalDmg = (p.weapons ? p.weapons.reduce((sum, w) => sum + w.weaponDamage, 0) : 0) * 1.2;
      const dmg = totalDmg * 1.6;

      const explosiveBullet = shootBulletFn(s, p.x, p.y, 0, dmg, 100, {
        r: 7.0,
        pierce: 0,
        color: "#ffaa00",
        crit: true,
        knock: 0,
        bounces: 0,
        effect: null,
        life: 12.0,
      });

      explosiveBullet.explosive = true;
      explosiveBullet.injected = false;
      explosiveBullet.injectedEnemy = null;
      explosiveBullet.explodeAfter = 2.0;
      explosiveBullet.explosionRadius = 120;
      explosiveBullet.explosionDmg = dmg * 0.8;
      explosiveBullet.seeking = true;
      explosiveBullet.playerAbilityRef = null;

      // Visual effects
      addParticle(s, p.x, p.y, 20, 40);
      playBeepFn({ type: "square", f0: 200, f1: 120, dur: 0.12, gain: 0.18, pan: 0 });
    }
    return;
  }

  // SLAM ABILITY (Ground Slam AoE)
  if (p.abilityId === "slam") {
    const r = 95 * p.sizeMult;
    // Calculate actual damage from weapons
    const totalWeaponDmg = p.weapons ? p.weapons.reduce((sum, w) => sum + w.weaponDamage, 0) : 0;
    const dmg = totalWeaponDmg * 1.35;
    bumpShake(s, 8, 0.12); // Stronger screen shake
    s.hitStopT = Math.max(s.hitStopT, 0.02);
    addParticle(s, p.x, p.y, 22, 40);

    // Shockwave effect for slam (replaces slice)
    for (let i = 0; i < 3; i++) {
      s.floaters.push({
        x: p.x,
        y: p.y,
        t: i * 0.05,
        life: 0.4,
        type: "shockwave",
        r: r * 0.3 + i * r * 0.35,
        color: i === 0 ? "#ff7a3d" : i === 1 ? "#ffaa44" : "#ffd44a",
      });
    }

    // Impact particles
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      s.floaters.push({
        x: p.x,
        y: p.y,
        t: 0,
        life: 0.35,
        type: "particle",
        vx: Math.cos(angle) * (80 + Math.random() * 40),
        vy: Math.sin(angle) * (80 + Math.random() * 40),
        color: "#ffd44a",
      });
    }

    // Damage and knockback enemies in radius
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      const d2v = Math.hypot(p.x - e.x, p.y - e.y) ** 2;
      if (d2v <= (r + e.r) * (r + e.r)) {
        e.hp -= dmg;
        e.hitT = 0.14;
        const dealt = Math.max(1, Math.round(dmg));
        s.floaters.push({
          x: e.x,
          y: e.y - 14,
          t: 0,
          life: 0.85,
          type: "text",
          text: String(dealt),
          color: "#ffd44a",
          size: 14,
          crit: true,
          vx: 0,
          vy: -40,
        });

        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const dd = Math.hypot(dx, dy) || 1;
        // Increased knockback for slam
        const knockbackDist = 95;
        e.x += (dx / dd) * knockbackDist;
        e.y += (dy / dd) * knockbackDist;
      }
    }

    playBeepFn({ type: "square", f0: 160, f1: 90, dur: 0.12, gain: 0.18, pan: 0 });

    p.abilityT = p.abilityCd * (p.abilityCdMult || 1);
    return;
  }

  // FLAMEWALKER ABILITY (Fire trail)
  if (p.abilityId === "flamewalker") {
    // Leave a trail of fire behind the player
    const totalWeaponDmg = p.weapons ? p.weapons.reduce((sum, w) => sum + w.weaponDamage, 0) : 0;
    const dmgPerTick = totalWeaponDmg * 0.3; // 30% weapon damage per tick

    if (!s.burningAreas) s.burningAreas = [];
    s.burningAreas.push({
      x: p.x,
      y: p.y,
      r: 60, // Fire area radius
      t: 0,
      life: 4.0, // Burn for 4 seconds
      dmg: dmgPerTick,
      tickRate: 0.5, // Damage every 0.5 seconds
      lastTick: 0,
    });

    addExplosion(s, p.x, p.y, 1.0, 40);
    playBeepFn({ type: "square", f0: 160, f1: 90, dur: 0.12, gain: 0.18, pan: 0 });
    p.abilityT = p.abilityCd * (p.abilityCdMult || 1);
  }
}
