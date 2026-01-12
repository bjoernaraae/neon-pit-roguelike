/**
 * Item definitions and configurations
 */

import { TYPE } from "./constants.js";
import { clamp } from "../utils/math.js";

/**
 * Creates the items array with icon drawing functions
 * @param {Function} makeIconDraw - Function that creates icon drawing functions
 * @param {Function} rarityMult - Function that returns rarity multiplier
 * @param {Function} bumpShake - Function to add screen shake effect
 * @param {Function} addParticle - Function to add particles
 * @param {Function} sfxBoss - Function to play boss sound effect
 * @returns {Array} Array of item definitions
 */
export function createItems(makeIconDraw, rarityMult, bumpShake, addParticle, sfxBoss) {
  return [
    {
      id: "moldy_cheese",
      name: "Moldy Cheese",
      type: TYPE.ITEM,
      desc: "",
      apply: (s, r) => {
        const m = rarityMult(r);
        s.player.poisonChance = clamp(s.player.poisonChance + 0.06 * m, 0, 0.85); // Reduced from 0.12
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "ice_crystal",
      name: "Ice Crystal",
      type: TYPE.ITEM,
      desc: "",
      apply: (s, r) => {
        // Ice Crystal freezes enemies in an area around the hit (AoE freeze)
        const m = rarityMult(r);
        s.player.iceCrystalFreezeChance = 0.2 + 0.15 * m; // 20-50% chance
        s.player.iceCrystalFreezeRadius = 35 + 15 * m; // AoE radius
        s.player.iceCrystalFreezeDuration = 1.4 + 0.4 * m; // Longer freeze duration
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "time_bracelet",
      name: "Time Bracelet",
      type: TYPE.ITEM,
      desc: "Reduces cooldowns",
      apply: (s, r) => {
        const m = rarityMult(r);
        // Reduce ability cooldown (permanent reduction)
        // Common: -8%, Uncommon: -10%, Rare: -12%, Legendary: -15%
        const reduction = 0.08 + (m - 1) * 0.02;
        s.player.abilityCdMult = Math.max(0.5, (s.player.abilityCdMult || 1) * (1 - reduction));
        // Also reduce weapon attack cooldowns temporarily (haste multiplier > 1 speeds up)
        s.player.buffHasteT = Math.max(s.player.buffHasteT, 4 + 2.5 * m);
        s.player.buffHasteMult = Math.max(1.15, 1.1 + 0.12 * m); // > 1 speeds up cooldown reduction
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "nuke",
      name: "Nuke",
      type: TYPE.ITEM,
      desc: "Destroy most enemies",
      apply: (s) => {
        for (const e of s.enemies) e.hp -= 999999;
        if (s.boss.active) s.boss.hp -= Math.round(s.boss.maxHp * 0.28);
        bumpShake(s, 10, 0.12);
        s.hitStopT = Math.max(s.hitStopT, 0.08);
        addParticle(s, s.player.x, s.player.y, 38, 55);
        sfxBoss();
      },
      icon: makeIconDraw("nuke"),
    },
    {
      id: "patch",
      name: "Patch",
      type: TYPE.ITEM,
      desc: "Heal now for coins",
      apply: (s, r) => {
        const m = rarityMult(r);
        const p = s.player;
        const cost = Math.max(2, Math.round(3 + s.floor + 2 * (m - 1)));
        if (p.coins < cost) return;
        p.coins -= cost;
        p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * (0.16 + 0.1 * m)));
        addParticle(s, p.x, p.y, 18, 160);
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "glass",
      name: "Glass Cannon",
      type: TYPE.ITEM,
      desc: "Damage up, HP down",
      apply: (s, r) => {
        const m = rarityMult(r);
        const p = s.player;
        const cost = Math.max(4, Math.round(6 + s.floor));
        if (p.coins < cost) return;
        p.coins -= cost;
        p.weaponDamage *= 1 + 0.28 * m;
        p.maxHp = Math.max(50, Math.round(p.maxHp * (1 - 0.07 * m)));
        p.hp = Math.min(p.hp, p.maxHp);
      },
      icon: makeIconDraw("revolver"),
    },
    {
      id: "spiky_shield",
      name: "Spiky Shield",
      type: TYPE.ITEM,
      desc: "Reflect damage",
      apply: (s, r) => {
        const m = rarityMult(r);
        s.player.thorns = (s.player.thorns || 0) + 0.12 * m;
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "slurp_gloves",
      name: "Slurp Gloves",
      type: TYPE.ITEM,
      desc: "",
      apply: (s, r) => {
        const m = rarityMult(r);
        s.player.lifesteal = (s.player.lifesteal || 0) + 0.06 * m;
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "mirror",
      name: "Mirror",
      type: TYPE.ITEM,
      desc: "Brief invincibility on hit",
      apply: (s, r) => {
        const m = rarityMult(r);
        s.player.iFrameOnHit = (s.player.iFrameOnHit || 0) + 0.12 * m;
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "big_bonk",
      name: "Big Bonk",
      type: TYPE.ITEM,
      desc: "Low chance for extreme damage",
      apply: (s, r) => {
        const m = rarityMult(r);
        s.player.bigBonkChance = (s.player.bigBonkChance || 0) + 0.016 * m;
        s.player.bigBonkMult = (s.player.bigBonkMult || 1) + 0.4 * m;
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "lucky_coin",
      name: "Lucky Coin",
      type: TYPE.ITEM,
      desc: "Chance to double coin drops",
      apply: (s, r) => {
        const m = rarityMult(r);
        s.player.luckyCoinChance = (s.player.luckyCoinChance || 0) + 0.15 * m; // 15-23% chance
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "magnet",
      name: "Magnet",
      type: TYPE.ITEM,
      desc: "Pulls coins/items toward player",
      apply: (s, r) => {
        const m = rarityMult(r);
        s.player.magnetRange = (s.player.magnetRange || 0) + 120 * m; // Pull range
        s.player.magnetStrength = (s.player.magnetStrength || 0) + 0.4 * m; // Pull strength
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "death_defiance",
      name: "Death Defiance",
      type: TYPE.ITEM,
      desc: "One-time revive at 1 HP",
      apply: (s, r) => {
        const m = rarityMult(r);
        s.player.deathDefiance = (s.player.deathDefiance || 0) + Math.floor(m); // 1-2 revives
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "bloodthirst",
      name: "Bloodthirst",
      type: TYPE.ITEM,
      desc: "Damage increases with kills (resets on hit)",
      apply: (s, r) => {
        const m = rarityMult(r);
        s.player.bloodthirstMax = (s.player.bloodthirstMax || 0) + 0.12 * m; // Max 12-18% damage per kill
        s.player.bloodthirstKills = 0; // Reset counter
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "chain_reaction",
      name: "Chain Reaction",
      type: TYPE.ITEM,
      desc: "Kills cause small explosions",
      apply: (s, r) => {
        const m = rarityMult(r);
        s.player.chainReactionChance = (s.player.chainReactionChance || 0) + 0.25 * m; // 25-38% chance
        s.player.chainReactionRadius = (s.player.chainReactionRadius || 0) + 45 * m; // Explosion radius
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "split_shot",
      name: "Split Shot",
      type: TYPE.ITEM,
      desc: "Chance to fire additional projectiles",
      apply: (s, r) => {
        const m = rarityMult(r);
        s.player.splitShotChance = (s.player.splitShotChance || 0) + 0.2 * m; // 20-30% chance
        s.player.splitShotCount = (s.player.splitShotCount || 0) + Math.floor(1 + m); // 1-2 extra projectiles
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "experience_orb",
      name: "Experience Orb",
      type: TYPE.ITEM,
      desc: "Increased XP gain",
      apply: (s, r) => {
        const m = rarityMult(r);
        s.player.xpGain *= 1 + 0.12 * m; // 12-18% more XP
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "speed_boots",
      name: "Speed Boots",
      type: TYPE.ITEM,
      desc: "",
      apply: (s, r) => {
        const m = rarityMult(r);
        s.player.speedBonus += 12 * m; // 12-18 speed
      },
      icon: makeIconDraw("time"),
    },
    {
      id: "shield_generator",
      name: "Shield Generator",
      type: TYPE.ITEM,
      desc: "Temporary shield on low HP",
      apply: (s, r) => {
        const m = rarityMult(r);
        s.player.shieldGenThreshold = 0.3 - 0.05 * m; // Activates at 30-25% HP
        s.player.shieldGenAmount = Math.round(15 * m); // Shield amount
        s.player.shieldGenCooldown = 12 - 2 * m; // Cooldown in seconds
      },
      icon: makeIconDraw("time"),
    },
  ];
}

/**
 * Get an item by its ID
 * @param {string} id - Item ID
 * @param {Function} makeIconDraw - Function that creates icon drawing functions
 * @param {Function} rarityMult - Function that returns rarity multiplier
 * @param {Function} bumpShake - Function to add screen shake effect
 * @param {Function} addParticle - Function to add particles
 * @param {Function} sfxBoss - Function to play boss sound effect
 * @returns {Object|undefined} Item definition or undefined if not found
 */
export function getItemById(id, makeIconDraw, rarityMult, bumpShake, addParticle, sfxBoss) {
  return createItems(makeIconDraw, rarityMult, bumpShake, addParticle, sfxBoss).find((i) => i.id === id);
}
