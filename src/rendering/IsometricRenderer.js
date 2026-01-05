/**
 * Isometric rendering system
 */

import { ISO_TILE_WIDTH, ISO_TILE_HEIGHT } from '../data/constants.js';
import { adjustBrightness } from '../utils/color.js';

/**
 * Convert world coordinates to isometric screen coordinates
 * @param {number} wx - World X coordinate
 * @param {number} wy - World Y coordinate
 * @param {number} wz - World Z coordinate (height, default 0)
 * @param {number} isoScale - Isometric scale factor (default 0.01)
 * @returns {{x: number, y: number}} Isometric screen coordinates
 */
export function worldToIso(wx, wy, wz = 0, isoScale = 0.01) {
  const isoX = (wx - wy) * (ISO_TILE_WIDTH / 2) * isoScale;
  const isoY = (wx + wy) * (ISO_TILE_HEIGHT / 2) * isoScale - wz * isoScale;
  return { x: isoX, y: isoY };
}

/**
 * Convert isometric screen coordinates back to world coordinates
 * @param {number} isoX - Isometric X coordinate
 * @param {number} isoY - Isometric Y coordinate
 * @returns {{x: number, y: number}} World coordinates
 */
export function isoToWorld(isoX, isoY) {
  const wx = (isoX / (ISO_TILE_WIDTH / 2) + isoY / (ISO_TILE_HEIGHT / 2)) / 2;
  const wy = (isoY / (ISO_TILE_HEIGHT / 2) - isoX / (ISO_TILE_WIDTH / 2)) / 2;
  return { x: wx, y: wy };
}

/**
 * Get depth for sorting (higher Y = further back in isometric view)
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {number} Depth value
 */
export function getIsoDepth(x, y) {
  return y; // Simple: use Y coordinate
}

/**
 * Transform input direction to match isometric visual directions
 * @param {number} mx - Input X direction (-1 to 1)
 * @param {number} my - Input Y direction (-1 to 1)
 * @returns {{x: number, y: number}} Normalized world direction vector
 */
export function transformInputForIsometric(mx, my) {
  // mx: -1 (left) to +1 (right)
  // my: -1 (up) to +1 (down)
  
  // The correct transformation matrix:
  // Right (mx=1) -> world (+1, -1): worldX = mx, worldY = -mx
  // Up (my=-1) -> world (-1, -1): worldX = my, worldY = my
  // Combined: worldX = mx + my, worldY = -mx + my
  const worldX = mx + my;
  const worldY = -mx + my;
  
  // Normalize to maintain consistent speed in world space
  // This ensures movement speed is the same in all directions
  const len = Math.hypot(worldX, worldY);
  if (len === 0) return { x: 0, y: 0 };
  
  // Return normalized direction vector
  // The magnitude is always 1, so speed will be consistent
  return { x: worldX / len, y: worldY / len };
}

/**
 * Draw isometric cube (3 visible sides: top, left, right)
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} screenX - Screen X position in isometric space (ground level)
 * @param {number} screenY - Screen Y position in isometric space (ground level)
 * @param {number} size - Size of the cube (radius equivalent)
 * @param {string} color - Base color
 * @param {number} isoScale - Isometric scale factor (default 0.01)
 * @param {number} z - Z coordinate (height, default 0)
 */
export function drawIsometricCube(ctx, screenX, screenY, size, color, isoScale = 0.01, z = 0) {
  // In isometric projection, a cube appears as:
  // - Top face: diamond shape (at the top)
  // - Left face: parallelogram (visible on the left side)
  // - Right face: parallelogram (visible on the right side)
  
  // Convert size from world units to isometric screen space
  // Reduce multiplier so cube fits within collision radius (no visual overlap with walls)
  const baseMultiplier = 45; // Reduced from 60 to ensure cube fits within collision circle
  const cubeSize = size * baseMultiplier * isoScale;
  
  // In isometric projection, use ISO_TILE_WIDTH and ISO_TILE_HEIGHT ratios
  // For a cube in isometric: width = size, height = size/2 (2:1 ratio)
  // Reduce visual extent to ensure it fits within the collision radius
  const halfW = cubeSize * 0.4; // Reduced from 0.5 to fit within collision circle
  const halfH = cubeSize * 0.2; // Reduced from 0.25 to fit within collision circle
  const height = cubeSize * 0.5; // Reduced from 0.6 to match smaller base
  
  // Adjust screen position based on z (jump height)
  // In isometric, higher z means higher on screen (negative Y)
  const zOffset = -z * isoScale * 100; // Scale z offset appropriately
  
  // Ground level (base of cube) - center point
  const groundX = screenX;
  const groundY = screenY + zOffset;
  
  // Ground level corners (base of cube in isometric - diamond shape)
  const groundRightX = groundX + halfW;
  const groundRightY = groundY + halfH;
  const groundBottomX = groundX;
  const groundBottomY = groundY + halfH * 2;
  const groundLeftX = groundX - halfW;
  const groundLeftY = groundY + halfH;
  
  // Top face corners (diamond shape, raised by height - SAME SIZE as base)
  // The top face should be the same size as the base for proper cube geometry
  const topCenterX = groundX;
  const topCenterY = groundY - height;
  const topRightX = topCenterX + halfW;
  const topRightY = topCenterY + halfH;
  const topBottomX = topCenterX;
  const topBottomY = topCenterY + halfH * 2;
  const topLeftX = topCenterX - halfW;
  const topLeftY = topCenterY + halfH;
  
  // Draw left face first (so it appears behind)
  // Left face connects: topLeft -> topBottom -> groundBottom -> groundLeft
  const leftColor = adjustBrightness(color, -0.15);
  ctx.fillStyle = leftColor;
  ctx.beginPath();
  ctx.moveTo(topLeftX, topLeftY);        // Top-left corner of top face
  ctx.lineTo(topBottomX, topBottomY);    // Bottom corner of top face
  ctx.lineTo(groundBottomX, groundBottomY); // Bottom corner of ground
  ctx.lineTo(groundLeftX, groundLeftY); // Left corner of ground
  ctx.closePath();
  ctx.fill();
  
  // Draw right face (behind top face)
  // Right face connects: topRight -> topBottom -> groundBottom -> groundRight
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(topRightX, topRightY);      // Top-right corner of top face
  ctx.lineTo(topBottomX, topBottomY);    // Bottom corner of top face
  ctx.lineTo(groundBottomX, groundBottomY); // Bottom corner of ground
  ctx.lineTo(groundRightX, groundRightY); // Right corner of ground
  ctx.closePath();
  ctx.fill();
  
  // Draw top face (diamond) - lighter color, drawn last so it's on top
  const topColor = adjustBrightness(color, 0.2);
  ctx.fillStyle = topColor;
  ctx.beginPath();
  ctx.moveTo(topCenterX, topCenterY);  // Top point
  ctx.lineTo(topRightX, topRightY);    // Right point
  ctx.lineTo(topBottomX, topBottomY);   // Bottom point
  ctx.lineTo(topLeftX, topLeftY);      // Left point
  ctx.closePath();
  ctx.fill();
  
  // Add edges for definition (draw on top of faces)
  ctx.strokeStyle = adjustBrightness(color, -0.3);
  ctx.lineWidth = 1.5;
  // Draw edges for left face
  ctx.beginPath();
  ctx.moveTo(topLeftX, topLeftY);
  ctx.lineTo(topBottomX, topBottomY);
  ctx.lineTo(groundBottomX, groundBottomY);
  ctx.lineTo(groundLeftX, groundLeftY);
  ctx.closePath();
  ctx.stroke();
  // Draw edges for right face
  ctx.beginPath();
  ctx.moveTo(topRightX, topRightY);
  ctx.lineTo(topBottomX, topBottomY);
  ctx.lineTo(groundBottomX, groundBottomY);
  ctx.lineTo(groundRightX, groundRightY);
  ctx.closePath();
  ctx.stroke();
  // Draw edges for top face
  ctx.beginPath();
  ctx.moveTo(topCenterX, topCenterY);
  ctx.lineTo(topRightX, topRightY);
  ctx.lineTo(topBottomX, topBottomY);
  ctx.lineTo(topLeftX, topLeftY);
  ctx.closePath();
  ctx.stroke();
}

/**
 * Draw entity as isometric cube
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} screenX - Screen X position
 * @param {number} screenY - Screen Y position
 * @param {number} size - Entity size (radius equivalent)
 * @param {string} color - Base color
 * @param {number} isoScale - Isometric scale factor (default 0.01)
 * @param {boolean} shadow - Whether to draw shadow (default true)
 * @param {number} z - Z coordinate (height, default 0)
 */
export function drawEntityAsCube(ctx, screenX, screenY, size, color, isoScale = 0.01, shadow = true, z = 0) {
  // Draw shadow first (ellipse on ground at isometric position)
  // Shadow should scale with cube size and isoScale
  // Shadow offset increases with z (jump height) - shadow moves away from entity
  if (shadow) {
    // Calculate shadow size based on cube size (same scaling as cube)
    const baseMultiplier = 45; // Match cube baseMultiplier
    const cubeSize = size * baseMultiplier * isoScale;
    // Shadow is an ellipse that matches the isometric projection
    // Width is larger, height is smaller (isometric 2:1 ratio)
    const shadowWidth = cubeSize * 0.5; // Reduced to match smaller cube
    const shadowHeight = cubeSize * 0.25; // Reduced to match smaller cube
    
    // Shadow offset based on z (higher z = shadow further from entity)
    // In isometric, shadow moves down and slightly away when entity is higher
    const shadowOffsetX = z * isoScale * 20; // Shadow moves slightly right when jumping
    const shadowOffsetY = z * isoScale * 40; // Shadow moves down when jumping
    const shadowAlpha = Math.max(0.15, 0.4 - z * 0.01); // Shadow fades when higher
    
    ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(screenX + shadowOffsetX, screenY + shadowOffsetY, shadowWidth, shadowHeight, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Draw the isometric cube (with z offset)
  drawIsometricCube(ctx, screenX, screenY, size, color, isoScale, z);
}

/**
 * Draw isometric rectangle (for map/ground rendering)
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {object} rect - Rectangle in world coordinates {x, y, w, h}
 * @param {string} color - Fill color
 * @param {number} camX - Camera X position in world space (default 0)
 * @param {number} camY - Camera Y position in world space (default 0)
 * @param {number} screenW - Screen width for centering (default 0)
 * @param {number} screenH - Screen height for centering (default 0)
 * @param {number} isoScale - Isometric scale factor (default 0.01)
 */
export function drawIsometricRectangle(ctx, rect, color, camX = 0, camY = 0, screenW = 0, screenH = 0, isoScale = 0.01) {
  // Convert absolute positions to isometric, then subtract camera's isometric position
  // Use exact coordinates to match collision geometry - no visual padding
  const camIso = worldToIso(camX, camY, 0, isoScale);
  const topLeft = worldToIso(rect.x, rect.y, 0, isoScale);
  const topRight = worldToIso(rect.x + rect.w, rect.y, 0, isoScale);
  const bottomRight = worldToIso(rect.x + rect.w, rect.y + rect.h, 0, isoScale);
  const bottomLeft = worldToIso(rect.x, rect.y + rect.h, 0, isoScale);
  
  // Center on screen if screen dimensions provided
  const offsetX = screenW > 0 ? screenW / 2 - camIso.x : -camIso.x;
  const offsetY = screenH > 0 ? screenH / 2 - camIso.y : -camIso.y;
  
  // Draw as parallelogram (isometric rectangle)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(offsetX + topLeft.x, offsetY + topLeft.y);
  ctx.lineTo(offsetX + topRight.x, offsetY + topRight.y);
  ctx.lineTo(offsetX + bottomRight.x, offsetY + bottomRight.y);
  ctx.lineTo(offsetX + bottomLeft.x, offsetY + bottomLeft.y);
  ctx.closePath();
  ctx.fill();
  
  // No border - unified floor design
}
