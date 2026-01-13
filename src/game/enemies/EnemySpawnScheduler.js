import { clamp, rand } from "../../utils/math.js";

/**
 * Update enemy spawn timer and spawn new enemies based on difficulty and intensity
 */
export function updateEnemySpawning(s, dt, intensity, spawnEnemyFn) {
  const p = s.player;
  const diff = p.difficultyTome * s.difficultyMultiplier;
  
  s.spawn.t -= dt;
  
  const early = s.t < 18;
  // Enemy numbers increase with floor, not HP/damage
  const floorMultiplier = 1 + (s.floor - 1) * 0.15; // 15% more enemies per floor
  const cap = Math.round((s.spawn.cap + intensity * 10) * diff * floorMultiplier * (early ? 0.8 : 1));
  const delay = Math.max(0.18, (s.spawn.delay * (early ? 1.2 : 1)) / diff); // Faster spawns early
  
  if (s.spawn.t <= 0 && s.enemies.length < cap && s.stageLeft > 0) {
    const batch = clamp(
      Math.round((1 + intensity * 2 + Math.max(0, diff - 1) * 0.8) * floorMultiplier), 
      1, 
      early ? 2 : Math.max(3, Math.floor(3 * floorMultiplier))
    ); // More enemies per floor
    
    for (let i = 0; i < batch; i++) {
      spawnEnemyFn(s);
    }
    
    s.spawn.t = delay * rand(0.85, 1.25);
  }
}
