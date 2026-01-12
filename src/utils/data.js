/**
 * Data utility functions
 */

/**
 * Deep clone an object using JSON serialization
 * @param {any} obj - Object to clone
 * @returns {any} Deep cloned object
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Pick a random item from a weighted array
 * @param {Array<{w: number, [key: string]: any}>} items - Array of items with weight property 'w'
 * @returns {any} Selected item
 */
export function pickWeighted(items) {
  const total = items.reduce((s, it) => s + it.w, 0);
  
  // If all weights are zero or invalid, return the last item as fallback
  if (total <= 0) {
    return items[items.length - 1];
  }
  
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.w;
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}
