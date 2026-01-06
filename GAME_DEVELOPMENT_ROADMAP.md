# Neon Pit Roguelike - Development Roadmap

## 🎯 Current Status (Updated)

### ✅ Recently Completed
- **Optimized Flow Field Pathfinding**: Gradient-based system with wall influence, smooth sub-tile steering
- **Corner Prevention**: Enemies no longer get stuck at corners
- **BSP Dungeon Generation**: Procedural rooms and corridors
- **Line of Sight System**: Enemies use LOS for combat decisions
- **Core Combat Loop**: Weapons, tomes, items, progression

### 🎮 Core Systems Status
- ✅ Procedural level generation (BSP)
- ✅ Flow field pathfinding (optimized)
- ✅ Enemy AI and movement
- ✅ Combat system (weapons, projectiles)
- ✅ Progression (XP, leveling, floors)
- ✅ Boss system
- ⚠️ Isometric rendering (in progress/testing)
- ⚠️ Visual polish (needs improvement)

---

## 📋 Development Phases

## Phase 1: Immediate Polish & Balance (Next 1-2 Weeks)

### 1.1 Visual Polish & Feedback
**Priority: High** - Makes the game feel more polished

- [ ] **Enhanced Particle Effects**
  - Weapon-specific impact effects (fire, ice, lightning)
  - Better death animations for enemies
  - Hit spark improvements
  - Trail effects for fast projectiles
  
- [ ] **UI Improvements**
  - Animated health bars
  - Better loot card design with hover effects
  - Damage number improvements (floating, color-coded)
  - Visual buff/debuff indicators
  - Mini-map for level navigation
  
- [ ] **Screen Effects**
  - Improved screen shake (weapon-specific intensity)
  - Hit stop on critical hits
  - Flash effects for damage
  - Screen edge indicators for off-screen enemies

### 1.2 Gameplay Balance
**Priority: High** - Ensures all weapons/builds are viable

- [ ] **Weapon Balance Pass**
  - Review damage/cooldown ratios
  - Ensure no weapon is overpowered/underpowered
  - Test all weapon combinations
  - Adjust projectile speeds and ranges
  
- [ ] **Enemy Balance**
  - Review enemy HP/damage scaling per floor
  - Ensure difficulty curve feels fair
  - Test enemy spawn rates
  - Balance elite enemy variants

### 1.3 Quality of Life
**Priority: Medium** - Improves player experience

- [ ] **Pause System**
  - Full pause functionality (ESC key)
  - Pause menu with settings access
  - Resume/Quit options
  
- [ ] **Settings Menu**
  - Graphics options (particle count, effects quality)
  - Audio sliders (master, music, SFX)
  - Control rebinding
  - Accessibility options (colorblind mode, etc.)

---

## Phase 2: Content Expansion (Next 2-4 Weeks)

### 2.1 Enemy Variety
**Priority: High** - Adds gameplay variety

- [ ] **New Enemy Types**
  - **Charger**: Fast enemy that charges in straight line, then pauses to recover
  - **Teleporter**: Teleports near player every few seconds, short-range attacks
  - **Shielder**: Protects nearby enemies, takes reduced damage, slower movement
  - **Exploder**: Low HP, explodes on death dealing AoE damage
  - **Splitter**: Splits into smaller enemies when killed
  
- [ ] **Elite Variants**
  - Elite versions of existing enemies with:
    - Higher HP/damage
    - Special abilities (trails, multi-shot, etc.)
    - Visual distinction (glow, size, color)
    - Better loot drops

- [ ] **Enemy Spawn Patterns**
  - Wave-based spawning for arena rooms
  - Ambush spawns when entering new areas
  - Elite spawns based on floor progression
  - Boss minion spawns

### 2.2 Weapon Expansion
**Priority: High** - More build variety

- [ ] **New Weapons**
  - **Crossbow**: Slower fire rate, high damage, pierces enemies
  - **Throwing Knives**: Fast, low damage, high projectile count
  - **Chain Lightning**: Bounces between enemies
  - **Orbiting Weapons**: Weapons that orbit player, auto-attack nearby enemies
  - **Summon**: Temporary minions that fight for player
  - **Beam Weapon**: Continuous beam that damages enemies
  - **Grenade Launcher**: Explosive projectiles with AoE
  
- [ ] **Weapon Synergies**
  - Some weapons work better together
  - Display synergy hints in UI
  - Bonus effects when using compatible weapons

### 2.3 Tome & Item Expansion
**Priority: Medium** - More build variety

- [ ] **New Tomes**
  - **Berserker Tome**: Lower HP = more damage (risk/reward)
  - **Vampire Tome**: Lifesteal on damage dealt
  - **Shield Tome**: Temporary invincibility after taking damage
  - **Crit Master Tome**: Higher crit chance and crit damage
  - **Elemental Tome**: Adds elemental effects to attacks
  - **Speed Demon Tome**: Movement speed = damage bonus
  
- [ ] **New Items**
  - **Lucky Coin**: Chance to double coin drops
  - **Experience Orb**: Increased XP gain
  - **Speed Boots**: Permanent movement speed increase
  - **Damage Reflect**: Reflect portion of damage back to attackers
  - **Magnet**: Pulls coins/items toward player
  - **Shield Generator**: Temporary shield on low HP

---

## Phase 3: Level Design & Variety (Next 3-5 Weeks)

### 3.1 Room Variety
**Priority: Medium** - More interesting levels

- [ ] **Special Room Types**
  - **Arena Room**: Large open room with waves of enemies, good loot
  - **Treasure Vault**: High-value loot, heavily guarded
  - **Challenge Room**: Optional difficult room with unique rewards
  - **Puzzle Room**: Room with mechanics to solve (pressure plates, switches)
  - **Boss Room**: Special large room for boss fights
  - **Secret Room**: Hidden rooms with rare loot
  
- [ ] **Room Events**
  - Random events in rooms (temporary buffs/debuffs)
  - Environmental hazards (spikes, fire, poison zones)
  - Moving platforms or obstacles
  - Time-limited challenges

### 3.2 Level Generation Improvements
**Priority: Medium** - Better procedural generation

- [ ] **Room Placement Logic**
  - Better room distribution
  - Dead-end rooms for treasure
  - Multiple paths to objectives
  - Room clustering by type
  
- [ ] **Corridor Improvements**
  - Wider corridors for better navigation
  - Corridor rooms at intersections
  - Varied corridor widths
  - Decorative elements in corridors

### 3.3 Environmental Elements
**Priority: Low** - Adds visual interest and gameplay

- [ ] **Platforms & Jumping**
  - Jumpable platforms for vertical gameplay
  - High ground advantages
  - Platform bridges
  
- [ ] **Hazards**
  - Spike traps (static and timed)
  - Fire zones
  - Poison clouds
  - Moving hazards

---

## Phase 4: Progression & Meta Systems (Next 4-6 Weeks)

### 4.1 Character System
**Priority: Medium** - More replayability

- [ ] **Multiple Characters**
  - Each with unique starting weapon and stats
  - Character-specific abilities
  - Unlock system for new characters
  - Character selection screen
  
- [ ] **Character Upgrades**
  - Permanent upgrades between runs
  - Character-specific upgrade trees
  - Unlock new starting weapons/items

### 4.2 Meta Progression
**Priority: Medium** - Long-term engagement

- [ ] **Unlock System**
  - Unlock new weapons by using them X times
  - Unlock new tomes/items by finding them
  - Achievement system
  - Unlock requirements visible in UI
  
- [ ] **Statistics & Tracking**
  - Track player stats (deaths, kills, floors reached)
  - Best run statistics
  - Weapon usage statistics
  - Death screen with run summary

### 4.3 Save System
**Priority: Low** - Quality of life

- [ ] **Save Between Floors**
  - Save progress between floors
  - Resume run option
  - Multiple save slots
  - Save/load UI

---

## Phase 5: Advanced Features (Future)

### 5.1 Advanced Combat
- [ ] Combo system (chaining attacks)
- [ ] Parry/block mechanics
- [ ] Status effect system expansion
- [ ] Weapon mastery system

### 5.2 Endgame Content
- [ ] Infinite mode (endless floors)
- [ ] Daily challenges
- [ ] Boss rush mode
- [ ] Special challenge floors
- [ ] Leaderboards

### 5.3 Audio Enhancement
- [ ] More weapon sound variants
- [ ] Enemy death sounds
- [ ] Ambient room sounds
- [ ] Different music for different floors
- [ ] Boss fight music
- [ ] Intensity-based music changes

### 5.4 Tutorial & Onboarding
- [ ] First-time player tutorial
- [ ] Tooltips for game mechanics
- [ ] Help menu with game rules
- [ ] Visual indicators for stats/mechanics

---

## 🎨 Visual & Technical Improvements

### Visual Polish Ideas
1. **Better Particle Systems**
   - Weapon-specific effects
   - Environmental particles (dust, debris)
   - Impact effects
   
2. **Animation Improvements**
   - Enemy death animations
   - Weapon firing animations
   - Character movement animations
   
3. **UI/UX Enhancements**
   - Better font choices
   - Improved color schemes
   - Animated transitions
   - Better iconography

### Technical Improvements
1. **Performance Optimization**
   - Enemy culling (off-screen enemies)
   - Particle system optimization
   - Reduce unnecessary calculations
   - Better memory management

2. **Code Quality**
   - Refactor large components
   - Better code organization
   - Add more unit tests
   - Documentation improvements

---

## 📊 Success Metrics

### Gameplay Metrics
- All weapons feel viable and fun
- Enemies are challenging but fair
- Difficulty curve is smooth
- Multiple viable build paths

### Content Metrics
- 15+ weapons
- 10+ tomes
- 10+ items
- 5+ characters
- 8+ enemy types

### Polish Metrics
- Smooth 60fps gameplay
- Good visual feedback
- Clear UI/UX
- Responsive controls

### Engagement Metrics
- Players want to replay
- Try different builds
- No single strategy dominates
- High replayability

---

## 🚀 Quick Wins (Can Do Anytime)

These are small improvements that can be done quickly:

- [ ] Add more particle variety
- [ ] Improve damage number display
- [ ] Add screen shake variety
- [ ] Better enemy death animations
- [ ] UI hover effects
- [ ] Sound effect improvements
- [ ] Better color schemes
- [ ] Font improvements
- [ ] Tooltip system
- [ ] Achievement notifications

---

## 💡 Creative Ideas for Future

### Unique Mechanics
- **Weapon Fusion**: Combine two weapons to create a new one
- **Mutation System**: Random mutations that change gameplay
- **Time Manipulation**: Slow time abilities
- **Dimension Shifts**: Alternate dimension with different rules
- **Companion System**: AI companions that fight with you

### Special Modes
- **Speedrun Mode**: Timed runs with leaderboards
- **Endless Mode**: Infinite floors with scaling difficulty
- **Challenge Mode**: Weekly challenges with modifiers
- **Boss Rush**: Fight all bosses in sequence
- **Pacifist Mode**: Complete without killing (stealth)

### Social Features
- **Replay System**: Save and share runs
- **Ghost Mode**: Race against your best time
- **Daily Challenges**: Shared challenges for all players
- **Leaderboards**: Global and friends leaderboards

---

## 📝 Notes

- **Focus on fun**: Make sure new features are fun, not just features
- **Iterate quickly**: Test ideas fast, keep what works
- **Balance is key**: Regular balance passes keep the game fair
- **Player feedback**: Listen to what players want
- **Performance matters**: Keep 60fps as a priority
- **Polish counts**: Small details make a big difference

---

## 🎯 Next Steps

1. **This Week**: Visual polish and weapon balance
2. **Next Week**: New enemy types and weapons
3. **Month 1**: Content expansion (enemies, weapons, items)
4. **Month 2**: Level variety and special rooms
5. **Month 3**: Progression systems and meta features

---

*Last Updated: After pathfinding optimization completion*
