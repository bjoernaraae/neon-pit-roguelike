/**
 * Upgrade System
 * 
 * Handles weapon upgrades and level-up progression.
 */

import { clamp } from "../../utils/math.js";
import { rarityMult } from "../../data/raritySystem.js";
import { RARITY } from "../../data/constants.js";

/**
 * Apply a weapon to a player (new weapon or upgrade existing)
 * @param {Object} p - Player object
 * @param {Object} weaponDef - Weapon definition from content
 * @param {string} rarity - Rarity level
 * @param {boolean} previewOnly - If true, don't permanently apply changes
 * @param {string|null} forcedUpgradeType - Force specific upgrade type
 */
export function applyWeapon(p, weaponDef, rarity, previewOnly, forcedUpgradeType = null) {
  const m = rarityMult(rarity);

  // Initialize weapons array if it doesn't exist
  if (!p.weapons) {
    p.weapons = [];
  }

  // Find existing weapon
  const existingWeapon = p.weapons.find((w) => w.id === weaponDef.id);

  if (!existingWeapon) {
    // Add new weapon (even in preview mode so preview can read its stats)
    const newWeapon = {
      id: weaponDef.id,
      level: 1,
      attackCooldown: weaponDef.base.attackCooldown * (1 - 0.05 * (m - 1)),
      weaponDamage: weaponDef.base.weaponDamage * (1 + 0.06 * (m - 1)), // Reduced from 0.1 to 0.06 (40% less effective)
      projectiles: weaponDef.base.projectiles + (rarity === RARITY.LEGENDARY ? 1 : 0),
      pierce: weaponDef.base.pierce,
      weaponSpread: weaponDef.base.spread,
      weaponMode: weaponDef.base.mode,
      weaponEffect: weaponDef.base.effect || null,
      weaponSplashR: weaponDef.base.splashR || 0,
      weaponMeleeR: weaponDef.base.meleeR || 0,
      bounces: weaponDef.base.bounces || 0,
      bulletSpeedMult: weaponDef.base.bulletSpeedMult || 1,
      bulletSizeMult: weaponDef.base.bulletSizeMult || 1,
      attackT: 0,
      hasActiveBoomerang: false, // For bananarang tracking
      // Weapon-specific properties (initialized based on weapon type)
      boomerangMaxDist: weaponDef.id === "bananarang" ? 250 : undefined,
      boomerangReturnSpeedMult: weaponDef.id === "bananarang" ? 1 : undefined,
      boneRotationSpeed: weaponDef.id === "bone" ? 8 : undefined,
      flamewalkerDuration: weaponDef.id === "flamewalker" ? 4.0 : undefined,
      meleeKnockbackMult: weaponDef.base.mode === "melee" ? 1 : undefined,
      orbitBlades: weaponDef.id === "orbiting_blades" ? 2 : undefined,
      orbitAngle: weaponDef.id === "orbiting_blades" ? 0 : undefined,
    };
    p.weapons.push(newWeapon);
    // Track collected weapon (only if not preview)
    if (!previewOnly) {
      if (!p.collectedWeapons) p.collectedWeapons = [];
      if (!p.collectedWeapons.find(w => w.id === weaponDef.id)) {
        p.collectedWeapons.push({ id: weaponDef.id, name: weaponDef.name, icon: weaponDef.icon });
      }
    }
    return;
  }

  // Track collected weapon even if upgrading existing one
  if (!p.collectedWeapons) p.collectedWeapons = [];
  if (!p.collectedWeapons.find(w => w.id === weaponDef.id)) {
    p.collectedWeapons.push({ id: weaponDef.id, name: weaponDef.name, icon: weaponDef.icon });
  }
  
  // Upgrade existing weapon - when getting duplicate, randomly improve one stat
  const nextLevel = (existingWeapon.level || 1) + 1;
  const idx = (nextLevel - 2) % Math.max(1, weaponDef.levelBonuses.length);
  const fn = weaponDef.levelBonuses[idx];

  const before = {
    attackCooldown: existingWeapon.attackCooldown,
    weaponDamage: existingWeapon.weaponDamage,
    projectiles: existingWeapon.projectiles,
    pierce: existingWeapon.pierce,
    bounces: existingWeapon.bounces,
  };

  // Apply level bonus
  fn(existingWeapon);

  existingWeapon.weaponDamage *= 1 + 0.02 * (m - 1); // Reduced from 0.03 to 0.02 (33% less effective)
  existingWeapon.attackCooldown = Math.max(0.18, existingWeapon.attackCooldown * (1 - 0.015 * (m - 1))); // Reduced from 0.03
  
  // Weapon-specific upgrades based on weapon type
  const weaponId = existingWeapon.id;
  
  // Get weapon-specific upgrade cycle
  let upgradeTypes = [];
  if (weaponId === "bananarang") {
    // Bananarang-specific upgrades: Range -> Attack Speed -> Damage -> Return Speed
    upgradeTypes = ["range", "attackSpeed", "damage", "returnSpeed"];
  } else if (weaponId === "bone") {
    // Bone-specific upgrades: Projectile -> Damage -> Attack Speed -> Rotation Speed
    upgradeTypes = ["projectile", "damage", "attackSpeed", "rotationSpeed"];
  } else if (weaponId === "flamewalker") {
    // Flamewalker-specific upgrades: Radius -> Damage -> Attack Speed -> Duration
    upgradeTypes = ["radius", "damage", "attackSpeed", "duration"];
  } else if (weaponId === "poison_flask") {
    // Poison flask-specific upgrades: Projectile -> Damage -> Attack Speed -> Splash Radius
    upgradeTypes = ["projectile", "damage", "attackSpeed", "splashRadius"];
  } else if (weaponId === "revolver" || weaponId === "bow" || weaponId === "lightning_staff") {
    // Ranged weapons: Projectile -> Damage -> Attack Speed -> Bullet Speed
    upgradeTypes = ["projectile", "damage", "attackSpeed", "bulletSpeed"];
  } else if (existingWeapon.weaponMode === "melee") {
    // Melee weapons: Range -> Damage -> Attack Speed -> Knockback
    upgradeTypes = ["range", "damage", "attackSpeed", "knockback"];
  } else {
    // Default: Projectile -> Damage -> Attack Speed -> Bullet Speed
    upgradeTypes = ["projectile", "damage", "attackSpeed", "bulletSpeed"];
  }
  
  // Use forced upgrade type if provided, otherwise randomly select
  // Reduce chance of projectile upgrades (quantity) - make it less common
  let upgradeType = forcedUpgradeType;
  if (!upgradeType) {
    // Weighted random selection - reduce projectile chance
    const weights = upgradeTypes.map(t => t === "projectile" ? 0.15 : 0.85 / (upgradeTypes.length - 1));
    let rand = Math.random();
    let sum = 0;
    for (let i = 0; i < upgradeTypes.length; i++) {
      sum += weights[i];
      if (rand < sum) {
        upgradeType = upgradeTypes[i];
        break;
      }
    }
    if (!upgradeType) upgradeType = upgradeTypes[Math.floor(Math.random() * upgradeTypes.length)];
  }
  
  // Apply weapon-specific upgrade
  if (upgradeType === "projectile") {
    existingWeapon.projectiles = clamp(existingWeapon.projectiles + 1, 1, 16);
  } else if (upgradeType === "damage") {
    existingWeapon.weaponDamage *= 1.06;
  } else if (upgradeType === "attackSpeed") {
    // Multiplicative attack speed upgrade (reduces cooldown by 4% = 1/0.96)
    const currentCd = existingWeapon.attackCooldown || 0.42;
    existingWeapon.attackCooldown = Math.max(0.18, currentCd * 0.96);
  } else if (upgradeType === "bulletSpeed") {
    existingWeapon.bulletSpeedMult = (existingWeapon.bulletSpeedMult || 1) * 1.04;
  } else if (upgradeType === "range") {
    // For bananarang: increase maxDist
    if (weaponId === "bananarang") {
      existingWeapon.boomerangMaxDist = (existingWeapon.boomerangMaxDist || 250) + 30;
    } else if (existingWeapon.weaponMeleeR) {
      // For melee: increase melee range
      existingWeapon.weaponMeleeR = (existingWeapon.weaponMeleeR || 60) * 1.08;
    }
  } else if (upgradeType === "returnSpeed") {
    // Bananarang-specific: increase return speed multiplier
    existingWeapon.boomerangReturnSpeedMult = (existingWeapon.boomerangReturnSpeedMult || 1) * 1.15;
  } else if (upgradeType === "rotationSpeed") {
    // Bone-specific: increase rotation speed
    existingWeapon.boneRotationSpeed = (existingWeapon.boneRotationSpeed || 8) * 1.2;
  } else if (upgradeType === "radius") {
    // Flamewalker-specific: increase aura radius
    existingWeapon.weaponMeleeR = (existingWeapon.weaponMeleeR || 50) * 1.1;
  } else if (upgradeType === "duration") {
    // Flamewalker-specific: increase burn duration (stored in weapon for reference)
    existingWeapon.flamewalkerDuration = (existingWeapon.flamewalkerDuration || 4.0) * 1.15;
  } else if (upgradeType === "splashRadius") {
    // Poison flask-specific: increase splash radius
    existingWeapon.weaponSplashR = (existingWeapon.weaponSplashR || 54) * 1.12;
  } else if (upgradeType === "knockback") {
    // Melee-specific: increase knockback (stored in weapon for reference)
    existingWeapon.meleeKnockbackMult = (existingWeapon.meleeKnockbackMult || 1) * 1.2;
  }
  
  if (rarity === RARITY.LEGENDARY && Math.random() < 0.35) existingWeapon.projectiles = clamp(existingWeapon.projectiles + 1, 1, 16);

  if (!previewOnly) existingWeapon.level = nextLevel;

  // Validate and clamp all weapon stats to prevent NaN/undefined
  existingWeapon.attackCooldown = Math.max(0.18, isNaN(existingWeapon.attackCooldown) || existingWeapon.attackCooldown === undefined ? 0.42 : existingWeapon.attackCooldown);
  existingWeapon.weaponDamage = Math.max(1, isNaN(existingWeapon.weaponDamage) || existingWeapon.weaponDamage === undefined ? 1 : existingWeapon.weaponDamage);
  existingWeapon.projectiles = clamp(isNaN(existingWeapon.projectiles) || existingWeapon.projectiles === undefined ? 1 : existingWeapon.projectiles, 0, 16);
  existingWeapon.pierce = clamp(isNaN(existingWeapon.pierce) || existingWeapon.pierce === undefined ? 0 : existingWeapon.pierce, 0, 12);
  existingWeapon.bounces = clamp(isNaN(existingWeapon.bounces) || existingWeapon.bounces === undefined ? 0 : existingWeapon.bounces, 0, 8);
  
  // Validate multiplicative stats
  if (isNaN(existingWeapon.bulletSpeedMult) || existingWeapon.bulletSpeedMult === undefined) {
    existingWeapon.bulletSpeedMult = 1;
  }
  if (isNaN(existingWeapon.bulletSizeMult) || existingWeapon.bulletSizeMult === undefined) {
    existingWeapon.bulletSizeMult = 1;
  }

  if (previewOnly) {
    existingWeapon.attackCooldown = before.attackCooldown;
    existingWeapon.weaponDamage = before.weaponDamage;
    existingWeapon.projectiles = before.projectiles;
    existingWeapon.pierce = before.pierce;
    existingWeapon.bounces = before.bounces;
    existingWeapon.level = nextLevel;
  }
}
