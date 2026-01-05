# A* Pathfinding Refinements

## Overview
Refined the A* pathfinding system to prevent enemies from getting stuck on corners through three key improvements:
1. **No Corner Cutting** - 8-way movement with corner cutting prevention
2. **Path Weighting** - Wall influence map to prefer center paths
3. **Waypoint Steering** - Smooth steering forces with wall sliding

---

## 1. No Corner Cutting

### Implementation
- **8-Way Movement**: Extended from 4-way to 8-way movement (cardinal + diagonal)
- **Corner Cutting Prevention**: Diagonal moves are only valid if both adjacent cardinal tiles are walkable

### Code Changes
```javascript
// Get neighbors for 8-way movement with corner cutting prevention
function getNeighbors(grid, x, y) {
  // Cardinal directions (cost: 1.0)
  // Diagonal directions (cost: 1.414) - only if both adjacent cardinals walkable
}
```

### How It Works
1. Check all 8 neighbors (4 cardinal + 4 diagonal)
2. For diagonal moves, verify both adjacent cardinal tiles are walkable
3. If either adjacent cardinal is a wall, the diagonal move is blocked
4. This prevents enemies from "cutting corners" through walls

### Benefits
- Prevents enemies from getting stuck trying to move through walls
- More realistic movement around corners
- Better navigation in tight spaces

---

## 2. Path Weighting (Wall Influence Map)

### Implementation
- **Wall Influence Map**: Generated during level creation
- **Cost Calculation**: Tiles adjacent to walls have higher movement cost
- **Path Preference**: A* prefers paths through center of corridors

### Code Changes
```javascript
// Generate wall influence map
function generateWallInfluenceMap(grid) {
  // For each floor tile, count adjacent walls
  // Assign cost: (wallCount / 8) * 0.5
  // Cost ranges from 0 (no walls) to 0.5 (surrounded)
}
```

### How It Works
1. During level generation, analyze each floor tile
2. Count how many of the 8 neighbors are walls
3. Assign influence cost: `(wallCount / 8) * 0.5`
4. A* adds this cost to movement cost when pathfinding
5. Paths through center of corridors (fewer walls) are cheaper

### Benefits
- Enemies prefer wider paths (center of corridors)
- Reduces corner-sticking behavior
- More natural movement patterns
- Better navigation in complex layouts

---

## 3. Waypoint Steering

### Implementation
- **Steering Forces**: Smooth movement toward waypoints instead of snapping
- **Wall Sliding**: Apply slide force along wall edges when colliding
- **Force Combination**: Combine steering and slide forces for smooth movement

### Code Changes
```javascript
// Get steering force toward waypoint
function getSteeringForce(enemyX, enemyY, targetX, targetY, maxForce = 1.0) {
  // Calculate normalized direction vector
  // Scale by max force
}

// Get wall slide force when colliding
function getWallSlideForce(enemyX, enemyY, desiredX, desiredY, levelData, radius) {
  // Check if desired position is blocked
  // Try perpendicular directions for sliding
  // Return slide force along wall edge
}
```

### How It Works
1. **Steering**: Calculate force vector toward next waypoint
2. **Look Ahead**: Check if desired position (steering * lookAhead) is walkable
3. **Wall Detection**: If blocked, calculate slide force perpendicular to desired direction
4. **Force Combination**: Combine steering + slide forces
5. **Smooth Movement**: Enemy moves with combined force (not snapping to waypoints)

### Benefits
- Smooth, natural movement (no snapping to grid centers)
- Prevents momentum loss when hitting walls
- Enemies slide along walls instead of stopping
- Better corner navigation

---

## Integration Details

### Grid Data Structure
```javascript
// BSP generation returns:
{
  grid: [[0,1,1,0], ...],        // 0=wall, 1=floor
  wallInfluence: [[0,0.1,0,0], ...], // Cost map (0-0.5)
  rooms: [...],
  corridors: [...]
}

// Stored in levelData:
levelData.pathfindingGrid
levelData.pathfindingWallInfluence
levelData.pathfindingGridSize
```

### Pathfinding Call
```javascript
const gridData = {
  grid: s.levelData.pathfindingGrid,
  wallInfluence: s.levelData.pathfindingWallInfluence || null
};
const path = findPath(start, end, gridData, gridSize);
```

### Enemy Movement
```javascript
// Get steering force toward waypoint
const steering = getSteeringForce(e.x, e.y, waypoint.x, waypoint.y, 1.0);

// Check for wall collision and apply slide
const slideForce = getWallSlideForce(e.x, e.y, desiredX, desiredY, s.levelData, 5);

// Combine forces
const totalForce = normalize(steering + slideForce);
```

---

## Performance Considerations

### Wall Influence Map
- Generated once during level creation
- O(n) where n = number of floor tiles
- Stored in memory (minimal overhead)

### Steering Forces
- Calculated every frame per enemy
- Very lightweight (simple vector math)
- No performance impact

### Corner Cutting Prevention
- Adds 2 extra checks per diagonal neighbor
- Minimal overhead (8 neighbors max)
- Prevents expensive stuck recovery

---

## Testing Checklist

- [x] 8-way movement works correctly
- [x] Corner cutting prevention blocks invalid diagonals
- [x] Wall influence map generated correctly
- [x] Paths prefer center of corridors
- [x] Steering forces work smoothly
- [x] Wall sliding prevents stuck enemies
- [x] Force combination works correctly
- [ ] Test with various room layouts
- [ ] Test corner navigation
- [ ] Test narrow corridors
- [ ] Performance with many enemies

---

## Code Locations

- **Corner Cutting**: `getNeighbors()` - Lines 776-825
- **Wall Influence**: `generateWallInfluenceMap()` - Lines 301-350
- **Grid Conversion**: `convertBSPToGrid()` - Lines 352-410
- **Steering Forces**: `getSteeringForce()` - Lines 907-920
- **Wall Sliding**: `getWallSlideForce()` - Lines 922-960
- **Enemy Movement**: Lines 5426-5480 (steering integration)

---

## Future Enhancements

1. **Dynamic Wall Influence**: Update influence map when destructibles are destroyed
2. **Adaptive Steering**: Adjust steering force based on distance to waypoint
3. **Predictive Sliding**: Anticipate wall collisions before they happen
4. **Path Smoothing**: Post-process paths to reduce zigzagging
5. **Formation Movement**: Coordinate steering for groups of enemies

---

## Notes

- Wall influence cost (0-0.5) is balanced to prefer center paths without being too strong
- Steering force maxForce (1.0) provides smooth movement without overshooting
- Wall slide force (0.5) is reduced to prevent excessive sliding
- Look-ahead distance (20px) balances responsiveness and collision detection
- Corner cutting prevention adds ~2 checks per diagonal (negligible overhead)
