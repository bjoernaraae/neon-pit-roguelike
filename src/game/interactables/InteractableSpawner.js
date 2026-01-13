/**
 * Interactable Spawner
 * 
 * Spawns interactable objects (chests, shrines, portals, etc.)
 */

import { rand } from "../../utils/math.js";
import { isPointWalkable, findNearestWalkable } from "../world/WalkabilitySystem.js";
import { INTERACT } from "../../data/constants.js";
import { chestCost } from "../../utils/gameMath.js";

/**
 * Spawn an interactable object
 * @param {Object} s - Game state
 * @param {string} kind - Interactable type (INTERACT constant)
 */
export function spawnInteractable(s, kind) {
  const { w, h, padding } = s.arena;
  let x, y;
  let attempts = 0;
  const maxAttempts = 50;
  
  // Try to find a walkable position
  do {
    // For chests, spawn in random rooms across the level for better distribution
    if (kind === INTERACT.CHEST && s.levelData && s.levelData.rooms && s.levelData.rooms.length > 0) {
      // Pick a random room
      const room = s.levelData.rooms[Math.floor(Math.random() * s.levelData.rooms.length)];
      // Spawn in the center area of the room
      x = room.x + rand(room.w * 0.3, room.w * 0.7);
      y = room.y + rand(room.h * 0.3, room.h * 0.7);
    } else if (s.levelData && s.levelData.rooms && s.levelData.rooms.length > 0) {
      // For other interactables, try to spawn in a random room first
      const room = s.levelData.rooms[Math.floor(Math.random() * s.levelData.rooms.length)];
      x = room.x + rand(room.w * 0.3, room.w * 0.7);
      y = room.y + rand(room.h * 0.3, room.h * 0.7);
    } else if (s.levelData) {
      // Fallback to level bounds
      x = rand(padding + 60, s.levelData.w - padding - 60);
      y = rand(padding + 60, s.levelData.h - padding - 60);
    } else {
      // Fallback to arena bounds
      x = rand(padding + 60, w - padding - 60);
      y = rand(padding + 60, h - padding - 60);
    }
    
    // Ensure position is walkable
    if (s.levelData && isPointWalkable(x, y, s.levelData, 20)) {
      break; // Found walkable position
    }
    
    attempts++;
  } while (attempts < maxAttempts);
  
  // If still not walkable after max attempts, find nearest walkable position
  if (s.levelData && !isPointWalkable(x, y, s.levelData, 20)) {
    const walkable = findNearestWalkable(x, y, s.levelData, 20);
    x = walkable.x;
    y = walkable.y;
  }

  let cost = 0;
  if (kind === INTERACT.CHEST) cost = chestCost(s.chestOpens, s.floor);
  // Shrines are now free (repurposed as permanent buff stations)
  if (kind === INTERACT.MICROWAVE) cost = 0; // Free
  if (kind === INTERACT.GREED) cost = Math.round(8 + s.floor * 2);
  if (kind === INTERACT.SHRINE) cost = 0; // Free
  if (kind === INTERACT.MAGNET_SHRINE) cost = 0; // Free (but these won't spawn anymore)
  if (kind === INTERACT.BOSS_TP) {
    // Boss portal cost: 20% of current gold, minimum 100 (calculated dynamically)
    // Set to -1 as a flag to calculate dynamically
    cost = -1;
  }

  s.interact.push({
    id: Math.random().toString(16).slice(2),
    kind,
    x,
    y,
    r: 16,
    cost,
    used: false,
    t: 0,
  });
}
