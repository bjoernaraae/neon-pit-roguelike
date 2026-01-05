/**
 * Game constants
 */

// Isometric rendering constants
export const ISO_TILE_WIDTH = 64;  // Width of isometric tile
export const ISO_TILE_HEIGHT = 32; // Height of isometric tile
export const ISO_MODE = true; // Change to true to enable isometric view

// Collision margin constants for isometric cube collision
export const COLLISION_MARGIN_LEFT = 0;   // Left wall (cube's left face)
export const COLLISION_MARGIN_RIGHT = 0.5;  // Right wall (cube's right face)
export const COLLISION_MARGIN_TOP = 0;     // Top wall (cube's top face) - adjust this
export const COLLISION_MARGIN_BOTTOM = 0.5;  // Bottom wall (cube's bottom face)

// Rarity constants
export const RARITY = {
  COMMON: "Common",
  UNCOMMON: "Uncommon",
  RARE: "Rare",
  LEGENDARY: "Legendary",
};

// Rarity color mapping
export const RARITY_COLOR = {
  [RARITY.COMMON]: { bg: "#1fe06a", fg: "#0b1a12" },
  [RARITY.UNCOMMON]: { bg: "#2ea8ff", fg: "#06131d" },
  [RARITY.RARE]: { bg: "#c23bff", fg: "#12041a" },
  [RARITY.LEGENDARY]: { bg: "#ffd44a", fg: "#1b1200" },
};

// Item type constants
export const TYPE = {
  WEAPON: "Weapon",
  TOME: "Tome",
  ITEM: "Item",
};

// Interaction type constants
export const INTERACT = {
  CHEST: "Chest",
  SHRINE: "Shrine",
  MAGNET_SHRINE: "MagnetShrine",
  MICROWAVE: "Microwave",
  GREED: "GreedShrine",
  BOSS_TP: "BossTeleporter",
};
