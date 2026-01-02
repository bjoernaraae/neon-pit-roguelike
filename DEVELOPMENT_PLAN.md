# Development Plan: Procedural Floor Generation & Enemy AI

## Overview
This plan outlines improvements to the procedural floor generation system and enemy AI to create more interesting, consistent maps with smarter enemy behavior.

---

## 1. Map Size & Consistency

### Current Issues:
- Map size scales with floor: `scaleFactor = 3.5 + (floor - 1) * 0.25`
- Floors get progressively larger, making gameplay inconsistent

### Solution:
- **Fixed map size**: All floors use `scaleFactor = 4.0` (4x screen size)
- Consistent experience across all floors
- Map dimensions: `levelW = w * 4.0`, `levelH = h * 4.0`

### Implementation:
```javascript
// In generateProceduralLevel:
const scaleFactor = 4.0; // Fixed size for all floors
const levelW = w * scaleFactor;
const levelH = h * scaleFactor;
```

---

## 2. Line of Sight System

### Purpose:
- Enemies should only aggro/attack if they can see the player
- Creates tactical gameplay (hiding behind walls, ambushes)
- More realistic enemy behavior

### Implementation Plan:

#### 2.1 Line-of-Sight Function
```javascript
function hasLineOfSight(fromX, fromY, toX, toY, levelData, stepSize = 10) {
  // Raycast from enemy to player
  // Check if line intersects any walls
  // Return true if clear path exists
}
```

#### 2.2 Wall Intersection Detection
- Check if ray from enemy to player crosses any non-walkable areas
- Use grid-based or geometric intersection tests
- Consider enemy radius for visibility checks

#### 2.3 Enemy Behavior Updates
- **Idle State**: Enemy doesn't see player → patrol or stand still
- **Alert State**: Enemy sees player → move towards player
- **Lost State**: Enemy loses sight → search briefly, then return to idle

---

## 3. Improved Procedural Generation

### Current State:
- Basic room generation (3-5 rooms)
- Simple corridors connecting rooms
- No room variety or special rooms

### Enhancements:

#### 3.1 Room Types
- **Spawn Room**: Starting area (safe, no enemies initially)
- **Combat Rooms**: Regular rooms with enemies
- **Treasure Rooms**: Smaller rooms with chests/shrines
- **Boss Room**: Large room for boss fights
- **Corridor Rooms**: Small connecting rooms

#### 3.2 Room Types
```javascript
const roomTypes = {
  SPAWN: { minSize: 1.0, maxSize: 1.2, enemies: 0, chests: 0 },
  COMBAT: { minSize: 0.8, maxSize: 1.4, enemies: 'normal', chests: 'rare' },
  TREASURE: { minSize: 0.6, maxSize: 0.9, enemies: 'low', chests: 'high' },
  BOSS: { minSize: 1.5, maxSize: 2.0, enemies: 1, chests: 1 },
  CORRIDOR: { minSize: 0.4, maxSize: 0.6, enemies: 'low', chests: 0 }
};
```

#### 3.3 Better Room Placement
- **Minimum Distance**: Ensure rooms aren't too close
- **Maximum Distance**: Ensure all rooms are reachable
- **Room Clustering**: Group similar room types
- **Dead Ends**: Some rooms should be dead ends (treasure rooms)

#### 3.4 Corridor Improvements
- **Wider Corridors**: Minimum 100px width for better navigation
- **Corridor Rooms**: Small rooms at corridor intersections
- **Multiple Paths**: Some areas should have multiple routes

---

## 4. Enemy Pathfinding System

### Current Issues:
- Enemies move directly towards player
- Get stuck on walls
- No pathfinding around obstacles

### Solution: Simple A* Pathfinding

#### 4.1 Grid-Based Pathfinding
```javascript
function findPath(startX, startY, endX, endY, levelData) {
  // Create grid from walkable areas
  // Use A* algorithm to find path
  // Return array of waypoints
}
```

#### 4.2 Flow Field Alternative (Simpler)
- Pre-compute flow field from player position
- Enemies follow flow field gradient
- Faster than A* for many enemies
- Updates when player moves

#### 4.3 Implementation Choice
**Recommendation: Flow Field**
- Simpler to implement
- Better performance with many enemies
- Good enough for this game type
- Can upgrade to A* later if needed

---

## 5. Enemy Stuck Detection

### Detection Method:
```javascript
function isEnemyStuck(enemy, lastPositions, threshold = 0.5) {
  // Track enemy position over last N frames
  // If movement < threshold, enemy is stuck
  // Return true if stuck
}
```

### Unstuck Behavior:
1. **Detect Stuck**: Enemy hasn't moved significantly in 1-2 seconds
2. **Back Away**: Move away from current position
3. **Pathfind**: Use pathfinding to find alternative route
4. **Reset**: Clear stuck state after successful movement

---

## 6. Improved Enemy Movement

### Current Movement:
- Direct line to player
- Simple wall checking (only prevents movement into walls)

### New Movement System:

#### 6.1 Movement States
- **Direct Path**: If line of sight exists, move directly
- **Pathfinding**: If no line of sight, use pathfinding
- **Wall Avoidance**: Steer away from walls before collision

#### 6.2 Wall Avoidance
```javascript
function getWallAvoidanceVector(enemy, levelData, lookAhead = 30) {
  // Check for walls ahead of enemy
  // Return steering vector away from walls
  // Combine with movement towards player
}
```

#### 6.3 Movement Priority
1. **Avoid Walls**: Highest priority
2. **Follow Path**: If pathfinding active
3. **Move to Player**: If line of sight
4. **Patrol**: If no player in sight

---

## 7. Implementation Priority

### Phase 1: Core Fixes (High Priority)
1. ✅ Fix map size consistency
2. ✅ Implement basic pathfinding (flow field)
3. ✅ Add stuck detection and recovery

### Phase 2: Line of Sight (Medium Priority)
4. ✅ Implement line-of-sight system
5. ✅ Update enemy behavior based on visibility
6. ✅ Add enemy states (idle, alert, lost)

### Phase 3: Enhanced Generation (Lower Priority)
7. ✅ Add room types and variety
8. ✅ Improve corridor generation
9. ✅ Add special rooms (treasure, boss)

---

## 8. Technical Details

### Flow Field Implementation:
```javascript
// Create flow field grid
const gridSize = 50; // 50px cells
const gridW = Math.ceil(levelW / gridSize);
const gridH = Math.ceil(levelH / gridSize);

// Compute distances from player
const flowField = computeFlowField(playerX, playerY, levelData);

// Enemy uses flow field
const cellX = Math.floor(enemy.x / gridSize);
const cellY = Math.floor(enemy.y / gridSize);
const direction = flowField[cellY][cellX]; // Vector to follow
```

### Line of Sight Implementation:
```javascript
function hasLineOfSight(fromX, fromY, toX, toY, levelData) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.hypot(dx, dy);
  const steps = Math.ceil(dist / 10); // Check every 10px
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = fromX + dx * t;
    const y = fromY + dy * t;
    
    if (!isPointWalkable(x, y, levelData, 5)) {
      return false; // Wall in the way
    }
  }
  return true; // Clear path
}
```

---

## 9. Testing Checklist

- [ ] All floors are same size
- [ ] Enemies don't get stuck on walls
- [ ] Enemies pathfind around obstacles
- [ ] Line of sight works correctly
- [ ] Enemies only aggro when they see player
- [ ] Stuck detection recovers enemies
- [ ] Room generation is varied and interesting
- [ ] Corridors are wide enough for navigation
- [ ] Performance is acceptable with many enemies

---

## 10. Future Enhancements

- **Dynamic Difficulty**: Adjust room complexity based on floor
- **Secret Rooms**: Hidden rooms with special rewards
- **Room Events**: Special events in certain rooms
- **Multi-level Pathfinding**: Enemies can plan ahead
- **Formation Movement**: Enemies move in groups
- **Cover System**: Enemies use walls for cover
