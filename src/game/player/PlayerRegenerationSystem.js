/**
 * Update player health regeneration
 */
export function updateHealthRegeneration(p, dt) {
  if (p.regen > 0 && p.hp > 0 && p.hp < p.maxHp) {
    p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
  }
}

/**
 * Update player shield regeneration (once per minute)
 */
export function updateShieldRegeneration(s) {
  const p = s.player;
  
  // Shield regeneration (only if player has maxShield from tomes or shieldPerWave from items)
  if (Math.floor(s.stageLeft) % 60 === 0 && s._shieldTick !== Math.floor(s.stageLeft)) {
    s._shieldTick = Math.floor(s.stageLeft);
    // Regenerate shield: use shieldPerWave if set, otherwise regenerate 30% of maxShield
    if (p.shieldPerWave > 0) {
      p.shield = p.shieldPerWave;
    } else if (p.maxShield > 0) {
      const regenAmount = p.maxShield * 0.3; // Regenerate 30% of max shield
      p.shield = Math.min(p.maxShield, (p.shield || 0) + regenAmount);
    }
  }
}
