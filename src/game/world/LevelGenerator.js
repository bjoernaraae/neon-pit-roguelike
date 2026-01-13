/**
 * Level generator for procedural level creation
 */

import { generateBSPDungeon } from './BSPDungeonGenerator.js';
import { rand } from '../../utils/math.js';

/**
 * Ensure only the main connected cluster remains walkable
 * Removes isolated islands to prevent player spawning in dead-end areas
 * @param {Array<Array<number>>} grid - Pathfinding grid (0=wall, 1=floor)
 * @param {Array} rooms - Room objects for spawn point reference
 * @returns {Array<Array<number>>} Grid with only main cluster walkable
 */
function ensureMainClusterOnly(grid, rooms) {
  if (!Array.isArray(grid) || !Array.isArray(grid[0])) return grid;

  const gridH = grid.length;
  const gridW = grid[0].length;
  const result = grid.map(row => [...row]);

  // Find all walkable clusters
  const clusters = findAllClusters(result, gridW, gridH);

  if (clusters.length <= 1) {
    return result; // Already connected or no walkable areas
  }

  // Find the main cluster (largest, or contains first room)
  let mainClusterIndex = 0;
  let maxSize = 0;

  // First priority: cluster containing the first room (player spawn area)
  if (rooms.length > 0) {
    const firstRoom = rooms[0];
    const roomCenterX = Math.floor((firstRoom.x + firstRoom.w / 2) / 10); // Convert to grid coords
    const roomCenterY = Math.floor((firstRoom.y + firstRoom.h / 2) / 10);

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      for (const [x, y] of cluster) {
        if (x === roomCenterX && y === roomCenterY) {
          mainClusterIndex = i;
          break;
        }
      }
      if (mainClusterIndex === i) break; // Found it
    }
  }

  // Second priority: largest cluster
  if (mainClusterIndex === 0) {
    for (let i = 0; i < clusters.length; i++) {
      if (clusters[i].length > maxSize) {
        maxSize = clusters[i].length;
        mainClusterIndex = i;
      }
    }
  }

  // Turn all other clusters into walls
  for (let i = 0; i < clusters.length; i++) {
    if (i !== mainClusterIndex) {
      for (const [x, y] of clusters[i]) {
        result[y][x] = 0; // Turn into wall
      }
    }
  }

  return result;
}

/**
 * Find all connected clusters of walkable tiles
 * @param {Array<Array<number>>} grid - Grid to analyze
 * @param {number} gridW - Grid width
 * @param {number} gridH - Grid height
 * @returns {Array<Array<Array<number>>>} Array of clusters, each cluster is [[x,y], ...]
 */
function findAllClusters(grid, gridW, gridH) {
  const visited = [];
  for (let y = 0; y < gridH; y++) {
    visited[y] = [];
    for (let x = 0; x < gridW; x++) {
      visited[y][x] = false;
    }
  }

  const clusters = [];
  const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (grid[y][x] === 1 && !visited[y][x]) {
        // Found a new cluster
        const cluster = [];
        const queue = [[x, y]];
        visited[y][x] = true;

        while (queue.length > 0) {
          const [cx, cy] = queue.shift();
          cluster.push([cx, cy]);

          for (const [dx, dy] of directions) {
            const nx = cx + dx;
            const ny = cy + dy;

            if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH &&
                !visited[ny][nx] && grid[ny][nx] === 1) {
              visited[ny][nx] = true;
              queue.push([nx, ny]);
            }
          }
        }

        clusters.push(cluster);
      }
    }
  }

  return clusters;
}

/**
 * Ensure grid exactly matches room and corridor boundaries
 * Master reference for all walkability - eliminates mismatches
 * @param {Array<Array<number>>} grid - Current pathfinding grid
 * @param {Array} rooms - Room objects
 * @param {Array} corridors - Corridor objects
 * @param {number} gridSize - Grid cell size
 * @returns {Array<Array<number>>} Corrected grid matching room/corridor boundaries
 */
function enforceGridRoomCorridorAlignment(grid, rooms, corridors, gridSize) {
  if (!Array.isArray(grid) || !Array.isArray(grid[0])) return grid;

  const gridH = grid.length;
  const gridW = grid[0].length;
  const result = [];

  // Initialize grid with all walls (0)
  for (let y = 0; y < gridH; y++) {
    result[y] = [];
    for (let x = 0; x < gridW; x++) {
      result[y][x] = 0; // Start with all walls
    }
  }

  // Mark all room areas as walkable (1)
  for (const room of rooms) {
    const startX = Math.floor(room.x / gridSize);
    const startY = Math.floor(room.y / gridSize);
    const endX = Math.ceil((room.x + room.w) / gridSize);
    const endY = Math.ceil((room.y + room.h) / gridSize);

    for (let y = startY; y < endY && y < gridH; y++) {
      for (let x = startX; x < endX && x < gridW; x++) {
        result[y][x] = 1; // Room area is walkable
      }
    }
  }

  // Mark all corridor areas as walkable (1)
  for (const corridor of corridors) {
    const startX = Math.floor(corridor.x / gridSize);
    const startY = Math.floor(corridor.y / gridSize);
    const endX = Math.ceil((corridor.x + corridor.w) / gridSize);
    const endY = Math.ceil((corridor.y + corridor.h) / gridSize);

    for (let y = startY; y < endY && y < gridH; y++) {
      for (let x = startX; x < endX && x < gridW; x++) {
        result[y][x] = 1; // Corridor area is walkable
      }
    }
  }

  return result;
}

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
  // CRITICAL: Visual and grid coordinates MUST be perfectly aligned
  // Use Math.floor to ensure exact grid alignment (no sub-pixel offsets)
  for (let i = 0; i < bspResult.rooms.length; i++) {
    const bspRoom = bspResult.rooms[i];
    const room = {
      x: Math.floor(bspRoom.x), // Exact grid alignment
      y: Math.floor(bspRoom.y), // Exact grid alignment
      w: Math.floor(bspRoom.w), // Exact grid alignment
      h: Math.floor(bspRoom.h), // Exact grid alignment
      id: i,
      enemies: [],
      cleared: false
    };
    rooms.push(room);
  }

  // Convert BSP corridors to our format
  // Ensure corridors align perfectly with grid
  for (const bspCorr of bspResult.corridors) {
    corridors.push({
      x: Math.floor(bspCorr.x), // Exact grid alignment
      y: Math.floor(bspCorr.y), // Exact grid alignment
      w: Math.floor(bspCorr.w), // Exact grid alignment
      h: Math.floor(bspCorr.h)  // Exact grid alignment
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

  // UNIFIED GRID TRUTH: Ensure grid exactly matches room/corridor boundaries
  // Master reference for all walkability - visual, collision, and AI must align
  pathfindingGrid = enforceGridRoomCorridorAlignment(pathfindingGrid, rooms, corridors, pathfindingGridSize);

  // POST-GENERATION CONNECTIVITY CHECK: Remove isolated islands
  // Ensure player never spawns in a disconnected area
  pathfindingGrid = ensureMainClusterOnly(pathfindingGrid, rooms);

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
