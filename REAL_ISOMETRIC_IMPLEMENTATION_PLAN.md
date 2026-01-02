# Real Isometric Implementation Plan

## Overview
Implement a true isometric view where everything looks natural and level. Entities appear upright and properly oriented in isometric space, not rotated. The world uses proper isometric projection mathematics.

---

## 1. Core Principles

### 1.1 What is "Real Isometric"?
- **Mathematical Projection**: World coordinates (x, y, z) → Isometric screen coordinates
- **Natural Orientation**: Entities appear upright and level, not rotated
- **Proper Perspective**: 3D world projected onto 2D screen with correct depth
- **Consistent Scale**: All elements use the same isometric transformation

### 1.2 Key Requirements
- ✅ Everything looks natural and level (no rotated sprites)
- ✅ Proper depth perception
- ✅ Entities appear upright in isometric space
- ✅ Map/ground rendered in isometric
- ✅ Smooth camera movement
- ✅ Correct layering (back to front)

---

## 2. Isometric Mathematics

### 2.1 Coordinate Transformation
```javascript
// Standard isometric projection (2:1 ratio)
const ISO_TILE_WIDTH = 64;   // Width of isometric tile
const ISO_TILE_HEIGHT = 32;  // Height of isometric tile (half of width = 2:1 ratio)
const ISO_SCALE = 1.0;       // Overall scale factor

// World to Isometric Screen
function worldToIso(wx, wy, wz = 0) {
  // Isometric projection formula
  const isoX = (wx - wy) * (ISO_TILE_WIDTH / 2) * ISO_SCALE;
  const isoY = (wx + wy) * (ISO_TILE_HEIGHT / 2) * ISO_SCALE - wz * ISO_SCALE;
  return { x: isoX, y: isoY };
}

// Isometric Screen to World (for mouse/input)
function isoToWorld(isoX, isoY) {
  const wx = (isoX / (ISO_TILE_WIDTH / 2) + isoY / (ISO_TILE_HEIGHT / 2)) / 2;
  const wy = (isoY / (ISO_TILE_HEIGHT / 2) - isoX / (ISO_TILE_WIDTH / 2)) / 2;
  return { x: wx, y: wy };
}
```

### 2.2 Why This Works
- **No Rotation**: Entities are drawn at their isometric position, but remain upright
- **Natural Look**: The isometric transform is applied to positions, not to entity sprites
- **Proper Depth**: Y coordinate determines depth (higher Y = further back)

---

## 3. Rendering System

### 3.1 Entity Rendering (Natural & Level)
Entities are drawn at their isometric screen position, but remain upright:

```javascript
function drawEntityIso(ctx, entity, color) {
  // Convert world position to isometric screen position
  const { x: isoX, y: isoY } = worldToIso(entity.x, entity.y, entity.z || 0);
  
  // Draw shadow first (on ground, at entity's world position)
  drawShadow(ctx, isoX, isoY, entity.r);
  
  // Draw entity body - CIRCLE (not rotated, just positioned)
  // The entity appears at the isometric position but looks natural
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(isoX, isoY - entity.r * 0.3, entity.r, 0, Math.PI * 2);
  ctx.fill();
  
  // Optional: Add highlight for 3D effect (still natural looking)
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.arc(isoX - entity.r * 0.2, isoY - entity.r * 0.4, entity.r * 0.4, 0, Math.PI * 2);
  ctx.fill();
}
```

**Key Point**: Entity shape (circle) is NOT rotated. Only the position is transformed to isometric space.

### 3.2 Map/Ground Rendering
The map is drawn in isometric space:

```javascript
function drawMapIso(ctx, levelData, camera) {
  // Draw each room/corridor as isometric rectangle
  for (const room of levelData.rooms) {
    drawIsometricRect(ctx, room, roomColor);
  }
  
  for (const corridor of levelData.corridors) {
    drawIsometricRect(ctx, corridor, corridorColor);
  }
}

function drawIsometricRect(ctx, rect, color) {
  // Convert rectangle corners to isometric
  const corners = [
    worldToIso(rect.x, rect.y),                    // Top-left
    worldToIso(rect.x + rect.w, rect.y),           // Top-right
    worldToIso(rect.x + rect.w, rect.y + rect.h), // Bottom-right
    worldToIso(rect.x, rect.y + rect.h)            // Bottom-left
  ];
  
  // Draw as diamond/parallelogram shape
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  ctx.lineTo(corners[1].x, corners[1].y);
  ctx.lineTo(corners[2].x, corners[2].y);
  ctx.lineTo(corners[3].x, corners[3].y);
  ctx.closePath();
  ctx.fill();
}
```

### 3.3 Shadows
Shadows help with depth perception:

```javascript
function drawShadow(ctx, isoX, isoY, radius) {
  // Shadow is an ellipse (wider than tall) at ground level
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(isoX, isoY, radius * 1.2, radius * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
}
```

---

## 4. Depth Sorting

### 4.1 Why Depth Sorting is Critical
In isometric view, entities further back (higher Y) must be drawn first so entities in front appear on top.

### 4.2 Implementation
```javascript
function sortByDepth(entities) {
  // Sort by Y position (back to front)
  // In isometric: higher Y = further back
  return entities.sort((a, b) => {
    const depthA = a.y + (a.z || 0) + (a.r || 0);
    const depthB = b.y + (b.z || 0) + (b.r || 0);
    return depthA - depthB; // Draw back entities first
  });
}
```

### 4.3 Drawing Order
1. **Ground/Map** (always drawn first)
2. **Shadows** (for all entities)
3. **Entities** (sorted by depth, back to front)
4. **Effects** (particles, bullets - sorted by depth)
5. **UI Overlay** (always on top)

---

## 5. Camera System

### 5.1 Camera in World Space
Camera position remains in world coordinates:

```javascript
// Camera follows player in world space
camera.x = player.x - screenW / 2;
camera.y = player.y - screenH / 2;
```

### 5.2 Camera Transform for Isometric
When rendering, convert camera position to isometric:

```javascript
function applyCameraTransform(ctx, camera, screenW, screenH) {
  // Convert camera world position to isometric
  const camIso = worldToIso(camera.x, camera.y);
  
  // Center camera on screen
  ctx.translate(screenW / 2 - camIso.x, screenH / 2 - camIso.y);
}
```

**Alternative Approach** (Simpler):
- Keep camera in world coordinates
- Apply camera transform: `ctx.translate(-camera.x, -camera.y)`
- Convert entity positions to isometric when drawing
- This keeps the camera system simpler

---

## 6. Implementation Phases

### Phase 1: Core Isometric System ✅
**Status**: Partially complete (test mode exists)

1. ✅ Create `worldToIso()` and `isoToWorld()` functions
2. ✅ Add isometric constants
3. ⚠️ Fix entity rendering (currently not visible in test mode)
4. ⚠️ Test basic coordinate transformation

**Current Issue**: Entities not rendering in test mode - needs fixing

### Phase 2: Map Rendering in Isometric
**Status**: Not started

1. Convert map rendering to isometric
   - Draw rooms as isometric rectangles (diamond shapes)
   - Draw corridors as isometric rectangles
   - Draw decorations (grass, rocks, water) in isometric space
2. Test map visibility and alignment
3. Ensure map matches collision detection

### Phase 3: Entity Rendering (Natural & Level)
**Status**: Not started

1. Draw entities at isometric positions (natural, not rotated)
   - Player: Circle at isometric position
   - Enemies: Circles at isometric positions
   - Add shadows for depth
2. Implement depth sorting
   - Sort all entities by Y position
   - Draw back to front
3. Test entity visibility and layering

### Phase 4: Effects & Particles
**Status**: Not started

1. Convert bullet rendering to isometric
2. Convert particle effects to isometric
3. Convert combat text to isometric
4. Test all effects render correctly

### Phase 5: Camera & Movement
**Status**: Not started

1. Update camera to work with isometric
2. Test camera follows player correctly
3. Test movement feels natural
4. Ensure camera bounds work correctly

### Phase 6: Polish & Optimization
**Status**: Not started

1. Add proper shadows for all entities
2. Improve visual clarity
3. Optimize rendering performance
4. Test with many entities

---

## 7. Technical Details

### 7.1 Entity Drawing (Natural Orientation)
```javascript
// Player/Enemy rendering - NATURAL, NOT ROTATED
function drawEntityNaturalIso(ctx, entity, color) {
  // Step 1: Convert world position to isometric screen position
  const { x: isoX, y: isoY } = worldToIso(entity.x, entity.y);
  
  // Step 2: Draw shadow (ellipse on ground)
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(isoX, isoY, entity.r * 1.2, entity.r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Step 3: Draw entity body - CIRCLE (natural, upright)
  // Positioned at isometric coordinates, but shape is not rotated
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(isoX, isoY - entity.r * 0.3, entity.r, 0, Math.PI * 2);
  ctx.fill();
  
  // Step 4: Optional highlight (still natural looking)
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.arc(isoX - entity.r * 0.2, isoY - entity.r * 0.4, entity.r * 0.3, 0, Math.PI * 2);
  ctx.fill();
}
```

**Key**: The circle is drawn as a normal circle, just positioned at the isometric coordinates. No rotation applied to the entity itself.

### 7.2 Map Rectangle Drawing
```javascript
function drawIsometricRectangle(ctx, rect, color) {
  // Convert rectangle corners to isometric screen coordinates
  const topLeft = worldToIso(rect.x, rect.y);
  const topRight = worldToIso(rect.x + rect.w, rect.y);
  const bottomRight = worldToIso(rect.x + rect.w, rect.y + rect.h);
  const bottomLeft = worldToIso(rect.x, rect.y + rect.h);
  
  // Draw as parallelogram (isometric rectangle)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(topLeft.x, topLeft.y);
  ctx.lineTo(topRight.x, topRight.y);
  ctx.lineTo(bottomRight.x, bottomRight.y);
  ctx.lineTo(bottomLeft.x, bottomLeft.y);
  ctx.closePath();
  ctx.fill();
  
  // Optional: Add border
  ctx.strokeStyle = adjustBrightness(color, -0.2);
  ctx.lineWidth = 2;
  ctx.stroke();
}
```

### 7.3 Depth Sorting Implementation
```javascript
function drawWorldIsometric(s, ctx) {
  // ... camera setup ...
  
  // Draw map/ground first
  drawMapIso(ctx, s.levelData);
  
  // Collect all entities for depth sorting
  const drawables = [];
  
  // Add enemies
  for (const enemy of s.enemies) {
    if (enemy.hp > 0) {
      drawables.push({
        type: 'enemy',
        y: enemy.y,
        z: enemy.z || 0,
        r: enemy.r,
        draw: () => drawEntityNaturalIso(ctx, enemy, enemyColor)
      });
    }
  }
  
  // Add player
  drawables.push({
    type: 'player',
    y: s.player.y,
    z: s.player.z || 0,
    r: s.player.r,
    draw: () => drawEntityNaturalIso(ctx, s.player, playerColor)
  });
  
  // Add bullets
  for (const bullet of s.bullets) {
    drawables.push({
      type: 'bullet',
      y: bullet.y,
      z: bullet.z || 0,
      r: bullet.r,
      draw: () => drawBulletIso(ctx, bullet)
    });
  }
  
  // Sort by depth (back to front)
  drawables.sort((a, b) => {
    const depthA = a.y + a.z + a.r;
    const depthB = b.y + b.z + b.r;
    return depthA - depthB;
  });
  
  // Draw all entities in sorted order
  for (const item of drawables) {
    item.draw();
  }
}
```

---

## 8. Step-by-Step Implementation

### Step 1: Fix Current Test Mode
**Goal**: Make isometric boxes visible and correctly positioned

1. Fix coordinate transformation in `drawIsoBoxAtOrigin`
2. Ensure boxes render at correct positions
3. Test with player and enemies visible

### Step 2: Convert Map to Isometric
**Goal**: Render map (rooms, corridors) in isometric view

1. Create `drawIsometricRectangle()` function
2. Update `drawWorld()` to render map in isometric
3. Test map visibility and alignment

### Step 3: Convert Entities to Natural Isometric
**Goal**: Render entities naturally (circles, not boxes) at isometric positions

1. Create `drawEntityNaturalIso()` function
2. Replace box rendering with natural circle rendering
3. Add shadows for depth
4. Test entity visibility

### Step 4: Implement Depth Sorting
**Goal**: Correct layering (entities behind drawn first)

1. Collect all drawable entities
2. Sort by Y position (back to front)
3. Draw in sorted order
4. Test layering is correct

### Step 5: Convert Effects to Isometric
**Goal**: All effects render correctly in isometric

1. Convert bullets to isometric
2. Convert particles to isometric
3. Convert combat text to isometric
4. Test all effects

### Step 6: Update Camera System
**Goal**: Camera works smoothly with isometric

1. Test camera follows player
2. Test camera bounds
3. Ensure smooth movement

### Step 7: Polish
**Goal**: Visual polish and optimization

1. Improve shadows
2. Add visual effects
3. Optimize performance
4. Test with many entities

---

## 9. Key Differences from Current Approach

### Current (Test Mode) Issues:
- ❌ Boxes not rendering (coordinate mismatch)
- ❌ Using rotated transforms (not natural)
- ❌ Map still in top-down view

### New Approach:
- ✅ Entities drawn as natural circles at isometric positions
- ✅ No rotation applied to entity shapes
- ✅ Map rendered in isometric (diamond/parallelogram shapes)
- ✅ Proper depth sorting
- ✅ Natural, level appearance

---

## 10. Visual Examples

### Entity Rendering:
```
Top-Down View:          Isometric View (Natural):
   ●                      Shadow: (ellipse)
  /|\                   Entity: ● (circle, upright)
   |                    Position: isometric coords
```

### Map Rendering:
```
Top-Down:               Isometric:
┌─────┐                 /\
│     │                /  \
└─────┘               /____\
```

---

## 11. Testing Checklist

- [ ] Entities render at correct isometric positions
- [ ] Entities appear natural and upright (not rotated)
- [ ] Map renders correctly in isometric
- [ ] Depth sorting works (entities behind drawn first)
- [ ] Shadows appear in correct positions
- [ ] Camera follows player smoothly
- [ ] Movement feels natural
- [ ] All effects render correctly
- [ ] Performance is acceptable
- [ ] Visual clarity is good

---

## 12. Next Steps

1. **Immediate**: Fix test mode to make boxes visible
2. **Short-term**: Convert map rendering to isometric
3. **Medium-term**: Implement natural entity rendering with depth sorting
4. **Long-term**: Polish and optimize

---

## 13. Notes

- **No Sprite Rotation**: Entities remain upright in isometric space
- **Position Transformation**: Only positions are converted to isometric, not shapes
- **Natural Appearance**: Everything should look level and natural
- **Proper Depth**: Y coordinate determines drawing order
- **Consistent System**: All elements use the same isometric transformation
