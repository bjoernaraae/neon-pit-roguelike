import { lerp, clamp } from "../../utils/math.js";
import { ISO_MODE } from "../../data/constants.js";

/**
 * Camera initialization and setup
 */
export function initializeCamera(s, w, h) {
  const p = s.player;
  
  if (!s.camera) {
    if (ISO_MODE) {
      // In isometric mode, camera is at player position (we convert to isometric when rendering)
      s.camera = { x: p.x, y: p.y };
    } else {
      // In top-down mode, camera is offset to center player on screen
      s.camera = { x: p.x - w / 2, y: p.y - h / 2 };
    }
  }
}

/**
 * Update camera to follow player (but not during upgrade selection)
 */
export function updateCamera(s, dt, w, h, uiRef) {
  const p = s.player;
  const u = uiRef.current;
  const hasUpgradeCards = u && u.levelChoices && u.levelChoices.length > 0;
  // Also check s.upgradeCards if it exists
  const upgradeCardsLength = (s.upgradeCards && s.upgradeCards.length) || (hasUpgradeCards ? 1 : 0);
  
  if (upgradeCardsLength === 0) {
    if (ISO_MODE) {
      // In isometric mode, camera follows player directly (no offset)
      // We'll convert to isometric and center when rendering
      s.camera.x = lerp(s.camera.x, p.x, dt * 4);
      s.camera.y = lerp(s.camera.y, p.y, dt * 4);
    } else {
      // In top-down mode, camera is offset to center player on screen
      const targetX = p.x - w / 2;
      const targetY = p.y - h / 2;
      const beforeLerpX = s.camera.x;
      const beforeLerpY = s.camera.y;
      s.camera.x = lerp(s.camera.x, targetX, dt * 4);
      s.camera.y = lerp(s.camera.y, targetY, dt * 4);
      
      // DEBUG: Only log first 60 frames after levelup
      if (s.t < s._debugCameraUntil) {
        console.log("Camera lerp - Before:", beforeLerpX.toFixed(1), beforeLerpY.toFixed(1), 
                    "Target:", targetX.toFixed(1), targetY.toFixed(1),
                    "After:", s.camera.x.toFixed(1), s.camera.y.toFixed(1),
                    "Player:", p.x.toFixed(1), p.y.toFixed(1));
      }
      
      // Clamp camera to level bounds (only needed for top-down mode)
      if (s.levelData) {
        s.camera.x = clamp(s.camera.x, 0, Math.max(0, s.levelData.w - w));
        s.camera.y = clamp(s.camera.y, 0, Math.max(0, s.levelData.h - h));
      }
    }
  }
}
