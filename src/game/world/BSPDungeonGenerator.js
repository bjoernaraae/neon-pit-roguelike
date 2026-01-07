/**
 * BSP (Binary Space Partitioning) Dungeon Generator
 */

/**
 * BSP Node class for dungeon generation
 */
export class BSPNode {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.left = null;
    this.right = null;
    this.room = null;
    this.corridor = null;
  }
  
  isLeaf() {
    return this.left === null && this.right === null;
  }
}

/**
 * Get room from node (recursively finds room in leaf)
 * @param {BSPNode} node - BSP node
 * @returns {object|null} Room object or null
 */
export function getRoomFromNode(node) {
  if (!node) return null;
  if (node.isLeaf()) {
    return node.room;
  }
  // Get room from any descendant
  return getRoomFromNode(node.left) || getRoomFromNode(node.right);
}

/**
 * Recursively split BSP node
 * @param {BSPNode} node - Node to split
 * @param {number} minRoomSize - Minimum room size
 * @param {number} minSplitSize - Minimum size to continue splitting
 * @param {number} depth - Current depth
 * @param {number} maxDepth - Maximum recursion depth
 */
export function splitBSPNode(node, minRoomSize, minSplitSize, depth = 0, maxDepth = 4) {
  // Limit recursion depth to maxDepth (default 4, resulting in 8-16 rooms)
  if (depth >= maxDepth) {
    return;
  }
  
  // Don't split if too small
  if (node.width < minSplitSize * 2 || node.height < minSplitSize * 2) {
    return;
  }
  
  // Decide split direction (prefer splitting longer dimension)
  const splitHorizontally = node.width > node.height;
  
  if (splitHorizontally) {
    // Split vertically (divide width)
    const minSplit = minRoomSize;
    const maxSplit = node.width - minRoomSize;
    if (maxSplit <= minSplit) return; // Can't split
    
    const splitX = minSplit + Math.random() * (maxSplit - minSplit);
    node.left = new BSPNode(node.x, node.y, splitX, node.height);
    node.right = new BSPNode(node.x + splitX, node.y, node.width - splitX, node.height);
  } else {
    // Split horizontally (divide height)
    const minSplit = minRoomSize;
    const maxSplit = node.height - minRoomSize;
    if (maxSplit <= minSplit) return; // Can't split
    
    const splitY = minSplit + Math.random() * (maxSplit - minSplit);
    node.left = new BSPNode(node.x, node.y, node.width, splitY);
    node.right = new BSPNode(node.x, node.y + splitY, node.width, node.height - splitY);
  }
  
  // Recursively split children with increased depth
  splitBSPNode(node.left, minRoomSize, minSplitSize, depth + 1, maxDepth);
  splitBSPNode(node.right, minRoomSize, minSplitSize, depth + 1, maxDepth);
}

/**
 * Create rooms in leaf nodes
 * @param {BSPNode} node - BSP node
 * @param {number} minRoomSize - Minimum room size
 * @param {number} padding - Padding around rooms
 */
export function createRoomsInBSP(node, minRoomSize, padding) {
  if (node.isLeaf()) {
    // Mandatory padding = 2 tiles (20px with gridSize=10) on all sides
    // This ensures rooms never touch and always have at least 4 tiles of wall space between them
    const mandatoryPadding = padding; // padding should be 20px (2 tiles * 10px)
    const availableW = node.width - mandatoryPadding * 2;
    const availableH = node.height - mandatoryPadding * 2;
    
    if (availableW < minRoomSize || availableH < minRoomSize) {
      // Node too small - don't create a room (will be skipped)
      // This prevents 1x1 or very small rooms that enemies can't enter
      node.room = null;
      return;
    }
    
    // Create room in leaf node with mandatory padding enforced
    // Make rooms larger - use 70-90% of available space for better horde gameplay
    const roomW = Math.max(minRoomSize, availableW * (0.7 + Math.random() * 0.2));
    const roomH = Math.max(minRoomSize, availableH * (0.7 + Math.random() * 0.2));
    const roomX = node.x + mandatoryPadding + Math.random() * Math.max(0, availableW - roomW);
    const roomY = node.y + mandatoryPadding + Math.random() * Math.max(0, availableH - roomH);
    
    node.room = {
      x: Math.max(node.x + mandatoryPadding, Math.min(roomX, node.x + node.width - roomW - mandatoryPadding)),
      y: Math.max(node.y + mandatoryPadding, Math.min(roomY, node.y + node.height - roomH - mandatoryPadding)),
      w: Math.min(roomW, availableW),
      h: Math.min(roomH, availableH)
    };
  } else {
    createRoomsInBSP(node.left, minRoomSize, padding);
    createRoomsInBSP(node.right, minRoomSize, padding);
  }
}

/**
 * Create L-shaped corridors connecting sibling rooms
 * Recursively connects siblings from leaves all the way up to root to ensure no isolated rooms
 * @param {BSPNode} node - BSP node
 */
export function createCorridorsInBSP(node) {
  if (node.isLeaf()) {
    return; // Leaf nodes have no siblings to connect
  }
  
  // Recursively create corridors in children FIRST (bottom-up approach)
  // This ensures all child connections are made before parent connections
  createCorridorsInBSP(node.left);
  createCorridorsInBSP(node.right);
  
  // Get rooms from left and right subtrees
  const leftRoom = getRoomFromNode(node.left);
  const rightRoom = getRoomFromNode(node.right);
  
  if (!leftRoom || !rightRoom) return;
  
  // Create L-shaped corridor connecting the two rooms
  const leftCenterX = leftRoom.x + leftRoom.w / 2;
  const leftCenterY = leftRoom.y + leftRoom.h / 2;
  const rightCenterX = rightRoom.x + rightRoom.w / 2;
  const rightCenterY = rightRoom.y + rightRoom.h / 2;
  
  // 5-tile wide corridors (5 * 10px gridSize = 50px) for better player movement
  const corridorW = 50; // Fixed 5-tile wide corridors for horde gameplay
  
  // Ensure corridors extend INTO rooms for guaranteed connectivity
  // Use room centers but extend corridors well into both rooms to avoid invisible walls
  const extendIntoRoom = 40; // Extend 40px into each room to guarantee connection
  
  // Create L-shaped corridor: horizontal then vertical, or vertical then horizontal
  let corridor1, corridor2;
  
  if (Math.random() < 0.5) {
    // Horizontal first, then vertical
    const midX = (leftCenterX + rightCenterX) / 2;
    // Horizontal segment: from left room center to midX, extending into both rooms
    corridor1 = {
      x: Math.min(leftCenterX - extendIntoRoom, midX - corridorW / 2),
      y: leftCenterY - corridorW / 2,
      w: Math.abs(midX - (leftCenterX - extendIntoRoom)) + corridorW + extendIntoRoom,
      h: corridorW
    };
    // Vertical segment: from midX to right room center, extending into both rooms
    corridor2 = {
      x: midX - corridorW / 2,
      y: Math.min(leftCenterY, rightCenterY) - corridorW / 2,
      w: corridorW,
      h: Math.abs(rightCenterY - leftCenterY) + corridorW + extendIntoRoom * 2
    };
  } else {
    // Vertical first, then horizontal
    const midY = (leftCenterY + rightCenterY) / 2;
    // Vertical segment: from left room center to midY, extending into both rooms
    corridor1 = {
      x: leftCenterX - corridorW / 2,
      y: Math.min(leftCenterY - extendIntoRoom, midY - corridorW / 2),
      w: corridorW,
      h: Math.abs(midY - (leftCenterY - extendIntoRoom)) + corridorW + extendIntoRoom
    };
    // Horizontal segment: from midY to right room center, extending into both rooms
    corridor2 = {
      x: Math.min(leftCenterX, rightCenterX) - corridorW / 2,
      y: midY - corridorW / 2,
      w: Math.abs(rightCenterX - leftCenterX) + corridorW + extendIntoRoom * 2,
      h: corridorW
    };
  }
  
  // Ensure corridors extend WELL into both rooms to prevent invisible walls
  // Use generous overlap to guarantee connectivity
  const roomOverlap = 60; // Overlap 60px into each room (more than corridor width)
  
  // Minimum corridor dimensions to prevent 1x1 corridors that enemies can't enter
  const minCorridorLength = corridorW; // At least as long as it is wide (50px minimum)
  
  // Horizontal corridors should reach deep into both rooms
  if (corridor1.h === corridorW) {
    // Horizontal corridor - extend deep into both rooms
    corridor1.x = Math.min(corridor1.x, leftRoom.x - roomOverlap);
    const rightEdge = Math.max(corridor1.x + corridor1.w, rightRoom.x + rightRoom.w + roomOverlap);
    corridor1.w = rightEdge - corridor1.x;
    // Ensure minimum length
    if (corridor1.w < minCorridorLength) {
      const centerX = corridor1.x + corridor1.w / 2;
      corridor1.x = centerX - minCorridorLength / 2;
      corridor1.w = minCorridorLength;
    }
  }
  if (corridor2.h === corridorW) {
    // Horizontal corridor - extend deep into both rooms
    corridor2.x = Math.min(corridor2.x, leftRoom.x - roomOverlap);
    const rightEdge = Math.max(corridor2.x + corridor2.w, rightRoom.x + rightRoom.w + roomOverlap);
    corridor2.w = rightEdge - corridor2.x;
    // Ensure minimum length
    if (corridor2.w < minCorridorLength) {
      const centerX = corridor2.x + corridor2.w / 2;
      corridor2.x = centerX - minCorridorLength / 2;
      corridor2.w = minCorridorLength;
    }
  }
  
  // Vertical corridors should reach deep into both rooms
  if (corridor1.w === corridorW) {
    // Vertical corridor - extend deep into both rooms
    corridor1.y = Math.min(corridor1.y, leftRoom.y - roomOverlap);
    const bottomEdge = Math.max(corridor1.y + corridor1.h, rightRoom.y + rightRoom.h + roomOverlap);
    corridor1.h = bottomEdge - corridor1.y;
    // Ensure minimum length
    if (corridor1.h < minCorridorLength) {
      const centerY = corridor1.y + corridor1.h / 2;
      corridor1.y = centerY - minCorridorLength / 2;
      corridor1.h = minCorridorLength;
    }
  }
  if (corridor2.w === corridorW) {
    // Vertical corridor - extend deep into both rooms
    corridor2.y = Math.min(corridor2.y, leftRoom.y - roomOverlap);
    const bottomEdge = Math.max(corridor2.y + corridor2.h, rightRoom.y + rightRoom.h + roomOverlap);
    corridor2.h = bottomEdge - corridor2.y;
    // Ensure minimum length
    if (corridor2.h < minCorridorLength) {
      const centerY = corridor2.y + corridor2.h / 2;
      corridor2.y = centerY - minCorridorLength / 2;
      corridor2.h = minCorridorLength;
    }
  }
  
  node.corridor = [corridor1, corridor2];
}

/**
 * Collect all rooms and corridors from BSP tree
 * @param {BSPNode} node - BSP node
 * @param {Array} rooms - Array to collect rooms
 * @param {Array} corridors - Array to collect corridors
 */
export function collectBSPRoomsAndCorridors(node, rooms, corridors) {
  if (node.isLeaf()) {
    if (node.room) {
      rooms.push(node.room);
    }
  } else {
    collectBSPRoomsAndCorridors(node.left, rooms, corridors);
    collectBSPRoomsAndCorridors(node.right, rooms, corridors);
    
    if (node.corridor) {
      corridors.push(...node.corridor);
    }
  }
}

/**
 * Validate that all rooms are connected via corridors
 * Uses flood fill to check connectivity
 * @param {Array} rooms - Array of room objects
 * @param {Array} corridors - Array of corridor objects
 * @param {number} width - Level width
 * @param {number} height - Level height
 * @param {number} gridSize - Grid cell size (default 10)
 * @returns {boolean} True if all rooms are connected
 */
export function validateRoomConnectivity(rooms, corridors, width, height, gridSize = 10) {
  if (rooms.length === 0) return true;
  if (rooms.length === 1) return true;
  
  // Create a connectivity grid
  const gridW = Math.ceil(width / gridSize);
  const gridH = Math.ceil(height / gridSize);
  const grid = [];
  
  // Initialize grid with 0 (wall)
  for (let y = 0; y < gridH; y++) {
    grid[y] = [];
    for (let x = 0; x < gridW; x++) {
      grid[y][x] = 0;
    }
  }
  
  // Mark rooms and corridors as floor (1)
  for (const room of rooms) {
    const startX = Math.floor(room.x / gridSize);
    const startY = Math.floor(room.y / gridSize);
    const endX = Math.ceil((room.x + room.w) / gridSize);
    const endY = Math.ceil((room.y + room.h) / gridSize);
    
    for (let y = startY; y < endY && y < gridH; y++) {
      for (let x = startX; x < endX && x < gridW; x++) {
        if (x >= 0 && y >= 0) {
          grid[y][x] = 1;
        }
      }
    }
  }
  
  for (const corridor of corridors) {
    const startX = Math.floor(corridor.x / gridSize);
    const startY = Math.floor(corridor.y / gridSize);
    const endX = Math.ceil((corridor.x + corridor.w) / gridSize);
    const endY = Math.ceil((corridor.y + corridor.h) / gridSize);
    
    for (let y = startY; y < endY && y < gridH; y++) {
      for (let x = startX; x < endX && x < gridW; x++) {
        if (x >= 0 && y >= 0) {
          grid[y][x] = 1;
        }
      }
    }
  }
  
  // Find first room center to start flood fill
  const firstRoom = rooms[0];
  const startX = Math.floor((firstRoom.x + firstRoom.w / 2) / gridSize);
  const startY = Math.floor((firstRoom.y + firstRoom.h / 2) / gridSize);
  
  if (startX < 0 || startX >= gridW || startY < 0 || startY >= gridH) return false;
  if (grid[startY][startX] === 0) return false; // Starting point is wall
  
  // Flood fill to mark all reachable floor tiles
  const visited = [];
  for (let y = 0; y < gridH; y++) {
    visited[y] = [];
    for (let x = 0; x < gridW; x++) {
      visited[y][x] = false;
    }
  }
  
  const queue = [[startX, startY]];
  visited[startY][startX] = true;
  let reachableCount = 0;
  
  const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    if (grid[y][x] === 1) {
      reachableCount++;
    }
    
    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      
      if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH && !visited[ny][nx] && grid[ny][nx] === 1) {
        visited[ny][nx] = true;
        queue.push([nx, ny]);
      }
    }
  }
  
  // Count total floor tiles (rooms + corridors)
  let totalFloorTiles = 0;
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (grid[y][x] === 1) {
        totalFloorTiles++;
      }
    }
  }
  
  // All floor tiles should be reachable
  return reachableCount === totalFloorTiles;
}

/**
 * Generate wall influence map - assigns higher cost to tiles adjacent to walls
 * This encourages paths through the center of corridors
 * @param {Array<Array<number>>} grid - 2D grid array
 * @returns {Array<Array<number>>|null} Influence map or null if invalid
 */
export function generateWallInfluenceMap(grid) {
  if (!grid || !Array.isArray(grid) || grid.length === 0) return null;
  if (!grid[0] || !Array.isArray(grid[0]) || grid[0].length === 0) return null;
  
  const gridH = grid.length;
  const gridW = grid[0].length;
  const influenceMap = [];
  
  // Initialize influence map
  for (let y = 0; y < gridH; y++) {
    influenceMap[y] = [];
    for (let x = 0; x < gridW; x++) {
      influenceMap[y][x] = 0; // Base cost
    }
  }
  
  // Check each floor tile for adjacent walls
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (grid[y][x] === 1) { // Only check floor tiles
        let wallCount = 0;
        
        // Check all 8 neighbors for walls
        const checkDirs = [
          [-1, -1], [0, -1], [1, -1],
          [-1,  0],          [1,  0],
          [-1,  1], [0,  1], [1,  1]
        ];
        
        for (const [dx, dy] of checkDirs) {
          const nx = x + dx;
          const ny = y + dy;
          
          // Check bounds
          if (ny < 0 || ny >= gridH || nx < 0 || nx >= gridW) {
            wallCount++; // Out of bounds counts as wall
          } else if (grid[ny][nx] === 0) {
            wallCount++; // Adjacent wall
          }
        }
        
        // Assign influence cost based on number of adjacent walls
        // More walls = higher cost (encourages center paths)
        // Cost ranges from 0 (no walls) to 0.5 (surrounded by walls)
        influenceMap[y][x] = (wallCount / 8) * 0.5;
      }
    }
  }
  
  return influenceMap;
}

/**
 * Convert BSP rooms and corridors to 2D grid
 * @param {Array} rooms - Array of room objects
 * @param {Array} corridors - Array of corridor objects
 * @param {number} width - Level width
 * @param {number} height - Level height
 * @param {number} gridSize - Grid cell size (default 10)
 * @returns {{grid: Array<Array<number>>, wallInfluence: Array<Array<number>>|null}} Grid and influence map
 */
export function convertBSPToGrid(rooms, corridors, width, height, gridSize = 10) {
  const gridW = Math.ceil(width / gridSize);
  const gridH = Math.ceil(height / gridSize);
  const grid = [];
  const corridorGrid = []; // Track which cells are part of corridors
  
  // Initialize grid with 0 (void/wall)
  for (let y = 0; y < gridH; y++) {
    grid[y] = [];
    corridorGrid[y] = [];
    for (let x = 0; x < gridW; x++) {
      grid[y][x] = 0; // 0 = void/wall
      corridorGrid[y][x] = false; // Track if cell is part of a corridor
    }
  }
  
  // Mark rooms as floor (1)
  // Use exact room coordinates to match visual rendering
  for (const room of rooms) {
    const startX = Math.floor(room.x / gridSize);
    const startY = Math.floor(room.y / gridSize);
    const endX = Math.ceil((room.x + room.w) / gridSize);
    const endY = Math.ceil((room.y + room.h) / gridSize);
    
    // Mark all cells within room bounds (exact match to visual)
    for (let y = startY; y < endY && y < gridH; y++) {
      for (let x = startX; x < endX && x < gridW; x++) {
        if (x >= 0 && y >= 0) {
          grid[y][x] = 1; // 1 = floor
        }
      }
    }
  }
  
  // Mark corridors as floor (1) - corridors are 50px wide (5 tiles * 10px)
  // Use exact corridor coordinates to match visual rendering
  for (const corridor of corridors) {
    const startX = Math.floor(corridor.x / gridSize);
    const startY = Math.floor(corridor.y / gridSize);
    const endX = Math.ceil((corridor.x + corridor.w) / gridSize);
    const endY = Math.ceil((corridor.y + corridor.h) / gridSize);
    
    // Mark corridor area using exact coordinates (matches visual)
    for (let y = startY; y < endY && y < gridH; y++) {
      for (let x = startX; x < endX && x < gridW; x++) {
        if (x >= 0 && y >= 0) {
          grid[y][x] = 1; // 1 = floor
          corridorGrid[y][x] = true; // Mark as corridor cell
        }
      }
    }
  }
  
  // Post-process: Ensure minimum wall thickness to prevent thin/invisible walls
  // Expand walls to ensure they're at least 2 tiles (20px) thick
  const minWallThickness = 2; // Minimum 2 tiles thick walls
  const expandedGrid = [];
  
  // Initialize expanded grid as copy of original
  for (let y = 0; y < gridH; y++) {
    expandedGrid[y] = [];
    for (let x = 0; x < gridW; x++) {
      expandedGrid[y][x] = grid[y][x];
    }
  }
  
  // For each wall cell, check if it's part of a thin wall and expand it
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (grid[y][x] === 0) { // Wall cell
        // Check if this wall is adjacent to floor on both sides (thin wall)
        const hasFloorLeft = x > 0 && grid[y][x - 1] === 1;
        const hasFloorRight = x < gridW - 1 && grid[y][x + 1] === 1;
        const hasFloorTop = y > 0 && grid[y - 1][x] === 1;
        const hasFloorBottom = y < gridH - 1 && grid[y + 1][x] === 1;
        
        // If wall is between floors horizontally (thin vertical wall)
        if (hasFloorLeft && hasFloorRight) {
          // Expand wall horizontally to ensure minimum thickness
          for (let expandX = Math.max(0, x - minWallThickness + 1); expandX <= Math.min(gridW - 1, x + minWallThickness - 1); expandX++) {
            if (grid[y][expandX] === 0) { // Only expand if it's already a wall
              expandedGrid[y][expandX] = 0; // Keep as wall
            }
          }
        }
        
        // If wall is between floors vertically (thin horizontal wall)
        if (hasFloorTop && hasFloorBottom) {
          // Expand wall vertically to ensure minimum thickness
          for (let expandY = Math.max(0, y - minWallThickness + 1); expandY <= Math.min(gridH - 1, y + minWallThickness - 1); expandY++) {
            if (grid[expandY][x] === 0) { // Only expand if it's already a wall
              expandedGrid[expandY][x] = 0; // Keep as wall
            }
          }
        }
      }
    }
  }
  
  // Find thin passages (floor cells between walls) and expand walls to meet minimum thickness
  // BUT: Preserve corridors - don't convert corridor cells to walls (they're meant to connect rooms)
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (grid[y][x] === 1) { // Floor cell
        // Check for thin horizontal passages (wall on both left and right)
        const hasWallLeft = x > 0 && grid[y][x - 1] === 0;
        const hasWallRight = x < gridW - 1 && grid[y][x + 1] === 0;
        
        if (hasWallLeft && hasWallRight) {
          // Find the full extent of this horizontal passage
          let passageStart = x;
          let passageEnd = x;
          while (passageStart > 0 && grid[y][passageStart - 1] === 1) passageStart--;
          while (passageEnd < gridW - 1 && grid[y][passageEnd + 1] === 1) passageEnd++;
          const passageWidth = passageEnd - passageStart + 1;
          
          // Check if this passage is part of a corridor - if so, preserve it
          let isCorridor = false;
          for (let checkX = passageStart; checkX <= passageEnd; checkX++) {
            if (corridorGrid[y][checkX]) {
              isCorridor = true;
              break;
            }
          }
          
          // Only convert to walls if it's NOT a corridor and thinner than minimum
          if (!isCorridor && passageWidth < minWallThickness * 2) {
            // Convert outer cells of passage to walls to ensure minimum wall thickness
            const cellsToConvert = Math.floor((minWallThickness * 2 - passageWidth) / 2);
            for (let i = 0; i < cellsToConvert && passageStart + i <= passageEnd - i; i++) {
              if (passageStart + i < gridW) expandedGrid[y][passageStart + i] = 0; // Convert to wall
              if (passageEnd - i >= 0) expandedGrid[y][passageEnd - i] = 0; // Convert to wall
            }
          }
        }
        
        // Check for thin vertical passages (wall on both top and bottom)
        const hasWallTop = y > 0 && grid[y - 1][x] === 0;
        const hasWallBottom = y < gridH - 1 && grid[y + 1][x] === 0;
        
        if (hasWallTop && hasWallBottom) {
          // Find the full extent of this vertical passage
          let passageStart = y;
          let passageEnd = y;
          while (passageStart > 0 && grid[passageStart - 1][x] === 1) passageStart--;
          while (passageEnd < gridH - 1 && grid[passageEnd + 1][x] === 1) passageEnd++;
          const passageHeight = passageEnd - passageStart + 1;
          
          // Check if this passage is part of a corridor - if so, preserve it
          let isCorridor = false;
          for (let checkY = passageStart; checkY <= passageEnd; checkY++) {
            if (corridorGrid[checkY][x]) {
              isCorridor = true;
              break;
            }
          }
          
          // Only convert to walls if it's NOT a corridor and thinner than minimum
          if (!isCorridor && passageHeight < minWallThickness * 2) {
            // Convert outer cells of passage to walls to ensure minimum wall thickness
            const cellsToConvert = Math.floor((minWallThickness * 2 - passageHeight) / 2);
            for (let i = 0; i < cellsToConvert && passageStart + i <= passageEnd - i; i++) {
              if (passageStart + i < gridH) expandedGrid[passageStart + i][x] = 0; // Convert to wall
              if (passageEnd - i >= 0) expandedGrid[passageEnd - i][x] = 0; // Convert to wall
            }
          }
        }
      }
    }
  }
  
  // Generate wall influence map using expanded grid
  const wallInfluence = generateWallInfluenceMap(expandedGrid);
  
  return { grid: expandedGrid, wallInfluence };
}

/**
 * Generate BSP dungeon
 * @param {number} width - Dungeon width
 * @param {number} height - Dungeon height
 * @param {number} minRoomSize - Minimum room size
 * @param {number} maxDepth - Maximum recursion depth (default 4)
 * @returns {{grid: Array<Array<number>>, wallInfluence: Array<Array<number>>|null, rooms: Array, corridors: Array, bspTree: BSPNode}} Dungeon data
 */
export function generateBSPDungeon(width, height, minRoomSize, maxDepth = 4) {
  // Create root node
  const root = new BSPNode(0, 0, width, height);
  
  // Split recursively with depth limit (maxDepth = 4 results in 8-16 rooms)
  const minSplitSize = minRoomSize * 1.5; // Minimum size to continue splitting
  splitBSPNode(root, minRoomSize, minSplitSize, 0, maxDepth);
  
  // Create rooms in leaf nodes with mandatory padding = 2 tiles (20px)
  const padding = 20; // 2 tiles * 10px gridSize = 20px mandatory padding
  createRoomsInBSP(root, minRoomSize, padding);
  
  // Create corridors (recursively connects siblings from leaves to root)
  createCorridorsInBSP(root);
  
  // Collect rooms and corridors
  const rooms = [];
  const corridors = [];
  collectBSPRoomsAndCorridors(root, rooms, corridors);
  
  // Filter out rooms that are too small (enemies can't enter 1x1 or very small rooms)
  const minRoomSizeForEnemies = 30; // Minimum 3 tiles (30px) so enemies can enter
  const filteredRooms = rooms.filter(room => {
    return room.w >= minRoomSizeForEnemies && room.h >= minRoomSizeForEnemies;
  });
  
  // Filter out corridors that are too small (1x1 or very small)
  const minCorridorSize = 50; // Minimum 5 tiles (50px) - same as corridor width
  const filteredCorridors = corridors.filter(corridor => {
    return corridor.w >= minCorridorSize && corridor.h >= minCorridorSize;
  });
  
  // Use filtered arrays
  const finalRooms = filteredRooms.length > 0 ? filteredRooms : rooms; // Keep at least some rooms
  const finalCorridors = filteredCorridors;
  
  // Validate connectivity - ensure all rooms are connected
  // The issue: getRoomFromNode only returns ONE room per subtree, but subtrees can have multiple rooms
  // This means some rooms might not be connected via corridors
  const isConnected = validateRoomConnectivity(finalRooms, finalCorridors, width, height, 10);
  
  if (!isConnected) {
    // If not connected, add additional corridors to connect all rooms
    console.warn("BSP Dungeon: Some rooms are not connected, adding additional corridors");
    
    // Get ALL rooms from all leaf nodes (not just one per subtree)
    const allRooms = [];
    function getAllRooms(node) {
      if (node.isLeaf()) {
        if (node.room) {
          allRooms.push(node.room);
        }
      } else {
        getAllRooms(node.left);
        getAllRooms(node.right);
      }
    }
    getAllRooms(root);
    
    // Use flood fill to find which rooms are connected
    const gridW = Math.ceil(width / 10);
    const gridH = Math.ceil(height / 10);
    const connectivityGrid = [];
    
    // Initialize grid
    for (let y = 0; y < gridH; y++) {
      connectivityGrid[y] = [];
      for (let x = 0; x < gridW; x++) {
        connectivityGrid[y][x] = 0; // 0 = wall, 1 = floor
      }
    }
    
    // Mark rooms and existing corridors as floor
    for (const room of allRooms) {
      const startX = Math.floor(room.x / 10);
      const startY = Math.floor(room.y / 10);
      const endX = Math.ceil((room.x + room.w) / 10);
      const endY = Math.ceil((room.y + room.h) / 10);
      for (let y = startY; y < endY && y < gridH; y++) {
        for (let x = startX; x < endX && x < gridW; x++) {
          if (x >= 0 && y >= 0) connectivityGrid[y][x] = 1;
        }
      }
    }
    
    for (const corridor of corridors) {
      const startX = Math.floor(corridor.x / 10);
      const startY = Math.floor(corridor.y / 10);
      const endX = Math.ceil((corridor.x + corridor.w) / 10);
      const endY = Math.ceil((corridor.y + corridor.h) / 10);
      for (let y = startY; y < endY && y < gridH; y++) {
        for (let x = startX; x < endX && x < gridW; x++) {
          if (x >= 0 && y >= 0) connectivityGrid[y][x] = 1;
        }
      }
    }
    
    // Flood fill to find connected components
    const roomComponents = [];
    const visited = [];
    for (let y = 0; y < gridH; y++) {
      visited[y] = [];
      for (let x = 0; x < gridW; x++) {
        visited[y][x] = false;
      }
    }
    
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    
    // Track which rooms belong to which component
    const roomToComponent = new Map();
    
    for (let i = 0; i < allRooms.length; i++) {
      const room = allRooms[i];
      const roomCenterX = Math.floor((room.x + room.w / 2) / 10);
      const roomCenterY = Math.floor((room.y + room.h / 2) / 10);
      
      if (roomCenterX < 0 || roomCenterX >= gridW || roomCenterY < 0 || roomCenterY >= gridH) continue;
      if (visited[roomCenterY][roomCenterX]) continue;
      if (connectivityGrid[roomCenterY][roomCenterX] === 0) continue;
      
      // Flood fill from this room
      const component = [];
      const queue = [[roomCenterX, roomCenterY]];
      visited[roomCenterY][roomCenterX] = true;
      
      while (queue.length > 0) {
        const [x, y] = queue.shift();
        component.push([x, y]);
        
        for (const [dx, dy] of directions) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH && !visited[ny][nx] && connectivityGrid[ny][nx] === 1) {
            visited[ny][nx] = true;
            queue.push([nx, ny]);
          }
        }
      }
      
      // Find which rooms are in this component by checking if any part of the room overlaps
      const roomsInComponent = [];
      for (let j = 0; j < allRooms.length; j++) {
        if (roomToComponent.has(j)) continue; // Already assigned to a component
        
        const r = allRooms[j];
        const startX = Math.floor(r.x / 10);
        const startY = Math.floor(r.y / 10);
        const endX = Math.ceil((r.x + r.w) / 10);
        const endY = Math.ceil((r.y + r.h) / 10);
        
        // Check if any cell of this room is in the component
        let roomInComponent = false;
        for (let ry = startY; ry < endY && ry < gridH; ry++) {
          for (let rx = startX; rx < endX && rx < gridW; rx++) {
            if (rx >= 0 && ry >= 0 && visited[ry][rx]) {
              roomInComponent = true;
              break;
            }
          }
          if (roomInComponent) break;
        }
        
        if (roomInComponent) {
          roomsInComponent.push(j);
          roomToComponent.set(j, roomComponents.length);
        }
      }
      
      if (roomsInComponent.length > 0) {
        roomComponents.push(roomsInComponent);
      }
    }
    
    // If we have multiple components, connect them
    if (roomComponents.length > 1) {
      // Connect each component to the first component
      for (let compIdx = 1; compIdx < roomComponents.length; compIdx++) {
        const sourceComponent = roomComponents[compIdx];
        const targetComponent = roomComponents[0];
        
        // Find nearest rooms between components
        let nearestSourceRoom = allRooms[sourceComponent[0]];
        let nearestTargetRoom = allRooms[targetComponent[0]];
        let nearestDist = Infinity;
        
        for (const sourceIdx of sourceComponent) {
          for (const targetIdx of targetComponent) {
            const sourceRoom = allRooms[sourceIdx];
            const targetRoom = allRooms[targetIdx];
            const dist = Math.hypot(
              (sourceRoom.x + sourceRoom.w / 2) - (targetRoom.x + targetRoom.w / 2),
              (sourceRoom.y + sourceRoom.h / 2) - (targetRoom.y + targetRoom.h / 2)
            );
            if (dist < nearestDist) {
              nearestDist = dist;
              nearestSourceRoom = sourceRoom;
              nearestTargetRoom = targetRoom;
            }
          }
        }
        
        // Create L-shaped corridor between these rooms
        const corridorW = 50;
        const extendIntoRoom = 60;
        const sourceCenterX = nearestSourceRoom.x + nearestSourceRoom.w / 2;
        const sourceCenterY = nearestSourceRoom.y + nearestSourceRoom.h / 2;
        const targetCenterX = nearestTargetRoom.x + nearestTargetRoom.w / 2;
        const targetCenterY = nearestTargetRoom.y + nearestTargetRoom.h / 2;
        
        let extraCorridor1, extraCorridor2;
        if (Math.random() < 0.5) {
          const midX = (sourceCenterX + targetCenterX) / 2;
          extraCorridor1 = {
            x: Math.min(sourceCenterX - extendIntoRoom, midX - corridorW / 2),
            y: sourceCenterY - corridorW / 2,
            w: Math.abs(midX - (sourceCenterX - extendIntoRoom)) + corridorW + extendIntoRoom,
            h: corridorW
          };
          extraCorridor2 = {
            x: midX - corridorW / 2,
            y: Math.min(sourceCenterY, targetCenterY) - corridorW / 2,
            w: corridorW,
            h: Math.abs(targetCenterY - sourceCenterY) + corridorW + extendIntoRoom * 2
          };
        } else {
          const midY = (sourceCenterY + targetCenterY) / 2;
          extraCorridor1 = {
            x: sourceCenterX - corridorW / 2,
            y: Math.min(sourceCenterY - extendIntoRoom, midY - corridorW / 2),
            w: corridorW,
            h: Math.abs(midY - (sourceCenterY - extendIntoRoom)) + corridorW + extendIntoRoom
          };
          extraCorridor2 = {
            x: Math.min(sourceCenterX, targetCenterX) - corridorW / 2,
            y: midY - corridorW / 2,
            w: Math.abs(targetCenterX - sourceCenterX) + corridorW + extendIntoRoom * 2,
            h: corridorW
          };
        }
        
        corridors.push(extraCorridor1, extraCorridor2);
        // Merge components
        roomComponents[0].push(...sourceComponent);
      }
    }
  }
  
  // Add additional corridors to create multiple entrances per room
  // This improves flow and gives players multiple ways in/out of rooms
  addMultipleEntrances(finalRooms, finalCorridors, width, height);
  
  // Final filter: Remove any corridors that became too small after processing
  const minCorridorSizeFinal = 50;
  const finalFilteredCorridors = finalCorridors.filter(corridor => {
    return corridor.w >= minCorridorSizeFinal && corridor.h >= minCorridorSizeFinal;
  });
  
  // Convert to grid
  const gridResult = convertBSPToGrid(finalRooms, finalFilteredCorridors, width, height, 10);
  
  return {
    grid: gridResult.grid,
    wallInfluence: gridResult.wallInfluence || null,
    rooms: finalRooms,
    corridors: finalFilteredCorridors,
    bspTree: root
  };
}

/**
 * Check if a corridor overlaps with a room (for connection detection)
 * @param {object} corridor - Corridor object with x, y, w, h
 * @param {object} room - Room object with x, y, w, h
 * @returns {boolean} True if corridor overlaps room
 */
function corridorOverlapsRoom(corridor, room) {
  // Check if corridor rectangle overlaps room rectangle
  // Add small margin to account for corridor extending into room
  const margin = 20;
  return !(corridor.x + corridor.w < room.x - margin ||
           corridor.x > room.x + room.w + margin ||
           corridor.y + corridor.h < room.y - margin ||
           corridor.y > room.y + room.h + margin);
}

/**
 * Check if two rooms are already connected via existing corridors
 * @param {object} room1 - First room
 * @param {object} room2 - Second room
 * @param {Array} corridors - Array of corridor objects
 * @returns {boolean} True if rooms are already connected
 */
function areRoomsConnected(room1, room2, corridors) {
  // Check if any corridor connects both rooms
  for (const corridor of corridors) {
    const connectsRoom1 = corridorOverlapsRoom(corridor, room1);
    const connectsRoom2 = corridorOverlapsRoom(corridor, room2);
    if (connectsRoom1 && connectsRoom2) {
      return true;
    }
  }
  return false;
}

/**
 * Count how many unique rooms a given room is connected to
 * @param {object} room - Room object
 * @param {Array} allRooms - Array of all rooms
 * @param {Array} corridors - Array of corridor objects
 * @returns {number} Number of unique room connections
 */
function countRoomConnections(room, allRooms, corridors) {
  const connectedRooms = new Set();
  
  for (const corridor of corridors) {
    if (corridorOverlapsRoom(corridor, room)) {
      // Find which other room(s) this corridor connects to
      for (let i = 0; i < allRooms.length; i++) {
        const otherRoom = allRooms[i];
        if (otherRoom === room) continue;
        if (corridorOverlapsRoom(corridor, otherRoom)) {
          connectedRooms.add(i);
        }
      }
    }
  }
  
  return connectedRooms.size;
}

/**
 * Add additional corridors to create multiple entrances per room
 * Connects nearby rooms that aren't already directly connected
 * @param {Array} rooms - Array of room objects
 * @param {Array} corridors - Array of corridor objects (will be modified)
 * @param {number} width - Level width
 * @param {number} height - Level height
 */
function addMultipleEntrances(rooms, corridors, width, height) {
  if (rooms.length < 3) return; // Need at least 3 rooms for multiple entrances
  
  const corridorW = 50; // Same width as main corridors
  const extendIntoRoom = 60; // Extend into rooms for guaranteed connection
  
  // Track which room pairs we've already connected to avoid duplicates
  const connectedPairs = new Set();
  
  // For each room, try to add 1-2 additional connections to nearby rooms
  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i];
    const roomCenterX = room.x + room.w / 2;
    const roomCenterY = room.y + room.h / 2;
    
    // Count existing connections (unique rooms this room connects to)
    const existingConnections = countRoomConnections(room, rooms, corridors);
    
    // Target: 2-3 total connections per room
    const targetConnections = 2 + Math.floor(Math.random() * 2); // 2 or 3
    const neededConnections = Math.max(0, targetConnections - existingConnections);
    
    if (neededConnections === 0) continue; // Already has enough connections
    
    // Find nearby rooms (within reasonable distance)
    const nearbyRooms = [];
    for (let j = 0; j < rooms.length; j++) {
      if (i === j) continue;
      
      const otherRoom = rooms[j];
      const otherCenterX = otherRoom.x + otherRoom.w / 2;
      const otherCenterY = otherRoom.y + otherRoom.h / 2;
      
      const dist = Math.hypot(roomCenterX - otherCenterX, roomCenterY - otherCenterY);
      const maxDist = Math.min(width, height) * 0.5; // Within 50% of level size
      const minDist = Math.min(room.w, room.h) * 1.2; // Not too close (avoid redundant)
      
      if (dist >= minDist && dist < maxDist) {
        // Check if already connected
        const pairKey = `${Math.min(i, j)}-${Math.max(i, j)}`;
        if (!connectedPairs.has(pairKey) && !areRoomsConnected(room, otherRoom, corridors)) {
          nearbyRooms.push({ room: otherRoom, dist, idx: j });
        }
      }
    }
    
    // Sort by distance (closest first)
    nearbyRooms.sort((a, b) => a.dist - b.dist);
    
    // Add connections to nearby rooms
    let addedConnections = 0;
    for (const nearby of nearbyRooms) {
      if (addedConnections >= neededConnections) break;
      
      // 50% chance to add connection to this nearby room
      if (Math.random() < 0.5) {
        const otherRoom = nearby.room;
        const otherCenterX = otherRoom.x + otherRoom.w / 2;
        const otherCenterY = otherRoom.y + otherRoom.h / 2;
        
        // Create L-shaped corridor
        let extraCorridor1, extraCorridor2;
        if (Math.random() < 0.5) {
          // Horizontal first, then vertical
          const midX = (roomCenterX + otherCenterX) / 2;
          extraCorridor1 = {
            x: Math.min(roomCenterX - extendIntoRoom, midX - corridorW / 2),
            y: roomCenterY - corridorW / 2,
            w: Math.abs(midX - (roomCenterX - extendIntoRoom)) + corridorW + extendIntoRoom,
            h: corridorW
          };
          extraCorridor2 = {
            x: midX - corridorW / 2,
            y: Math.min(roomCenterY, otherCenterY) - corridorW / 2,
            w: corridorW,
            h: Math.abs(otherCenterY - roomCenterY) + corridorW + extendIntoRoom * 2
          };
        } else {
          // Vertical first, then horizontal
          const midY = (roomCenterY + otherCenterY) / 2;
          extraCorridor1 = {
            x: roomCenterX - corridorW / 2,
            y: Math.min(roomCenterY - extendIntoRoom, midY - corridorW / 2),
            w: corridorW,
            h: Math.abs(midY - (roomCenterY - extendIntoRoom)) + corridorW + extendIntoRoom
          };
          extraCorridor2 = {
            x: Math.min(roomCenterX, otherCenterX) - corridorW / 2,
            y: midY - corridorW / 2,
            w: Math.abs(otherCenterX - roomCenterX) + corridorW + extendIntoRoom * 2,
            h: corridorW
          };
        }
        
        // Extend corridors well into both rooms
        const roomOverlap = 60;
        const minCorridorLength = corridorW; // Minimum length = width (50px)
        
        if (extraCorridor1.h === corridorW) {
          extraCorridor1.x = Math.min(extraCorridor1.x, room.x - roomOverlap);
          const rightEdge = Math.max(extraCorridor1.x + extraCorridor1.w, otherRoom.x + otherRoom.w + roomOverlap);
          extraCorridor1.w = rightEdge - extraCorridor1.x;
          // Ensure minimum length
          if (extraCorridor1.w < minCorridorLength) {
            const centerX = extraCorridor1.x + extraCorridor1.w / 2;
            extraCorridor1.x = centerX - minCorridorLength / 2;
            extraCorridor1.w = minCorridorLength;
          }
        }
        if (extraCorridor2.h === corridorW) {
          extraCorridor2.x = Math.min(extraCorridor2.x, room.x - roomOverlap);
          const rightEdge = Math.max(extraCorridor2.x + extraCorridor2.w, otherRoom.x + otherRoom.w + roomOverlap);
          extraCorridor2.w = rightEdge - extraCorridor2.x;
          // Ensure minimum length
          if (extraCorridor2.w < minCorridorLength) {
            const centerX = extraCorridor2.x + extraCorridor2.w / 2;
            extraCorridor2.x = centerX - minCorridorLength / 2;
            extraCorridor2.w = minCorridorLength;
          }
        }
        if (extraCorridor1.w === corridorW) {
          extraCorridor1.y = Math.min(extraCorridor1.y, room.y - roomOverlap);
          const bottomEdge = Math.max(extraCorridor1.y + extraCorridor1.h, otherRoom.y + otherRoom.h + roomOverlap);
          extraCorridor1.h = bottomEdge - extraCorridor1.y;
          // Ensure minimum length
          if (extraCorridor1.h < minCorridorLength) {
            const centerY = extraCorridor1.y + extraCorridor1.h / 2;
            extraCorridor1.y = centerY - minCorridorLength / 2;
            extraCorridor1.h = minCorridorLength;
          }
        }
        if (extraCorridor2.w === corridorW) {
          extraCorridor2.y = Math.min(extraCorridor2.y, room.y - roomOverlap);
          const bottomEdge = Math.max(extraCorridor2.y + extraCorridor2.h, otherRoom.y + otherRoom.h + roomOverlap);
          extraCorridor2.h = bottomEdge - extraCorridor2.y;
          // Ensure minimum length
          if (extraCorridor2.h < minCorridorLength) {
            const centerY = extraCorridor2.y + extraCorridor2.h / 2;
            extraCorridor2.y = centerY - minCorridorLength / 2;
            extraCorridor2.h = minCorridorLength;
          }
        }
        
        corridors.push(extraCorridor1, extraCorridor2);
        
        // Mark this pair as connected
        const pairKey = `${Math.min(i, nearby.idx)}-${Math.max(i, nearby.idx)}`;
        connectedPairs.add(pairKey);
        
        addedConnections++;
      }
    }
  }
}

