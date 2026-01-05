# A* Pathfinding Implementation

## Overview
Replaced flow field pathfinding with A* (A-Star) algorithm for more accurate and reliable enemy pathfinding.

---

## Implementation Details

### 1. A* Algorithm Components

#### AStarNode Class
- Represents a node in the pathfinding grid
- Properties: `x`, `y`, `g` (cost from start), `h` (heuristic), `f` (total cost), `parent`, `closed`, `open`
- `equals()` method for node comparison

#### PriorityQueue Class
- Simple priority queue for the open set
- Sorts nodes by `f` value (total cost)
- Methods: `enqueue()`, `dequeue()`, `isEmpty()`, `contains()`, `updateNode()`

#### Core Functions
- `manhattanDistance()` - Heuristic for 4-way movement
- `getNeighbors()` - Returns walkable neighbors (4 directions: up, down, left, right)
- `findPath()` - Main A* pathfinding function
- `getNextWaypoint()` - Gets next waypoint from path for enemy movement

---

## Algorithm Flow

### 1. Path Calculation (`findPath()`)
```
Input:
  - start: {x, y} in world coordinates
  - end: {x, y} in world coordinates
  - grid: 2D array (0 = wall, 1 = floor)
  - gridSize: size of each grid cell (default: 10px)

Process:
  1. Convert world coordinates to grid coordinates
  2. Validate start and end are walkable
  3. Initialize open set (priority queue) and closed set (map)
  4. Add start node to open set
  5. While open set is not empty:
     a. Dequeue node with lowest f value
     b. If node is goal, reconstruct and return path
     c. Mark node as closed
     d. Check all neighbors:
        - Skip if in closed set
        - Calculate g cost (current.g + 1)
        - If neighbor not in open set, create new node
        - If better path found, update node and add to open set
  6. Return null if no path found

Output:
  - Array of waypoints: [{x, y}, ...] in world coordinates
  - null if no path exists
```

### 2. Enemy Movement Integration

#### Path Caching
- Each enemy has a `pathCache` object:
  ```javascript
  {
    path: [...],        // Array of waypoints
    targetX: number,    // Last known player X
    targetY: number,    // Last known player Y
    lastUpdate: number  // Time of last path calculation
  }
  ```

#### Path Update Conditions
- Path recalculated when:
  1. Player moved > 50 units from last target position
  2. Path expired (> 0.3 seconds old)
  3. Path is empty or null

#### Waypoint Following
- Enemy moves toward next waypoint in path
- Waypoint reached when within 30px threshold
- Removes waypoint from path when reached
- Falls back to direct movement if path exhausted

---

## Grid Integration

### BSP Grid Storage
- BSP dungeon generation creates a 2D grid (0 = wall, 1 = floor)
- Grid stored in `levelData.pathfindingGrid`
- Grid size: 10px per cell (stored in `levelData.pathfindingGridSize`)

### Coordinate Conversion
- World coordinates → Grid coordinates: `Math.floor(worldPos / gridSize)`
- Grid coordinates → World coordinates: `gridPos * gridSize + gridSize / 2` (center of cell)

---

## Performance Optimizations

### 1. Path Caching
- Paths cached per enemy (not recalculated every frame)
- Update interval: 0.3 seconds
- Only recalculates when player moves significantly

### 2. Priority Queue
- Simple sorted array (efficient for small-medium grids)
- Sorted by `f` value (total cost)
- O(n log n) insertion, O(1) removal

### 3. Closed Set
- Uses Map for O(1) lookup: `Map<"x,y", AStarNode>`
- Fast duplicate detection

### 4. Early Termination
- Stops immediately when goal is reached
- Returns path as soon as found

---

## Comparison: Flow Field vs A*

### Flow Field (Old)
- ✅ Fast for many enemies (single computation)
- ✅ Good for simple navigation
- ❌ Less accurate (gradient-based)
- ❌ Can get stuck at corners
- ❌ Updates globally (all enemies affected)

### A* (New)
- ✅ More accurate (optimal paths)
- ✅ Better corner navigation
- ✅ Per-enemy paths (more flexible)
- ✅ Guaranteed to find path if one exists
- ❌ Slightly more expensive (per-enemy calculation)
- ✅ Mitigated by path caching

---

## Fallback Behavior

### When A* Fails
1. **No path found**: Falls back to direct movement toward player
2. **No grid available**: Falls back to direct movement
3. **Path exhausted**: Recalculates or falls back to direct movement
4. **Stuck detection**: If enemy stuck > 0.4s, clears path cache and tries direct movement

---

## Testing Checklist

- [x] A* finds paths correctly
- [x] Enemies follow waypoints
- [x] Path caching works (not recalculating every frame)
- [x] Fallback to direct movement when pathfinding fails
- [x] Grid coordinate conversion correct
- [x] Performance acceptable with multiple enemies
- [ ] Test with various room layouts
- [ ] Test corner navigation
- [ ] Test path recalculation when player moves

---

## Future Enhancements

1. **Diagonal Movement**: Add 8-directional movement support
2. **Path Smoothing**: Smooth paths to reduce zigzagging
3. **Hierarchical Pathfinding**: Use larger grid for long distances
4. **Dynamic Obstacles**: Update grid when destructibles are destroyed
5. **Path Sharing**: Share paths between nearby enemies
6. **JPS (Jump Point Search)**: Optimize for uniform-cost grids

---

## Code Locations

- **A* Implementation**: Lines 716-905 (`import React, { useEffect, useMemo, useR.js`)
- **Enemy Movement**: Lines 5259-5330 (pathfinding integration)
- **Grid Storage**: Lines 665-680 (levelData return)
- **BSP Grid**: Lines 286-333 (grid conversion)

---

## Notes

- Grid size of 10px provides good balance between accuracy and performance
- Path update interval of 0.3s prevents excessive recalculation
- Waypoint threshold of 30px allows smooth movement
- Manhattan distance heuristic is optimal for 4-way movement
