# Upgrade System Balance & Visual Improvements Plan

## 🎯 Goals
1. Balance all items/weapons - remove redundancies
2. Fix broken items (Bananarang)
3. Create a rewarding, balanced upgrade system
4. Add visual fanfare for leveling/chest opening
5. Add keyboard controls (A/D scroll, E select)
6. Visual improvements based on rarity

---

## 📊 Current Issues Analysis

### Redundant Items to Remove/Consolidate

#### Weapons:
- ❌ **Katana vs Sword**: Both are melee weapons, too similar
  - **Decision**: Keep Sword, remove Katana (or merge into one "Blade" weapon)
  
- ❌ **Multiple Freeze Items**:
  - Frost Wand (weapon with freeze effect)
  - Freeze Tome (+freeze chance)
  - Ice Crystal (AoE freeze on hit)
  - **Decision**: Keep Frost Wand and Ice Crystal, remove Freeze Tome (redundant)

#### Items:
- ❌ **Power Gloves vs Damage Tome**: Both just add damage
  - **Decision**: Keep Damage Tome, remove Power Gloves (tomes are more interesting)

- ❌ **Borgar vs HP Tome**: Both add HP
  - **Decision**: Keep HP Tome, remove Borgar (consolidate)

- ❌ **Oats vs Regen Tome**: Both add regen
  - **Decision**: Keep Regen Tome, remove Oats

- ❌ **Golden Glove vs Gold Tome**: Both add gold gain
  - **Decision**: Keep Gold Tome, remove Golden Glove

### Broken Items to Fix:
- 🔧 **Bananarang**: Not working as intended
  - Issue: Boomerang mechanics may not be functioning properly
  - Fix: Review boomerang return logic, ensure it returns to player

---

## 🎨 Visual Improvements

### Level Up Fanfare
**Current**: Simple text "LEVEL X", basic explosion
**New**: 
- Large animated "LEVEL UP!" text with glow effect
- Particle burst in rarity colors
- Screen flash (subtle)
- Sound effect with pitch variation based on level
- Rarity-colored border flash around screen edges

### Chest Opening Fanfare
**Current**: Minimal feedback
**New**:
- Chest opening animation (lid opens, glow emits)
- Particle burst from chest
- Rarity-colored light beam
- Sound effect
- Brief pause before showing choices (builds anticipation)

### Upgrade Selection UI
**Current**: Static cards, click or 1/2/3 keys
**New**:
- **Keyboard Controls**: 
  - A/D or Left/Right arrows to scroll through choices
  - E or Enter to select
  - Visual indicator showing selected choice (glow, scale, border)
  
- **Rarity Visuals**:
  - **Common**: Green glow, simple particles
  - **Uncommon**: Blue glow, moderate particles, subtle pulse
  - **Rare**: Purple glow, strong particles, pulsing effect
  - **Legendary**: Gold glow, intense particles, shimmer effect, screen flash
  
- **Selection Animation**:
  - Selected card scales up slightly (1.05x)
  - Glowing border pulses
  - Particles emit from selected card
  - Other cards dim slightly
  
- **Card Improvements**:
  - Rarity-colored border (thicker for higher rarity)
  - Rarity-colored background gradient
  - Icon glow effect matching rarity
  - Animated rarity indicator (sparkles for legendary)

---

## ⚖️ Balanced Upgrade System

### Weapon Categories (Keep Distinct Roles)

#### 1. **Ranged Single-Target**
- ✅ **Revolver**: Balanced, bounces once
- ✅ **Bow**: Fast, accurate
- ✅ **Shotgun**: Close range, multi-projectile

#### 2. **Ranged AoE**
- ✅ **Firestaff**: Fire splash damage
- ✅ **Poison Flask**: Thrown AoE poison
- ✅ **Lightning Staff**: Piercing shock

#### 3. **Melee**
- ✅ **Sword**: Standard melee (remove Katana)
- ✅ **Axe**: Thrown melee with pierce

#### 4. **Special Mechanics**
- ✅ **Bone**: Bouncing projectile
- ✅ **Bananarang**: Boomerang (FIX THIS)
- ✅ **Flamewalker**: Ground fire aura

### New Weapons to Add (Inspired by Hades/Megabonk)

1. **Crossbow** (Ranged Single-Target)
   - Slow fire rate (0.9s), high damage (18)
   - Pierces 3 enemies
   - Upgrade path: Damage → Pierce → Speed → Crit

2. **Chain Lightning** (Ranged AoE)
   - Medium fire rate (0.65s), medium damage (10)
   - Bounces between 3-5 enemies
   - Upgrade path: Bounces → Damage → Chain Range → Speed

3. **Orbiting Blades** (Special)
   - 2-3 blades orbit player
   - Auto-attack nearby enemies
   - Upgrade path: Blades → Damage → Orbit Speed → Range

4. **Throwing Knives** (Ranged Single-Target)
   - Very fast (0.35s), low damage (6)
   - Fires 2-3 projectiles
   - Upgrade path: Projectiles → Speed → Damage → Crit

5. **Grenade Launcher** (Ranged AoE)
   - Slow (1.1s), high damage (20)
   - Explosive AoE on impact
   - Upgrade path: Damage → AoE → Speed → Explosive Radius

### Tome Categories (Keep Core Stats)

#### Core Stats (Keep):
- ✅ Damage Tome
- ✅ Cooldown Tome (Attack Speed)
- ✅ Quantity Tome (Projectiles)
- ✅ Precision Tome (Crit)
- ✅ HP Tome
- ✅ Regen Tome
- ✅ Agility Tome (Speed)
- ✅ Luck Tome
- ✅ XP Tome
- ✅ Gold Tome
- ✅ Evasion Tome
- ✅ Shield Tome
- ✅ Size Tome
- ✅ Knockback Tome
- ✅ Projectile Speed Tome
- ✅ Jump Tome
- ✅ Bounce Tome

#### Remove:
- ❌ Freeze Tome (redundant with Frost Wand + Ice Crystal)

#### New Tomes (Inspired by Hades):
1. **Berserker Tome**: Lower HP = more damage (risk/reward)
2. **Vampire Tome**: Lifesteal on damage dealt
3. **Shield Tome**: Temporary invincibility after taking damage (already exists, enhance)
4. **Crit Master Tome**: Higher crit chance AND crit damage multiplier
5. **Elemental Tome**: Adds random elemental effect (burn/shock/poison/freeze)
6. **Speed Demon Tome**: Movement speed = damage bonus
7. **Pierce Tome**: +Pierce to all weapons
8. **Explosive Tome**: Chance for projectiles to explode

### Item Categories (Keep Unique Effects)

#### Keep (Unique Effects):
- ✅ Moldy Cheese (Poison chance)
- ✅ Ice Crystal (AoE freeze)
- ✅ Rubber Bullets (Bounces)
- ✅ Time Bracelet (Cooldown reduction)
- ✅ Nuke (Emergency clear)
- ✅ Patch (Heal for coins)
- ✅ Glass Cannon (Damage up, HP down)
- ✅ Spiky Shield (Thorns/Reflect)
- ✅ Slurp Gloves (Lifesteal)
- ✅ Mirror (Invincibility on hit)
- ✅ Big Bonk (Low chance extreme damage)

#### Remove (Redundant):
- ❌ Power Gloves (redundant with Damage Tome)
- ❌ Borgar (redundant with HP Tome)
- ❌ Oats (redundant with Regen Tome)
- ❌ Golden Glove (redundant with Gold Tome)

#### New Items (Inspired by Hades/Megabonk):
1. **Lucky Coin**: Chance to double coin drops
2. **Experience Orb**: Increased XP gain (stacking)
3. **Speed Boots**: Permanent movement speed increase
4. **Magnet**: Pulls coins/items toward player
5. **Shield Generator**: Temporary shield on low HP
6. **Death Defiance**: One-time revive at 1 HP
7. **Bloodthirst**: Damage increases with kills (resets on hit)
8. **Chain Reaction**: Kills cause small explosions
9. **Ricochet**: Projectiles bounce more times
10. **Split Shot**: Chance to fire additional projectiles

---

## 🔧 Bananarang Fix

### Current Issues:
- May not be returning properly
- Upgrade system may not be working correctly
- Visual feedback may be unclear

### Fix Plan:
1. Review boomerang return logic in bullet update code
2. Ensure boomerang tracks player position correctly
3. Fix upgrade path (Range → Speed → Damage → Return Speed)
4. Add visual trail/glow for better visibility
5. Ensure only one active at a time (unless upgraded)

---

## 📐 Balance Framework

### Weapon Balance Formula:
- **DPS = (Damage / Cooldown) * Projectiles**
- All weapons should have similar base DPS (within 20%)
- Unique mechanics justify DPS differences

### Tome Balance:
- Each tome should provide ~10-15% improvement per rarity level
- Stacking should be meaningful but not overpowered
- Rarity multipliers: Common 1.0x, Uncommon 1.12x, Rare 1.28x, Legendary 1.55x

### Item Balance:
- Items should provide unique, non-stackable effects
- Cost/benefit should be clear
- No item should be "must-have" or "never-take"

---

## 🎮 Implementation Priority

### Phase 1: Core Balance (Week 1)
1. Remove redundant items (Katana, Freeze Tome, Power Gloves, etc.)
2. Fix Bananarang
3. Balance existing weapons/tomes/items
4. Add keyboard controls (A/D/E)

### Phase 2: Visual Improvements (Week 1-2)
1. Level up fanfare
2. Chest opening fanfare
3. Upgrade selection visuals (rarity-based)
4. Selection animation

### Phase 3: New Content (Week 2-3)
1. Add new weapons (Crossbow, Chain Lightning, etc.)
2. Add new tomes (Berserker, Vampire, etc.)
3. Add new items (Lucky Coin, Magnet, etc.)
4. Test and balance new additions

---

## 🎨 Visual Design Specs

### Rarity Colors:
- **Common**: `#1fe06a` (Green) - Subtle glow
- **Uncommon**: `#2ea8ff` (Blue) - Moderate glow, pulse
- **Rare**: `#c23bff` (Purple) - Strong glow, pulsing, particles
- **Legendary**: `#ffd44a` (Gold) - Intense glow, shimmer, screen flash

### Selection Animation:
- Scale: 1.0 → 1.05 (selected), 1.0 → 0.95 (others)
- Glow intensity: 0.3 → 1.0 (selected)
- Border width: 2px → 4px (selected)
- Particles: Emit from selected card
- Duration: 0.2s transition

### Fanfare Effects:
- **Level Up**: 
  - Text size: 24px → 32px (animated)
  - Particle count: 50-100
  - Screen flash: 0.1s
  - Sound: Pitch based on level
  
- **Chest Open**:
  - Particle burst: 30-50 particles
  - Light beam: Rarity-colored, 0.5s
  - Sound: Chest-specific
  - Pause: 0.3s before showing choices

---

## ✅ Success Criteria

1. **Balance**: All weapons/builds feel viable
2. **Clarity**: No redundant items
3. **Fun**: Upgrades feel rewarding
4. **Visual**: Fanfare creates excitement
5. **Controls**: Keyboard navigation feels smooth
6. **Polish**: Rarity visuals are clear and impressive

---

*This plan will be implemented incrementally, testing each phase before moving to the next.*
