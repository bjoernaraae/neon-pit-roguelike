/**
 * Character/Player Base Stats Configuration
 * 
 * Defines default player stats and character-specific stats
 */

/**
 * Base player stats (before character modifications)
 */
export const PLAYER_BASE_STATS = {
  r: 14, // Radius
  
  // Movement
  speedBase: 75, // Reduced for slower-paced gameplay
  speedBonus: 0,
  
  // Health
  hp: 100,
  maxHp: 100,
  regen: 0,
  
  // Progression
  xpGain: 1,
  luck: 0,
  difficultyTome: 1,
  goldGain: 1,
  
  // Combat stats
  sizeMult: 1,
  projectileSpeed: 1,
  critChance: 0,
  armor: 0,
  evasion: 0,
  knockback: 0,
  thorns: 0,
  lifesteal: 0,
  iFrameOnHit: 0,
  bigBonkChance: 0,
  bigBonkMult: 1,
  
  // Status effects
  poisonChance: 0,
  freezeChance: 0,
  
  // Shield
  shieldPerWave: 0,
  shield: 0,
  maxShield: 0,
  iFrames: 0,
  
  // Ability
  abilityCdMult: 1,
  abilityT: 0,
  
  // Jump properties
  z: 0, // Vertical position (for isometric depth)
  jumpT: 0, // Jump timer (counts down)
  jumpV: 0, // Jump velocity (vertical)
  jumpVx: 0, // Jump horizontal velocity X
  jumpVy: 0, // Jump horizontal velocity Y
  jumpHeight: 1.0, // Jump height multiplier (upgradeable)
  jumpLandingGrace: 0, // Grace period after landing
  
  // Buffs
  buffHasteT: 0,
  buffHasteMult: 1,
  
  // Magnet
  magnet: 1,
  magnetT: 0,
  
  // Economy
  coins: 0,
  
  // Collections (for tracking)
  weapons: [],
  collectedWeapons: [],
  collectedTomes: [],
  collectedItems: [],
  
  // Damage tracking
  lastDamage: { src: "", amt: 0 },
  
  // Knockback velocity
  knockbackVx: 0,
  knockbackVy: 0,
  
  // Gold boost from shrines
  goldBoostT: 0,
  goldBoostMult: 1
};

/**
 * Create player with character-specific stats
 * @param {Object} character - Character data from content.characters
 * @param {number} w - Arena width
 * @param {number} h - Arena height
 * @returns {Object} Player object with all stats
 */
export function createPlayerWithCharacter(character, w, h) {
  const base = {
    ...PLAYER_BASE_STATS,
    x: w * 0.5,
    y: h * 0.55,
    abilityId: character.space?.id || "dash",
    abilityCd: character.space?.cd || 5,
  };
  
  // Apply character-specific stat overrides
  const stats = character.stats || {};
  if (stats.hp != null) {
    base.hp = stats.hp;
    base.maxHp = stats.hp;
  }
  if (stats.speedBase != null) base.speedBase = stats.speedBase;
  if (stats.critChance != null) base.critChance = stats.critChance;
  if (stats.sizeMult != null) base.sizeMult = stats.sizeMult;
  if (stats.luck != null) base.luck = stats.luck;
  if (stats.goldGain != null) base.goldGain = stats.goldGain;
  if (stats.regen != null) base.regen = stats.regen;
  if (stats.armor != null) base.armor = stats.armor;
  if (stats.evasion != null) base.evasion = stats.evasion;
  if (stats.magnet != null) base.magnet = stats.magnet;
  if (stats.projectileSpeed != null) base.projectileSpeed = stats.projectileSpeed;
  
  return base;
}
