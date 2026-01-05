# Visual Elements Plan: Meaningful Level Design

## Overview
Replace random decorative clutter with functional, meaningful elements that enhance gameplay and create interesting level design.

---

## Core Principles

1. **Function Over Form**: Every element should have a gameplay purpose
2. **Player Interaction**: Elements should affect player movement, strategy, or combat
3. **Visual Clarity**: Elements should be clearly distinguishable and readable
4. **Strategic Depth**: Elements should create interesting tactical choices

---

## 1. Platform Elements (Jumpable/Climbable)

### 1.1 Bricks/Platforms
**Purpose**: Create vertical gameplay, allow players to gain height advantage, create cover

**Types**:
- **Low Platform**: 1-2 units high, can be jumped onto
- **Medium Platform**: 2-3 units high, requires jump to reach
- **High Platform**: 3-4 units high, strategic high ground
- **Platform Bridge**: Connects two areas, creates pathways

**Properties**:
- Solid collision (player can stand on top)
- Can be jumped onto from sides
- Enemies can pathfind around them (or jump if they have that ability)
- Visual: Distinct from floor, clear edges

**Placement Rules**:
- Place near room entrances for tactical positioning
- Create "islands" in larger rooms for cover
- Connect separated areas
- Avoid blocking main pathways

**Implementation**:
```javascript
platforms: [
  {
    x, y, w, h, // Position and size
    type: "low" | "medium" | "high" | "bridge",
    z: 0, // Height (for jumping onto)
    solid: true, // Blocks movement from sides
    walkable: true // Can walk on top
  }
]
```

---

## 2. Environmental Hazards

### 2.1 Spike Traps
**Purpose**: Create danger zones, force movement, add risk/reward

**Types**:
- **Static Spikes**: Always dangerous
- **Timed Spikes**: Activate/deactivate on timer
- **Pressure Plate Spikes**: Activate when stepped on

**Properties**:
- Deal damage on contact
- Visual warning (red glow, animation)
- Can be avoided with jump
- Enemies also take damage

**Placement**:
- Near treasure/valuable areas (risk/reward)
- Create chokepoints
- Guard important locations

### 2.2 Fire Pits
**Purpose**: Area denial, environmental damage

**Properties**:
- Continuous damage while standing in area
- Visual fire effect
- Can be jumped over
- Enemies avoid or take damage

### 2.3 Poison Pools
**Purpose**: Slow movement, DoT damage

**Properties**:
- Slows player movement
- Applies poison DoT
- Visual: Green/purple liquid
- Can be jumped over

---

## 3. Interactive Elements

### 3.1 Destructible Crates/Barrels
**Purpose**: Temporary cover, rewards for destruction

**Properties**:
- Can be destroyed by player attacks
- Blocks enemy projectiles while intact
- Drops coins/XP when destroyed
- Visual feedback on destruction

**Types**:
- **Wooden Crate**: Low HP, common drops
- **Metal Barrel**: Higher HP, better drops
- **Explosive Barrel**: Explodes on destruction, AoE damage

### 3.2 Breakable Walls
**Purpose**: Hidden areas, alternative paths

**Properties**:
- Can be destroyed to reveal new areas
- Visual: Cracked appearance
- Requires multiple hits
- May hide secrets/treasure

### 3.3 Pressure Plates
**Purpose**: Activate mechanisms, open doors

**Properties**:
- Player/enemy weight activates
- Opens doors, reveals paths
- Can be used strategically

---

## 4. Cover Elements

### 4.1 Pillars/Columns
**Purpose**: Cover from projectiles, line of sight blocking

**Properties**:
- Blocks bullets/projectiles
- Blocks line of sight
- Can be used for cover
- Enemies pathfind around them

**Placement**:
- Strategic positions in rooms
- Create cover opportunities
- Break up open spaces

### 4.2 Walls/Barriers
**Purpose**: Create cover, define spaces

**Properties**:
- Partial height (can shoot over)
- Blocks movement
- Blocks line of sight
- Can be jumped over (if low enough)

---

## 5. Environmental Variety

### 5.1 Grass Types (Functional)
**Purpose**: Visual variety with subtle gameplay effects

**Types**:
- **Normal Grass**: Pure visual, no effect
- **Tall Grass**: Slows movement slightly, provides concealment
- **Thorny Grass**: Deals small damage when walked through
- **Healing Grass**: Restores small HP over time when standing in it

**Visual Distinction**:
- Different colors/textures
- Clear visual indicators for functional types
- Animation for special types

### 5.2 Floor Types
**Purpose**: Visual variety, subtle gameplay effects

**Types**:
- **Normal Floor**: Standard movement
- **Mud**: Slows movement
- **Ice**: Reduces friction, faster movement but harder to control
- **Stone**: Normal movement, more durable
- **Sand**: Slightly slower movement

---

## 6. Strategic Elements

### 6.1 Elevation Changes
**Purpose**: Create vertical gameplay, tactical positioning

**Types**:
- **Ramps**: Gradual elevation change
- **Stairs**: Step-based elevation
- **Cliffs**: Sharp elevation change (requires jump)

**Properties**:
- Affects line of sight
- Higher ground advantage
- Enemies must pathfind around or jump

### 6.2 Chokepoints
**Purpose**: Force tactical decisions

**Created by**:
- Narrow passages between platforms
- Doorways
- Gaps between hazards
- Strategic platform placement

---

## 7. Implementation Priority

### Phase 1: Core Functional Elements (High Priority)
1. **Platforms/Bricks** (jumpable)
   - Low and medium platforms
   - Collision detection
   - Enemy pathfinding around them
   - Visual clarity

2. **Pillars/Columns** (cover)
   - Block projectiles
   - Block line of sight
   - Strategic placement

3. **Destructible Crates**
   - Can be destroyed
   - Drop rewards
   - Provide temporary cover

### Phase 2: Environmental Variety (Medium Priority)
4. **Grass Types** (functional)
   - Tall grass (slows movement)
   - Visual distinction

5. **Floor Types**
   - Mud (slows)
   - Ice (slippery)
   - Visual variety

### Phase 3: Advanced Elements (Lower Priority)
6. **Hazards**
   - Spike traps
   - Fire pits
   - Poison pools

7. **Interactive Elements**
   - Pressure plates
   - Breakable walls
   - Elevation changes

---

## 8. Technical Implementation

### 8.1 Data Structure
```javascript
levelElements: {
  platforms: [], // Jumpable platforms
  cover: [], // Pillars, walls (block projectiles)
  destructibles: [], // Crates, barrels
  hazards: [], // Spikes, fire, poison
  interactive: [], // Pressure plates, switches
  environment: [] // Grass types, floor types
}
```

### 8.2 Collision System
- **Platforms**: Solid top surface, can jump onto
- **Cover**: Blocks projectiles and line of sight
- **Hazards**: Damage on contact
- **Environment**: Affects movement speed

### 8.3 Pathfinding Integration
- Enemies must pathfind around solid elements
- Consider platforms as obstacles
- Account for jumpable elements

### 8.4 Visual Rendering
- Clear visual distinction between element types
- Height/depth visualization
- Functional indicators (e.g., spike glow)
- Consistent art style

---

## 9. Placement Rules

### 9.1 Platform Placement
- **Room Entrances**: 1-2 platforms for tactical positioning
- **Large Rooms**: Create "islands" of 2-3 platforms
- **Connections**: Platforms bridging separated areas
- **Cover**: Platforms near walls for cover opportunities

### 9.2 Cover Placement
- **Strategic Positions**: Near room centers, entrances
- **Spacing**: Not too dense (allow movement)
- **Variety**: Mix of sizes and positions

### 9.3 Destructible Placement
- **Near Combat Areas**: Provide temporary cover
- **Reward Locations**: Near valuable areas
- **Pathways**: Can be destroyed to open new routes

### 9.4 Hazard Placement
- **Risk/Reward**: Near valuable items/areas
- **Chokepoints**: Force tactical decisions
- **Avoidance**: Always provide alternative paths

---

## 10. Visual Design Guidelines

### 10.1 Clarity
- **Distinct Colors**: Each element type has unique color
- **Clear Edges**: Platforms have visible borders
- **Height Indicators**: Visual cues for jumpable height
- **Functional Indicators**: Hazards glow/warn

### 10.2 Consistency
- **Art Style**: Consistent with game aesthetic
- **Size Consistency**: Similar elements same size
- **Color Coding**: Functional types have color coding

### 10.3 Feedback
- **Destruction**: Clear visual/audio feedback
- **Interaction**: Visual response to player actions
- **Hazards**: Clear warning before danger

---

## 11. Gameplay Integration

### 11.1 Player Mechanics
- **Jumping**: Can jump onto platforms
- **Cover**: Can use pillars/walls for cover
- **Destruction**: Can break destructibles
- **Movement**: Affected by floor types

### 11.2 Enemy AI
- **Pathfinding**: Navigate around solid elements
- **Cover Usage**: Enemies can use cover
- **Hazard Avoidance**: Enemies avoid or take damage from hazards
- **Platform Navigation**: Enemies can jump onto platforms (if capable)

### 11.3 Combat Impact
- **Line of Sight**: Cover blocks LOS
- **Projectile Blocking**: Cover blocks bullets
- **Positioning**: Platforms create height advantage
- **Area Denial**: Hazards control space

---

## 12. Success Metrics

- **Gameplay Depth**: Elements create interesting tactical choices
- **Visual Clarity**: Players can easily identify element types
- **Functional Purpose**: Every element serves a gameplay purpose
- **Strategic Variety**: Different room layouts feel unique
- **Player Engagement**: Elements enhance rather than clutter gameplay

---

## 13. Example Room Layouts

### 13.1 Combat Arena
- 2-3 platforms in center for height advantage
- Pillars around edges for cover
- Destructible crates for temporary cover
- Open floor for movement

### 13.2 Chokepoint Room
- Narrow passage with platforms on sides
- Spike traps in center
- Cover elements on sides
- Forces tactical approach

### 13.3 Treasure Room
- Platforms creating path to treasure
- Hazards guarding valuable items
- Destructible walls hiding secrets
- Risk/reward positioning

---

## 14. Future Enhancements

- **Moving Platforms**: Platforms that move on tracks
- **Elevators**: Vertical transportation
- **Teleporters**: Instant movement between points
- **Environmental Puzzles**: Elements that require interaction to progress
- **Dynamic Elements**: Elements that change state during combat

---

## Notes

- Start with platforms and cover (most impactful)
- Test each element type for gameplay value
- Remove elements that don't enhance gameplay
- Iterate based on player feedback
- Keep visual style consistent and clear
