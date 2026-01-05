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
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/f7ace1fb-1ecf-4f19-b232-cce80869f22f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generateFlowField:entry',message:'Flow field generation started',data:{targetX,targetY,gridSize,hasGrid:!!grid,gridType:grid?.constructor?.name,isArray:Array.isArray(grid),hasLength:typeof grid?.length==='number',gridH:grid?.length,gridW:grid?.[0]?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  // CLEAN FLOW FIELD INPUT: Strict validation - must be a 2D array
  if (!Array.isArray(grid) || grid.length === 0) {
    const errorMsg = 'FLOW FIELD ERROR: grid must be a 2D array, got: ' + (grid?.constructor?.name || typeof grid);
    console.error(errorMsg, grid);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f7ace1fb-1ecf-4f19-b232-cce80869f22f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generateFlowField:error',message:'Grid is not an array',data:{hasGrid:!!grid,gridType:grid?.constructor?.name,isArray:Array.isArray(grid),error:errorMsg},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    throw new Error(errorMsg);
  }
  
  // Check if first row exists and is an array
  if (!Array.isArray(grid[0]) || grid[0].length === 0) {
    const errorMsg = 'FLOW FIELD ERROR: grid[0] must be an array, got: ' + (grid[0]?.constructor?.name || typeof grid[0]);
    console.error(errorMsg, grid[0]);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f7ace1fb-1ecf-4f19-b232-cce80869f22f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generateFlowField:error2',message:'Grid[0] is not an array',data:{hasGrid0:!!grid[0],grid0Type:grid[0]?.constructor?.name,isArray:Array.isArray(grid[0]),error:errorMsg},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    throw new Error(errorMsg);
  }
  
  const gridH = grid.length;
  const gridW = grid[0].length;
  
  // Convert target to grid coordinates
  const targetGridX = Math.floor(targetX / gridSize);
  const targetGridY = Math.floor(targetY / gridSize);
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/f7ace1fb-1ecf-4f19-b232-cce80869f22f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generateFlowField:coords',message:'Grid coordinates calculated',data:{targetGridX,targetGridY,gridW,gridH,isInBounds:targetGridY>=0&&targetGridY<gridH&&targetGridX>=0&&targetGridX<gridW,gridValue:targetGridY>=0&&targetGridY<gridH&&targetGridX>=0&&targetGridX<gridW?grid[targetGridY][targetGridX]:'out_of_bounds'},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
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
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/f7ace1fb-1ecf-4f19-b232-cce80869f22f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generateFlowField:bfs_start',message:'BFS started',data:{startX,startY,queueLength:queue.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  
  // 8-directional movement for better pathfinding
  const dirs = [
    [0, 1, 1.0], [1, 0, 1.0], [0, -1, 1.0], [-1, 0, 1.0], // Cardinal (cost 1.0)
    [1, 1, 1.414], [1, -1, 1.414], [-1, -1, 1.414], [-1, 1, 1.414] // Diagonal (cost sqrt(2))
  ];
  
  // BFS to fill distance map
  let processedCells = 0;
  while (queue.length > 0) {
    const current = queue.shift();
    const currentDist = distances[current.y][current.x];
    processedCells++;
    
    for (const [dx, dy, cost] of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      
      // Bounds check
      if (ny < 0 || ny >= gridH || nx < 0 || nx >= gridW) continue;
      
      // Only process walkable tiles (value = 1)
      if (grid[ny][nx] !== 1) continue; // Walls have infinite cost (already set)
      
      // Update distance if we found a shorter path
      const newDist = currentDist + cost;
      if (newDist < distances[ny][nx]) {
        distances[ny][nx] = newDist;
        queue.push({ x: nx, y: ny });
      }
    }
  }
  
  // #region agent log
  const sampleDistances = [];
  for(let y=0;y<Math.min(5,gridH);y++) {
    for(let x=0;x<Math.min(5,gridW);x++) {
      sampleDistances.push({x,y,dist:distances[y][x],grid:grid[y][x]});
    }
  }
  fetch('http://127.0.0.1:7242/ingest/f7ace1fb-1ecf-4f19-b232-cce80869f22f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generateFlowField:bfs_end',message:'BFS completed',data:{processedCells,queueLength:queue.length,sampleDistances},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  
  return {
    distances,
    gridSize,
    gridW,
    gridH
  };
}

/**
 * Get flow direction vector for a given world position
 * Returns normalized vector pointing toward neighbor with lowest distance
 * @param {number} x - World X coordinate
 * @param {number} y - World Y coordinate
 * @param {object} flowFieldData - Flow field data from generateFlowField
 * @returns {{x: number, y: number}} Normalized direction vector
 */
export function getFlowDirection(x, y, flowFieldData) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/f7ace1fb-1ecf-4f19-b232-cce80869f22f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'getFlowDirection:entry',message:'Flow direction calculation',data:{x,y,hasFlowField:!!flowFieldData,hasDistances:!!flowFieldData?.distances},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  
  if (!flowFieldData || !flowFieldData.distances) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f7ace1fb-1ecf-4f19-b232-cce80869f22f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'getFlowDirection:null',message:'No flow field data',data:{hasFlowField:!!flowFieldData,hasDistances:!!flowFieldData?.distances},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return { x: 0, y: 0 }; // No flow field
  }
  
  const { distances, gridSize } = flowFieldData;
  const gridH = distances.length;
  const gridW = distances[0].length;
  
  // Convert world coordinates to grid coordinates
  const gridX = Math.floor(x / gridSize);
  const gridY = Math.floor(y / gridSize);
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/f7ace1fb-1ecf-4f19-b232-cce80869f22f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'getFlowDirection:coords',message:'Grid coordinates',data:{gridX,gridY,gridW,gridH,isInBounds:gridY>=0&&gridY<gridH&&gridX>=0&&gridX<gridW},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  
  // Bounds check
  if (gridY < 0 || gridY >= gridH || gridX < 0 || gridX >= gridW) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f7ace1fb-1ecf-4f19-b232-cce80869f22f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'getFlowDirection:out_of_bounds',message:'Out of bounds',data:{gridX,gridY,gridW,gridH},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    return { x: 0, y: 0 }; // Out of bounds
  }
  
  const currentDist = distances[gridY][gridX];
  
  // If current cell has infinite distance (wall), return zero vector
  if (currentDist === Infinity) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f7ace1fb-1ecf-4f19-b232-cce80869f22f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'getFlowDirection:infinity',message:'Current cell is wall',data:{gridX,gridY,currentDist},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    return { x: 0, y: 0 };
  }
  
  // Check all 8 neighbors to find the one with lowest distance
  const dirs = [
    [0, 1], [1, 0], [0, -1], [-1, 0], // Cardinal
    [1, 1], [1, -1], [-1, -1], [-1, 1] // Diagonal
  ];
  
  let bestDir = { x: 0, y: 0 };
  let bestDist = currentDist;
  const neighborDists = [];
  
  for (const [dx, dy] of dirs) {
    const nx = gridX + dx;
    const ny = gridY + dy;
    
    if (ny < 0 || ny >= gridH || nx < 0 || nx >= gridW) continue;
    
    const neighborDist = distances[ny][nx];
    neighborDists.push({dx,dy,dist:neighborDist});
    
    // Find neighbor with lowest distance (closer to target)
    if (neighborDist < bestDist) {
      bestDist = neighborDist;
      // Normalize direction vector
      const len = Math.hypot(dx, dy) || 1;
      bestDir = { x: dx / len, y: dy / len };
    }
  }
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/f7ace1fb-1ecf-4f19-b232-cce80869f22f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'getFlowDirection:result',message:'Flow direction result',data:{gridX,gridY,currentDist,bestDist,bestDir,neighborDists},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  
  // If no better neighbor found, return zero vector (already at target or stuck)
  return bestDir;
}
