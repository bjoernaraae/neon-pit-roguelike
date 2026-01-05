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
      // Node too small, create minimal room (still with mandatory padding)
      node.room = {
        x: node.x + mandatoryPadding,
        y: node.y + mandatoryPadding,
        w: Math.max(minRoomSize * 0.5, availableW),
        h: Math.max(minRoomSize * 0.5, availableH)
      };
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
  
  // Horizontal corridors should reach deep into both rooms
  if (corridor1.h === corridorW) {
    // Horizontal corridor - extend deep into both rooms
    corridor1.x = Math.min(corridor1.x, leftRoom.x - roomOverlap);
    const rightEdge = Math.max(corridor1.x + corridor1.w, rightRoom.x + rightRoom.w + roomOverlap);
    corridor1.w = rightEdge - corridor1.x;
  }
  if (corridor2.h === corridorW) {
    // Horizontal corridor - extend deep into both rooms
    corridor2.x = Math.min(corridor2.x, leftRoom.x - roomOverlap);
    const rightEdge = Math.max(corridor2.x + corridor2.w, rightRoom.x + rightRoom.w + roomOverlap);
    corridor2.w = rightEdge - corridor2.x;
  }
  
  // Vertical corridors should reach deep into both rooms
  if (corridor1.w === corridorW) {
    // Vertical corridor - extend deep into both rooms
    corridor1.y = Math.min(corridor1.y, leftRoom.y - roomOverlap);
    const bottomEdge = Math.max(corridor1.y + corridor1.h, rightRoom.y + rightRoom.h + roomOverlap);
    corridor1.h = bottomEdge - corridor1.y;
  }
  if (corridor2.w === corridorW) {
    // Vertical corridor - extend deep into both rooms
    corridor2.y = Math.min(corridor2.y, leftRoom.y - roomOverlap);
    const bottomEdge = Math.max(corridor2.y + corridor2.h, rightRoom.y + rightRoom.h + roomOverlap);
    corridor2.h = bottomEdge - corridor2.y;
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
  
  // Initialize grid with 0 (void/wall)
  for (let y = 0; y < gridH; y++) {
    grid[y] = [];
    for (let x = 0; x < gridW; x++) {
      grid[y][x] = 0; // 0 = void/wall
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
        }
      }
    }
  }
  
  // Generate wall influence map
  const wallInfluence = generateWallInfluenceMap(grid);
  
  return { grid, wallInfluence };
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
  
  // Convert to grid
  const gridResult = convertBSPToGrid(rooms, corridors, width, height, 10);
  
  return {
    grid: gridResult.grid,
    wallInfluence: gridResult.wallInfluence || null,
    rooms,
    corridors,
    bspTree: root
  };
}
