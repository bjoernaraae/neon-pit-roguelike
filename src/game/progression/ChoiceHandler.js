/**
 * Choice Handler
 * 
 * Handles picking upgrade choices and resuming the game.
 * Uses factory pattern to inject React state dependencies.
 */

import { clamp } from "../../utils/math.js";
import { RARITY, RARITY_COLOR } from "../../data/constants.js";
import { ISO_MODE } from "../../data/constants.js";

/**
 * Create choice picking function with injected dependencies
 * @param {Object} deps - Dependencies { stateRef, uiRef, setUi, pushCombatText }
 * @returns {Function} pickChoice function
 */
export function createChoiceHandler(deps) {
  const { stateRef, uiRef, setUi, pushCombatText } = deps;

  return function pickChoice(i) {
    const s = stateRef.current;
    if (!s) return;
    const u = uiRef.current;
    if (u.screen !== "levelup") return;

    const c = u.levelChoices?.[i];
    if (!c) return;

    c.apply();

    // Show popup text for the upgrade with rarity color
    const p = s.player;
    const col = RARITY_COLOR[c.rarity] || RARITY_COLOR[RARITY.COMMON];
    pushCombatText(s, p.x, p.y - 30, c.name.toUpperCase(), col.bg, { size: 18, life: 1.5 });

    // FIX CAMERA SHIFT: Snap camera to centered position on player BEFORE resuming
    // This prevents any offset or drift that accumulated during the levelup screen
    const { w, h } = s.arena;
    console.log("pickChoice - Player position:", p.x, p.y);
    console.log("pickChoice - Arena size:", w, h);
    console.log("pickChoice - Camera BEFORE snap:", s.camera.x, s.camera.y);
    
    if (ISO_MODE) {
      // In isometric mode, camera is at player position
      s.camera.x = p.x;
      s.camera.y = p.y;
    } else {
      // In top-down mode, camera is offset to center player on screen
      const targetX = p.x - w / 2;
      const targetY = p.y - h / 2;
      s.camera.x = targetX;
      s.camera.y = targetY;
      
      console.log("pickChoice - Camera target (before clamp):", targetX, targetY);
      
      // Clamp to level bounds
      if (s.levelData) {
        const minX = 0;
        const maxX = Math.max(0, s.levelData.w - w);
        const minY = 0;
        const maxY = Math.max(0, s.levelData.h - h);
        
        console.log("pickChoice - Level bounds: minX:", minX, "maxX:", maxX, "minY:", minY, "maxY:", maxY);
        console.log("pickChoice - Level size:", s.levelData.w, s.levelData.h);
        
        s.camera.x = clamp(s.camera.x, minX, maxX);
        s.camera.y = clamp(s.camera.y, minY, maxY);
      }
    }
    
    console.log("pickChoice - Camera AFTER snap:", s.camera.x, s.camera.y);

    // CRITICAL: Clear upgrade cards from state so camera can resume following player
    s.upgradeCards = [];
    
    // Enable camera debug logging for 3 seconds after levelup
    s._debugCameraUntil = s.t + 3.0;
    s._cameraDebugLogged = false; // Reset debug flag

    s.running = true;
    s.freezeMode = null;

    const nextUi = {
      ...u,
      screen: "running",
      level: s.level,
      xp: s.xp,
      xpNeed: s.xpNeed,
      score: s.score,
      coins: s.player.coins,
      timer: s.stageLeft,
      hint: "",
      levelChoices: [],
      selectedChoiceIndex: 0,
      levelUpFanfareT: 0,
      chestOpenFanfareT: 0,
    };

    uiRef.current = nextUi;
    setUi(nextUi);
  };
}
