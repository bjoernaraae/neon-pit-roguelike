import { rand } from "../../utils/math.js";

/**
 * Handle boss portal spawning logic
 */
export function updateBossPortalSpawning(s, spawnInteractableFn, INTERACT) {
  if (!s.boss.active && !s.bossPortalSpawned) {
    const timeOnFloor = s.t - s.floorStartTime;
    // Spawn boss portal after 30 seconds or when stage time is low
    if (timeOnFloor > 30 || s.stageLeft < 120) {
      if (!s.schedule.didSeven) {
        s.schedule.didSeven = true;
        spawnInteractableFn(s, INTERACT.BOSS_TP);
        s.bossPortalSpawned = true;
      }
    }
  }
}

/**
 * Update difficulty multiplier based on time spent on floor
 */
export function updateDifficultyScaling(s) {
  const timeOnFloor = s.t - s.floorStartTime;
  s.difficultyMultiplier = 1.0 + Math.min(2.0, (timeOnFloor / s.maxStageTime) * 2.0);
}

/**
 * Handle chest respawning logic
 */
export function updateChestSpawning(s, dt, spawnInteractableFn, INTERACT) {
  if (s.chestSpawnT > 0) s.chestSpawnT = Math.max(0, s.chestSpawnT - dt);
  
  const chestCount = s.interact.filter((it) => !it.used && it.kind === INTERACT.CHEST).length;
  // Spawn multiple chests across the level (2-4 chests at a time, spread across different rooms)
  const targetChestCount = s.levelData && s.levelData.rooms ? Math.min(4, Math.max(2, Math.floor(s.levelData.rooms.length * 0.4))) : 1;
  
  if (chestCount < targetChestCount && s.chestSpawnT <= 0 && s.stageLeft > 0) {
    spawnInteractableFn(s, INTERACT.CHEST);
    s.chestSpawnT = 28 + rand(0, 12); // Faster respawn for multiple chests
  }
}
