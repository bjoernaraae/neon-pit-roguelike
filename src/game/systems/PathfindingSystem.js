/**
 * Pathfinding system using flow field (Dijkstra map) algorithm
 */

/**
 * Generate Flow Field using BFS/Dijkstra - runs once per frame
 * Creates a distance map from target position to all walkable tiles
 * @param {number} targetX - Target X coordinate in world space
 * @param {number} targetY - Target Y coordinate in world space
 * @param {Array<Array<number>>} grid - 2D grid array (1 = walkable, 0 = wall)
 * @param {number} gridSize - Size of each grid cell in world units (default 10)
 * @returns {{distances: Array<Array<number>>, gridSize: number, gridW: number, gridH: number}|null} Flow field data or null if invalid
 */
export function generateFlowField(targetX, targetY, grid, gridSize = 10) {
  
  // CLEAN FLOW FIELD INPUT: Strict validation - must be a 2D array
  if (!Array.isArray(grid) || grid.length === 0) {
    const errorMsg = 'FLOW FIELD ERROR: grid must be a 2D array, got: ' + (grid?.constructor?.name || typeof grid);
    console.error(errorMsg, grid);
    throw new Error(errorMsg);
  }
  
  // Check if first row exists and is an array
  if (!Array.isArray(grid[0]) || grid[0].length === 0) {
    const errorMsg = 'FLOW FIELD ERROR: grid[0] must be an array, got: ' + (grid[0]?.constructor?.name || typeof grid[0]);
    console.error(errorMsg, grid[0]);
    throw new Error(errorMsg);
  }
  
  const gridH = grid.length;
  const gridW = grid[0].length;
  
  // Convert target to grid coordinates
  const targetGridX = Math.floor(targetX / gridSize);
  const targetGridY = Math.floor(targetY / gridSize);
  
  // Step 1: Build wall influence map (identify tiles adjacent to walls)
  // Tiles adjacent to walls get higher traversal cost to curve paths away from corners
  const wallInfluence = [];
  const WALL_PENALTY = 2.5; // Cost multiplier for near-wall tiles
  const BASE_COST = 1.0;    // Base cost for walkable tiles
  
  for (let y = 0; y < gridH; y++) {
    wallInfluence[y] = [];
    for (let x = 0; x < gridW; x++) {
      if (grid[y][x] === 0) {
        wallInfluence[y][x] = Infinity; // Wall itself
        continue;
      }
      
      // Check 8 neighbors for walls (cardinal + diagonal)
      let adjacentWalls = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH) {
            if (grid[ny][nx] === 0) {
              adjacentWalls++;
            }
          }
        }
      }
      
      // If adjacent to any wall, apply penalty
      wallInfluence[y][x] = adjacentWalls > 0 ? WALL_PENALTY : BASE_COST;
    }
  }
  
  // Initialize distance map with Infinity (walls have infinite cost)
  const distances = [];
  for (let y = 0; y < gridH; y++) {
    distances[y] = [];
    for (let x = 0; x < gridW; x++) {
      // Walls (value 0) have infinite distance, floors (value 1) start at Infinity
      distances[y][x] = grid[y][x] === 1 ? Infinity : Infinity; // Both start as Infinity
    }
  }
  
  // BFS starting from target position
  const queue = [];
  
  // Find nearest walkable cell to target if target is not walkable
  let startX = targetGridX;
  let startY = targetGridY;
  
  if (startY < 0 || startY >= gridH || startX < 0 || startX >= gridW || grid[startY][startX] !== 1) {
    // Target not walkable - find nearest walkable cell
    let found = false;
    for (let r = 1; r <= 5 && !found; r++) {
      for (let dy = -r; dy <= r && !found; dy++) {
        for (let dx = -r; dx <= r && !found; dx++) {
          const y = targetGridY + dy;
          const x = targetGridX + dx;
          if (y >= 0 && y < gridH && x >= 0 && x < gridW && grid[y][x] === 1) {
            startX = x;
            startY = y;
            found = true;
          }
        }
      }
    }
    if (!found) return null; // Can't find walkable cell
  }
  
  // Start BFS from target position (distance 0)
  distances[startY][startX] = 0;
  queue.push({ x: startX, y: startY });
  
  // 8-directional movement for better pathfinding
  const cardinalDirs = [
    [0, 1, 1.0], [1, 0, 1.0], [0, -1, 1.0], [-1, 0, 1.0] // Cardinal directions
  ];
  const diagonalDirs = [
    [1, 1, 1.414], [1, -1, 1.414], [-1, -1, 1.414], [-1, 1, 1.414] // Diagonal directions
  ];
  
  // BFS to fill distance map
  let processedCells = 0;
  while (queue.length > 0) {
    const current = queue.shift();
    const currentDist = distances[current.y][current.x];
    processedCells++;
    
    // Step 3: Process cardinal directions first
    for (const [dx, dy, baseCost] of cardinalDirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      
      // Bounds check
      if (ny < 0 || ny >= gridH || nx < 0 || nx >= gridW) continue;
      
      // Only process walkable tiles (value = 1)
      if (grid[ny][nx] !== 1) continue; // Walls have infinite cost (already set)
      
      // Step 1: Apply wall influence cost penalty
      const tileWeight = wallInfluence[ny][nx];
      const moveCost = baseCost * tileWeight;
      
      // Update distance if we found a shorter path
      const newDist = currentDist + moveCost;
      if (newDist < distances[ny][nx]) {
        distances[ny][nx] = newDist;
        queue.push({ x: nx, y: ny });
      }
    }
    
    // Step 3: Process diagonal directions with strict validation
    for (const [dx, dy, baseCost] of diagonalDirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      
      // Bounds check
      if (ny < 0 || ny >= gridH || nx < 0 || nx >= gridW) continue;
      
      // Only process walkable tiles (value = 1)
      if (grid[ny][nx] !== 1) continue; // Walls have infinite cost (already set)
      
      // Step 3: Strict diagonal validation - only allow if both adjacent cardinals are walkable
      // Check the two cardinal neighbors that form the diagonal
      const card1X = current.x + dx; // One cardinal component
      const card1Y = current.y;
      const card2X = current.x;
      const card2Y = current.y + dy; // Other cardinal component
      
      // Both cardinal tiles must be walkable
      const card1Walkable = card1X >= 0 && card1X < gridW && card1Y >= 0 && card1Y < gridH && grid[card1Y][card1X] === 1;
      const card2Walkable = card2X >= 0 && card2X < gridW && card2Y >= 0 && card2Y < gridH && grid[card2Y][card2X] === 1;
      
      if (!card1Walkable || !card2Walkable) {
        continue; // Skip this diagonal move - would clip through corner
      }
      
      // Step 1: Apply wall influence cost penalty
      const tileWeight = wallInfluence[ny][nx];
      const moveCost = baseCost * tileWeight;
      
      // Update distance if we found a shorter path
      const newDist = currentDist + moveCost;
      if (newDist < distances[ny][nx]) {
        distances[ny][nx] = newDist;
        queue.push({ x: nx, y: ny });
      }
    }
  }
  
  
  return {
    distances,
    gridSize,
    gridW,
    gridH
  };
}

/**
 * Get flow direction vector for a given world position
 * Uses bilinear interpolation with gradient vector calculation for smooth sub-tile steering
 * @param {number} x - World X coordinate
 * @param {number} y - World Y coordinate
 * @param {object} flowFieldData - Flow field data from generateFlowField
 * @returns {{x: number, y: number}} Normalized direction vector
 */
export function getFlowDirection(x, y, flowFieldData) {
  
  if (!flowFieldData || !flowFieldData.distances) {
    return { x: 0, y: 0 }; // No flow field
  }
  
  const { distances, gridSize } = flowFieldData;
  const gridH = distances.length;
  const gridW = distances[0].length;
  
  // Step 2: Bilinear interpolation - don't snap to grid, use exact world position
  // Convert to grid coordinates (not floored - we use fractional part for interpolation)
  const gridX = x / gridSize;
  const gridY = y / gridSize;
  
  // Get the center grid cell (the cell we're currently in)
  const centerGridX = Math.floor(gridX);
  const centerGridY = Math.floor(gridY);
  
  // Check if coordinates are completely out of bounds
  if (centerGridX < 0 || centerGridX >= gridW || centerGridY < 0 || centerGridY >= gridH) {
    return { x: 0, y: 0 }; // Out of bounds - return zero vector
  }
  
  // Clamp center to grid bounds (for edge cases where we're at the boundary)
  const clampedCenterX = Math.max(0, Math.min(centerGridX, gridW - 1));
  const clampedCenterY = Math.max(0, Math.min(centerGridY, gridH - 1));
  
  // Get center cell distance
  const centerDist = distances[clampedCenterY][clampedCenterX];
  
  // If center is a wall, fallback to discrete neighbor check
  if (centerDist === Infinity) {
    // Fallback: try to find a valid neighbor
    const cardinalDirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    let bestDir = { x: 0, y: 0 };
    let bestDist = Infinity;
    
    for (const [dx, dy] of cardinalDirs) {
      const nx = clampedCenterX + dx;
      const ny = clampedCenterY + dy;
      if (ny >= 0 && ny < gridH && nx >= 0 && nx < gridW) {
        const neighborDist = distances[ny][nx];
        if (neighborDist < bestDist && neighborDist !== Infinity) {
          bestDist = neighborDist;
          const len = Math.hypot(dx, dy) || 1;
          bestDir = { x: dx / len, y: dy / len };
        }
      }
    }
    
    return bestDir;
  }
  
  // Get the 4 cardinal neighbors for gradient calculation
  // Left: (centerX - 1, centerY), Right: (centerX + 1, centerY)
  // Top: (centerX, centerY - 1), Bottom: (centerX, centerY + 1)
  const leftX = Math.max(0, clampedCenterX - 1);
  const rightX = Math.min(gridW - 1, clampedCenterX + 1);
  const topY = Math.max(0, clampedCenterY - 1);
  const bottomY = Math.min(gridH - 1, clampedCenterY + 1);
  
  // Sample distances from the 4 cardinal neighbors
  // Left and Right use the same Y coordinate (centerY)
  // Top and Bottom use the same X coordinate (centerX)
  let distLeft = distances[clampedCenterY][leftX];
  let distRight = distances[clampedCenterY][rightX];
  let distTop = distances[topY][clampedCenterX];
  let distBottom = distances[bottomY][clampedCenterX];
  
  // Handle Infinity neighbors by using center distance (prevents gradient from breaking near walls)
  // This allows gradient to still work when some neighbors are walls
  if (distLeft === Infinity) distLeft = centerDist;
  if (distRight === Infinity) distRight = centerDist;
  if (distTop === Infinity) distTop = centerDist;
  if (distBottom === Infinity) distBottom = centerDist;
  
  // Step 2: Calculate gradient vector using finite differences
  // The gradient of a distance field points toward increasing distance
  // We want to go toward decreasing distance (target), so we use the negative gradient
  // Gradient formula: grad_x = (distRight - distLeft) / (2 * gridSize)
  // If target is to the right: distRight < distLeft, so grad_x < 0 (points left, toward higher distance)
  // Negative gradient: -grad_x > 0 (points right, toward lower distance/target) ✓
  const gradX = (distRight - distLeft) / (2 * gridSize);
  const gradY = (distBottom - distTop) / (2 * gridSize);
  
  // Negate to get direction toward target (decreasing distance)
  const vx = -gradX;
  const vy = -gradY;
  
  // Normalize the vector
  const mag = Math.hypot(vx, vy);
  if (mag < 0.001) {
    // Gradient is too small (at or near target), fallback to discrete neighbor check
    const cardinalDirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    let bestDir = { x: 0, y: 0 };
    let bestDist = centerDist;
    
    for (const [dx, dy] of cardinalDirs) {
      const nx = clampedCenterX + dx;
      const ny = clampedCenterY + dy;
      if (ny >= 0 && ny < gridH && nx >= 0 && nx < gridW) {
        const neighborDist = distances[ny][nx];
        if (neighborDist < bestDist && neighborDist !== Infinity) {
          bestDist = neighborDist;
          const len = Math.hypot(dx, dy) || 1;
          bestDir = { x: dx / len, y: dy / len };
        }
      }
    }
    
    return bestDir;
  }
  
  // Return normalized vector pointing toward target
  return { x: vx / mag, y: vy / mag };
}
