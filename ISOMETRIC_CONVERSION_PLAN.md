# Isometric Conversion Plan

## Overview
Convert the game from top-down 2D to isometric view (like Vampire Survivors). This involves changing the rendering system, coordinate transformations, and visual style.

---

## 1. Understanding Isometric Projection

### Current System:
- **Top-down view**: X/Y coordinates map directly to screen
- **Simple rendering**: `ctx.fillRect(x, y, w, h)` or `ctx.arc(x, y, r)`

### Isometric System:
- **2.5D view**: 3D world projected onto 2D screen
- **Coordinate transformation**: World (x, y) → Screen (isoX, isoY)
- **Depth sorting**: Objects further back are drawn first

### Isometric Math:
```javascript
// World to Screen (Isometric)
function worldToIso(worldX, worldY) {
  const isoX = (worldX - worldY) * tileWidth / 2;
  const isoY = (worldX + worldY) * tileHeight / 2;
  return { x: isoX, y: isoY };
}

// Screen to World (Reverse)
function isoToWorld(screenX, screenY) {
  const worldX = (screenX / (tileWidth / 2) + screenY / (tileHeight / 2)) / 2;
  const worldY = (screenY / (tileHeight / 2) - screenX / (tileWidth / 2)) / 2;
  return { x: worldX, y: worldY };
}
```

---

## 2. Visual Style Changes

### 2.1 Current Style
- Circles for entities (player, enemies)
- Rectangles for rooms/walls
- Simple flat colors

### 2.2 Isometric Style
- **Sprites**: 2D sprites drawn at isometric angles
- **Shadows**: Ground shadows for depth
- **Layering**: Multiple layers (ground, walls, entities, effects)
- **Perspective**: Objects appear to have height/depth

### 2.3 Sprite Approach Options

#### Option A: Procedural Isometric Sprites (Recommended)
- Generate isometric shapes programmatically
- Use canvas transformations to draw at angles
- Pros: No external assets needed, flexible
- Cons: More complex drawing code

#### Option B: Pre-rendered Sprites
- Create sprite sheets for entities
- Load and draw sprites
- Pros: Better visuals, easier to style
- Cons: Requires asset creation, file loading

#### Option C: Hybrid
- Procedural for simple shapes (bullets, particles)
- Sprites for complex entities (player, enemies)
- Best of both worlds

**Recommendation: Option A (Procedural) for MVP, can upgrade to sprites later**

---

## 3. Coordinate System Changes

### 3.1 World Coordinates (Unchanged)
- Game logic still uses world (x, y)
- Collision detection unchanged
- Movement unchanged
- Only rendering changes

### 3.2 Screen Coordinates (New)
- Isometric projection for rendering
- Depth sorting for correct layering
- Camera follows player in isometric space

### 3.3 Depth Sorting
```javascript
// Sort entities by Y position (back to front)
entities.sort((a, b) => {
  // In isometric, higher Y = further back
  return (a.y + a.r) - (b.y + b.r);
});
```

---

## 4. Rendering Pipeline Changes

### 4.1 Current Pipeline
1. Clear canvas
2. Apply camera transform
3. Draw background
4. Draw map (rooms, corridors)
5. Draw entities (enemies, player)
6. Draw effects (particles, bullets)

### 4.2 New Isometric Pipeline
1. Clear canvas
2. Apply camera transform (isometric)
3. **Sort all drawable objects by depth (Y position)**
4. Draw ground layer (map background)
5. Draw walls/obstacles
6. Draw entities (sorted by depth)
7. Draw effects (particles, bullets)
8. Draw UI overlay (unchanged)

### 4.3 Drawing Order
```javascript
// Sort everything by Y position
const drawables = [
  ...enemies.map(e => ({ type: 'enemy', y: e.y, draw: () => drawEnemyIso(e) })),
  { type: 'player', y: player.y, draw: () => drawPlayerIso(player) },
  ...bullets.map(b => ({ type: 'bullet', y: b.y, draw: () => drawBulletIso(b) }))
];

drawables.sort((a, b) => a.y - b.y);
drawables.forEach(item => item.draw());
```

---

## 5. Entity Rendering

### 5.1 Player Rendering
```javascript
function drawPlayerIso(ctx, player) {
  const { isoX, isoY } = worldToIso(player.x, player.y);
  
  // Draw shadow first (on ground)
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(isoX, isoY + player.r, player.r * 1.2, player.r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw player body (isometric circle/cylinder)
  ctx.fillStyle = player.color;
  ctx.beginPath();
  // Draw as isometric ellipse (wider than tall)
  ctx.ellipse(isoX, isoY - player.r * 0.3, player.r, player.r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw highlight for 3D effect
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(isoX - player.r * 0.3, isoY - player.r * 0.5, player.r * 0.5, player.r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
}
```

### 5.2 Enemy Rendering
- Similar to player but with enemy-specific colors
- Add visual variety (different shapes for different enemy types)
- Elite enemies can have glow effects

### 5.3 Bullet/Projectile Rendering
- Draw as isometric circles or sprites
- Trail effects work the same
- Rotation might need adjustment

---

## 6. Map Rendering

### 6.1 Ground/Room Rendering
```javascript
function drawRoomIso(ctx, room) {
  // Draw room as isometric rectangle
  const corners = [
    worldToIso(room.x, room.y),
    worldToIso(room.x + room.w, room.y),
    worldToIso(room.x + room.w, room.y + room.h),
    worldToIso(room.x, room.y + room.h)
  ];
  
  // Draw floor
  ctx.fillStyle = roomColor;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  ctx.lineTo(corners[1].x, corners[1].y);
  ctx.lineTo(corners[2].x, corners[2].y);
  ctx.lineTo(corners[3].x, corners[3].y);
  ctx.closePath();
  ctx.fill();
  
  // Draw walls (if needed)
  // Draw borders
}
```

### 6.2 Wall Rendering
- Walls can be drawn as isometric rectangles
- Add height/depth for 3D effect
- Shadows for depth perception

---

## 7. Camera System

### 7.1 Current Camera
- Simple translation: `ctx.translate(-cam.x, -cam.y)`
- Follows player directly

### 7.2 Isometric Camera
- Same translation, but in isometric space
- Camera position in world coordinates
- Convert to isometric for rendering

```javascript
// Camera follows player in world space
camera.x = player.x;
camera.y = player.y;

// When rendering, convert camera position to isometric
const camIso = worldToIso(camera.x, camera.y);
ctx.translate(-camIso.x + screenW/2, -camIso.y + screenH/2);
```

---

## 8. UI Elements

### 8.1 HUD (Unchanged)
- HP, XP, Gold bars stay the same
- Minimap might need isometric view
- Ability hotbar unchanged

### 8.2 Minimap
- Option A: Keep top-down view (simpler)
- Option B: Convert to isometric view (more consistent)
- **Recommendation: Keep top-down for clarity**

### 8.3 Combat Text
- Position in isometric space
- Float up and fade out (same as now)

---

## 9. Movement & Controls

### 9.1 Movement (Unchanged)
- WASD movement in world coordinates
- No changes to movement logic
- Only visual representation changes

### 9.2 Visual Feedback
- Movement direction more visible in isometric
- Can add directional sprites/animations
- Rotation might be more noticeable

---

## 10. Performance Considerations

### 10.1 Depth Sorting
- Sort entities every frame (O(n log n))
- Can optimize with spatial partitioning
- For <100 entities, performance is fine

### 10.2 Coordinate Transformations
- World-to-iso conversion every frame
- Cache transformations when possible
- Use lookup tables for common positions

### 10.3 Rendering Optimization
- Batch similar draw calls
- Use sprite sheets if using sprites
- Cull off-screen objects

---

## 11. Implementation Steps

### Phase 1: Core Isometric System
1. ✅ Create `worldToIso()` and `isoToWorld()` functions
2. ✅ Update camera system for isometric
3. ✅ Convert player rendering to isometric
4. ✅ Test basic movement and camera

### Phase 2: Entity Rendering
5. ✅ Convert enemy rendering to isometric
6. ✅ Convert bullet/projectile rendering
7. ✅ Add depth sorting for entities
8. ✅ Add shadows for depth

### Phase 3: Map Rendering
9. ✅ Convert room/corridor rendering to isometric
10. ✅ Add wall rendering (if needed)
11. ✅ Update ground textures
12. ✅ Add visual polish (shadows, highlights)

### Phase 4: Effects & Polish
13. ✅ Convert particle effects to isometric
14. ✅ Update combat text positioning
15. ✅ Add visual effects (glows, auras)
16. ✅ Performance optimization

### Phase 5: Testing & Refinement
17. ✅ Test all game mechanics
18. ✅ Adjust visual style
19. ✅ Optimize performance
20. ✅ Player testing and feedback

---

## 12. Technical Implementation

### 12.1 Isometric Constants
```javascript
const ISO_TILE_WIDTH = 64;  // Width of isometric tile
const ISO_TILE_HEIGHT = 32; // Height of isometric tile
const ISO_SCALE = 1.0;      // Overall scale factor
```

### 12.2 Core Functions
```javascript
// World to Isometric Screen
function worldToIso(wx, wy) {
  const isoX = (wx - wy) * (ISO_TILE_WIDTH / 2) * ISO_SCALE;
  const isoY = (wx + wy) * (ISO_TILE_HEIGHT / 2) * ISO_SCALE;
  return { x: isoX, y: isoY };
}

// Isometric Screen to World
function isoToWorld(isoX, isoY) {
  const wx = (isoX / (ISO_TILE_WIDTH / 2) + isoY / (ISO_TILE_HEIGHT / 2)) / 2;
  const wy = (isoY / (ISO_TILE_HEIGHT / 2) - isoX / (ISO_TILE_WIDTH / 2)) / 2;
  return { x: wx, y: wy };
}

// Get depth for sorting (higher Y = further back)
function getDepth(x, y) {
  return y; // Simple: use Y coordinate
}
```

### 12.3 Drawing Helpers
```javascript
// Draw isometric circle (ellipse)
function drawIsoCircle(ctx, worldX, worldY, radius, color) {
  const { x: isoX, y: isoY } = worldToIso(worldX, worldY);
  ctx.fillStyle = color;
  ctx.beginPath();
  // Ellipse: wider than tall for isometric effect
  ctx.ellipse(isoX, isoY, radius, radius * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Draw shadow
function drawShadow(ctx, worldX, worldY, radius) {
  const { x: isoX, y: isoY } = worldToIso(worldX, worldY);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(isoX, isoY + radius * 0.5, radius * 1.2, radius * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
}
```

---

## 13. Visual Style Guide

### 13.1 Color Scheme
- Keep current color scheme
- Add depth with shadows and highlights
- Use gradients for 3D effect

### 13.2 Entity Design
- **Player**: Cylinder/ellipse with highlight
- **Enemies**: Similar but with enemy colors
- **Elites**: Add glow/shadow effects
- **Boss**: Larger, more detailed

### 13.3 Map Design
- **Ground**: Flat isometric tiles
- **Walls**: Optional, can be just borders
- **Decorations**: Rocks, grass as isometric sprites

---

## 14. Challenges & Solutions

### Challenge 1: Depth Sorting Performance
**Solution**: Only sort when entities move significantly, use spatial partitioning

### Challenge 2: Coordinate Confusion
**Solution**: Keep world coordinates for logic, only convert for rendering

### Challenge 3: Visual Clarity
**Solution**: Add shadows, outlines, and clear depth cues

### Challenge 4: Minimap Consistency
**Solution**: Keep minimap top-down for clarity, or add toggle

---

## 15. Testing Checklist

- [ ] Player renders correctly in isometric
- [ ] Enemies render correctly and are sorted by depth
- [ ] Bullets/projectiles work correctly
- [ ] Map renders correctly
- [ ] Camera follows player smoothly
- [ ] Movement feels natural
- [ ] Collision detection still works
- [ ] UI elements are positioned correctly
- [ ] Performance is acceptable
- [ ] Visual style is consistent

---

## 16. Future Enhancements

- **Sprite Support**: Load and use sprite sheets
- **Animations**: Add walking/running animations
- **3D Effects**: More advanced lighting and shadows
- **Parallax**: Background layers with parallax scrolling
- **Particle Effects**: Isometric particle systems
- **Tile System**: Proper isometric tile-based map

---

## 17. Recommendation

**Start with Phase 1 (Core System)**
- Implement basic isometric transformation
- Convert player rendering
- Test camera and movement
- If it feels good, continue to Phase 2
- If not, can easily revert or adjust

**Key Success Factors:**
1. Keep game logic unchanged (world coordinates)
2. Only change rendering layer
3. Test frequently during conversion
4. Maintain performance
