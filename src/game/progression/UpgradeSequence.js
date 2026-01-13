/**
 * Upgrade Sequence
 * 
 * Handles triggering the upgrade sequence when opening chests or leveling up.
 * Uses factory pattern to inject React state dependencies.
 */

import { clamp } from "../../utils/math.js";
import { INTERACT, RARITY } from "../../data/constants.js";
import { ISO_MODE } from "../../data/constants.js";

/**
 * Create upgrade sequence function with injected dependencies
 * @param {Object} deps - Dependencies { uiRef, setUi, sfxLevelUp, rollChestChoices }
 * @returns {Function} triggerUpgradeSequence function
 */
export function createUpgradeSequence(deps) {
  const { uiRef, setUi, sfxLevelUp, rollChestChoices } = deps;

  return function triggerUpgradeSequence(s, content) {
    const rolled = rollChestChoices(s);
    const best = s.interact?.find(i => i.kind === INTERACT.CHEST && !i.used);
    const chestX = best?.x || s.player.x;
    const chestY = best?.y || s.player.y;
    
    // Find highest rarity for fanfare color (same as level up)
    const rarityOrder = { [RARITY.COMMON]: 0, [RARITY.UNCOMMON]: 1, [RARITY.RARE]: 2, [RARITY.LEGENDARY]: 3 };
    let highestRarity = RARITY.COMMON;
    for (const choice of rolled.choices) {
      if (rarityOrder[choice.rarity] > rarityOrder[highestRarity]) {
        highestRarity = choice.rarity;
      }
    }
    
    // Chest opening fanfare: particle burst and visual effects (same as level up)
    for (let i = 0; i < 80; i++) {
      const angle = (Math.PI * 2 * i) / 80;
      const speed = 80 + Math.random() * 120;
      s.particles.push({
        x: chestX,
        y: chestY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 3 + Math.random() * 4,
        t: 0,
        life: 0.6 + Math.random() * 0.4,
        hue: 200 + Math.random() * 40, // Blue-purple range (same as level up)
      });
    }
    
    sfxLevelUp(); // Use same sound as level up
    
    // FIX CAMERA: Center camera on player BEFORE entering levelup screen
    // This prevents the off-center camera issue when the levelup overlay appears
    const p = s.player;
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
    
    // CRITICAL: Set s.upgradeCards and ui.screen = 'levelup' immediately
    if (!s.upgradeCards) s.upgradeCards = [];
    s.upgradeCards = rolled.choices; // Store upgrade cards in state
    
    const nextUi = {
      ...uiRef.current,
      screen: "levelup", // MUST set screen to levelup
      level: s.level,
      xp: s.xp,
      xpNeed: s.xpNeed,
      score: s.score,
      coins: s.player.coins,
      timer: s.stageLeft,
      hint: `Chest reward: ${rolled.bucket}`,
      levelChoices: rolled.choices,
      selectedChoiceIndex: 0, // Reset selection
      levelUpFanfareT: 2.5, // Start fanfare animation (2.5 seconds) - same as level up
      highestRarity: highestRarity, // Store highest rarity for fanfare color
    };

    uiRef.current = nextUi;
    setUi(nextUi);
  };
}
