/**
 * Weapon definitions and configurations
 */

import { TYPE } from "./constants.js";
import { clamp } from "../utils/math.js";

/**
 * Creates the weapons array with icon drawing functions
 * @param {Function} makeIconDraw - Function that creates icon drawing functions
 * @returns {Array} Array of weapon definitions
 */
export function createWeapons(makeIconDraw) {
  return [
    {
      id: "revolver",
      name: "Revolver",
      type: TYPE.WEAPON,
      base: {
        attackCooldown: 0.68, // Slower firing speed
        weaponDamage: 9,
        projectiles: 1,
        pierce: 0,
        spread: 0.02,
        bounces: 1, // Revolver bounces to 1 additional target
        effect: null,
        mode: "bullet",
      },
      levelBonuses: [
        (p) => (p.weaponDamage *= 1.08), // Reduced from 1.12 to 1.08
        (p) => (p.attackCooldown = Math.max(0.24, p.attackCooldown * 0.92)),
        (p) => (p.critChance = clamp(p.critChance + 0.03, 0, 0.8)),
        (p) => {
          // For weapons, p is the weapon object, not the player
          if (p.projectiles !== undefined) {
            p.projectiles = clamp(p.projectiles + 1, 1, 16);
          }
        },
        (p) => (p.weaponDamage *= 1.12), // Reduced from 1.16 to 1.12
      ],
      icon: makeIconDraw("revolver"),
    },
    {
      id: "firestaff",
      name: "Firestaff",
      type: TYPE.WEAPON,
      base: {
        attackCooldown: 0.78,
        weaponDamage: 12,
        projectiles: 1,
        pierce: 0,
        spread: 0.05,
        bounces: 0,
        effect: "burn",
        mode: "splash",
        splashR: 54,
      },
      levelBonuses: [
        (p) => (p.weaponDamage *= 1.10), // Reduced from 1.14 to 1.10
        (p) => (p.attackCooldown = Math.max(0.3, p.attackCooldown * 0.9)),
        (p) => (p.sizeMult *= 1.08),
        (p) => (p.weaponDamage *= 1.14), // Reduced from 1.18 to 1.14
      ],
      icon: makeIconDraw("staff"),
    },
    {
      id: "sword",
      name: "Sword",
      type: TYPE.WEAPON,
      base: {
        attackCooldown: 0.5,
        weaponDamage: 16,
        projectiles: 0,
        pierce: 999,
        spread: 0,
        bounces: 0,
        effect: null,
        mode: "melee",
        meleeR: 68,
      },
      levelBonuses: [
        (p) => (p.weaponDamage *= 1.11), // Reduced from 1.15 to 1.11
        (p) => (p.attackCooldown = Math.max(0.22, p.attackCooldown * 0.9)),
        (p) => (p.sizeMult *= 1.06),
        (p) => (p.weaponDamage *= 1.16), // Reduced from 1.20 to 1.16
      ],
      icon: makeIconDraw("sword"),
    },
    {
      id: "bone",
      name: "Bone",
      type: TYPE.WEAPON,
      base: {
        attackCooldown: 0.95, // Slower attack speed for level 1
        weaponDamage: 8,
        projectiles: 1,
        pierce: 0,
        spread: 0.12,
        bounces: 1, // Default bounce once when hitting enemy
        effect: null,
        mode: "bullet",
      },
      levelBonuses: [
        (p) => (p.weaponDamage *= 1.08), // Reduced from 1.12 to 1.08
        (p) => (p.bounces = clamp(p.bounces + 1, 0, 7)),
        (p) => (p.attackCooldown = Math.max(0.22, p.attackCooldown * 0.92)),
        (p) => {
          // For weapons, p is the weapon object, not the player
          if (p.projectiles !== undefined) {
            p.projectiles = clamp(p.projectiles + 1, 1, 16);
          }
        },
        (p) => (p.weaponDamage *= 1.12), // Reduced from 1.16 to 1.12
      ],
      icon: makeIconDraw("revolver"),
    },
    {
      id: "poison_flask",
      name: "Poison Flask",
      type: TYPE.WEAPON,
      base: {
        attackCooldown: 2.2, // Very slow attack speed - thrown flask
        weaponDamage: 10,
        projectiles: 1,
        pierce: 0,
        spread: 0.02,
        bounces: 0,
        effect: "poison",
        mode: "thrown", // Thrown flask that lands and splashes
        weaponSplashR: 65, // Splash radius
        bulletSpeedMult: 0.65, // Slower throw speed
      },
      levelBonuses: [
        (p) => (p.weaponDamage *= 1.10), // Reduced from 1.14 to 1.10
        (p) => (p.attackCooldown = Math.max(0.25, p.attackCooldown * 0.9)),
        (p) => {
          // For weapons, p is the weapon object, not the player
          if (p.projectiles !== undefined) {
            p.projectiles = clamp(p.projectiles + 1, 1, 16);
          }
        },
        (p) => (p.weaponDamage *= 1.14), // Reduced from 1.18 to 1.14
      ],
      icon: makeIconDraw("nuke"),
    },
    {
      id: "frostwand",
      name: "Frost Wand",
      type: TYPE.WEAPON,
      base: {
        attackCooldown: 0.68,
        weaponDamage: 9,
        projectiles: 1,
        pierce: 0,
        spread: 0.05,
        bounces: 0,
        effect: "freeze",
        mode: "bullet",
      },
      levelBonuses: [
        (p) => (p.weaponDamage *= 1.08), // Reduced from 1.12 to 1.08
        (p) => (p.attackCooldown = Math.max(0.24, p.attackCooldown * 0.9)),
        (p) => (p.weaponDamage *= 1.14), // Reduced from 1.18 to 1.14
        (p) => (p.projectileSpeed *= 1.08),
      ],
      icon: makeIconDraw("time"),
    },
    {
      id: "bow",
      name: "Bow",
      type: TYPE.WEAPON,
      base: {
        attackCooldown: 0.55,
        weaponDamage: 11,
        projectiles: 1,
        pierce: 0,
        spread: 0.03,
        bounces: 0,
        effect: null,
        mode: "bullet",
        bulletSpeedMult: 1.2,
      },
      levelBonuses: [
        (p) => (p.weaponDamage *= 1.09), // Reduced from 1.13 to 1.09
        (p) => (p.attackCooldown = Math.max(0.25, p.attackCooldown * 0.91)),
        (p) => {
          // For weapons, p is the weapon object, not the player
          if (p.projectiles !== undefined) {
            p.projectiles = clamp(p.projectiles + 1, 1, 16);
          }
        },
        (p) => (p.weaponDamage *= 1.09), // Reduced from 1.13 to 1.09 // Reduced from 1.17 to 1.13
      ],
      icon: makeIconDraw("revolver"),
    },
    {
      id: "lightning_staff",
      name: "Lightning Staff",
      type: TYPE.WEAPON,
      base: {
        attackCooldown: 0.65,
        weaponDamage: 10,
        projectiles: 1,
        pierce: 2,
        spread: 0.04,
        bounces: 0,
        effect: "shock",
        mode: "bullet",
        bulletSpeedMult: 1.3,
      },
      levelBonuses: [
        (p) => (p.weaponDamage *= 1.10), // Reduced from 1.14 to 1.10
        (p) => (p.pierce = clamp(p.pierce + 1, 0, 8)),
        (p) => (p.attackCooldown = Math.max(0.24, p.attackCooldown * 0.9)),
        (p) => (p.weaponDamage *= 1.14), // Reduced from 1.18 to 1.14
      ],
      icon: makeIconDraw("staff"),
    },
    {
      id: "axe",
      name: "Axe",
      type: TYPE.WEAPON,
      base: {
        attackCooldown: 0.58,
        weaponDamage: 14,
        projectiles: 1,
        pierce: 1,
        spread: 0.08,
        bounces: 0,
        effect: null,
        mode: "bullet",
        bulletSpeedMult: 0.9,
      },
      levelBonuses: [
        (p) => (p.weaponDamage *= 1.11), // Reduced from 1.15 to 1.11
        (p) => (p.pierce = clamp(p.pierce + 1, 0, 5)),
        (p) => (p.attackCooldown = Math.max(0.24, p.attackCooldown * 0.92)),
        (p) => (p.weaponDamage *= 1.15), // Reduced from 1.19 to 1.15
      ],
      icon: makeIconDraw("sword"),
    },
    {
      id: "shotgun",
      name: "Shotgun",
      type: TYPE.WEAPON,
      base: {
        attackCooldown: 0.72,
        weaponDamage: 7,
        projectiles: 3,
        pierce: 0,
        spread: 0.18,
        bounces: 0,
        effect: null,
        mode: "bullet",
        bulletSpeedMult: 0.85,
      },
      levelBonuses: [
        (p) => (p.weaponDamage *= 1.08), // Reduced from 1.12 to 1.08
        (p) => {
          // For weapons, p is the weapon object, not the player
          if (p.projectiles !== undefined) {
            p.projectiles = clamp(p.projectiles + 1, 1, 16);
          }
        },
        (p) => (p.attackCooldown = Math.max(0.28, p.attackCooldown * 0.92)),
        (p) => (p.weaponDamage *= 1.12), // Reduced from 1.16 to 1.12
      ],
      icon: makeIconDraw("revolver"),
    },
    {
      id: "flamewalker",
      name: "Flamewalker",
      type: TYPE.WEAPON,
      base: {
        attackCooldown: 0.85, // Slower attack speed - spawns fire periodically
        weaponDamage: 6,
        projectiles: 0,
        pierce: 0,
        spread: 0,
        bounces: 0,
        effect: "burn",
        mode: "aura", // New mode for ground fire
        meleeR: 50,
      },
      levelBonuses: [
        (p) => (p.weaponDamage *= 1.10), // Reduced from 1.14 to 1.10
        (p) => (p.weaponMeleeR = (p.weaponMeleeR || 50) + 5),
        (p) => (p.weaponDamage *= 1.14), // Reduced from 1.18 to 1.14
      ],
      icon: makeIconDraw("staff"),
    },
    {
      id: "bananarang",
      name: "Bananarang",
      type: TYPE.WEAPON,
      base: {
        attackCooldown: 0.68,
        weaponDamage: 11,
        projectiles: 1,
        pierce: 999, // Pierce all targets
        spread: 0.05,
        bounces: 0, // No bounce, it returns instead
        effect: null,
        mode: "boomerang", // Special boomerang mode
        bulletSpeedMult: 0.65, // Slower speed for visibility
      },
      levelBonuses: [
        (p) => (p.weaponDamage *= 1.09), // Reduced from 1.13 to 1.09
        (p) => (p.attackCooldown = Math.max(0.26, p.attackCooldown * 0.91)),
        (p) => (p.bounces = clamp(p.bounces + 1, 0, 7)),
        (p) => (p.weaponDamage *= 1.09), // Reduced from 1.13 to 1.09 // Reduced from 1.17 to 1.13
      ],
      icon: makeIconDraw("revolver"),
    },
    {
      id: "crossbow",
      name: "Crossbow",
      type: TYPE.WEAPON,
      base: {
        attackCooldown: 0.9, // Slow fire rate
        weaponDamage: 18, // High damage
        projectiles: 1,
        pierce: 3, // Pierces 3 enemies
        spread: 0.01, // Very accurate
        bounces: 0,
        effect: null,
        mode: "bullet",
        bulletSpeedMult: 1.4, // Fast projectile
      },
      levelBonuses: [
        (p) => (p.weaponDamage *= 1.11), // Reduced from 1.15 to 1.11
        (p) => (p.pierce = clamp(p.pierce + 1, 0, 8)),
        (p) => (p.attackCooldown = Math.max(0.28, p.attackCooldown * 0.92)),
        (p) => (p.weaponDamage *= 1.16), // Reduced from 1.20 to 1.16
      ],
      icon: makeIconDraw("revolver"),
    },
    {
      id: "chain_lightning",
      name: "Chain Lightning",
      type: TYPE.WEAPON,
      base: {
        attackCooldown: 0.65,
        weaponDamage: 10,
        projectiles: 1,
        pierce: 0,
        spread: 0.03,
        bounces: 3, // Bounces between 3-5 enemies
        effect: "shock",
        mode: "bullet",
        bulletSpeedMult: 1.5, // Very fast
      },
      levelBonuses: [
        (p) => (p.bounces = clamp(p.bounces + 1, 0, 7)),
        (p) => (p.weaponDamage *= 1.10), // Reduced from 1.14 to 1.10
        (p) => (p.attackCooldown = Math.max(0.24, p.attackCooldown * 0.91)),
        (p) => (p.weaponDamage *= 1.14), // Reduced from 1.18 to 1.14
      ],
      icon: makeIconDraw("staff"),
    },
    {
      id: "orbiting_blades",
      name: "Orbiting Blades",
      type: TYPE.WEAPON,
      base: {
        attackCooldown: 0.4, // Fast auto-attack
        weaponDamage: 8,
        projectiles: 0,
        pierce: 999,
        spread: 0,
        bounces: 0,
        effect: null,
        mode: "orbit", // Special orbiting mode
        meleeR: 60, // Orbit radius
      },
      levelBonuses: [
        (p) => {
          // Increase number of orbiting blades
          p.orbitBlades = (p.orbitBlades || 2) + 1;
          p.orbitBlades = clamp(p.orbitBlades, 2, 6);
        },
        (p) => (p.weaponDamage *= 1.09), // Reduced from 1.13 to 1.09
        (p) => (p.weaponMeleeR = (p.weaponMeleeR || 60) + 8),
        (p) => (p.weaponDamage *= 1.09), // Reduced from 1.13 to 1.09 // Reduced from 1.17 to 1.13
      ],
      icon: makeIconDraw("sword"),
    },
    {
      id: "throwing_knives",
      name: "Throwing Knives",
      type: TYPE.WEAPON,
      base: {
        attackCooldown: 0.35, // Very fast
        weaponDamage: 6, // Low damage
        projectiles: 2, // Fires 2-3 projectiles
        pierce: 0,
        spread: 0.08,
        bounces: 0,
        effect: null,
        mode: "bullet",
        bulletSpeedMult: 1.3,
      },
      levelBonuses: [
        (p) => {
          if (p.projectiles !== undefined) {
            p.projectiles = clamp(p.projectiles + 1, 1, 16);
          }
        },
        (p) => (p.attackCooldown = Math.max(0.18, p.attackCooldown * 0.9)),
        (p) => (p.weaponDamage *= 1.08), // Reduced from 1.12 to 1.08
        (p) => (p.critChance = clamp((p.critChance || 0) + 0.04, 0, 0.8)),
      ],
      icon: makeIconDraw("revolver"),
    },
    {
      id: "grenade_launcher",
      name: "Grenade Launcher",
      type: TYPE.WEAPON,
      base: {
        attackCooldown: 1.1, // Slow
        weaponDamage: 20, // High damage
        projectiles: 1,
        pierce: 0,
        spread: 0.02,
        bounces: 0,
        effect: "explosive",
        mode: "explosive", // Explosive AoE on impact
        splashR: 80, // Large AoE
        bulletSpeedMult: 0.7, // Slower projectile
      },
      levelBonuses: [
        (p) => (p.weaponDamage *= 1.12), // Reduced from 1.16 to 1.12
        (p) => (p.weaponSplashR = (p.weaponSplashR || 80) + 10),
        (p) => (p.attackCooldown = Math.max(0.32, p.attackCooldown * 0.92)),
        (p) => (p.weaponDamage *= 1.16), // Reduced from 1.20 to 1.16
      ],
      icon: makeIconDraw("nuke"),
    },
  ];
}

/**
 * Get a weapon by its ID
 * @param {string} id - Weapon ID
 * @param {Function} makeIconDraw - Function that creates icon drawing functions
 * @returns {Object|undefined} Weapon definition or undefined if not found
 */
export function getWeaponById(id, makeIconDraw) {
  return createWeapons(makeIconDraw).find((w) => w.id === id);
}
