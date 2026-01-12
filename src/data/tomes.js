/**
 * Tome definitions and configurations
 */

import { TYPE, RARITY } from "./constants.js";
import { clamp } from "../utils/math.js";

/**
 * Creates the tomes array with icon drawing functions
 * @param {Function} makeIconDraw - Function that creates icon drawing functions
 * @param {Function} rarityMult - Function that returns rarity multiplier
 * @returns {Array} Array of tome definitions
 */
export function createTomes(makeIconDraw, rarityMult) {
  return [
    {
      id: "t_agility",
      name: "Agility Tome",
      type: TYPE.TOME,
      desc: "+Movement Speed",
      apply: (p, r) => {
        const m = rarityMult(r);
        p.speedBonus += 8 * m; // Reduced from 14
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "t_damage",
      name: "Damage Tome",
      type: TYPE.TOME,
      desc: "+Damage",
      apply: (p, r) => {
        const m = rarityMult(r);
        // Apply damage increase to all weapons
        if (p.weapons && p.weapons.length > 0) {
          for (const weapon of p.weapons) {
            weapon.weaponDamage *= 1 + 0.04 * m; // Reduced from 0.06 to 0.04 (40% less effective)
          }
        }
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "t_cooldown",
      name: "Cooldown Tome",
      type: TYPE.TOME,
      desc: "+Attack speed",
      apply: (p, r) => {
        const m = rarityMult(r);
        // Reduce cooldown on all weapons (lower cooldown = faster attacks)
        if (p.weapons && p.weapons.length > 0) {
          for (const weapon of p.weapons) {
            weapon.attackCooldown = Math.max(0.18, weapon.attackCooldown * (1 - 0.04 * m));
          }
        }
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "t_quantity",
      name: "Quantity Tome",
      type: TYPE.TOME,
      desc: "+Projectile count",
      apply: (p, r) => {
        // Always add projectiles based on rarity
        // Common: +1, Uncommon: +2, Rare: +2, Legendary: +3
        let projectilesToAdd = 1;
        if (r === RARITY.UNCOMMON || r === RARITY.RARE) {
          projectilesToAdd = 2;
        } else if (r === RARITY.LEGENDARY) {
          projectilesToAdd = 3;
        }
        
        // Add projectiles to all weapons (100% chance)
        // This includes bananarang - quantity tome increases bananarang count
        if (p.weapons && p.weapons.length > 0) {
          for (const weapon of p.weapons) {
            // For bananarang, quantity tome increases the number of bananarangs you can have
            // But bananarang is limited to 1 active at a time, so this affects the upgrade path
            // Instead, we'll increase the weapon's projectiles stat (which affects other upgrades)
            weapon.projectiles = clamp(weapon.projectiles + projectilesToAdd, 1, 16);
          }
        }
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "t_precision",
      name: "Precision Tome",
      type: TYPE.TOME,
      desc: "+Crit chance",
      apply: (p, r) => {
        const m = rarityMult(r);
        p.critChance = clamp(p.critChance + 0.02 * m, 0, 0.8); // Reduced from 0.04
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "t_hp",
      name: "HP Tome",
      type: TYPE.TOME,
      desc: "",
      apply: (p, r) => {
        const m = rarityMult(r);
        p.maxHp = Math.round(p.maxHp + 8 * m); // Reduced from 14
        p.hp = Math.min(p.maxHp, p.hp + Math.round(5 * m)); // Reduced from 8
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "t_regen",
      name: "Regen Tome",
      type: TYPE.TOME,
      desc: "+HP regen",
      apply: (p, r) => {
        const m = rarityMult(r);
        p.regen += 0.3 * m; // Reduced from 0.55
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "t_gold",
      name: "Gold Tome",
      type: TYPE.TOME,
      desc: "+Gold gain",
      apply: (p, r) => {
        const m = rarityMult(r);
        p.goldGain *= 1 + 0.06 * m; // Reduced from 0.12
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "t_luck",
      name: "Luck Tome",
      type: TYPE.TOME,
      desc: "+Luck",
      apply: (p, r) => {
        const m = rarityMult(r);
        p.luck += 0.18 * m; // Reduced from 0.32
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "t_xp",
      name: "XP Tome",
      type: TYPE.TOME,
      desc: "",
      apply: (p, r) => {
        const m = rarityMult(r);
        p.xpGain *= 1 + 0.06 * m; // Reduced from 0.12
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "t_bounce",
      name: "Ricochet Tome",
      type: TYPE.TOME,
      desc: "+Bounces to all weapons",
      apply: (p, r) => {
        const m = rarityMult(r);
        // Balanced merge: Common/Uncommon: +1, Rare: +2, Legendary: +3
        const bounceAdd = m < 1.2 ? 1 : m < 1.4 ? 2 : 3;
        if (p.weapons && p.weapons.length > 0) {
          for (const weapon of p.weapons) {
            if (weapon.bounces !== undefined && weapon.bounces >= 0) {
              weapon.bounces = clamp(weapon.bounces + bounceAdd, 0, 9);
            }
          }
        }
        // Also add to player's base bounce stat for future weapons
        p.bounces = (p.bounces || 0) + bounceAdd;
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "t_evasion",
      name: "Evasion Tome",
      type: TYPE.TOME,
      desc: "+Dodge chance",
      apply: (p, r) => {
        const m = rarityMult(r);
        p.evasion = clamp(p.evasion + 0.04 * m, 0, 0.6);
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "t_shield",
      name: "Shield Tome",
      type: TYPE.TOME,
      desc: "+Max Shield HP",
      apply: (p, r) => {
        const m = rarityMult(r);
        p.maxShield = Math.round((p.maxShield || 0) + 8 * m); // Reduced from 12, caps at reasonable amount
        // Also add current shield if below max
        if (!p.shield || p.shield < p.maxShield) {
          p.shield = Math.min(p.maxShield, (p.shield || 0) + 8 * m);
        }
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "t_size",
      name: "Size Tome",
      type: TYPE.TOME,
      desc: "+Attack size",
      apply: (p, r) => {
        const m = rarityMult(r);
        p.sizeMult *= 1 + 0.11 * m;
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "t_knockback",
      name: "Knockback Tome",
      type: TYPE.TOME,
      desc: "+Knockback force",
      apply: (p, r) => {
        const m = rarityMult(r);
        // Increase knockback value directly (stacks additively)
        p.knockback = (p.knockback || 0) + (8 + 4 * m); // Common: +8, Uncommon: +12, Rare: +12, Legendary: +20
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "t_projectile_speed",
      name: "Projectile Speed Tome",
      type: TYPE.TOME,
      desc: "+Projectile speed",
      apply: (p, r) => {
        const m = rarityMult(r);
        p.bulletSpeedMult = (p.bulletSpeedMult || 1) * (1 + 0.12 * m);
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "t_jump",
      name: "Jump Tome",
      type: TYPE.TOME,
      desc: "+Jump height",
      apply: (p, r) => {
        const m = rarityMult(r);
        // Increase jump height multiplier (stacks multiplicatively)
        p.jumpHeight = (p.jumpHeight || 1.0) * (1 + 0.15 * m); // Common: +15%, Uncommon: +17%, Rare: +19%, Legendary: +23%
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "t_berserker",
      name: "Berserker Tome",
      type: TYPE.TOME,
      desc: "",
      apply: (p, r) => {
        const m = rarityMult(r);
        // Lower HP (risk/reward)
        const hpReduction = 0.15 * m; // 15-23% HP reduction
        p.maxHp = Math.max(50, Math.round(p.maxHp * (1 - hpReduction)));
        p.hp = Math.min(p.hp, p.maxHp); // Cap current HP to new max
        // Damage multiplier based on missing HP (risk/reward)
        p.berserkerMult = (p.berserkerMult || 0) + 0.10 * m; // Reduced from 0.15 to 0.10 (33% less effective)
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "t_vampire",
      name: "Vampire Tome",
      type: TYPE.TOME,
      desc: "Lifesteal on damage",
      apply: (p, r) => {
        const m = rarityMult(r);
        p.lifesteal = (p.lifesteal || 0) + 0.04 * m; // 4-6% lifesteal
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "t_crit_master",
      name: "Crit Master Tome",
      type: TYPE.TOME,
      desc: "",
      apply: (p, r) => {
        const m = rarityMult(r);
        p.critChance = clamp((p.critChance || 0) + 0.025 * m, 0, 0.8);
        p.critDamageMult = (p.critDamageMult || 2.0) + 0.3 * m; // Increases crit damage multiplier
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "t_elemental",
      name: "Elemental Tome",
      type: TYPE.TOME,
      desc: "Chance to apply burn, shock, poison, or freeze on hit",
      apply: (p, r) => {
        const m = rarityMult(r);
        // Adds chance for random elemental effect (burn/shock/poison/freeze)
        p.elementalChance = (p.elementalChance || 0) + 0.12 * m; // 12-18% chance
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "t_speed_demon",
      name: "Speed Demon Tome",
      type: TYPE.TOME,
      desc: "",
      apply: (p, r) => {
        const m = rarityMult(r);
        // Damage scales with movement speed
        p.speedDamageMult = (p.speedDamageMult || 0) + 0.05 * m; // Reduced from 0.08 to 0.05 (37% less effective)
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "t_pierce",
      name: "Pierce Tome",
      type: TYPE.TOME,
      desc: "+Pierce to all weapons",
      apply: (p, r) => {
        const m = rarityMult(r);
        const pierceAdd = m < 1.5 ? 1 : 2; // Common/Uncommon: +1, Rare/Legendary: +2
        if (p.weapons && p.weapons.length > 0) {
          for (const weapon of p.weapons) {
            if (weapon.pierce !== undefined && weapon.pierce < 999) {
              weapon.pierce = clamp(weapon.pierce + pierceAdd, 0, 8);
            }
          }
        }
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "t_explosive",
      name: "Explosive Tome",
      type: TYPE.TOME,
      desc: "Chance for projectiles to explode",
      apply: (p, r) => {
        const m = rarityMult(r);
        p.explosiveChance = (p.explosiveChance || 0) + 0.08 * m; // 8-12% chance
        p.explosiveRadius = (p.explosiveRadius || 0) + 25 * m; // Explosion radius
      },
      icon: makeIconDraw("time"),
    },
  ];
}

/**
 * Get a tome by its ID
 * @param {string} id - Tome ID
 * @param {Function} makeIconDraw - Function that creates icon drawing functions
 * @param {Function} rarityMult - Function that returns rarity multiplier
 * @returns {Object|undefined} Tome definition or undefined if not found
 */
export function getTomeById(id, makeIconDraw, rarityMult) {
  return createTomes(makeIconDraw, rarityMult).find((t) => t.id === id);
}
