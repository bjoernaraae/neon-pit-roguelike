/**
 * Barrel export for all game data
 * This file provides a single entry point to initialize all game data
 */

import { createWeapons } from "./weapons.js";
import { createTomes } from "./tomes.js";
import { createItems } from "./items.js";
import { createCharacters } from "./characters.js";

/**
 * Creates all game content (weapons, tomes, items, characters)
 * @param {Function} makeIconDraw - Function that creates icon drawing functions
 * @param {Function} rarityMult - Function that returns rarity multiplier
 * @param {Function} bumpShake - Function to add screen shake effect (for items)
 * @param {Function} addParticle - Function to add particles (for items)
 * @param {Function} sfxBoss - Function to play boss sound effect (for items)
 * @returns {Object} Object containing all game data
 */
export function createGameContent(makeIconDraw, rarityMult, bumpShake, addParticle, sfxBoss) {
  return {
    weapons: createWeapons(makeIconDraw),
    tomes: createTomes(makeIconDraw, rarityMult),
    items: createItems(makeIconDraw, rarityMult, bumpShake, addParticle, sfxBoss),
    characters: createCharacters(),
  };
}

/**
 * Re-export individual creators for direct access if needed
 */
export { createWeapons } from "./weapons.js";
export { createTomes } from "./tomes.js";
export { createItems } from "./items.js";
export { createCharacters } from "./characters.js";

/**
 * Re-export helper functions
 */
export { getWeaponById } from "./weapons.js";
export { getTomeById } from "./tomes.js";
export { getItemById } from "./items.js";
export { getCharacterById } from "./characters.js";

/**
 * Re-export constants
 */
export * from "./constants.js";
