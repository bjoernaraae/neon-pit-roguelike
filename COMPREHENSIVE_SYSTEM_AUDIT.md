# **Neon Pit Roguelike V3 - Comprehensive System Audit**

**Date**: January 13, 2026  
**Auditor**: Senior Software Architect  
**Target**: `src/components/NeonPitRoguelikeV3.jsx`

---

## **EXECUTIVE SUMMARY**
- **Current Size**: 6,284 lines
- **Target Size**: <1,000 lines
- **Reduction Needed**: ~5,300 lines (84% reduction)
- **Total Systems Identified**: 35+ distinct logical systems
- **Refactoring Complexity**: Medium-High (many interdependencies but modular potential)

---

## **TASK 1: COMPREHENSIVE SYSTEM AUDIT**

### **1. STATIC DATA & CONFIGURATION** ⭐ HIGH PRIORITY
- **Location**: Lines 54-101
- **Size**: ~48 lines
- **Responsibility**: Game constants, changelog, rarity weights, multiplier calculations
- **Decoupling Potential**: **HIGH** - Pure functions, no state dependencies
- **Recommended Path**: `src/data/gameConstants.js`, `src/data/raritySystem.js`

### **2. GAME MATH UTILITIES** ⭐ HIGH PRIORITY
- **Location**: Lines 103-122
- **Size**: ~20 lines
- **Responsibility**: Chest cost calculation, damage mitigation, evasion rolls
- **Decoupling Potential**: **HIGH** - Pure utility functions
- **Recommended Path**: `src/utils/gameMath.js` (expand existing)

### **3. VISUAL EFFECTS SYSTEM** ⭐ HIGH PRIORITY
- **Location**: Lines 124-182
- **Size**: ~59 lines
- **Responsibility**: Screen shake, particle effects, explosions, hit flashes
- **Decoupling Potential**: **HIGH** - Takes state object, mutates arrays
- **Recommended Path**: `src/game/effects/VisualEffects.js`

### **4. ICON DRAWING SYSTEM** ⭐ HIGH PRIORITY
- **Location**: Lines 185-253
- **Size**: ~69 lines
- **Responsibility**: Canvas icon renderers for weapons/items
- **Decoupling Potential**: **HIGH** - Pure rendering functions
- **Recommended Path**: `src/rendering/IconRenderer.js`

### **5. AUDIO SYSTEM** ⭐ MEDIUM PRIORITY
- **Location**: Lines 296-737
- **Size**: ~442 lines (!!)
- **Responsibility**: Web Audio API, music management, SFX synthesis, music transitions
- **Decoupling Potential**: **MEDIUM** - Uses refs and state, but can be encapsulated
- **Recommended Path**: `src/audio/AudioManager.js`, `src/audio/SoundEffects.js`, `src/audio/MusicController.js`
- **Notes**: This is one of the largest systems and should be split into 3 modules

### **6. CANVAS & FULLSCREEN MANAGEMENT** ⭐ MEDIUM PRIORITY
- **Location**: Lines 749-812
- **Size**: ~64 lines
- **Responsibility**: Canvas resizing, fullscreen API, DPR handling
- **Decoupling Potential**: **MEDIUM** - Uses refs directly
- **Recommended Path**: `src/rendering/CanvasManager.js`

### **7. ENEMY SPAWNING SYSTEM** ⭐ HIGH PRIORITY
- **Location**: Lines 814-972
- **Size**: ~159 lines
- **Responsibility**: Enemy generation, tier selection, elite mechanics, positioning
- **Decoupling Potential**: **HIGH** - Takes state, returns enemy objects
- **Recommended Path**: `src/game/enemies/EnemySpawner.js`

### **8. TARGET ACQUISITION** ⭐ HIGH PRIORITY
- **Location**: Lines 974-993
- **Size**: ~20 lines
- **Responsibility**: Finding nearest targetable entity
- **Decoupling Potential**: **HIGH** - Pure query function
- **Recommended Path**: `src/game/systems/TargetingSystem.js`

### **9. COMBAT TEXT & FEEDBACK** ⭐ HIGH PRIORITY
- **Location**: Lines 996-1007
- **Size**: ~12 lines
- **Responsibility**: Floating damage numbers
- **Decoupling Potential**: **HIGH** - Pushes to state array
- **Recommended Path**: `src/game/effects/CombatText.js`

### **10. BULLET/PROJECTILE SYSTEM** ⭐ HIGH PRIORITY
- **Location**: Lines 1009-1060
- **Size**: ~52 lines
- **Responsibility**: Bullet creation with all properties
- **Decoupling Potential**: **HIGH** - Factory function
- **Recommended Path**: `src/game/projectiles/BulletFactory.js`

### **11. WEAPON SYSTEM** ⭐ CRITICAL - FRAGILE
- **Location**: Lines 1062-1249
- **Size**: ~188 lines
- **Responsibility**: Weapon application, leveling, upgrade types, stat calculations
- **Decoupling Potential**: **MEDIUM** - Heavily modifies player state, complex upgrade logic
- **Recommended Path**: `src/game/weapons/WeaponSystem.js`
- **⚠️ FRAGILE**: Complex state mutations, rarity calculations, upgrade type selection

### **12. WEAPON FIRING LOGIC** ⭐ CRITICAL - VERY FRAGILE
- **Location**: Lines 1251-1676
- **Size**: ~426 lines (!!)
- **Responsibility**: All weapon firing mechanics (melee, ranged, aura, boomerang, etc.)
- **Decoupling Potential**: **LOW** - Deeply coupled to player, state, bullet creation
- **Recommended Path**: `src/game/weapons/WeaponFiring.js` + weapon-specific modules
- **⚠️ VERY FRAGILE**: Touches player, state, bullets, effects, audio - needs careful extraction

### **13. INTERACTABLE SPAWNING** ⭐ HIGH PRIORITY
- **Location**: Lines 1678-1746
- **Size**: ~69 lines
- **Responsibility**: Chest, shrine, boss portal spawning with positioning
- **Decoupling Potential**: **HIGH** - Creates and pushes to interact array
- **Recommended Path**: `src/game/interactables/InteractableSpawner.js`

### **14. UPGRADE/CHOICE SYSTEM** ⭐ CRITICAL - FRAGILE
- **Location**: Lines 1748-2106
- **Size**: ~359 lines
- **Responsibility**: Rolling upgrade options, preview generation, rarity selection, detailed descriptions
- **Decoupling Potential**: **MEDIUM** - Complex logic with closures and state access
- **Recommended Path**: `src/game/progression/UpgradeSystem.js`
- **⚠️ FRAGILE**: Creates closures, modifies player state, generates previews

### **15. UPGRADE SEQUENCE & FANFARE** ⭐ MEDIUM PRIORITY
- **Location**: Lines 2108-2183
- **Size**: ~76 lines
- **Responsibility**: Chest opening animation, camera centering, fanfare
- **Decoupling Potential**: **MEDIUM** - UI and state coordination
- **Recommended Path**: `src/game/progression/UpgradeSequence.js`

### **16. BOSS SYSTEM** ⭐ MEDIUM PRIORITY
- **Location**: Lines 2185-2283
- **Size**: ~99 lines
- **Responsibility**: Boss initialization, HP scaling, ability assignment
- **Decoupling Potential**: **MEDIUM** - Uses BossController from external module
- **Recommended Path**: `src/game/enemies/BossSpawner.js`

### **17. PLAYER CREATION** ⭐ HIGH PRIORITY
- **Location**: Lines 2285-2310
- **Size**: ~26 lines
- **Responsibility**: Player initialization with character data
- **Decoupling Potential**: **HIGH** - Factory function
- **Recommended Path**: `src/game/player/PlayerFactory.js`

### **18. GAME INITIALIZATION** ⭐ MEDIUM PRIORITY
- **Location**: Lines 2312-2430
- **Size**: ~119 lines
- **Responsibility**: newRun function - creates entire game state
- **Decoupling Potential**: **MEDIUM** - Orchestrates many systems
- **Recommended Path**: `src/game/GameInitializer.js`

### **19. XP & LEVELING SYSTEM** ⭐ MEDIUM PRIORITY
- **Location**: Lines 2432-2551
- **Size**: ~120 lines
- **Responsibility**: XP gain, level up logic, class perks, fanfare, upgrade rolling
- **Decoupling Potential**: **MEDIUM** - Modifies state and triggers UI changes
- **Recommended Path**: `src/game/progression/LevelingSystem.js`

### **20. INTERACTABLE INTERACTION** ⭐ MEDIUM PRIORITY
- **Location**: Lines 2553-2770
- **Size**: ~218 lines
- **Responsibility**: Using chests, shrines, boss portals (nearest detection + activation)
- **Decoupling Potential**: **MEDIUM** - Complex side effects
- **Recommended Path**: `src/game/interactables/InteractionHandler.js`

### **21. PLAYER ABILITIES** ⭐ MEDIUM PRIORITY
- **Location**: Lines 2772-2954
- **Size**: ~183 lines
- **Responsibility**: Blink, quickdraw (explosive shot), slam abilities
- **Decoupling Potential**: **MEDIUM** - Complex ability logic
- **Recommended Path**: `src/game/player/PlayerAbilities.js`

### **22. MAIN UPDATE LOOP** ⭐⭐ CRITICAL - EXTREMELY FRAGILE ⭐⭐
- **Location**: Lines 2956-5109
- **Size**: **~2,154 lines** (34% of entire file!)
- **Responsibility**: 
  - Camera management
  - Flow field pathfinding
  - Shake/hitstop timers
  - Jump physics
  - Buff/effect timers
  - Difficulty scaling
  - Player movement & collision
  - Weapon cooldowns
  - Orbiting blades
  - Enemy AI & pathfinding
  - Enemy status effects (poison, burn, slow)
  - Enemy-player collision & contact damage
  - Bullet physics & logic
  - Bullet-enemy collision
  - Bullet effects (explosive, seeking, boomerang, bounce, pierce)
  - Boss updates
  - Particle system updates
  - Hit flash updates
  - Floating text updates
  - Burning area updates
  - Aura updates
  - Enemy death & loot drops
  - Consumable collection
  - Boss defeat & floor transitions
  - HP regeneration
  - Shield regeneration
  - UI updates
- **Decoupling Potential**: **VERY LOW** - Monolithic game loop touching everything
- **Recommended Path**: Break into **10+ separate update systems**:
  - `src/game/systems/CameraSystem.js`
  - `src/game/systems/PhysicsSystem.js`
  - `src/game/systems/PlayerUpdateSystem.js`
  - `src/game/systems/EnemyUpdateSystem.js`
  - `src/game/systems/BulletUpdateSystem.js`
  - `src/game/systems/CollisionSystem.js` (already exists)
  - `src/game/systems/StatusEffectSystem.js`
  - `src/game/systems/LootSystem.js`
  - `src/game/systems/ProgressionSystem.js`
  - `src/game/effects/ParticleSystem.js`
  - `src/game/effects/EffectUpdateSystem.js`
- **⚠️⚠️ EXTREMELY FRAGILE**: This is the heart of the game - any mistake will cause cascading failures

### **23. ADMIN PANEL** ⭐ HIGH PRIORITY
- **Location**: Lines 5122-5265
- **Size**: ~144 lines
- **Responsibility**: Debug/cheat functions
- **Decoupling Potential**: **HIGH** - Separate feature
- **Recommended Path**: `src/game/debug/AdminPanel.js`

### **24. CHOICE SELECTION** ⭐ MEDIUM PRIORITY
- **Location**: Lines 5267-5348
- **Size**: ~82 lines
- **Responsibility**: Picking upgrade, camera reset, resume game
- **Decoupling Potential**: **MEDIUM** - UI and state coordination
- **Recommended Path**: `src/game/progression/ChoiceHandler.js`

### **25. MENU CHARACTER SELECTION** ⭐ HIGH PRIORITY
- **Location**: Lines 5350-5356
- **Size**: ~7 lines
- **Responsibility**: Character picker UI handler
- **Decoupling Potential**: **HIGH** - Simple UI handler
- **Recommended Path**: Keep in component or move to `src/ui/MenuHandlers.js`

### **26. PAUSE MANAGEMENT** ⭐ HIGH PRIORITY
- **Location**: Lines 5358-5380
- **Size**: ~23 lines
- **Responsibility**: Pause/unpause game
- **Decoupling Potential**: **HIGH** - UI state handler
- **Recommended Path**: Keep in component or move to `src/ui/PauseHandler.js`

### **27. EVENT HANDLERS** ⭐ MEDIUM PRIORITY
- **Location**: Lines 5394-6056
- **Size**: ~663 lines
- **Responsibility**: Keyboard input, mouse clicks, resize, wheel zoom
- **Decoupling Potential**: **MEDIUM** - Input handling with game logic mixed in
- **Recommended Path**: 
  - `src/input/InputManager.js`
  - `src/input/KeyboardHandler.js`
  - `src/input/MouseHandler.js`

### **28. RENDER LOOP (useEffect)** ⭐ LOW PRIORITY
- **Location**: Lines 6058-6242
- **Size**: ~185 lines
- **Responsibility**: Main game loop, render orchestration, screen management
- **Decoupling Potential**: **LOW** - Must stay in component for RAF and React integration
- **Recommended Path**: Can extract render logic functions but loop stays here

### **29. JSX COMPONENT STRUCTURE** ⭐ LOW PRIORITY
- **Location**: Lines 6244-6283
- **Size**: ~40 lines
- **Responsibility**: React component structure
- **Decoupling Potential**: **NONE** - Must stay
- **Recommended Path**: N/A

---

## **TASK 2: REFACTORING ROADMAP**

### **PHASE 1: STATIC DATA & UTILITIES** (Target: -500 lines)
**Priority**: High | **Risk**: Low | **Estimated Time**: 1-2 hours

**Actions**:
1. ✅ Extract to `/src/data/raritySystem.js`:
   - `getRarityWeights()`
   - `rollRarity()`
   - `rarityMult()`
   
2. ✅ Extract to `/src/data/gameConstants.js`:
   - `LATEST_UPDATES`
   - Game balance constants
   
3. ✅ Expand `/src/utils/gameMath.js`:
   - `chestCost()`
   - `mitigateDamage()`
   - `rollEvasion()`
   
4. ✅ Extract to `/src/game/effects/VisualEffects.js`:
   - `bumpShake()`
   - `addParticle()`
   - `addExplosion()`
   - `addHitFlash()`
   
5. ✅ Extract to `/src/rendering/IconRenderer.js`:
   - `makeIconDraw()`
   - All icon drawing functions

**Expected Reduction**: ~400-500 lines

---

### **PHASE 2: AUDIO SYSTEM** (Target: -400 lines)
**Priority**: High | **Risk**: Medium | **Estimated Time**: 2-3 hours

**Actions**:
1. ✅ Create `/src/audio/AudioManager.js`:
   - `ensureAudio()`
   - `applyAudioToggles()`
   - `updateMusicVolume()`
   - Audio context management
   
2. ✅ Create `/src/audio/MusicController.js`:
   - `updateMusic()`
   - Track switching logic
   - Fade transitions
   
3. ✅ Create `/src/audio/SoundEffects.js`:
   - `playBeep()`
   - All `sfx*` functions
   - `tickMusic()`

**Expected Reduction**: ~400-450 lines

---

### **PHASE 3: SPAWNING & FACTORIES** (Target: -450 lines)
**Priority**: High | **Risk**: Low | **Estimated Time**: 2-3 hours

**Actions**:
1. ✅ Create `/src/game/enemies/EnemySpawner.js`:
   - `spawnEnemy()`
   
2. ✅ Create `/src/game/interactables/InteractableSpawner.js`:
   - `spawnInteractable()`
   
3. ✅ Create `/src/game/projectiles/BulletFactory.js`:
   - `shootBullet()`
   
4. ✅ Create `/src/game/player/PlayerFactory.js`:
   - `makePlayer()`
   
5. ✅ Create `/src/game/enemies/BossSpawner.js`:
   - `startBoss()`
   
6. ✅ Create `/src/game/systems/TargetingSystem.js`:
   - `acquireTarget()`
   
7. ✅ Create `/src/game/effects/CombatText.js`:
   - `pushCombatText()`

**Expected Reduction**: ~400-500 lines

---

### **PHASE 4: WEAPON SYSTEMS** (Target: -700 lines)
**Priority**: Critical | **Risk**: High | **Estimated Time**: 4-6 hours

**⚠️ WARNING**: This phase is FRAGILE. Weapon logic is deeply intertwined with player state, damage calculations, and effects.

**Actions**:
1. ✅ Create `/src/game/weapons/WeaponSystem.js`:
   - `applyWeapon()` (upgrade logic)
   - Weapon stat calculations
   - Upgrade type selection
   
2. ✅ Create `/src/game/weapons/WeaponFiring.js`:
   - `fireWeapon()` (main orchestrator)
   - Split into weapon-type specific functions:
     - `fireMeleeWeapon()`
     - `fireRangedWeapon()`
     - `fireAuraWeapon()` (Flamewalker)
     - `fireOrbitingBlades()`
     - `fireBoomerangWeapon()`

**Expected Reduction**: ~600-700 lines

**Testing Requirements**:
- Test ALL weapon types
- Test ALL upgrade paths
- Test rarity scaling
- Test damage calculations with all modifiers

---

### **PHASE 5: PROGRESSION & UPGRADES** (Target: -650 lines)
**Priority**: Critical | **Risk**: High | **Estimated Time**: 3-5 hours

**⚠️ WARNING**: Upgrade system has complex closures and preview generation logic.

**Actions**:
1. ✅ Create `/src/game/progression/UpgradeSystem.js`:
   - `rollChoicesOfType()`
   - `rollLevelChoices()`
   - `rollChestChoices()`
   - Preview generation logic
   
2. ✅ Create `/src/game/progression/UpgradeSequence.js`:
   - `triggerUpgradeSequence()`
   - Fanfare logic
   
3. ✅ Create `/src/game/progression/LevelingSystem.js`:
   - `awardXP()`
   - Level up logic
   - Class perk system
   
4. ✅ Create `/src/game/progression/ChoiceHandler.js`:
   - `pickChoice()`
   - Camera reset logic

**Expected Reduction**: ~600-700 lines

---

### **PHASE 6: THE GREAT LOOP SPLIT** (Target: -2000 lines)
**Priority**: CRITICAL | **Risk**: EXTREME | **Estimated Time**: 10-15 hours

**⚠️⚠️ WARNING**: This is the most dangerous phase. The main update loop is 2,154 lines and touches EVERYTHING. Any mistake will break the game.

**Strategy**: Extract systems ONE AT A TIME, testing after each extraction.

**Actions** (in order of dependency):

1. ✅ Create `/src/game/systems/CameraSystem.js`: (~100 lines)
   - Camera initialization
   - Camera following logic
   - Camera bounds clamping
   
2. ✅ Create `/src/game/systems/PhysicsSystem.js`: (~200 lines)
   - Jump physics
   - Ground detection
   - Gravity
   - Horizontal jump velocity
   
3. ✅ Create `/src/game/systems/PlayerUpdateSystem.js`: (~250 lines)
   - Player movement
   - Player collision with walls
   - Knockback physics
   - Buff timers
   - Ability cooldowns
   
4. ✅ Create `/src/game/systems/StatusEffectSystem.js`: (~150 lines)
   - Poison damage over time
   - Burn damage over time
   - Slow effects
   - Elite regeneration
   - Elite teleport
   
5. ✅ Create `/src/game/enemies/EnemyAISystem.js`: (~400 lines)
   - Enemy state machine (idle, alert, lost)
   - Flow field pathfinding
   - Line of sight checks
   - Stuck detection & unstuck logic
   - Movement with wall sliding
   - Spitter shooting
   
6. ✅ Create `/src/game/projectiles/BulletUpdateSystem.js`: (~600 lines)
   - Bullet movement
   - Boomerang return logic
   - Explosive seeking logic
   - Injection logic
   - Wall collision
   - Bullet-enemy collision
   - Bullet-boss collision
   - Pierce/bounce/splash mechanics
   - Effect application (poison, freeze, burn)
   
7. ✅ Create `/src/game/systems/BossUpdateSystem.js`: (~150 lines)
   - Boss controller updates
   - Boss ability execution
   - Enrage logic
   - Boss death handling
   
8. ✅ Create `/src/game/effects/ParticleSystem.js`: (~80 lines)
   - Particle physics
   - Hit flash updates
   - Floater updates
   - Burning area updates
   - Aura updates
   
9. ✅ Create `/src/game/loot/LootSystem.js`: (~200 lines)
   - Enemy death XP/coin drops
   - Gem pickup logic
   - Coin pickup logic
   - Consumable spawning
   - Consumable collection
   - Magnet logic
   
10. ✅ Create `/src/game/progression/FloorTransition.js`: (~100 lines)
    - Boss defeat detection
    - Floor transition logic
    - Level regeneration

**Expected Reduction**: ~2,000 lines

**Testing Requirements**:
- Full playthrough from start to boss kill
- Test ALL enemy types
- Test ALL weapon types
- Test ALL abilities
- Test ALL status effects
- Test ALL pickups
- Test floor transitions
- Test boss mechanics

---

### **PHASE 7: INPUT & UI HANDLERS** (Target: -600 lines)
**Priority**: Medium | **Risk**: Medium | **Estimated Time**: 3-4 hours

**Actions**:
1. ✅ Create `/src/input/InputManager.js`:
   - Key state management
   - Input normalization
   
2. ✅ Create `/src/input/KeyboardHandler.js`:
   - Keyboard event handlers
   - Menu navigation
   - Ability triggering
   
3. ✅ Create `/src/input/MouseHandler.js`:
   - Mouse click handlers
   - Admin panel clicks
   - Menu clicks
   
4. ✅ Create `/src/game/interactables/InteractionHandler.js`:
   - `tryUseInteractable()`
   - `nearestInteractable()`
   
5. ✅ Create `/src/game/player/PlayerAbilities.js`:
   - `useAbility()`
   - All ability implementations
   
6. ✅ Create `/src/game/debug/AdminPanel.js`:
   - `handleAdminClick()`
   - `handleAdminAction()`

**Expected Reduction**: ~500-700 lines

---

### **PHASE 8: CANVAS & INITIALIZATION** (Target: -300 lines)
**Priority**: Low | **Risk**: Low | **Estimated Time**: 2 hours

**Actions**:
1. ✅ Create `/src/rendering/CanvasManager.js`:
   - `resizeCanvas()`
   - Fullscreen management
   
2. ✅ Create `/src/game/GameInitializer.js`:
   - `newRun()`
   - State initialization
   
3. ✅ Create `/src/game/damage/DamageSystem.js`:
   - `applyPlayerDamage()`
   - `recordDamage()`

**Expected Reduction**: ~250-350 lines

---

## **FINAL RESULT ESTIMATION**

| Phase | Lines Removed | Risk Level |
|-------|---------------|------------|
| Phase 1: Static Data | -500 | Low |
| Phase 2: Audio | -400 | Medium |
| Phase 3: Spawning | -450 | Low |
| Phase 4: Weapons | -700 | High |
| Phase 5: Progression | -650 | High |
| Phase 6: Main Loop | -2000 | **EXTREME** |
| Phase 7: Input/UI | -600 | Medium |
| Phase 8: Canvas/Init | -300 | Low |
| **TOTAL** | **-5,600** | |

**Remaining in Component**: ~680 lines
- Component structure: 40 lines
- React hooks (useEffect, useState): 100 lines
- Render loop coordination: 150 lines
- Game content memoization: 10 lines
- Import statements: ~80 lines
- Integration/orchestration: ~300 lines

**Expected Final Size**: **600-800 lines** ✅ (Target: <1000 lines)

---

## **RECOMMENDED FILE STRUCTURE**

```
src/
├── components/
│   └── NeonPitRoguelikeV3.jsx (600-800 lines) ✅
├── data/
│   ├── raritySystem.js
│   ├── gameConstants.js
│   └── (existing files...)
├── utils/
│   └── gameMath.js (expanded)
├── audio/
│   ├── AudioManager.js
│   ├── MusicController.js
│   └── SoundEffects.js
├── rendering/
│   ├── CanvasManager.js
│   ├── IconRenderer.js
│   └── (existing files...)
├── game/
│   ├── GameInitializer.js
│   ├── systems/
│   │   ├── CameraSystem.js
│   │   ├── PhysicsSystem.js
│   │   ├── PlayerUpdateSystem.js
│   │   ├── StatusEffectSystem.js
│   │   ├── BossUpdateSystem.js
│   │   └── TargetingSystem.js
│   ├── enemies/
│   │   ├── EnemySpawner.js
│   │   ├── EnemyAISystem.js
│   │   └── BossSpawner.js
│   ├── weapons/
│   │   ├── WeaponSystem.js
│   │   └── WeaponFiring.js
│   ├── projectiles/
│   │   ├── BulletFactory.js
│   │   └── BulletUpdateSystem.js
│   ├── interactables/
│   │   ├── InteractableSpawner.js
│   │   └── InteractionHandler.js
│   ├── progression/
│   │   ├── UpgradeSystem.js
│   │   ├── UpgradeSequence.js
│   │   ├── LevelingSystem.js
│   │   ├── ChoiceHandler.js
│   │   └── FloorTransition.js
│   ├── player/
│   │   ├── PlayerFactory.js
│   │   └── PlayerAbilities.js
│   ├── loot/
│   │   └── LootSystem.js
│   ├── damage/
│   │   └── DamageSystem.js
│   ├── effects/
│   │   ├── VisualEffects.js
│   │   ├── CombatText.js
│   │   └── ParticleSystem.js
│   └── debug/
│       └── AdminPanel.js
└── input/
    ├── InputManager.js
    ├── KeyboardHandler.js
    └── MouseHandler.js
```

---

## **FRAGILE LOGIC IDENTIFICATION** ⚠️

### **🔴 EXTREMELY FRAGILE** (Test extensively after ANY change)

1. **Weapon Firing System** (lines 1251-1676)
   - **Dependencies**: player state, weapon stats, damage calculation, effects, audio
   - **Risk**: Break ALL weapons if extracted incorrectly
   - **State Mutations**: Modifies player.weapons, state.bullets, state.burningAreas
   - **Side Effects**: Plays sounds, creates particles, triggers explosions
   
2. **Main Update Loop** (lines 2956-5109)
   - **Dependencies**: EVERYTHING
   - **Risk**: Catastrophic game-breaking bugs
   - **State Mutations**: Modifies every game object in state
   - **Side Effects**: Camera movement, physics, AI, collision, loot, progression
   
3. **Bullet Update System** (within main loop, ~600 lines)
   - **Dependencies**: Enemies, boss, effects, physics, collision
   - **Risk**: Bullets stop working, collisions fail, effects don't trigger
   - **State Mutations**: Modifies bullets, enemies, boss HP, particles
   - **Side Effects**: Damage application, knockback, status effects

### **🟡 MODERATELY FRAGILE** (Test carefully)

1. **Weapon Upgrade System** (lines 1062-1249)
   - **Dependencies**: Player state, rarity calculations, weapon stats
   - **Risk**: Upgrades don't apply correctly, stats become NaN
   - **State Mutations**: Deep modifications to player.weapons array
   - **Critical Logic**: Rarity multipliers, upgrade type selection, stat validation
   
2. **Upgrade/Choice System** (lines 1748-2106)
   - **Dependencies**: Content, player state, closures for apply functions
   - **Risk**: Upgrades don't work, previews show wrong values
   - **State Mutations**: Closures capture state for deferred application
   - **Critical Logic**: Preview generation, rarity weighting, deduplication
   
3. **XP & Leveling** (lines 2432-2551)
   - **Dependencies**: State, UI, upgrade rolling, class perks
   - **Risk**: Level ups don't trigger, upgrades don't show
   - **State Mutations**: XP, level, player stats, iFrames, bullets filtered
   - **Critical Logic**: Class-specific perks, camera centering, fanfare timing

### **🟢 SAFE TO EXTRACT** (Low risk)

1. **Static Data & Utilities**
   - Pure functions with no side effects
   - Easy to test in isolation
   
2. **Audio System**
   - Self-contained with clear interface
   - Uses refs but doesn't modify game state
   
3. **Spawning Systems**
   - Factory functions that return objects
   - Minimal side effects (push to arrays)
   
4. **Admin Panel**
   - Debug-only feature
   - Can be completely removed if broken
   
5. **Icon Drawing**
   - Pure rendering functions
   - No game logic dependencies

---

## **TESTING STRATEGY**

### **Unit Tests** (For each extracted module)
- Test pure functions in isolation
- Mock state objects
- Verify output correctness

### **Integration Tests** (After each phase)
- Test module interaction with game state
- Verify state mutations are correct
- Check for NaN/undefined values

### **System Tests** (After Phase 6)
- Full playthrough from menu to boss kill
- Test all weapons in combat
- Test all abilities
- Test all enemy types
- Test all status effects
- Verify no regressions

### **Regression Test Checklist**
- [ ] Player movement works correctly
- [ ] All weapons fire and deal damage
- [ ] All weapon upgrades apply correctly
- [ ] Enemies spawn and move toward player
- [ ] Enemies deal contact damage
- [ ] Bullets collide with enemies
- [ ] Status effects (poison, burn, slow) work
- [ ] XP drops and can be collected
- [ ] Level ups trigger and show choices
- [ ] Upgrades can be selected and applied
- [ ] Boss spawns and uses abilities
- [ ] Boss can be killed
- [ ] Floor transitions work
- [ ] Audio plays correctly
- [ ] Pause menu works
- [ ] Death screen appears on player death

---

## **RISK MITIGATION STRATEGIES**

### **1. Version Control**
- Create a branch for each phase
- Commit after each successful extraction
- Tag working states for easy rollback

### **2. Incremental Extraction**
- Extract ONE function at a time
- Test immediately after extraction
- Don't move to next function until current works

### **3. State Validation**
- Add NaN checks after math operations
- Validate array lengths before access
- Check for undefined before property access

### **4. Logging**
- Add console.log statements during extraction
- Log state changes for debugging
- Remove logs after verification

### **5. Backup Testing**
- Keep original function available during testing
- Add feature flag to switch between old/new
- Remove old code only after extensive testing

---

## **NEXT STEPS**

1. **Review & Approve** this audit
2. **Choose starting phase** (recommend Phase 1)
3. **Set up testing environment**
4. **Begin systematic extraction**
5. **Test after each change**
6. **Document any issues encountered**
7. **Update this document with actual results**

---

## **NOTES & OBSERVATIONS**

- The main update loop (2,154 lines) is the biggest challenge
- Audio system is surprisingly large (442 lines)
- Weapon firing is complex and touches many systems
- Many systems are already well-separated in concept but coupled in implementation
- The code is generally well-structured despite its size
- Most functions are already somewhat modular (good naming, clear responsibilities)
- The main issue is *location* not *structure* - functions are logically separable

---

**Document Status**: Complete  
**Last Updated**: January 13, 2026  
**Awaiting**: Approval to proceed with Phase 1
