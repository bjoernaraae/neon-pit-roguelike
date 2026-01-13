/**
 * Boss Spawner
 * 
 * Initializes and spawns boss enemies with abilities.
 */

import { 
  BossController, 
  ConeAttackAbility, 
  LineDashAbility, 
  RingPulseAbility, 
  TeleportAbility, 
  ChargeAbility, 
  MultiShotAbility 
} from "../systems/BossAbilitySystem.js";

/**
 * Start a boss fight
 * @param {Object} s - Game state
 * @param {number} seconds - Boss fight duration
 * @param {number|null} bossX - Optional boss spawn X
 * @param {number|null} bossY - Optional boss spawn Y
 * @param {Function} bumpShakeFn - Screen shake function
 * @param {Function} sfxBossFn - Boss sound effect function
 */
export function startBoss(s, seconds, bossX = null, bossY = null, bumpShakeFn, sfxBossFn) {
  const { w, padding } = s.arena;
  s.boss.active = true;
  s.boss.r = 38;
  // Boss HP scales with floor - F1 is easier
  // F1: 1000 HP, then +300 per floor (scaled down from previous)
  s.boss.maxHp = Math.round(1000 + (s.floor - 1) * 300);
  s.boss.hp = s.boss.maxHp;
  // Spawn boss at teleporter location if provided, otherwise center
  // Ensure boss doesn't spawn on top of player
  const p = s.player;
  if (bossX !== null && bossY !== null) {
    // Check distance from player, if too close, offset
    const dist = Math.hypot(bossX - p.x, bossY - p.y);
    if (dist < 150) {
      // Too close, offset away from player
      const angle = Math.atan2(bossY - p.y, bossX - p.x);
      s.boss.x = p.x + Math.cos(angle) * 150;
      s.boss.y = p.y + Math.sin(angle) * 150;
    } else {
      s.boss.x = bossX;
      s.boss.y = bossY;
    }
  } else {
    // Spawn away from player if no teleporter
    const angle = Math.random() * Math.PI * 2;
    s.boss.x = p.x + Math.cos(angle) * 200;
    s.boss.y = p.y + Math.sin(angle) * 200;
  }
  s.boss.timeLeft = seconds;
  s.boss.angle = 0; // Initialize angle for rotation
  s.boss.enraged = false;

  // Initialize boss controller with abilities - scale by floor
  // F1 boss is easier (fewer abilities, longer cooldowns, less damage)
  // Higher floors get more abilities and harder difficulty
  try {
    const floor = s.floor;
    const abilities = [];
    
    // Base abilities (always available)
    const baseCooldown = 4.0 + (floor - 1) * 0.3; // Slightly faster on higher floors
    abilities.push(new ConeAttackAbility({ 
      cooldown: baseCooldown * 1.2, 
      range: 350 + floor * 10,
      phase2Effect: 'burning_ground' 
    }));
    
    // F1: Only basic abilities
    if (floor >= 1) {
      abilities.push(new LineDashAbility({ 
        cooldown: baseCooldown * 1.5,
        dashDistance: 250 + floor * 15
      }));
    }
    
    // F2+: Add Ring Pulse
    if (floor >= 2) {
      abilities.push(new RingPulseAbility({ 
        cooldown: baseCooldown * 1.8,
        maxRadius: 300 + floor * 15
      }));
    }
    
    // F3+: Add Charge
    if (floor >= 3) {
      abilities.push(new ChargeAbility({ 
        cooldown: baseCooldown * 2.0,
        chargeDistance: 350 + floor * 20
      }));
    }
    
    // F4+: Add Teleport
    if (floor >= 4) {
      abilities.push(new TeleportAbility({ 
        cooldown: baseCooldown * 2.5,
        teleportDistance: 200 + floor * 10
      }));
    }
    
    // F5+: Add Multi-Shot
    if (floor >= 5) {
      abilities.push(new MultiShotAbility({ 
        cooldown: baseCooldown * 2.2,
        shotCount: 5 + Math.floor((floor - 5) / 2), // More shots on higher floors
        range: 400 + floor * 10
      }));
    }
    
    s.boss.controller = new BossController(s.boss, abilities);
  } catch (error) {
    console.error('Error initializing boss controller:', error);
    // Fallback: set controller to null to prevent crashes
    s.boss.controller = null;
  }

  bumpShakeFn(s, 8, 0.1);
  sfxBossFn();
}
