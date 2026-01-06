/**
 * Collision detection and resolution system
 */

import { isPointWalkable, findNearestWalkable } from '../world/WalkabilitySystem.js';

/**
 * Calculate the visual cube's effective collision radius to match what's actually drawn
 * @param {number} entityRadius - Entity radius
 * @returns {number} Visual radius for collision
 */
export function getVisualRadius(entityRadius) {
  // For collision detection, we want the visual radius to match the cube size
  // Use 80% of original radius for all entities - this was working well for bounding box
  const visualR = entityRadius * 0.4;
  return visualR;
}

/**
 * Resolve overlap between a kinematic (player) and dynamic (enemy) circle
 * @param {object} kin - Kinematic entity (player)
 * @param {object} dyn - Dynamic entity (enemy)
 * @param {object} bounds - Bounds object (unused but kept for compatibility)
 * @param {object} levelData - Level data for walkability checks
 * @returns {boolean} True if overlap was resolved
 */
export function resolveKinematicOverlap(kin, dyn, bounds, levelData = null) {
  // Default: enemies can ALWAYS hit you when in contact
  // Only exception: at the absolute peak of a very high jump
  
  // Landing grace period prevents immediate collision after landing
  if (kin.jumpLandingGrace !== undefined && kin.jumpLandingGrace > 0) {
    return false; // Grace period after landing
  }
  
  // Check if player is jumping - allow proper jumps while preventing spam
  if (kin.z !== undefined && kin.z > 0) {
    // Simple logic: if you're high enough (z > 8), you can jump over enemies
    // This prevents spam (spam jumps are very low, z < 5) while allowing proper jumps
    // With baseJumpV = 160, max height is ~16, so z > 8 covers most of the jump arc
    if (kin.z > 8) {
      // High enough to clear enemies - safe
      return false; // High enough to jump over enemies safely
    }
    // Low jump (z <= 8) - vulnerable (spam jump territory)
    // This means any jump that doesn't get high enough will get hit
  }
  // If z <= 0 or undefined (on ground), allow collision (player can be hit)
  
  const dx = kin.x - dyn.x;
  const dy = kin.y - dyn.y;
  const d = Math.hypot(dx, dy);
  // Use visual cube radius for collision to match what's actually drawn
  const kinVisualR = getVisualRadius(kin.r || 14);
  const dynVisualR = getVisualRadius(dyn.r || 14);
  const minD = kinVisualR + dynVisualR;
  if (!(d < minD)) {
    return false;
  }

  const nx = d > 0.0001 ? dx / d : 1;
  const ny = d > 0.0001 ? dy / d : 0;
  const overlap = minD - d;

  // Store original position
  const oldX = kin.x;
  const oldY = kin.y;
  const playerRadius = kin.r || 12;

  // Try to move player away from enemy
  const testX = kin.x + nx * (overlap + 0.01);
  const testY = kin.y + ny * (overlap + 0.01);
  
  // Check if new position is walkable (prevents being pushed through walls)
  if (levelData) {
    if (isPointWalkable(testX, testY, levelData, playerRadius)) {
      kin.x = testX;
      kin.y = testY;
    } else {
      // Can't move away, try X-only or Y-only
      if (isPointWalkable(testX, kin.y, levelData, playerRadius)) {
        kin.x = testX;
      } else if (isPointWalkable(kin.x, testY, levelData, playerRadius)) {
        kin.y = testY;
      }
      // If still can't move, stay in place (enemy will be pushed instead)
    }
  } else {
    // No level data, allow movement
    kin.x = testX;
    kin.y = testY;
  }

  dyn.x -= nx * (overlap * 0.2);
  dyn.y -= ny * (overlap * 0.2);
  
  // Final check: ensure player is still walkable
  if (levelData && !isPointWalkable(kin.x, kin.y, levelData, playerRadius)) {
    const walkable = findNearestWalkable(kin.x, kin.y, levelData, playerRadius);
    kin.x = walkable.x;
    kin.y = walkable.y;
  }
  
  
  return true;
}

/**
 * Resolve overlap between two dynamic circles (enemy-enemy collision)
 * @param {object} a - First dynamic entity
 * @param {object} b - Second dynamic entity
 * @param {object} bounds - Bounds object (unused but kept for compatibility)
 * @returns {boolean} True if overlap was resolved
 */
export function resolveDynamicOverlap(a, b, bounds) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const d = Math.hypot(dx, dy);
  const minD = a.r + b.r;
  if (!(d < minD)) return false;

  const nx = d > 0.0001 ? dx / d : 1;
  const ny = d > 0.0001 ? dy / d : 0;
  const overlap = minD - d;

  a.x += nx * (overlap * 0.5);
  a.y += ny * (overlap * 0.5);
  b.x -= nx * (overlap * 0.5);
  b.y -= ny * (overlap * 0.5);

  // Bounds clamping removed - enemies can move freely within walkable areas
  // Collision detection will handle boundaries naturally
  return true;
}
