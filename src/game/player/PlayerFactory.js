/**
 * Player Factory
 * 
 * Creates player objects with character-specific configurations.
 */

import { createPlayerWithCharacter } from "../../data/characterData.js";
import { RARITY } from "../../data/constants.js";

/**
 * Create a player with specified character
 * @param {string} charId - Character ID
 * @param {number} w - Arena width
 * @param {number} h - Arena height
 * @param {Object} content - Game content (weapons, characters, etc.)
 * @param {Function} applyWeaponFn - Function to apply weapon to player
 * @returns {Object} Player object
 */
export function makePlayer(charId, w, h, content, applyWeaponFn) {
  // Use createPlayerWithCharacter from characterData.js
  const c = content.characters.find((x) => x.id === charId) || content.characters[0];
  const base = createPlayerWithCharacter(c, w, h);
  
  // All character stat overrides are handled in createPlayerWithCharacter
  // Just apply starting weapon and character metadata

  const wDef = content.weapons.find((ww) => ww.id === c.startWeapon);
  if (wDef) {
    base.weapons = [];
    base.collectedWeapons = [];
    base.collectedTomes = [];
    base.collectedItems = [];
    applyWeaponFn(base, wDef, RARITY.COMMON, false);
    // Track starting weapon
    if (!base.collectedWeapons.find(w => w.id === wDef.id)) {
      base.collectedWeapons.push({ id: wDef.id, name: wDef.name, icon: wDef.icon });
    }
  }

  base.charId = c.id;
  base.charName = c.name;

  return base;
}
