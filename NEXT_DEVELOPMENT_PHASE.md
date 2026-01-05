# Next Development Phase Plan

## Overview
This plan outlines the next set of features and improvements to enhance gameplay, content, and polish for Neon Pit Roguelike.

---

## Current Status Summary

### ✅ Completed Systems
- **Procedural Level Generation**: Fixed map size, room generation, corridors
- **Pathfinding**: 8-directional flow field with stuck detection
- **Line of Sight**: LOS checks for shooting and enemy behavior
- **Core Combat**: Weapons, tomes, items, character system
- **Enemy AI**: Pathfinding, movement, shooting
- **Boss System**: Boss fights with enrage mechanics
- **Progression**: Leveling, XP, floor progression
- **Isometric View**: Basic isometric rendering (testing phase)

---

## Phase 4: Content Expansion & Gameplay Polish

### Priority 1: Gameplay Balance & Polish

#### 4.1 Enemy Variety & Behavior
**Goal**: More diverse enemy types with unique behaviors

**Tasks**:
- [ ] **Elite Enemy Variants**: Create elite versions of existing enemies with special abilities
  - Elite Runner: Faster, leaves trail of damage
  - Elite Spitter: Shoots 3 projectiles in spread pattern
  - Elite Tank: Slower but much tankier, charges at player
  
- [ ] **New Enemy Types**:
  - **Charger**: Fast enemy that charges in straight line, then pauses
  - **Teleporter**: Teleports near player periodically
  - **Shielder**: Protects nearby enemies, takes reduced damage
  - **Exploder**: Explodes on death, dealing AoE damage
  
- [ ] **Enemy Spawn Patterns**:
  - Wave-based spawning for certain rooms
  - Ambush spawns when entering new areas
  - Elite enemy spawns based on floor progression

#### 4.2 Weapon Balance & New Weapons
**Goal**: Ensure all weapons feel viable and add more variety

**Tasks**:
- [ ] **Balance Pass**: Review all weapons for damage/cooldown balance
- [ ] **New Weapon Ideas**:
  - **Crossbow**: Slower but higher damage, pierces enemies
  - **Throwing Knives**: Fast, low damage, high projectile count
  - **Chain Lightning**: Bounces between enemies
  - **Orbiting Weapons**: Weapons that orbit player
  - **Summon**: Temporary minions that fight for player
  
- [ ] **Weapon Synergies**: 
  - Some weapons work better together
  - Display synergy hints in UI

#### 4.3 Tome & Item Expansion
**Goal**: More build variety through tomes and items

**Tasks**:
- [ ] **New Tomes**:
  - **Berserker Tome**: Lower HP = more damage
  - **Vampire Tome**: Lifesteal on damage dealt
  - **Shield Tome**: Temporary invincibility after taking damage
  - **Crit Master Tome**: Higher crit chance and crit damage
  
- [ ] **New Items**:
  - **Lucky Coin**: Chance to double coin drops
  - **Experience Orb**: Increased XP gain
  - **Speed Boots**: Permanent movement speed increase
  - **Damage Reflect**: Reflect portion of damage back to attackers

#### 4.4 Difficulty Scaling
**Goal**: Better difficulty progression across floors

**Tasks**:
- [ ] **Enemy Scaling**: 
  - HP scaling per floor (current + improvements)
  - Damage scaling per floor
  - Spawn rate scaling
  
- [ ] **Difficulty Curves**:
  - Early floors: Learning curve
  - Mid floors: Steady challenge
  - Late floors: High difficulty spike
  
- [ ] **Adaptive Difficulty**:
  - Adjust based on player performance
  - Optional difficulty settings

---

### Priority 2: Visual & Audio Improvements

#### 4.5 Visual Polish
**Goal**: Make the game look more polished and professional

**Tasks**:
- [ ] **Particle Effects**:
  - Better hit effects
  - Weapon-specific visual effects
  - Death animations for enemies
  
- [ ] **UI Improvements**:
  - Better loot card design
  - Animated UI elements
  - Health bar improvements
  - Mini-map for level navigation
  
- [ ] **Visual Feedback**:
  - Screen shake improvements
  - Hit stop on big hits
  - Visual indicators for buffs/debuffs
  - Damage number improvements

#### 4.6 Audio Enhancement
**Goal**: Better audio experience

**Tasks**:
- [ ] **Sound Effects**:
  - More weapon sound variants
  - Enemy death sounds
  - Ambient room sounds
  - Footstep sounds (optional)
  
- [ ] **Music**:
  - Different music for different floors
  - Boss fight music
  - Intensity-based music changes

---

### Priority 3: New Features & Mechanics

#### 4.7 Room Variety & Special Rooms
**Goal**: More interesting level generation

**Tasks**:
- [ ] **Room Types**:
  - **Arena Room**: Large open room with waves of enemies
  - **Puzzle Room**: Room with mechanics to solve
  - **Treasure Vault**: High-value loot, but guarded
  - **Challenge Room**: Optional difficult room with rewards
  
- [ ] **Room Events**:
  - Random events in rooms (temporary buffs/debuffs)
  - Environmental hazards (spikes, fire, etc.)
  - Moving platforms or obstacles

#### 4.8 Character Progression
**Goal**: More character variety and progression

**Tasks**:
- [ ] **New Characters**:
  - Each with unique starting weapon and stats
  - Character-specific abilities
  - Unlock system for new characters
  
- [ ] **Character Upgrades**:
  - Permanent upgrades between runs
  - Character-specific upgrade trees
  - Prestige system (optional)

#### 4.9 Meta Progression
**Goal**: Long-term progression system

**Tasks**:
- [ ] **Unlock System**:
  - Unlock new weapons by using them
  - Unlock new tomes/items by finding them
  - Achievement system
  
- [ ] **Statistics**:
  - Track player stats (deaths, kills, floors reached)
  - Best run statistics
  - Weapon usage statistics

---

### Priority 4: Quality of Life & Polish

#### 4.10 Quality of Life
**Goal**: Better player experience

**Tasks**:
- [ ] **Settings Menu**:
  - Graphics options
  - Audio sliders
  - Control rebinding
  - Accessibility options
  
- [ ] **Pause Menu**:
  - Full pause functionality
  - Settings access during pause
  - Quit to menu option
  
- [ ] **Save System**:
  - Save progress between floors
  - Resume run option
  - Multiple save slots

#### 4.11 Tutorial & Onboarding
**Goal**: Help new players learn the game

**Tasks**:
- [ ] **Tutorial System**:
  - First-time player tutorial
  - Tooltips for game mechanics
  - Help menu with game rules
  
- [ ] **Visual Indicators**:
  - Show what stats do
  - Explain weapon mechanics
  - Display synergy information

#### 4.12 Performance & Optimization
**Goal**: Ensure smooth gameplay

**Tasks**:
- [ ] **Performance**:
  - Optimize particle systems
  - Reduce unnecessary calculations
  - Better enemy culling (off-screen enemies)
  
- [ ] **Memory Management**:
  - Clean up unused resources
  - Optimize asset loading
  - Reduce memory leaks

---

## Phase 5: Advanced Features (Future)

### 5.1 Advanced Combat
- Combo system
- Parry/block mechanics
- Status effect system expansion

### 5.2 Multiplayer (Optional)
- Co-op mode
- Leaderboards
- Shared progression

### 5.3 Advanced Level Generation
- Procedural room events
- Dynamic room generation based on player level
- Secret rooms and hidden areas

### 5.4 Endgame Content
- Infinite mode
- Daily challenges
- Boss rush mode
- Special challenge floors

---

## Implementation Priority

### Immediate (Next 1-2 weeks)
1. Enemy variety expansion (new enemy types)
2. Weapon balance pass
3. Visual polish (particles, effects)
4. Quality of life improvements (pause, settings)

### Short-term (Next month)
1. New weapons and items
2. Room variety and special rooms
3. Character progression system
4. Audio improvements

### Medium-term (Next 2-3 months)
1. Meta progression system
2. Tutorial and onboarding
3. Performance optimization
4. Advanced features

---

## Success Metrics

- **Gameplay**: All weapons feel viable, enemies are challenging but fair
- **Content**: 15+ weapons, 10+ tomes, 10+ items, 5+ characters
- **Polish**: Smooth 60fps, good visual feedback, clear UI
- **Engagement**: Players want to replay, try different builds
- **Balance**: No single strategy dominates, multiple viable builds

---

## Notes

- Focus on making existing systems feel great before adding new ones
- Balance is iterative - test and adjust frequently
- Player feedback is crucial for determining priorities
- Keep performance in mind with all new features
