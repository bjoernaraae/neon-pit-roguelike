# Isometric Testing & Implementation Plan

## Overview
Plan for implementing isometric view with depth mechanics (jumping, walls, obstacles). Includes testing with rectangular entities to visualize true isometric projection.

---

## 1. Fake vs Real Isometric

### 1.1 Fake/Pseudo-Isometric (Vampire Survivors style)
- **What it is**: 2D sprites drawn at an angle, but no true 3D projection
- **How it works**: 
  - Sprites are pre-rendered at isometric angles
  - No coordinate transformation math
  - Just visual style, not true perspective
- **Pros**: 
  - Simpler to implement
  - Better performance
  - Easier to create assets
- **Cons**: 
  - Limited depth mechanics
  - Can't easily add jumping/height mechanics
  - Less flexible for dynamic obstacles

### 1.2 Real Isometric (True 3D Projection)
- **What it is**: Mathematical projection of 3D world onto 2D screen
- **How it works**:
  - Coordinate transformation: `worldToIso(x, y, z)`
  - Depth sorting for correct layering
  - Z-axis for height (jumping, obstacles, walls)
- **Pros**:
  - True depth mechanics (jumping, walls, obstacles)
  - More flexible gameplay possibilities
  - Can add vertical gameplay elements
- **Cons**:
  - More complex math
  - Requires depth sorting
  - More rendering complexity

### 1.3 Recommendation
**Start with Real Isometric** for testing, then decide:
- If depth mechanics are important → Keep real isometric
- If just visual style → Can simplify to fake isometric later

---

## 2. Testing with Rectangular Entities

### 2.1 Why Rectangles?
- **Visual clarity**: 3 visible sides show true isometric projection
- **Depth perception**: Easy to see if projection is correct
- **Testing**: Can verify coordinate transformation works

### 2.2 Isometric Box (3 Visible Sides)
```
     Top Face (diamond shape)
    /\
   /  \
  /____\
  
  Left Side    Right Side
  (visible)    (visible)
```

### 2.3 Implementation
- Draw as isometric box with:
  - Top face (diamond/rhombus)
  - Left side (visible)
  - Right side (visible)
  - Bottom face (hidden or shadow)

---

## 3. Implementation Steps

### Phase 1: Test Mode (Current)
1. ✅ Add toggle flag for isometric test mode
2. ✅ Create `drawIsoBox()` function (3 visible sides)
3. ✅ Replace player/enemy circles with isometric boxes
4. ✅ Test coordinate transformation
5. ✅ Verify depth perception

### Phase 2: Full Isometric System
1. Implement proper `worldToIso()` with Z-axis support
2. Add depth sorting for all entities
3. Convert map rendering to isometric
4. Add shadows for depth
5. Test movement and camera

### Phase 3: Depth Mechanics
1. Add Z-axis to entities (height)
2. Implement jumping mechanics
3. Add wall/obstacle rendering with height
4. Collision detection for 3D space
5. Test jumping over obstacles

### Phase 4: Visual Polish
1. Add proper lighting/shading
2. Improve box rendering (textures, colors)
3. Add particle effects in isometric space
4. Optimize rendering performance

---

## 4. Technical Details

### 4.1 Isometric Box Drawing
```javascript
function drawIsoBox(ctx, worldX, worldY, width, height, depth, color) {
  const { x: isoX, y: isoY } = worldToIso(worldX, worldY);
  
  // Box dimensions in isometric space
  const isoW = width * ISO_SCALE;
  const isoH = height * ISO_SCALE;
  const isoD = depth * ISO_SCALE;
  
  // Top face (diamond)
  // Left face
  // Right face
  // With proper shading
}
```

### 4.2 Coordinate Transformation with Z
```javascript
function worldToIso(wx, wy, wz = 0) {
  const isoX = (wx - wy) * (ISO_TILE_WIDTH / 2) * ISO_SCALE;
  const isoY = (wx + wy) * (ISO_TILE_HEIGHT / 2) * ISO_SCALE - wz * ISO_SCALE;
  return { x: isoX, y: isoY };
}
```

### 4.3 Depth Sorting
```javascript
// Sort by Y position (back to front in isometric)
entities.sort((a, b) => {
  const depthA = a.y + (a.z || 0);
  const depthB = b.y + (b.z || 0);
  return depthA - depthB;
});
```

---

## 5. Testing Checklist

- [ ] Isometric boxes render correctly
- [ ] 3 visible sides show proper perspective
- [ ] Coordinate transformation is accurate
- [ ] Movement works correctly in isometric space
- [ ] Camera follows player correctly
- [ ] Depth sorting works (entities behind are drawn first)
- [ ] Shadows appear in correct positions
- [ ] Performance is acceptable

---

## 6. Future Possibilities

### 6.1 Gameplay Mechanics
- **Jumping**: Press space to jump over obstacles
- **Walls**: Walls with height that can be jumped over
- **Platforms**: Multi-level platforms
- **Elevation**: Different height levels

### 6.2 Visual Enhancements
- **Sprites**: Replace boxes with isometric sprites
- **Animations**: Walking, jumping animations
- **Lighting**: Dynamic lighting system
- **Shadows**: Real-time shadows

---

## 7. Decision Points

### When to use Fake Isometric:
- Visual style is more important than depth mechanics
- Performance is critical
- Simple gameplay (no jumping/height mechanics)
- Easier asset creation

### When to use Real Isometric:
- Need depth mechanics (jumping, walls, obstacles)
- Want vertical gameplay elements
- More complex level design
- Future-proof for advanced features
