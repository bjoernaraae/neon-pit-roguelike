import { clamp } from "../../utils/math.js";
import { bumpShake, addExplosion } from "../effects/VisualEffects.js";
import { isPointWalkable, findNearestWalkable } from "../world/WalkabilitySystem.js";
import { generateProceduralLevel } from "../world/LevelGenerator.js";

/**
 * Handle boss death and floor transition
 */
export function handleFloorTransition(s, generateLevel, spawnInteractableFn, INTERACT) {
  if (!s.boss.active) return;

  const p = s.player;

  // Check if boss is defeated
  if (s.boss.hp <= 0) {
    s.boss.active = false;
    s.score += Math.round(1200 + s.floor * 180);
    p.coins += Math.round(18 + s.floor * 3);
    bumpShake(s, 7, 0.1);
    s.hitStopT = Math.max(s.hitStopT, 0.05);
    addExplosion(s, s.boss.x, s.boss.y, 2.0, 300);
    
    // Advance to next floor - clear everything and generate new floor
    s.floor += 1;
    s.stageLeft = s.stageDur;
    s.bgHue = (s.bgHue + 18) % 360;
    s.schedule.didSeven = false;
    s.schedule.didThree = false;
    s.bossPortalSpawned = false;
    s.difficultyMultiplier = 1.0;
    s.floorStartTime = s.t;
    
    // Clear all enemies, bullets, gems, coins, interactables, particles, etc.
    s.enemies = [];
    // Preserve explosive bullets (injected or seeking) and boomerang bullets when starting new floor
    s.bullets = s.bullets.filter(b => 
      (b.explosive && ((b.injected && b.injectedEnemy) || (b.seeking && !b.injected))) ||
      (b.boomerang && b.t < b.life)
    );
    s.gems = [];
    s.coins = [];
    s.consumables = [];
    s.interact = [];
    s.particles = [];
    s.floaters = [];
    s.hitFlashes = [];
    s.burningAreas = [];
    s.auras = [];
    
    // Generate new procedural level
    s.levelData = generateLevel(s.arena.w, s.arena.h, s.floor);
    
    // Move player to first room of new floor
    const padding = s.arena.padding;
    if (s.levelData.rooms.length > 0) {
      const startRoom = s.levelData.rooms[0];
      p.x = clamp(startRoom.x + startRoom.w / 2, startRoom.x + padding, startRoom.x + startRoom.w - padding);
      p.y = clamp(startRoom.y + startRoom.h / 2, startRoom.y + padding, startRoom.y + startRoom.h - padding);
      
      // Ensure player is in walkable area
      if (s.levelData && !isPointWalkable(p.x, p.y, s.levelData, p.r || 12)) {
        const walkable = findNearestWalkable(p.x, p.y, s.levelData, p.r || 12);
        p.x = walkable.x;
        p.y = walkable.y;
      }
      
      // Reset camera to player position
      s.camera.x = clamp(p.x - s.arena.w / 2, 0, Math.max(0, s.levelData.w - s.arena.w));
      s.camera.y = clamp(p.y - s.arena.h / 2, 0, Math.max(0, s.levelData.h - s.arena.h));
    }
    
    // Spawn new chest on new floor
    spawnInteractableFn(s, INTERACT.CHEST);
    p.shield = p.shieldPerWave;
    s.uiPulseT = 0.25;
    s.chestSpawnT = 18;
  }
}

/**
 * Check boss timer (instant kill if time runs out)
 */
export function checkBossTimer(s, applyPlayerDamageFn) {
  if (!s.boss.active) return;
  
  if (s.boss.timeLeft <= 0) {
    applyPlayerDamageFn(s, 9999, "boss timer", { shakeMag: 0, shakeTime: 0, hitStop: 0 });
  }
}
