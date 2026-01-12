/**
 * Game-specific mathematical calculations and utilities
 */

import { deepClone } from "./data.js";

/**
 * Calculate XP required to reach the next level
 * @param {number} level - Current level
 * @returns {number} XP required for next level
 */
export function xpToNext(level) {
  return Math.round(16 + level * 8 + Math.pow(level, 1.35) * 4);
}

/**
 * Calculate player speed with soft cap
 * @param {Object} player - Player object with speedBase and speedBonus
 * @returns {number} Calculated speed
 */
export function computeSpeed(player) {
  const raw = player.speedBase + player.speedBonus;
  const softCap = 360;
  if (raw <= softCap) return raw;
  return softCap + (raw - softCap) * 0.35;
}

/**
 * Format a stat line showing before and after values
 * @param {string} label - Stat label
 * @param {*} before - Before value
 * @param {*} after - After value
 * @param {Function} formatter - Optional formatter function
 * @returns {string|null} Formatted stat line or null if values are equal
 */
export function statLine(label, before, after, formatter = (v) => v) {
  if (before === after) return null;
  return `${label}: ${formatter(before)} → ${formatter(after)}`;
}

/**
 * Build a preview string showing stat changes from applying an upgrade
 * @param {Object} player - Player object to clone and test
 * @param {Function} applyFn - Function that applies the upgrade to a player object
 * @param {Function} computeSpeedFn - Function to calculate player speed
 * @param {string|null} weaponId - Optional weapon ID for weapon-specific upgrades
 * @param {string|null} upgradeType - Optional upgrade type for specific stat display
 * @returns {string} Preview string showing stat changes
 */
export function buildPreview(player, applyFn, computeSpeedFn, weaponId = null, upgradeType = null) {
  const before = deepClone(player);
  const after = deepClone(player);
  try {
    applyFn(after);
  } catch {
    return "";
  }

  const lines = [];
  
  // For weapons, show the specific stat being upgraded
  if (weaponId && before.weapons && after.weapons) {
    // Weapon-specific upgrade: show stats for this weapon only
    const beforeWeapon = before.weapons.find(w => w.id === weaponId);
    const afterWeapon = after.weapons.find(w => w.id === weaponId);
    
    if (!beforeWeapon && afterWeapon) {
      // New weapon - show base stats
      const dmg = afterWeapon.weaponDamage || 0;
      if (dmg > 0 && !isNaN(dmg)) lines.push(`Damage: ${Math.round(dmg)}`);
      
      let range = 0;
      if (weaponId === "bananarang" && afterWeapon.boomerangMaxDist) {
        range = afterWeapon.boomerangMaxDist;
      } else if (afterWeapon.weaponMeleeR) {
        range = afterWeapon.weaponMeleeR;
      } else if (afterWeapon.weaponSplashR) {
        range = afterWeapon.weaponSplashR;
      }
      if (range > 0) lines.push(`Range: ${Math.round(range)}`);
    } else if (beforeWeapon && afterWeapon) {
      // Existing weapon upgrade - show the specific stat being upgraded
      if (upgradeType === "damage") {
        let beforeDmg = beforeWeapon ? (beforeWeapon.weaponDamage || 0) : 0;
        let afterDmg = afterWeapon ? (afterWeapon.weaponDamage || 0) : 0;
        if (isNaN(beforeDmg)) beforeDmg = 0;
        if (isNaN(afterDmg)) afterDmg = 0;
        lines.push(statLine("Damage", Math.round(beforeDmg), Math.round(afterDmg)));
      } else if (upgradeType === "attackSpeed") {
        let beforeCd = beforeWeapon ? (beforeWeapon.attackCooldown || 0.42) : 0.42;
        let afterCd = afterWeapon ? (afterWeapon.attackCooldown || 0.42) : 0.42;
        if (isNaN(beforeCd)) beforeCd = 0.42;
        if (isNaN(afterCd)) afterCd = 0.42;
        // Show as attack speed (inverse of cooldown) - lower cooldown = higher speed
        const beforeSpeed = Math.round((1 / beforeCd) * 100) / 100;
        const afterSpeed = Math.round((1 / afterCd) * 100) / 100;
        lines.push(statLine("Attack Speed", beforeSpeed.toFixed(2), afterSpeed.toFixed(2), (v) => `${v}/s`));
      } else if (upgradeType === "range") {
        let beforeRange = 0;
        let afterRange = 0;
        if (beforeWeapon) {
          if (weaponId === "bananarang" && beforeWeapon.boomerangMaxDist) {
            beforeRange = beforeWeapon.boomerangMaxDist;
          } else if (beforeWeapon.weaponMeleeR) {
            beforeRange = beforeWeapon.weaponMeleeR;
          } else if (beforeWeapon.weaponSplashR) {
            beforeRange = beforeWeapon.weaponSplashR;
          }
        }
        if (afterWeapon) {
          if (weaponId === "bananarang" && afterWeapon.boomerangMaxDist) {
            afterRange = afterWeapon.boomerangMaxDist;
          } else if (afterWeapon.weaponMeleeR) {
            afterRange = afterWeapon.weaponMeleeR;
          } else if (afterWeapon.weaponSplashR) {
            afterRange = afterWeapon.weaponSplashR;
          }
        }
        lines.push(statLine("Range", Math.round(beforeRange), Math.round(afterRange)));
      } else if (upgradeType === "projectile") {
        const beforeProj = beforeWeapon ? (beforeWeapon.projectiles || 0) : 0;
        const afterProj = afterWeapon ? (afterWeapon.projectiles || 0) : 0;
        lines.push(statLine("Projectiles", beforeProj, afterProj));
      } else if (upgradeType === "bulletSpeed") {
        const beforeSpeed = beforeWeapon ? ((beforeWeapon.bulletSpeedMult || 1) * 100) : 100;
        const afterSpeed = afterWeapon ? ((afterWeapon.bulletSpeedMult || 1) * 100) : 100;
        lines.push(statLine("Proj Speed", Math.round(beforeSpeed), Math.round(afterSpeed), (v) => `${v}%`));
      } else if (upgradeType === "returnSpeed") {
        const beforeSpeed = beforeWeapon ? ((beforeWeapon.boomerangReturnSpeedMult || 1) * 100) : 100;
        const afterSpeed = afterWeapon ? ((afterWeapon.boomerangReturnSpeedMult || 1) * 100) : 100;
        lines.push(statLine("Return Speed", Math.round(beforeSpeed), Math.round(afterSpeed), (v) => `${v}%`));
      } else if (upgradeType === "rotationSpeed") {
        const beforeSpeed = beforeWeapon ? (beforeWeapon.boneRotationSpeed || 8) : 8;
        const afterSpeed = afterWeapon ? (afterWeapon.boneRotationSpeed || 8) : 8;
        lines.push(statLine("Rotation Speed", Math.round(beforeSpeed), Math.round(afterSpeed)));
      } else if (upgradeType === "radius") {
        const beforeRadius = beforeWeapon ? (beforeWeapon.weaponMeleeR || 50) : 50;
        const afterRadius = afterWeapon ? (afterWeapon.weaponMeleeR || 50) : 50;
        lines.push(statLine("Radius", Math.round(beforeRadius), Math.round(afterRadius)));
      } else if (upgradeType === "duration") {
        const beforeDur = beforeWeapon ? (beforeWeapon.flamewalkerDuration || 4.0) : 4.0;
        const afterDur = afterWeapon ? (afterWeapon.flamewalkerDuration || 4.0) : 4.0;
        lines.push(statLine("Duration", beforeDur.toFixed(1), afterDur.toFixed(1), (v) => `${v}s`));
      } else if (upgradeType === "splashRadius") {
        const beforeRadius = beforeWeapon ? (beforeWeapon.weaponSplashR || 54) : 54;
        const afterRadius = afterWeapon ? (afterWeapon.weaponSplashR || 54) : 54;
        lines.push(statLine("Splash Radius", Math.round(beforeRadius), Math.round(afterRadius)));
      } else if (upgradeType === "knockback") {
        const beforeKb = beforeWeapon ? ((beforeWeapon.meleeKnockbackMult || 1) * 100) : 100;
        const afterKb = afterWeapon ? ((afterWeapon.meleeKnockbackMult || 1) * 100) : 100;
        lines.push(statLine("Knockback", Math.round(beforeKb), Math.round(afterKb), (v) => `${v}%`));
      } else {
        // Fallback: show damage and range if upgrade type is unknown
        const beforeDmg = beforeWeapon ? (beforeWeapon.weaponDamage || 0) : 0;
        const afterDmg = afterWeapon ? (afterWeapon.weaponDamage || 0) : 0;
        if (Math.abs(afterDmg - beforeDmg) > 0.1) {
          lines.push(statLine("Damage", Math.round(beforeDmg), Math.round(afterDmg)));
        }
      }
    }
  } else {
    // For tomes/items: only show stats that actually changed
    // Check all relevant stats and only show what changed
    
    // Damage (for damage tome)
    const beforeDmg = before.weapons ? before.weapons.reduce((sum, w) => {
      const dmg = w.weaponDamage || 0;
      return sum + (isNaN(dmg) ? 0 : dmg);
    }, 0) : 0;
    const afterDmg = after.weapons ? after.weapons.reduce((sum, w) => {
      const dmg = w.weaponDamage || 0;
      return sum + (isNaN(dmg) ? 0 : dmg);
    }, 0) : 0;
    if (Math.abs(afterDmg - beforeDmg) > 0.1) {
      lines.push(statLine("Damage", Math.round(beforeDmg), Math.round(afterDmg)));
    }
    
    // Attack Speed / Cooldown (for cooldown tome)
    const beforeCd = before.weapons && before.weapons.length > 0 
      ? before.weapons.reduce((sum, w) => {
          const cd = w.attackCooldown || 0.42;
          return sum + (isNaN(cd) ? 0.42 : cd);
        }, 0) / before.weapons.length 
      : 0.42;
    const afterCd = after.weapons && after.weapons.length > 0
      ? after.weapons.reduce((sum, w) => {
          const cd = w.attackCooldown || 0.42;
          return sum + (isNaN(cd) ? 0.42 : cd);
        }, 0) / after.weapons.length
      : 0.42;
    if (Math.abs(afterCd - beforeCd) > 0.01) {
      lines.push(statLine("Attack cd", Number(beforeCd.toFixed(3)), Number(afterCd.toFixed(3)), (v) => `${v}s`));
    }
    
    // Projectiles (for quantity tome)
    const beforeProj = before.weapons ? before.weapons.reduce((sum, w) => sum + (w.projectiles || 0), 0) : 0;
    const afterProj = after.weapons ? after.weapons.reduce((sum, w) => sum + (w.projectiles || 0), 0) : 0;
    if (afterProj !== beforeProj) {
      lines.push(statLine("Projectiles", beforeProj, afterProj));
    }
    
    // Speed (for agility tome)
    const beforeSpeed = Math.round(computeSpeedFn(before));
    const afterSpeed = Math.round(computeSpeedFn(after));
    if (beforeSpeed !== afterSpeed) {
      lines.push(`Speed: ${beforeSpeed} → ${afterSpeed}`);
    }
    
    // Max HP (for HP tome)
    const beforeHp = Math.round(before.maxHp);
    const afterHp = Math.round(after.maxHp);
    if (beforeHp !== afterHp) {
      lines.push(`Max HP: ${beforeHp} → ${afterHp}`);
    }
    
    // Crit chance (for precision/crit master tome)
    const beforeCrit = Math.round((before.critChance || 0) * 100);
    const afterCrit = Math.round((after.critChance || 0) * 100);
    if (beforeCrit !== afterCrit) {
      lines.push(`Crit: ${beforeCrit}% → ${afterCrit}%`);
    }
    
    // Regen (for regen tome)
    if (Math.abs((after.regen || 0) - (before.regen || 0)) > 0.01) {
      lines.push(`Regen: ${(before.regen || 0).toFixed(2)} → ${(after.regen || 0).toFixed(2)}`);
    }
    
    // Gold gain (for gold tome)
    if (Math.abs((after.goldGain || 1) - (before.goldGain || 1)) > 0.01) {
      lines.push(`Gold gain: ${(before.goldGain || 1).toFixed(2)}x → ${(after.goldGain || 1).toFixed(2)}x`);
    }
    
    // XP gain (for XP tome)
    if (Math.abs((after.xpGain || 1) - (before.xpGain || 1)) > 0.01) {
      lines.push(`XP gain: ${(before.xpGain || 1).toFixed(2)}x → ${(after.xpGain || 1).toFixed(2)}x`);
    }
    
    // Luck (for luck tome)
    if (Math.abs((after.luck || 0) - (before.luck || 0)) > 0.01) {
      lines.push(`Luck: ${(before.luck || 0).toFixed(2)} → ${(after.luck || 0).toFixed(2)}`);
    }
    
    // Bounces (for ricochet tome)
    const beforeBounce = before.weapons ? before.weapons.reduce((sum, w) => sum + (w.bounces || 0), 0) : 0;
    const afterBounce = after.weapons ? after.weapons.reduce((sum, w) => sum + (w.bounces || 0), 0) : 0;
    if (beforeBounce !== afterBounce) {
      lines.push(statLine("Bounces", beforeBounce, afterBounce));
    }
    
    // Pierce (for pierce tome)
    const beforePierce = before.weapons ? before.weapons.reduce((sum, w) => sum + (w.pierce || 0), 0) : 0;
    const afterPierce = after.weapons ? after.weapons.reduce((sum, w) => sum + (w.pierce || 0), 0) : 0;
    if (beforePierce !== afterPierce) {
      lines.push(statLine("Pierce", beforePierce, afterPierce));
    }
    
    // Evasion (for evasion tome)
    const beforeEvasion = Math.round((before.evasion || 0) * 100);
    const afterEvasion = Math.round((after.evasion || 0) * 100);
    if (beforeEvasion !== afterEvasion) {
      lines.push(`Evasion: ${beforeEvasion}% → ${afterEvasion}%`);
    }
    
    // Shield (for shield tome)
    const beforeShield = Math.round(before.maxShield || 0);
    const afterShield = Math.round(after.maxShield || 0);
    if (beforeShield !== afterShield) {
      lines.push(`Shield: ${beforeShield} → ${afterShield}`);
    }
    
    // Size (for size tome)
    if (Math.abs((after.sizeMult || 1) - (before.sizeMult || 1)) > 0.01) {
      lines.push(`Size: ${((before.sizeMult || 1) * 100).toFixed(0)}% → ${((after.sizeMult || 1) * 100).toFixed(0)}%`);
    }
    
    // Knockback (for knockback tome)
    if (Math.abs((after.knockback || 0) - (before.knockback || 0)) > 0.1) {
      lines.push(`Knockback: ${Math.round(before.knockback || 0)} → ${Math.round(after.knockback || 0)}`);
    }
    
    // Projectile Speed (for projectile speed tome)
    if (Math.abs((after.bulletSpeedMult || 1) - (before.bulletSpeedMult || 1)) > 0.01) {
      lines.push(`Proj Speed: ${((before.bulletSpeedMult || 1) * 100).toFixed(0)}% → ${((after.bulletSpeedMult || 1) * 100).toFixed(0)}%`);
    }
    
    // Poison chance (for poison items)
    const beforePoison = Math.round((before.poisonChance || 0) * 100);
    const afterPoison = Math.round((after.poisonChance || 0) * 100);
    if (beforePoison !== afterPoison) {
      lines.push(`Poison: ${beforePoison}% → ${afterPoison}%`);
    }
    
    // Freeze chance (for freeze items)
    const beforeFreeze = Math.round((before.freezeChance || 0) * 100);
    const afterFreeze = Math.round((after.freezeChance || 0) * 100);
    if (beforeFreeze !== afterFreeze) {
      lines.push(`Freeze: ${beforeFreeze}% → ${afterFreeze}%`);
    }
    
    // Lifesteal (for vampire tome)
    const beforeLifesteal = Math.round((before.lifesteal || 0) * 100);
    const afterLifesteal = Math.round((after.lifesteal || 0) * 100);
    if (beforeLifesteal !== afterLifesteal) {
      lines.push(`Lifesteal: ${beforeLifesteal}% → ${afterLifesteal}%`);
    }
    
    // Elemental chance (for elemental tome)
    const beforeElemental = Math.round((before.elementalChance || 0) * 100);
    const afterElemental = Math.round((after.elementalChance || 0) * 100);
    if (beforeElemental !== afterElemental) {
      lines.push(`Elemental: ${beforeElemental}% → ${afterElemental}%`);
    }
    
    // Explosive chance (for explosive tome)
    const beforeExplosive = Math.round((before.explosiveChance || 0) * 100);
    const afterExplosive = Math.round((after.explosiveChance || 0) * 100);
    if (beforeExplosive !== afterExplosive) {
      lines.push(`Explosive: ${beforeExplosive}% → ${afterExplosive}%`);
    }
  }
  
  // Calculate average attack cooldown (with NaN protection)
  const beforeCd = before.weapons && before.weapons.length > 0 
    ? before.weapons.reduce((sum, w) => {
        const cd = w.attackCooldown || 0.42;
        return sum + (isNaN(cd) ? 0.42 : cd);
      }, 0) / before.weapons.length 
    : 0.42;
  const afterCd = after.weapons && after.weapons.length > 0
    ? after.weapons.reduce((sum, w) => {
        const cd = w.attackCooldown || 0.42;
        return sum + (isNaN(cd) ? 0.42 : cd);
      }, 0) / after.weapons.length
    : 0.42;
  lines.push(
    statLine(
      "Attack cd",
      Number(beforeCd.toFixed(3)),
      Number(afterCd.toFixed(3)),
      (v) => `${v}s`,
    ),
  );
  
  // Calculate total projectiles
  const beforeProj = before.weapons ? before.weapons.reduce((sum, w) => sum + w.projectiles, 0) : 0;
  const afterProj = after.weapons ? after.weapons.reduce((sum, w) => sum + w.projectiles, 0) : 0;
  lines.push(statLine("Projectiles", beforeProj, afterProj));
  
  // Calculate total bounces
  const beforeBounce = before.weapons ? before.weapons.reduce((sum, w) => sum + w.bounces, 0) : 0;
  const afterBounce = after.weapons ? after.weapons.reduce((sum, w) => sum + w.bounces, 0) : 0;
  lines.push(statLine("Bounces", beforeBounce, afterBounce));
  
  // Speed
  const beforeSpeed = Math.round(computeSpeedFn(before));
  const afterSpeed = Math.round(computeSpeedFn(after));
  if (beforeSpeed !== afterSpeed) {
    lines.push(`Speed: ${beforeSpeed} → ${afterSpeed}`);
  }
  
  // Max HP
  const beforeHp = Math.round(before.maxHp);
  const afterHp = Math.round(after.maxHp);
  if (beforeHp !== afterHp) {
    lines.push(`Max HP: ${beforeHp} → ${afterHp}`);
  }
  
  // Crit chance - always show if it changes
  const beforeCrit = Math.round(before.critChance * 100);
  const afterCrit = Math.round(after.critChance * 100);
  if (beforeCrit !== afterCrit) {
    lines.push(`Crit: ${beforeCrit}% → ${afterCrit}%`);
  }
  
  // Poison chance
  const beforePoison = Math.round(before.poisonChance * 100);
  const afterPoison = Math.round(after.poisonChance * 100);
  if (beforePoison !== afterPoison) {
    lines.push(`Poison: ${beforePoison}% → ${afterPoison}%`);
  }
  
  // Freeze chance
  const beforeFreeze = Math.round(before.freezeChance * 100);
  const afterFreeze = Math.round(after.freezeChance * 100);
  if (beforeFreeze !== afterFreeze) {
    lines.push(`Freeze: ${beforeFreeze}% → ${afterFreeze}%`);
  }
  
  // Regen
  if (Math.abs(before.regen - after.regen) > 0.01) {
    lines.push(`Regen: ${before.regen.toFixed(2)} → ${after.regen.toFixed(2)}`);
  }
  
  // Armor
  const beforeArmor = Math.round(before.armor * 100);
  const afterArmor = Math.round(after.armor * 100);
  if (beforeArmor !== afterArmor) {
    lines.push(`Armor: ${beforeArmor}% → ${afterArmor}%`);
  }
  
  // Gold gain
  if (Math.abs(before.goldGain - after.goldGain) > 0.01) {
    lines.push(`Gold gain: ${before.goldGain.toFixed(2)}x → ${after.goldGain.toFixed(2)}x`);
  }
  
  // XP gain
  if (Math.abs(before.xpGain - after.xpGain) > 0.01) {
    lines.push(`XP gain: ${before.xpGain.toFixed(2)}x → ${after.xpGain.toFixed(2)}x`);
  }
  
  // Luck
  if (Math.abs(before.luck - after.luck) > 0.01) {
    lines.push(`Luck: ${before.luck.toFixed(2)} → ${after.luck.toFixed(2)}`);
  }

  // Return all relevant changes (filter out nulls from statLine)
  return lines.filter(line => line !== null).join(" | ");
}
