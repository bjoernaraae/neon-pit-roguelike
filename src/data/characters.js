/**
 * Character definitions and configurations
 */

/**
 * Creates the characters array
 * @returns {Array} Array of character definitions
 */
export function createCharacters() {
  return [
    {
      id: "cowboy",
      name: "Cowboy",
      subtitle: "Crit based",
      startWeapon: "revolver",
      stats: { hp: 95, speedBase: 75, critChance: 0.08 },
      space: { id: "quickdraw", name: "Quick Draw", cd: 8.0 },
      perk: "+1.5% Crit per level",
    },
    {
      id: "wizard",
      name: "Wizard",
      subtitle: "AoE fire",
      startWeapon: "firestaff",
      stats: { hp: 90, speedBase: 75, sizeMult: 1.08 },
      space: { id: "blink", name: "Blink", cd: 3.6 },
      perk: "+0.15 Luck per level",
    },
    {
      id: "brute",
      name: "Brute",
      subtitle: "Melee",
      startWeapon: "sword",
      stats: { hp: 125, speedBase: 75, armor: 0.06 },
      space: { id: "slam", name: "Slam", cd: 4.2 },
      perk: "+8 Max HP per level",
    },
  ];
}

/**
 * Get a character by its ID
 * @param {string} id - Character ID
 * @returns {Object|undefined} Character definition or undefined if not found
 */
export function getCharacterById(id) {
  return createCharacters().find((c) => c.id === id);
}
