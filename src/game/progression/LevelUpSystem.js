import { clamp, rand } from "../../utils/math.js";
import { xpToNext } from "../../utils/gameMath.js";
import { pushCombatText as pushCombatTextFn } from "../effects/CombatText.js";
import { addExplosion } from "../effects/VisualEffects.js";
import { RARITY, ISO_MODE } from "../../data/constants.js";

/**
 * Award XP to the player and handle level-up logic
 */
export function awardXP(s, amount, x, y, rollLevelChoicesFn, sfxLevelUpFn, uiRef, setUi) {
  const p = s.player;
  const xp = Math.round(amount * p.xpGain);
  s.xp += xp;

  if (Math.random() < 0.5) {
    s.particles.push({ x, y, vx: rand(-40, 40), vy: rand(-120, -40), r: 2.8, t: 0, life: rand(0.25, 0.45), hue: 170 });
  }

  let levelUpSafe = 0;
  while (s.xp >= s.xpNeed && levelUpSafe < 100) {
    levelUpSafe++;
    s.xp -= s.xpNeed;
    s.level += 1;
    s.xpNeed = xpToNext(s.level);

    p.iFrames = Math.max(p.iFrames, 1.25);
    if (p.hp <= 0) p.hp = 1;

    // Preserve explosive bullets (injected or seeking) and boomerang bullets when leveling up
    s.bullets = s.bullets.filter(b => 
      (b.explosive && ((b.injected && b.injectedEnemy) || (b.seeking && !b.injected))) ||
      (b.boomerang && b.t < b.life)
    );

    // Class-specific perks on level up
    if (p.charId === "cowboy") {
      // Cowboy: Increases crit by 1.5% each level
      p.critChance = clamp(p.critChance + 0.015, 0, 0.8);
      pushCombatTextFn(s, p.x, p.y - 35, "+1.5% Crit", "#2ea8ff", { size: 11, life: 0.8 });
    } else if (p.charId === "wizard") {
      // Wizard: Increases luck by 0.15 each level
      p.luck += 0.15;
      pushCombatTextFn(s, p.x, p.y - 35, "+0.15 Luck", "#c23bff", { size: 11, life: 0.8 });
    } else if (p.charId === "brute") {
      // Brute: Increases max HP by 8 each level
      p.maxHp = Math.round(p.maxHp + 8);
      p.hp = Math.min(p.maxHp, p.hp + 8);
      pushCombatTextFn(s, p.x, p.y - 35, "+8 Max HP", "#1fe06a", { size: 11, life: 0.8 });
    }

    // Level up fanfare: enhanced visual effects
    pushCombatTextFn(s, p.x, p.y - 18, `LEVEL ${s.level}`, "#2ea8ff", { size: 14, life: 0.95 });
    addExplosion(s, p.x, p.y, 1.5, 200);
    
    // Add particle burst for level up fanfare
    for (let i = 0; i < 80; i++) {
      const angle = (Math.PI * 2 * i) / 80;
      const speed = 80 + Math.random() * 120;
      s.particles.push({
        x: p.x,
        y: p.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 3 + Math.random() * 4,
        t: 0,
        life: 0.6 + Math.random() * 0.4,
        hue: 200 + Math.random() * 40, // Blue-purple range
      });
    }

    sfxLevelUpFn();

    const choices = rollLevelChoicesFn(s);
    
    // Find highest rarity for fanfare color
    const rarityOrder = { [RARITY.COMMON]: 0, [RARITY.UNCOMMON]: 1, [RARITY.RARE]: 2, [RARITY.LEGENDARY]: 3 };
    let highestRarity = RARITY.COMMON;
    for (const choice of choices) {
      if (rarityOrder[choice.rarity] > rarityOrder[highestRarity]) {
        highestRarity = choice.rarity;
      }
    }
    
    // FIX CAMERA: Center camera on player BEFORE entering levelup screen
    // This prevents the off-center camera issue when the levelup overlay appears
    const { w, h } = s.arena;
    if (ISO_MODE) {
      s.camera.x = p.x;
      s.camera.y = p.y;
    } else {
      const targetX = p.x - w / 2;
      const targetY = p.y - h / 2;
      s.camera.x = targetX;
      s.camera.y = targetY;
      
      // Clamp to level bounds
      if (s.levelData) {
        s.camera.x = clamp(s.camera.x, 0, Math.max(0, s.levelData.w - w));
        s.camera.y = clamp(s.camera.y, 0, Math.max(0, s.levelData.h - h));
      }
    }
    
    const nextUi = {
      ...uiRef.current,
      screen: "levelup",
      level: s.level,
      xp: s.xp,
      xpNeed: s.xpNeed,
      score: s.score,
      coins: s.player.coins,
      timer: s.stageLeft,
      hint: "Level up",
      levelChoices: choices,
      selectedChoiceIndex: 0, // Reset selection
      levelUpFanfareT: 2.5, // Start fanfare animation (2.5 seconds)
      highestRarity: highestRarity, // Store highest rarity for fanfare color
    };

    s.running = false;
    s.freezeMode = "levelup";

    uiRef.current = nextUi;
    setUi(nextUi);

    return true;
  }

  return false;
}
