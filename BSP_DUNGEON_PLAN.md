# BSP Dungeon Generation Plan

## Overview
Implement Binary Space Partitioning (BSP) algorithm for procedural dungeon generation to replace the current random room placement system.

---

## Current System Analysis

### Current Approach:
- **Method**: Random room placement with overlap checks
- **Rooms**: 3-5 large open rooms
- **Connections**: Wide corridors (100-140px) connecting rooms
- **Issues**:
  - Rooms can be poorly distributed
  - No guarantee of optimal connectivity
  - Limited control over room sizes
  - Can create awkward layouts

### BSP Advantages:
- **Structured**: Tree-based generation ensures good distribution
- **Guaranteed Connectivity**: L-shaped corridors ensure all rooms reachable
- **Size Control**: Can enforce minimum/maximum room sizes
- **Variety**: More varied room layouts and sizes
- **Scalability**: Works well for any number of rooms

---

## BSP Algorithm Implementation

### 1. BSP Tree Structure
```javascript
class BSPNode {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.left = null;  // Left child node
    this.right = null; // Right child node
    this.room = null;  // Room in this node (if leaf)
    this.corridor = null; // Corridor connecting children
  }
  
  isLeaf() {
    return this.left === null && this.right === null;
  }
}
```

### 2. Recursive Splitting
- Split area into two halves (horizontal or vertical)
- Continue splitting until nodes are small enough
- Create rooms in leaf nodes
- Connect sibling rooms with corridors

### 3. Room Generation
- Each leaf node gets a room
- Room size: random between minRoomSize and node size (with padding)
- Room position: random within node bounds (with padding)

### 4. Corridor Generation
- L-shaped corridors connecting sibling rooms
- Ensures all rooms are reachable
- Corridors connect room centers

### 5. Grid Output
- Convert rooms and corridors to 2D grid
- 0 = empty/void (walls)
- 1 = floor (walkable)
- 2 = wall (optional, for visual distinction)

---

## Implementation Steps

### Phase 1: Core BSP Algorithm
1. Create BSPNode class
2. Implement recursive splitting function
3. Add room generation in leaf nodes
4. Add corridor generation between siblings

### Phase 2: Grid Conversion
1. Convert BSP tree to 2D grid
2. Map rooms to grid cells
3. Map corridors to grid cells
4. Handle edge cases (overlaps, boundaries)

### Phase 3: Integration
1. Replace current `generateProceduralLevel` with BSP version
2. Convert grid to walkableAreas format
3. Maintain compatibility with existing systems
4. Add platforms, cover, destructibles to BSP rooms

### Phase 4: Enhancement
1. Add room type variety (treasure, combat, spawn)
2. Add special room features
3. Optimize corridor width and placement
4. Add visual variety to room sizes

---

## Parameters

### Input Parameters:
- `width`: Total dungeon width
- `height`: Total dungeon height
- `minRoomSize`: Minimum room dimension (e.g., 80px)
- `maxRoomSize`: Maximum room dimension (optional)
- `splitRatio`: Preferred split ratio (0.4-0.6 for balanced splits)
- `minSplitSize`: Minimum size to continue splitting (e.g., 120px)

### Output Format:
```javascript
{
  grid: [[0,1,1,0], [1,1,1,1], ...], // 2D array: 0=void, 1=floor, 2=wall
  rooms: [{x, y, w, h, id}, ...],
  corridors: [{x, y, w, h}, ...],
  walkableAreas: [{x, y, w, h}, ...],
  // ... other level data
}
```

---

## Algorithm Pseudocode

```
function generateBSPDungeon(width, height, minRoomSize):
  root = new BSPNode(0, 0, width, height)
  splitNode(root, minRoomSize)
  createRooms(root)
  createCorridors(root)
  grid = convertToGrid(root, width, height)
  return {grid, rooms, corridors, walkableAreas}

function splitNode(node, minRoomSize):
  if node.width < minRoomSize * 2 or node.height < minRoomSize * 2:
    return // Can't split further
  
  if node.width > node.height:
    // Split vertically
    splitX = random(minRoomSize, node.width - minRoomSize)
    node.left = new BSPNode(node.x, node.y, splitX, node.height)
    node.right = new BSPNode(node.x + splitX, node.y, node.width - splitX, node.height)
  else:
    // Split horizontally
    splitY = random(minRoomSize, node.height - minRoomSize)
    node.left = new BSPNode(node.x, node.y, node.width, splitY)
    node.right = new BSPNode(node.x, node.y + splitY, node.width, node.height - splitY)
  
  splitNode(node.left, minRoomSize)
  splitNode(node.right, minRoomSize)

function createRooms(node):
  if node.isLeaf():
    // Create room in leaf node
    padding = 10
    roomW = random(minRoomSize, node.width - padding * 2)
    roomH = random(minRoomSize, node.height - padding * 2)
    roomX = node.x + random(padding, node.width - roomW - padding)
    roomY = node.y + random(padding, node.height - roomH - padding)
    node.room = {x: roomX, y: roomY, w: roomW, h: roomH}
  else:
    createRooms(node.left)
    createRooms(node.right)

function createCorridors(node):
  if node.isLeaf():
    return
  
  createCorridors(node.left)
  createCorridors(node.right)
  
  // Connect left and right child rooms
  leftRoom = getRoom(node.left)
  rightRoom = getRoom(node.right)
  
  if leftRoom && rightRoom:
    // Create L-shaped corridor
    corridor = createLShapeCorridor(leftRoom, rightRoom)
    node.corridor = corridor

function getRoom(node):
  if node.isLeaf():
    return node.room
  // Get room from any descendant
  return getRoom(node.left) || getRoom(node.right)
```

---

## Comparison: Current vs BSP

### Current System:
- ✅ Simple and fast
- ✅ Large open rooms
- ❌ Unpredictable layouts
- ❌ Can create disconnected areas
- ❌ Limited room size control

### BSP System:
- ✅ Structured, predictable layouts
- ✅ Guaranteed connectivity
- ✅ Better room distribution
- ✅ More control over room sizes
- ✅ Scales well with more rooms
- ❌ Slightly more complex
- ❌ May create more uniform layouts

---

## Recommendation

**Use BSP for better structure and guaranteed connectivity**, but keep the current system as a fallback option. BSP will provide:
- More reliable level generation
- Better room distribution
- Guaranteed connectivity
- More control over difficulty scaling

---

## Integration Plan

1. **Keep current system** as `generateProceduralLevelLegacy`
2. **Add BSP system** as `generateBSPDungeon`
3. **Add toggle** to switch between systems (or use BSP by default)
4. **Maintain compatibility** with existing walkableAreas format
5. **Add platforms/cover/destructibles** to BSP rooms (same as current)

---

## Next Steps

1. Implement BSP algorithm
2. Test with various parameters
3. Compare layouts with current system
4. Integrate into game
5. Add visual elements (platforms, cover, destructibles) to BSP rooms
