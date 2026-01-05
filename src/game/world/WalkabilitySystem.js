/**
 * Walkability system for checking if positions are walkable and finding paths
 */

import { COLLISION_MARGIN_LEFT, COLLISION_MARGIN_RIGHT, COLLISION_MARGIN_TOP, COLLISION_MARGIN_BOTTOM } from '../../data/constants.js';

/**
 * Check if circle overlaps rectangle
 * @param {number} cx - Circle center x
 * @param {number} cy - Circle center y
 * @param {number} radius - Circle radius
 * @param {number} rx - Rectangle x
 * @param {number} ry - Rectangle y
 * @param {number} rw - Rectangle width
 * @param {number} rh - Rectangle height
 * @returns {boolean} True if circle overlaps rectangle
 */
export function circleOverlapsRect(cx, cy, radius, rx, ry, rw, rh) {
  // Find closest point on rectangle to circle center
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  // Check if distance from circle center to closest point <= radius
  const distSq = (cx - closestX) ** 2 + (cy - closestY) ** 2;
  return distSq <= radius ** 2;
}

/**
 * Check if a point (with radius) is walkable
 * Uses grid for quick rejection, then precise circle-rectangle checks
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {object} levelData - Level data with rooms, corridors, and grid
 * @param {number} radius - Entity radius (default 12)
 * @returns {boolean} True if point is walkable
 */
export function isPointWalkable(x, y, levelData, radius = 12) {
  if (!levelData) return true; // No level data = walkable (fallback)
  
  const gridSize = levelData.pathfindingGridSize || 10;
  
  // Quick rejection: Check if grid cell is walkable
  if (levelData.pathfindingGrid && Array.isArray(levelData.pathfindingGrid)) {
    const gridX = Math.floor(x / gridSize);
    const gridY = Math.floor(y / gridSize);
    const gridW = levelData.pathfindingGrid[0]?.length || 0;
    const gridH = levelData.pathfindingGrid.length || 0;
    
    // Check current cell and nearby cells (within radius)
    const checkRadius = Math.ceil(radius / gridSize) + 1;
    let foundWalkableCell = false;
    
    for (let dy = -checkRadius; dy <= checkRadius; dy++) {
      for (let dx = -checkRadius; dx <= checkRadius; dx++) {
        const gx = gridX + dx;
        const gy = gridY + dy;
        
        if (gx < 0 || gx >= gridW || gy < 0 || gy >= gridH) {
          continue; // Out of bounds, skip
        }
        
        if (levelData.pathfindingGrid[gy] && levelData.pathfindingGrid[gy][gx] === 1) {
          foundWalkableCell = true;
          break; // Found at least one walkable cell nearby
        }
      }
      if (foundWalkableCell) break;
    }
    
    // If no walkable cells nearby, definitely not walkable
    if (!foundWalkableCell) {
      return false;
    }
  }
  
  // Precise check: Circle must be inside rectangle (circle edge can touch wall)
  // Use independent margins for each edge to account for isometric cube shape
  const marginLeft = radius * COLLISION_MARGIN_LEFT;
  const marginRight = radius * COLLISION_MARGIN_RIGHT;
  const marginTop = radius * COLLISION_MARGIN_TOP;
  const marginBottom = radius * COLLISION_MARGIN_BOTTOM;
  
  // Check if circle is inside any room (circle edge can touch wall)
  for (const room of levelData.rooms || []) {
    // Check each edge independently with its own margin
    if (x >= room.x + marginLeft && 
        x <= room.x + room.w - marginRight &&
        y >= room.y + marginTop && 
        y <= room.y + room.h - marginBottom) {
      return true; // Inside a room
    }
  }
  
  // Check if circle is inside any corridor (circle edge can touch wall)
  for (const corridor of levelData.corridors || []) {
    // Check each edge independently with its own margin
    if (x >= corridor.x + marginLeft && 
        x <= corridor.x + corridor.w - marginRight &&
        y >= corridor.y + marginTop && 
        y <= corridor.y + corridor.h - marginBottom) {
      return true; // Inside a corridor
    }
  }
  
  // Not in any walkable area
  return false;
}

/**
 * Find nearest walkable position
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {object} levelData - Level data with rooms and corridors
 * @param {number} radius - Entity radius (default 12)
 * @returns {{x: number, y: number}} Nearest walkable position
 */
export function findNearestWalkable(x, y, levelData, radius = 12) {
  if (!levelData) return { x, y };
  
  let bestPos = { x, y };
  let minDist = Infinity;
  
  // Check all rooms and corridors
  // Use independent margins for each edge to match isPointWalkable
  const marginLeft = radius * COLLISION_MARGIN_LEFT;
  const marginRight = radius * COLLISION_MARGIN_RIGHT;
  const marginTop = radius * COLLISION_MARGIN_TOP;
  const marginBottom = radius * COLLISION_MARGIN_BOTTOM;
  const areas = [...(levelData.rooms || []), ...(levelData.corridors || [])];
  for (const area of areas) {
    // Clamp position to area bounds (accounting for independent edge margins)
    const clampedX = Math.max(area.x + marginLeft, Math.min(x, area.x + area.w - marginRight));
    const clampedY = Math.max(area.y + marginTop, Math.min(y, area.y + area.h - marginBottom));
    const dist = Math.hypot(x - clampedX, y - clampedY);
    
    if (dist < minDist) {
      minDist = dist;
      bestPos = { x: clampedX, y: clampedY };
    }
  }
  
  return bestPos;
}

/**
 * Line of sight check - raycast with collision detection
 * @param {number} fromX - Start X coordinate
 * @param {number} fromY - Start Y coordinate
 * @param {number} toX - End X coordinate
 * @param {number} toY - End Y coordinate
 * @param {object} levelData - Level data
 * @param {number} stepSize - Step size for raycast (default 10)
 * @returns {boolean} True if there is line of sight
 */
export function hasLineOfSight(fromX, fromY, toX, toY, levelData, stepSize = 10) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return true;
  
  const steps = Math.ceil(dist / stepSize);
  const stepX = dx / steps;
  const stepY = dy / steps;
  
  // Check each point along the ray
  for (let i = 0; i <= steps; i++) {
    const x = fromX + stepX * i;
    const y = fromY + stepY * i;
    
    // Check if point is walkable (not a wall)
    if (!isPointWalkable(x, y, levelData, 5)) {
      return false; // Hit a wall
    }
  }
  
  return true; // Clear line of sight
}
