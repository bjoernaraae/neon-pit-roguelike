/**
 * Level generator for procedural level creation
 */

import { generateBSPDungeon } from './BSPDungeonGenerator.js';
import { rand } from '../../utils/math.js';

/**
 * Generate a procedural level using BSP dungeon generation
 * @param {number} w - Level width (unused, calculated internally)
 * @param {number} h - Level height (unused, calculated internally)
 * @param {number} floor - Current floor number
 * @returns {object} Level data with rooms, corridors, grid, and decorations
 */
export function generateProceduralLevel(w, h, floor) {
  // Use BSP algorithm for better structured dungeon generation
  // Larger maps for slower-paced gameplay: ~140 tiles
  const gridSize = 10; // Grid cell size
  const targetTiles = 140; // Target ~140 tiles (larger maps for slower gameplay)
  const levelW = targetTiles * gridSize; // 1400px (140 tiles * 10px)
  const levelH = targetTiles * gridSize; // 1400px (140 tiles * 10px)
  const padding = 50;
  
  // Determine biome based on floor
  const biomeTypes = ["grassland", "desert", "winter", "forest", "volcanic"];
  const biome = biomeTypes[(floor - 1) % biomeTypes.length];
  
  // BSP Dungeon Generation Parameters
  // Minimum room size: at least 20x20 tiles (200px) for horde gameplay with player (r=14) and enemies
  const minRoomSize = 200; // 20 tiles * 10px = 200px minimum room size
  const maxDepth = 4; // Limit recursion to 4 levels (results in 8-16 rooms)
  
  // Generate BSP dungeon
  const bspResult = generateBSPDungeon(levelW, levelH, minRoomSize, maxDepth);
  
  // Extract rooms and corridors from BSP
  const rooms = [];
  const corridors = [];
  const obstacles = []; // Visual-only obstacles (don't block movement)
  const grass = []; // Grass patches for visual variety
  const rocks = []; // Rock decorations
  const water = []; // Water features (visual only)
  
  // Convert BSP rooms to our format
  // Visual rendering uses exact coordinates
  // Collision uses exact room/corridor bounds (no expansion)
  // pathfindingGrid is ONLY for pathfinding (flow fields, A*), not collision
  for (let i = 0; i < bspResult.rooms.length; i++) {
    const bspRoom = bspResult.rooms[i];
    const room = {
      x: bspRoom.x,
      y: bspRoom.y,
      w: bspRoom.w,
      h: bspRoom.h,
      id: i,
      enemies: [],
      cleared: false
    };
    rooms.push(room);
  }
  
  // Convert BSP corridors to our format
  for (const bspCorr of bspResult.corridors) {
    corridors.push({
      x: bspCorr.x,
      y: bspCorr.y,
      w: bspCorr.w,
      h: bspCorr.h
    });
  }
  
  // Add minimal visual decorations (don't block movement)
  // Grass patches (reduced - just a few for subtle variety)
  for (let i = 0; i < 5 + floor * 2; i++) {
    const room = rooms[Math.floor(Math.random() * rooms.length)];
    grass.push({
      x: room.x + Math.random() * room.w,
      y: room.y + Math.random() * room.h,
      r: 15 + Math.random() * 25
    });
  }
  
  // Water features (visual only)
  if (biome === "grassland" || biome === "forest") {
    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
      const room = rooms[Math.floor(Math.random() * rooms.length)];
      water.push({
        x: room.x + Math.random() * (room.w - 60),
        y: room.y + Math.random() * (room.h - 60),
        w: 40 + Math.random() * 40,
        h: 40 + Math.random() * 40
      });
    }
  }
  
  // Store BSP grid for A* pathfinding (gridSize = 10 for pathfinding)
  // FORCE ARRAY STRUCTURE: Ensure bspResult.grid is strictly a 2D Array
  let pathfindingGrid = bspResult.grid;
  
  // If grid is an object with a 'grid' property (from convertBSPToGrid result), extract it
  if (pathfindingGrid && typeof pathfindingGrid === 'object' && !Array.isArray(pathfindingGrid) && pathfindingGrid.grid) {
    pathfindingGrid = pathfindingGrid.grid;
  }
  
  // Convert to strict 2D array if needed (deep copy to ensure it's a proper array)
  if (pathfindingGrid && typeof pathfindingGrid.length === 'number') {
    const gridH = pathfindingGrid.length;
    const strictGrid = [];
    for (let y = 0; y < gridH; y++) {
      if (pathfindingGrid[y] && typeof pathfindingGrid[y].length === 'number') {
        const gridW = pathfindingGrid[y].length;
        strictGrid[y] = [];
        for (let x = 0; x < gridW; x++) {
          strictGrid[y][x] = pathfindingGrid[y][x] || 0; // Ensure integer (0 or 1)
        }
      }
    }
    pathfindingGrid = strictGrid;
  }
  
  const pathfindingWallInfluence = bspResult.wallInfluence || null;
  const pathfindingGridSize = 10; // Grid size used for A* pathfinding
  
  // VALIDATION: Check that pathfindingGrid is a proper 2D array before returning
  if (!Array.isArray(pathfindingGrid) || !Array.isArray(pathfindingGrid[0])) {
    console.error('GRID DATA ERROR: bspResult.grid is not a 2D array', pathfindingGrid);
    // Fallback: create empty grid to prevent crash
    pathfindingGrid = [[1]]; // Single walkable cell as fallback
  }
  
  
  return { 
    rooms, 
    corridors, 
    obstacles, 
    grass, 
    water, 
    rocks,
    biome, 
    w: levelW, 
    h: levelH, 
    pathfindingGrid, // BSP grid for A* pathfinding (0=wall, 1=floor)
    pathfindingWallInfluence, // Wall influence map for path weighting
    pathfindingGridSize // Grid cell size (10px)
  };
}
