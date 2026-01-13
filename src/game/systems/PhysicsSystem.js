import { isPointWalkable } from "../world/WalkabilitySystem.js";
import { ISO_MODE } from "../../data/constants.js";
import { transformInputForIsometric } from "../../rendering/IsometricRenderer.js";

/**
 * Update jump physics, gravity, and ground detection
 */
export function updateJumpPhysics(s, dt, keysRef, jumpKeyJustPressedRef) {
  const p = s.player;
  
  // Update jump physics
  if (p.jumpT > 0) {
    p.jumpT = Math.max(0, p.jumpT - dt);
    if (p.jumpV !== undefined) {
      // Apply gravity
      p.jumpV -= 800 * dt; // Gravity acceleration (restored from original)
      if (p.z === undefined) p.z = 0;
      p.z += p.jumpV * dt;
      
      // Apply horizontal jump velocity for diagonal jump arc
      if (p.jumpVx !== undefined && p.jumpVy !== undefined && (p.jumpVx !== 0 || p.jumpVy !== 0)) {
        // Check if new position with jump velocity is walkable
        const newJumpX = p.x + p.jumpVx * dt;
        const newJumpY = p.y + p.jumpVy * dt;
        
        // Apply jump movement with collision checks
        if (s.levelData) {
          // Try X movement first
          if (isPointWalkable(newJumpX, p.y, s.levelData, p.r || 12)) {
            p.x = newJumpX;
          }
          // Then try Y movement
          if (isPointWalkable(p.x, newJumpY, s.levelData, p.r || 12)) {
            p.y = newJumpY;
          }
        } else {
          // Fallback: no level data, allow movement
          p.x = newJumpX;
          p.y = newJumpY;
        }
        
        // Gradually reduce horizontal velocity (air resistance)
        p.jumpVx *= (1 - dt * 2.5); // Decay over time
        p.jumpVy *= (1 - dt * 2.5);
        
        // Stop horizontal velocity if it's very small
        if (Math.abs(p.jumpVx) < 1) p.jumpVx = 0;
        if (Math.abs(p.jumpVy) < 1) p.jumpVy = 0;
      }
      
      // Ground check - CRITICAL: clamp z to 0 to prevent tiny decimals
      if (p.z < 0) {
        p.z = 0;
      }
      if (p.z <= 0) {
        p.z = 0;
        p.jumpV = 0;
        p.jumpT = 0;
        p.jumpVx = 0;
        p.jumpVy = 0;
        p.jumpLandingGrace = 0.15;
      }
    }
  } else if (p.z !== undefined && p.z > 0) {
    // Fall down if not jumping
    p.jumpV = (p.jumpV || 0) - 800 * dt; // Gravity during fall (restored from original)
    p.z += p.jumpV * dt;
    
    // Apply remaining horizontal velocity during fall
    if (p.jumpVx !== undefined && p.jumpVy !== undefined && (p.jumpVx !== 0 || p.jumpVy !== 0)) {
      const newJumpX = p.x + p.jumpVx * dt;
      const newJumpY = p.y + p.jumpVy * dt;
      
      // Apply jump movement with collision checks
      if (s.levelData) {
        // Try X movement first
        if (isPointWalkable(newJumpX, p.y, s.levelData, p.r || 12)) {
          p.x = newJumpX;
        }
        // Then try Y movement
        if (isPointWalkable(p.x, newJumpY, s.levelData, p.r || 12)) {
          p.y = newJumpY;
        }
      } else {
        // Fallback: no level data, allow movement
        p.x = newJumpX;
        p.y = newJumpY;
      }
      
      // Gradually reduce horizontal velocity
      p.jumpVx *= (1 - dt * 2.5);
      p.jumpVy *= (1 - dt * 2.5);
      
      if (Math.abs(p.jumpVx) < 1) p.jumpVx = 0;
      if (Math.abs(p.jumpVy) < 1) p.jumpVy = 0;
    }
    
    // Ground check during fall
    if (p.z < 0) {
      p.z = 0;
      p.jumpV = 0;
      p.jumpVx = 0;
      p.jumpVy = 0;
      p.jumpLandingGrace = 0.15;
    }
  } else {
    // On ground, ensure z is 0
    if (p.z === undefined || p.z > 0) {
      p.z = 0;
    }
    // Clear horizontal jump velocity
    if (p.jumpVx !== undefined) p.jumpVx = 0;
    if (p.jumpVy !== undefined) p.jumpVy = 0;
    
    // Check for jump input (Space key) - only trigger on keydown, not when holding
    // Player must be grounded (z <= 0) and not already jumping (jumpT <= 0)
    const keys = keysRef.current;
    if (jumpKeyJustPressedRef.current && p.jumpT <= 0 && (p.z === undefined || p.z <= 0)) {
      jumpKeyJustPressedRef.current = false; // Clear the flag so holding doesn't trigger again
      // Initiate jump
      const baseJumpV = 160 * (p.jumpHeight || 1.0);
      p.jumpV = baseJumpV;
      p.jumpT = 0.4; // Jump duration
      
      // Get movement direction for diagonal jump
      let mx = (keys.has("ArrowRight") || keys.has("d") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("a") ? 1 : 0);
      let my = (keys.has("ArrowDown") || keys.has("s") ? 1 : 0) - (keys.has("ArrowUp") || keys.has("w") ? 1 : 0);
      
      // Transform input directions for isometric mode
      let dirX, dirY;
      if (ISO_MODE && (mx !== 0 || my !== 0)) {
        const transformed = transformInputForIsometric(mx, my);
        dirX = transformed.x;
        dirY = transformed.y;
      } else {
        const len = Math.hypot(mx, my) || 1;
        dirX = len ? mx / len : 1;
        dirY = len ? my / len : 0;
      }
      
      // Set horizontal jump velocity (diagonal jump)
      const jumpSpeed = baseJumpV * 0.6; // Horizontal jump speed multiplier
      p.jumpVx = dirX * jumpSpeed;
      p.jumpVy = dirY * jumpSpeed;
    }
  }
  
  // Update landing grace period
  if (p.jumpLandingGrace > 0) {
    p.jumpLandingGrace = Math.max(0, p.jumpLandingGrace - dt);
  }
}

/**
 * Update player buff timers
 */
export function updateBuffTimers(p, dt) {
  if (p.iFrames > 0) p.iFrames = Math.max(0, p.iFrames - dt);
  if (p.buffHasteT > 0) p.buffHasteT = Math.max(0, p.buffHasteT - dt);
  
  // Magnet shrine effect countdown
  if (p.magnetT > 0) {
    p.magnetT = Math.max(0, p.magnetT - dt);
    if (p.magnetT <= 0) {
      p.magnet = 1; // Reset to base magnet when effect ends
    }
  }
  
  // Gold boost effect countdown
  if (p.goldBoostT > 0) {
    p.goldBoostT = Math.max(0, p.goldBoostT - dt);
    if (p.goldBoostT <= 0) {
      p.goldBoostMult = 1; // Reset to base gold gain when effect ends
    }
  }
  
  // Update ability cooldown with multiplier
  if (p.abilityT > 0) {
    const cdMult = p.abilityCdMult || 1;
    p.abilityT = Math.max(0, p.abilityT - dt * (1 / cdMult));
  }
}
