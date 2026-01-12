/**
 * WorldRenderer - Handles rendering of all game world objects
 * 
 * This module contains functions for drawing:
 * - Game world (background, interactables, collectibles)
 * - Game entities (player, enemies, boss)
 * - Projectiles and particles
 * - Danger zones (boss attack indicators)
 */

import { worldToIso, drawIsometricCube, drawEntityAsCube, drawIsometricRectangle } from "./IsometricRenderer.js";
import { ISO_MODE } from "../data/constants.js";
import { INTERACT } from "../data/constants.js";
import { BOSS_ABILITY_STATE, DANGER_ZONE_TYPE } from "../game/systems/BossAbilitySystem.js";
import { clamp } from "../utils/math.js";
import { lerpColor } from "../utils/color.js";

/**
 * Draws boss danger zones (telegraphed attack areas)
 * @param {Object} s - Game state
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} cam - Camera object
 * @param {Array} dangerZones - Array of danger zone objects
 * @param {number} isoScale - Isometric scale factor
 */
export function drawDangerZones(s, ctx, cam, dangerZones, isoScale) {
  if (!dangerZones || dangerZones.length === 0) return;
  
  const { w, h } = s.arena;
  const pulse = Math.sin(s.t * 10) * 0.2 + 0.8; // Stronger pulsing effect
  
  for (const zone of dangerZones) {
    const alpha = zone.alpha * (zone.pulse ? pulse : 1.0);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = zone.color;
    ctx.fillStyle = zone.color;
    ctx.lineWidth = 5; // Thicker default line width
    
    if (zone.type === DANGER_ZONE_TYPE.CONE) {
      // Draw cone attack zone
      const centerX = ISO_MODE ? (() => {
        const zoneIso = worldToIso(zone.x, zone.y, 0, isoScale);
        const camIso = worldToIso(cam.x, cam.y, 0, isoScale);
        return w / 2 + zoneIso.x - camIso.x;
      })() : zone.x;
      const centerY = ISO_MODE ? (() => {
        const zoneIso = worldToIso(zone.x, zone.y, 0, isoScale);
        const camIso = worldToIso(cam.x, cam.y, 0, isoScale);
        return h / 2 + zoneIso.y - camIso.y;
      })() : zone.y;
      
      // Draw cone sector
      const startAngle = zone.angle - zone.angleWidth / 2;
      const endAngle = zone.angle + zone.angleWidth / 2;
      const range = ISO_MODE ? zone.range * isoScale * 0.5 : zone.range;
      
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, range, startAngle, endAngle);
      ctx.closePath();
      ctx.fill();
      
      // Outer edge highlight - much thicker and brighter
      ctx.globalAlpha = Math.min(alpha * 1.8, 1.0);
      ctx.lineWidth = 8;
      ctx.strokeStyle = zone.state === BOSS_ABILITY_STATE.WINDUP ? 'rgba(255,255,0,1.0)' : 'rgba(255,0,0,1.0)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, range, startAngle, endAngle);
      ctx.stroke();
      
      // Additional inner edge for clarity
      ctx.globalAlpha = Math.min(alpha * 1.3, 1.0);
      ctx.lineWidth = 4;
      ctx.strokeStyle = zone.color;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + Math.cos(startAngle) * range, centerY + Math.sin(startAngle) * range);
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + Math.cos(endAngle) * range, centerY + Math.sin(endAngle) * range);
      ctx.stroke();
      
    } else if (zone.type === DANGER_ZONE_TYPE.LINE_DASH) {
      // Draw line dash zone
      const startX = ISO_MODE ? (() => {
        const startIso = worldToIso(zone.x, zone.y, 0, isoScale);
        const camIso = worldToIso(cam.x, cam.y, 0, isoScale);
        return w / 2 + startIso.x - camIso.x;
      })() : zone.x;
      const startY = ISO_MODE ? (() => {
        const startIso = worldToIso(zone.x, zone.y, 0, isoScale);
        const camIso = worldToIso(cam.x, cam.y, 0, isoScale);
        return h / 2 + startIso.y - camIso.y;
      })() : zone.y;
      const endX = ISO_MODE ? (() => {
        const endIso = worldToIso(zone.targetX, zone.targetY, 0, isoScale);
        const camIso = worldToIso(cam.x, cam.y, 0, isoScale);
        return w / 2 + endIso.x - camIso.x;
      })() : zone.targetX;
      const endY = ISO_MODE ? (() => {
        const endIso = worldToIso(zone.targetX, zone.targetY, 0, isoScale);
        const camIso = worldToIso(cam.x, cam.y, 0, isoScale);
        return h / 2 + endIso.y - camIso.y;
      })() : zone.targetY;
      
      const width = ISO_MODE ? zone.width * isoScale * 0.5 : zone.width;
      const dx = endX - startX;
      const dy = endY - startY;
      const dist = Math.hypot(dx, dy);
      const perpX = -dy / dist;
      const perpY = dx / dist;
      
      // Draw rectangle
      ctx.beginPath();
      ctx.moveTo(startX + perpX * width / 2, startY + perpY * width / 2);
      ctx.lineTo(startX - perpX * width / 2, startY - perpY * width / 2);
      ctx.lineTo(endX - perpX * width / 2, endY - perpY * width / 2);
      ctx.lineTo(endX + perpX * width / 2, endY + perpY * width / 2);
      ctx.closePath();
      ctx.fill();
      
      // Edge highlight - much thicker and brighter
      ctx.globalAlpha = Math.min(alpha * 1.8, 1.0);
      ctx.lineWidth = 8;
      ctx.strokeStyle = zone.state === BOSS_ABILITY_STATE.WINDUP ? 'rgba(255,255,0,1.0)' : 'rgba(255,0,0,1.0)';
      ctx.stroke();
      
      // Additional corner highlights for clarity
      ctx.globalAlpha = Math.min(alpha * 1.3, 1.0);
      ctx.lineWidth = 6;
      ctx.strokeStyle = zone.color;
      ctx.beginPath();
      ctx.arc(startX, startY, width / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(endX, endY, width / 2, 0, Math.PI * 2);
      ctx.stroke();
      
    } else if (zone.type === DANGER_ZONE_TYPE.RING_PULSE) {
      // Draw ring pulse zone
      const centerX = ISO_MODE ? (() => {
        const zoneIso = worldToIso(zone.x, zone.y, 0, isoScale);
        const camIso = worldToIso(cam.x, cam.y, 0, isoScale);
        return w / 2 + zoneIso.x - camIso.x;
      })() : zone.x;
      const centerY = ISO_MODE ? (() => {
        const zoneIso = worldToIso(zone.x, zone.y, 0, isoScale);
        const camIso = worldToIso(cam.x, cam.y, 0, isoScale);
        return h / 2 + zoneIso.y - camIso.y;
      })() : zone.y;
      
      let innerR = ISO_MODE ? zone.innerRadius * isoScale * 0.5 : zone.innerRadius;
      let outerR = ISO_MODE ? zone.outerRadius * isoScale * 0.5 : zone.outerRadius;
      
      // Safety check: ensure outer radius is always larger than inner
      if (outerR <= innerR) {
        outerR = innerR + 20; // Minimum visible ring width
      }
      
      // Draw safe zone indicator (center is safe) if flag is set
      if (zone.showSafeZone && innerR > 0) {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = 'rgba(0,255,0,0.5)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, innerR, 0, Math.PI * 2);
        ctx.fill();
        
        // Safe zone border
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = 'rgba(0,255,0,1.0)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(centerX, centerY, innerR, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // Draw donut (outer circle minus inner circle)
      ctx.globalAlpha = alpha;
      ctx.fillStyle = zone.color;
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerR, 0, Math.PI * 2);
      ctx.arc(centerX, centerY, innerR, 0, Math.PI * 2, true); // Counter-clockwise for hole
      ctx.fill();
      
      // Edge highlights - much thicker and brighter
      ctx.globalAlpha = Math.min(alpha * 1.8, 1.0);
      ctx.lineWidth = 8;
      ctx.strokeStyle = zone.state === BOSS_ABILITY_STATE.WINDUP ? 'rgba(255,255,0,1.0)' : 'rgba(255,0,0,1.0)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerR, 0, Math.PI * 2);
      ctx.stroke();
      
      // Inner edge highlight
      if (innerR > 0) {
        ctx.globalAlpha = Math.min(alpha * 1.5, 1.0);
        ctx.lineWidth = 6;
        ctx.strokeStyle = zone.color;
        ctx.beginPath();
        ctx.arc(centerX, centerY, innerR, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (zone.type === DANGER_ZONE_TYPE.TELEPORT) {
      // Draw teleport destination
      const centerX = ISO_MODE ? (() => {
        const zoneIso = worldToIso(zone.x, zone.y, 0, isoScale);
        const camIso = worldToIso(cam.x, cam.y, 0, isoScale);
        return w / 2 + zoneIso.x - camIso.x;
      })() : zone.x;
      const centerY = ISO_MODE ? (() => {
        const zoneIso = worldToIso(zone.x, zone.y, 0, isoScale);
        const camIso = worldToIso(cam.x, cam.y, 0, isoScale);
        return h / 2 + zoneIso.y - camIso.y;
      })() : zone.y;
      
      const radius = ISO_MODE ? zone.radius * isoScale * 0.5 : zone.radius;
      
      // Draw pulsing circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Outer glow
      ctx.globalAlpha = Math.min(alpha * 1.5, 1.0);
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(150,50,255,1.0)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Inner bright ring
      ctx.globalAlpha = 1.0;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(200,100,255,1.0)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      
    } else if (zone.type === DANGER_ZONE_TYPE.CHARGE) {
      // Draw charge zone (similar to line dash but wider)
      const startX = ISO_MODE ? (() => {
        const startIso = worldToIso(zone.x, zone.y, 0, isoScale);
        const camIso = worldToIso(cam.x, cam.y, 0, isoScale);
        return w / 2 + startIso.x - camIso.x;
      })() : zone.x;
      const startY = ISO_MODE ? (() => {
        const startIso = worldToIso(zone.x, zone.y, 0, isoScale);
        const camIso = worldToIso(cam.x, cam.y, 0, isoScale);
        return h / 2 + startIso.y - camIso.y;
      })() : zone.y;
      const endX = ISO_MODE ? (() => {
        const endIso = worldToIso(zone.targetX, zone.targetY, 0, isoScale);
        const camIso = worldToIso(cam.x, cam.y, 0, isoScale);
        return w / 2 + endIso.x - camIso.x;
      })() : zone.targetX;
      const endY = ISO_MODE ? (() => {
        const endIso = worldToIso(zone.targetX, zone.targetY, 0, isoScale);
        const camIso = worldToIso(cam.x, cam.y, 0, isoScale);
        return h / 2 + endIso.y - camIso.y;
      })() : zone.targetY;
      
      const width = ISO_MODE ? zone.width * isoScale * 0.5 : zone.width;
      const dx = endX - startX;
      const dy = endY - startY;
      const dist = Math.hypot(dx, dy);
      const perpX = -dy / dist;
      const perpY = dx / dist;
      
      // Draw rectangle
      ctx.beginPath();
      ctx.moveTo(startX + perpX * width / 2, startY + perpY * width / 2);
      ctx.lineTo(startX - perpX * width / 2, startY - perpY * width / 2);
      ctx.lineTo(endX - perpX * width / 2, endY - perpY * width / 2);
      ctx.lineTo(endX + perpX * width / 2, endY + perpY * width / 2);
      ctx.closePath();
      ctx.fill();
      
      // Edge highlight
      ctx.globalAlpha = Math.min(alpha * 1.8, 1.0);
      ctx.lineWidth = 8;
      ctx.strokeStyle = zone.state === BOSS_ABILITY_STATE.WINDUP ? 'rgba(255,200,0,1.0)' : 'rgba(255,0,0,1.0)';
      ctx.stroke();
      
      // Corner highlights
      ctx.globalAlpha = Math.min(alpha * 1.3, 1.0);
      ctx.lineWidth = 6;
      ctx.strokeStyle = zone.color;
      ctx.beginPath();
      ctx.arc(startX, startY, width / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(endX, endY, width / 2, 0, Math.PI * 2);
      ctx.stroke();
      
    } else if (zone.type === DANGER_ZONE_TYPE.MULTI_SHOT) {
      // Draw multi-shot beam
      const centerX = ISO_MODE ? (() => {
        const zoneIso = worldToIso(zone.x, zone.y, 0, isoScale);
        const camIso = worldToIso(cam.x, cam.y, 0, isoScale);
        return w / 2 + zoneIso.x - camIso.x;
      })() : zone.x;
      const centerY = ISO_MODE ? (() => {
        const zoneIso = worldToIso(zone.x, zone.y, 0, isoScale);
        const camIso = worldToIso(cam.x, cam.y, 0, isoScale);
        return h / 2 + zoneIso.y - camIso.y;
      })() : zone.y;
      
      const range = ISO_MODE ? zone.range * isoScale * 0.5 : zone.range;
      const beamWidth = ISO_MODE ? zone.width * isoScale * 0.5 : zone.width;
      
      // Draw beam as a narrow rectangle
      const endX = centerX + Math.cos(zone.angle) * range;
      const endY = centerY + Math.sin(zone.angle) * range;
      const perpX = -Math.sin(zone.angle);
      const perpY = Math.cos(zone.angle);
      
      ctx.beginPath();
      ctx.moveTo(centerX + perpX * beamWidth / 2, centerY + perpY * beamWidth / 2);
      ctx.lineTo(centerX - perpX * beamWidth / 2, centerY - perpY * beamWidth / 2);
      ctx.lineTo(endX - perpX * beamWidth / 2, endY - perpY * beamWidth / 2);
      ctx.lineTo(endX + perpX * beamWidth / 2, endY + perpY * beamWidth / 2);
      ctx.closePath();
      ctx.fill();
      
      // Edge highlight
      ctx.globalAlpha = Math.min(alpha * 1.5, 1.0);
      ctx.lineWidth = 4;
      ctx.strokeStyle = zone.state === BOSS_ABILITY_STATE.WINDUP ? 'rgba(255,200,100,1.0)' : 'rgba(255,100,100,1.0)';
      ctx.stroke();
      
    } else if (zone.type === 'burning_ground') {
      // Draw burning ground from phase 2 effects
      const centerX = ISO_MODE ? (() => {
        const zoneIso = worldToIso(zone.x, zone.y, 0, isoScale);
        const camIso = worldToIso(cam.x, cam.y, 0, isoScale);
        return w / 2 + zoneIso.x - camIso.x;
      })() : zone.x;
      const centerY = ISO_MODE ? (() => {
        const zoneIso = worldToIso(zone.x, zone.y, 0, isoScale);
        const camIso = worldToIso(cam.x, cam.y, 0, isoScale);
        return h / 2 + zoneIso.y - camIso.y;
      })() : zone.y;
      
      if (zone.angle !== undefined) {
        // Cone-shaped burning ground
        const startAngle = zone.angle - zone.angleWidth / 2;
        const endAngle = zone.angle + zone.angleWidth / 2;
        const range = ISO_MODE ? zone.range * isoScale * 0.5 : zone.range;
        
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#ff4400';
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, range, startAngle, endAngle);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  
  ctx.globalAlpha = 1.0;
}

/**
 * Main world rendering function
 * Draws the entire game world including background, entities, projectiles, and effects
 * @param {Object} s - Game state
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} isoScale - Isometric scale factor
 */
export function drawWorld(s, ctx, isoScale) {
  const { w, h, padding } = s.arena;
  const p = s.player;

  ctx.clearRect(0, 0, w, h);

  const hue = s.bgHue;
  ctx.globalAlpha = 1;
  
  // Apply camera transform
  const cam = s.camera || { x: 0, y: 0 };
  ctx.save();
  // Camera transform is handled per-entity in isometric mode
  // No global transform needed for isometric - we'll convert positions individually
  if (!ISO_MODE) {
    // Top-down view: simple camera transform
    ctx.translate(-cam.x, -cam.y);
  }

  // Determine biome colors
  const biome = s.levelData?.biome || "grassland";
  let bgHue = hue;
  let bgSat = 55;
  let bgLight = 7;
  let roomHue = hue;
  let roomSat = 45;
  let roomLight = 11;
  let corrLight = 9;
  
  if (biome === "desert") {
    bgHue = 40; // Yellow/orange
    bgSat = 50;
    bgLight = 12;
    roomHue = 40;
    roomSat = 45;
    roomLight = 15;
    corrLight = 13;
  } else if (biome === "winter") {
    bgHue = 200; // Blue/cyan
    bgSat = 30;
    bgLight = 20;
    roomHue = 200;
    roomSat = 25;
    roomLight = 22;
    corrLight = 21;
  } else if (biome === "forest") {
    bgHue = 120; // Green
    bgSat = 50;
    bgLight = 8;
    roomHue = 120;
    roomSat = 40;
    roomLight = 12;
    corrLight = 10;
  } else if (biome === "volcanic") {
    bgHue = 10; // Red/orange
    bgSat = 60;
    bgLight = 10;
    roomHue = 10;
    roomSat = 55;
    roomLight = 13;
    corrLight = 11;
  }
  
  // Draw map background
  ctx.fillStyle = `hsl(${bgHue}, ${bgSat}%, ${bgLight}%)`;
  if (s.levelData) {
    if (ISO_MODE) {
      // Draw entire level area as isometric background
      // For isometric, we need to draw a large background rectangle
      const { w, h } = s.arena;
      const scale = isoScale;
      const bgRect = { x: 0, y: 0, w: s.levelData.w, h: s.levelData.h };
      drawIsometricRectangle(ctx, bgRect, `hsl(${bgHue}, ${bgSat}%, ${bgLight}%)`, cam.x, cam.y, w, h, scale);
      
      // Draw all walkable areas with unified color (no distinction between rooms and corridors)
      // Draw using exact coordinates to match collision geometry - no visual-only expansion
      const unifiedColor = `hsl(${roomHue}, ${roomSat}%, ${roomLight}%)`;
      if (s.levelData.corridors && s.levelData.corridors.length > 0) {
        for (const corr of s.levelData.corridors) {
          // Draw corridor using exact coordinates (matches collision geometry)
          drawIsometricRectangle(ctx, corr, unifiedColor, cam.x, cam.y, w, h, scale);
        }
      }
      if (s.levelData.rooms && s.levelData.rooms.length > 0) {
        for (const room of s.levelData.rooms) {
          // Draw room using exact coordinates (matches collision geometry)
          drawIsometricRectangle(ctx, room, unifiedColor, cam.x, cam.y, w, h, scale);
        }
      }
    } else {
      // Top-down view (original)
      // Fill entire level area
      ctx.fillRect(0, 0, s.levelData.w, s.levelData.h);
      
      // Draw all walkable areas with unified color (no distinction between rooms and corridors)
      // Draw using exact coordinates to match collision geometry - no visual-only expansion
      ctx.fillStyle = `hsl(${roomHue}, ${roomSat}%, ${roomLight}%)`;
      if (s.levelData.corridors && s.levelData.corridors.length > 0) {
        for (const corr of s.levelData.corridors) {
          // Draw corridor using exact coordinates (matches collision geometry)
          ctx.fillRect(corr.x, corr.y, corr.w, corr.h);
        }
      }
      if (s.levelData.rooms && s.levelData.rooms.length > 0) {
        for (const room of s.levelData.rooms) {
          // Draw room using exact coordinates (matches collision geometry)
          ctx.fillRect(room.x, room.y, room.w, room.h);
        }
      }
    }
    
    // Draw outer boundary only (subtle edge)
    ctx.strokeStyle = `hsl(${roomHue}, ${roomSat + 10}%, ${roomLight + 5}%)`;
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, s.levelData.w, s.levelData.h);
  } else {
    // Fallback if no level data
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = `hsl(${hue}, 45%, 18%)`;
    ctx.lineWidth = 2;
    ctx.strokeRect(padding, padding, w - padding * 2, h - padding * 2);
  }

  // Apply screen shake offset (if any)
  let ox = 0;
  let oy = 0;
  if (s.shakeT > 0 && s.shakeDur > 0) {
    const t = s.shakeT / s.shakeDur;
    const mag = s.shakeMag * t;
    ox = Math.sin(s.t * 53) * mag;
    oy = Math.cos(s.t * 61) * mag;
  }

  // Apply screen shake to camera transform (so everything shakes together)
  if (ox !== 0 || oy !== 0) {
    ctx.translate(ox, oy);
  }

  for (const it of s.interact) {
    if (it.used) continue;
    ctx.save();
    if (ISO_MODE) {
      const { w, h } = s.arena;
      const scale = isoScale;
      const itIso = worldToIso(it.x, it.y, 0, scale);
      const camIso = worldToIso(cam.x, cam.y, 0, scale);
      ctx.translate(w / 2 + itIso.x - camIso.x, h / 2 + itIso.y - camIso.y);
    } else {
      ctx.translate(it.x, it.y);
    }
    
    if (it.kind === INTERACT.BOSS_TP) {
      // Boss portal - pulsing effect
      const pulse = Math.sin(s.t * 4) * 0.3 + 0.7;
      ctx.strokeStyle = `rgba(255,93,93,${pulse})`;
      ctx.fillStyle = `rgba(255,93,93,${0.2 * pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Inner circle
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.stroke();
    } else if (it.kind === INTERACT.CHEST) {
      ctx.strokeStyle = "#2ea8ff";
      ctx.fillStyle = "rgba(46,168,255,0.14)";
      ctx.fillRect(-14, -10, 28, 20);
      ctx.strokeRect(-14, -10, 28, 20);
    } else if (it.kind === INTERACT.SHRINE) {
      ctx.strokeStyle = "#4dff88";
      ctx.fillStyle = "rgba(77,255,136,0.14)";
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (it.kind === INTERACT.MAGNET_SHRINE) {
      ctx.strokeStyle = "#ffd44a";
      ctx.fillStyle = "rgba(255,212,74,0.14)";
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Draw magnet symbol (M shape)
      ctx.strokeStyle = "#ffd44a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, -4);
      ctx.lineTo(-6, 4);
      ctx.lineTo(0, 0);
      ctx.lineTo(6, 4);
      ctx.lineTo(6, -4);
      ctx.stroke();
    } else if (it.kind === INTERACT.MICROWAVE) {
      ctx.strokeStyle = "#ff7a3d";
      ctx.fillStyle = "rgba(255,122,61,0.14)";
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (it.kind === INTERACT.GREED) {
      ctx.strokeStyle = "#ffd44a";
      ctx.fillStyle = "rgba(255,212,74,0.14)";
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.strokeStyle = "#2ea8ff";
      ctx.fillStyle = "rgba(46,168,255,0.14)";
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    
    // Draw interactable label above the interactable
    ctx.save();
    ctx.translate(0, -25);
    ctx.globalAlpha = 0.9;
    
    let label = "";
    let labelW = 70;
    let showPrice = false;
    
    if (it.kind === INTERACT.CHEST) {
      label = "Chest";
      showPrice = true;
      labelW = 90; // Wider for price
    } else if (it.kind === INTERACT.SHRINE) label = "Buff";
    else if (it.kind === INTERACT.MICROWAVE) label = "HP+";
    else if (it.kind === INTERACT.GREED) {
      label = "Greed";
      showPrice = true;
      labelW = 90;
    } else if (it.kind === INTERACT.BOSS_TP) {
      label = "Boss";
      showPrice = true;
      labelW = 90;
    }
    
    // Draw label text (no background box)
    ctx.fillStyle = "#e6e8ff";
    ctx.font = "10px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 0, showPrice ? -4 : 0);
    
    // Draw price for chests and other paid interactables
    if (showPrice) {
      const p = s.player;
      // Calculate dynamic cost for boss portal (percentage of current gold)
      let displayCost = it.cost;
      if (it.kind === INTERACT.BOSS_TP && it.cost === -1) {
        const percentageCost = Math.round(p.coins * 0.2);
        displayCost = Math.max(100, percentageCost);
      }
      
      if (displayCost > 0) {
        const canAfford = p.coins >= displayCost;
        ctx.fillStyle = canAfford ? "#ffd44a" : "#ff5d5d";
        ctx.font = "bold 11px ui-sans-serif, system-ui";
        ctx.fillText(`${displayCost}`, 0, 10);
      }
    }
    
    ctx.restore();
    
    ctx.restore();
  }

  // Draw XP gems
  for (const g of s.gems) {
    const a = clamp(1 - g.t / 0.35, 0, 1);
    ctx.globalAlpha = 0.75 + a * 0.25;
    ctx.fillStyle = "#4dff88";
    let gemX, gemY;
    if (ISO_MODE) {
      const { w, h } = s.arena;
      const scale = isoScale;
      const gemIso = worldToIso(g.x, g.y, 0, scale);
      const camIso = worldToIso(cam.x, cam.y, 0, scale);
      gemX = w / 2 + gemIso.x - camIso.x;
      gemY = h / 2 + gemIso.y - camIso.y;
    } else {
      gemX = g.x;
      gemY = g.y;
    }
    ctx.beginPath();
    ctx.arc(gemX, gemY, g.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw gold coins
  for (const c of s.coins) {
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#ffd44a";
    let coinX, coinY;
    if (ISO_MODE) {
      const { w, h } = s.arena;
      const scale = isoScale;
      const coinIso = worldToIso(c.x, c.y, 0, scale);
      const camIso = worldToIso(cam.x, cam.y, 0, scale);
      coinX = w / 2 + coinIso.x - camIso.x;
      coinY = h / 2 + coinIso.y - camIso.y;
    } else {
      coinX = c.x;
      coinY = c.y;
    }
    ctx.beginPath();
    ctx.arc(coinX, coinY, c.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw consumable potions
  for (const cons of s.consumables) {
    ctx.globalAlpha = 0.85;
    let color = "#4dff88"; // Default green
    if (cons.type === "speed") color = "#2ea8ff"; // Blue for speed
    else if (cons.type === "heal") color = "#ff5d5d"; // Red for heal
    else if (cons.type === "magnet") color = "#ffd44a"; // Yellow for magnet
    else if (cons.type === "gold") color = "#ffaa00"; // Orange/gold for gold boost
    
    let consX, consY;
    if (ISO_MODE) {
      const { w, h } = s.arena;
      const scale = isoScale;
      const consIso = worldToIso(cons.x, cons.y, 0, scale);
      const camIso = worldToIso(cam.x, cam.y, 0, scale);
      consX = w / 2 + consIso.x - camIso.x;
      consY = h / 2 + consIso.y - camIso.y;
    } else {
      consX = cons.x;
      consY = cons.y;
    }
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(consX, consY, cons.r, 0, Math.PI * 2);
    ctx.fill();
    
    // Add glow effect
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(consX, consY, cons.r + 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  for (const b of s.bullets) {
    // Convert bullet position to isometric if needed
    let bulletX, bulletY, prevX, prevY;
    if (ISO_MODE) {
      const { w, h } = s.arena;
      const scale = isoScale;
      const bulletIso = worldToIso(b.x, b.y, 0, scale);
      const camIso = worldToIso(cam.x, cam.y, 0, scale);
      bulletX = w / 2 + bulletIso.x - camIso.x;
      bulletY = h / 2 + bulletIso.y - camIso.y;
      if (b.px !== undefined && b.py !== undefined) {
        const prevIso = worldToIso(b.px, b.py, 0, scale);
        prevX = w / 2 + prevIso.x - camIso.x;
        prevY = h / 2 + prevIso.y - camIso.y;
      }
    } else {
      bulletX = b.x;
      bulletY = b.y;
      prevX = b.px;
      prevY = b.py;
    }
    
    // Draw bullet trail
    if (prevX !== undefined && prevY !== undefined) {
      const dx = bulletX - prevX;
      const dy = bulletY - prevY;
      const dist = Math.hypot(dx, dy);
      if (dist > 0) {
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = b.r * 1.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(bulletX, bulletY);
        ctx.stroke();
        ctx.restore();
      }
    }
    
    // Draw bullet with glow
    ctx.save();
    
    // Firey effect for burn weapons
    // Check boomerang first (before other effects)
    if (b.boomerang) {
      // Small banana-shaped projectile that spins
      ctx.save();
      ctx.translate(bulletX, bulletY);
      ctx.rotate(b.rotation || 0);
      
      // Size based on bullet radius, but make it visible
      const size = Math.max(8, b.r * 1.5); // Small but visible
      const length = size * 2.5; // Banana is elongated
      const width = size * 0.8; // Narrower than long
      
      // Draw banana shape (curved, elongated)
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = "#ffd700"; // Bright yellow
      ctx.beginPath();
      // Banana curve: start at top-left, curve down and right
      ctx.moveTo(-length * 0.4, -width * 0.3);
      ctx.quadraticCurveTo(0, 0, length * 0.4, width * 0.3);
      ctx.quadraticCurveTo(length * 0.5, width * 0.5, length * 0.3, width * 0.6);
      ctx.quadraticCurveTo(0, width * 0.4, -length * 0.3, width * 0.2);
      ctx.quadraticCurveTo(-length * 0.4, 0, -length * 0.4, -width * 0.3);
      ctx.closePath();
      ctx.fill();
      
      // Add highlight for 3D effect
      ctx.fillStyle = "#ffed4e";
      ctx.beginPath();
      ctx.moveTo(-length * 0.2, -width * 0.2);
      ctx.quadraticCurveTo(0, -width * 0.1, length * 0.2, width * 0.1);
      ctx.quadraticCurveTo(length * 0.3, width * 0.3, length * 0.15, width * 0.4);
      ctx.quadraticCurveTo(0, width * 0.2, -length * 0.15, width * 0.05);
      ctx.quadraticCurveTo(-length * 0.2, -width * 0.1, -length * 0.2, -width * 0.2);
      ctx.closePath();
      ctx.fill();
      
      // Outline for definition
      ctx.strokeStyle = "#ffaa00";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-length * 0.4, -width * 0.3);
      ctx.quadraticCurveTo(0, 0, length * 0.4, width * 0.3);
      ctx.quadraticCurveTo(length * 0.5, width * 0.5, length * 0.3, width * 0.6);
      ctx.quadraticCurveTo(0, width * 0.4, -length * 0.3, width * 0.2);
      ctx.quadraticCurveTo(-length * 0.4, 0, -length * 0.4, -width * 0.3);
      ctx.closePath();
      ctx.stroke();
      
      ctx.restore();
    } else if (b.isBone) {
      // Special drawing for bone - draw as rotating rectangle
      ctx.save();
      ctx.translate(bulletX, bulletY);
      ctx.rotate(b.rotation || 0);
      ctx.fillStyle = b.color || "#ffffff";
      // Draw bone as a rectangle (longer than wide)
      ctx.fillRect(-b.r * 1.5, -b.r * 0.6, b.r * 3, b.r * 1.2);
      // Add slight highlight
      ctx.fillStyle = "#f0f0f0";
      ctx.fillRect(-b.r * 1.5, -b.r * 0.6, b.r * 3, b.r * 0.4);
      ctx.restore();
    } else if (b.explosive) {
      // Delayed explosive bullet - large, pulsing, very visible
      const timeUntilExplosion = b.explodeAfter || 0;
      const pulse = Math.sin(s.t * 8) * 0.3 + 0.7; // Pulsing effect
      
      // If injected, make it more visible and show countdown
      if (b.injected) {
        // Pulsing effect increases as countdown approaches zero
        const urgencyPulse = timeUntilExplosion < 0.5 ? Math.sin(s.t * 20) * 0.4 + 0.6 : pulse;
        
        // Massive outer glow (pulsing faster when about to explode)
        ctx.shadowBlur = 25;
        ctx.shadowColor = "#ffaa00";
        ctx.globalAlpha = 0.7 * urgencyPulse;
        ctx.fillStyle = "#ffaa00";
        ctx.beginPath();
        ctx.arc(bulletX, bulletY, b.r * 3.0, 0, Math.PI * 2);
        ctx.fill();
        
        // Large middle ring
        ctx.shadowBlur = 15;
        ctx.globalAlpha = 0.9 * urgencyPulse;
        ctx.fillStyle = "#ff8800";
        ctx.beginPath();
        ctx.arc(bulletX, bulletY, b.r * 2.2, 0, Math.PI * 2);
        ctx.fill();
        
        // Bright core
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = "#ffcc00";
        ctx.beginPath();
        ctx.arc(bulletX, bulletY, b.r * 1.5, 0, Math.PI * 2);
        ctx.fill();
        
        // White hot center
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(bulletX, bulletY, b.r * 0.8, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw countdown indicator (always show when injected)
        if (timeUntilExplosion > 0) {
          ctx.save();
          ctx.globalAlpha = 1.0;
          ctx.fillStyle = timeUntilExplosion < 0.5 ? "#ff0000" : "#ffffff";
          ctx.font = "bold 14px ui-sans-serif, system-ui";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(timeUntilExplosion.toFixed(1), bulletX, bulletY - b.r * 3.5);
          ctx.restore();
        }
      } else {
        // Not injected yet - seeking enemy
        // Massive outer glow (pulsing)
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#ffaa00";
        ctx.globalAlpha = 0.6 * pulse;
        ctx.fillStyle = "#ffaa00";
        ctx.beginPath();
        ctx.arc(bulletX, bulletY, b.r * 2.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Large middle ring
        ctx.shadowBlur = 12;
        ctx.globalAlpha = 0.8 * pulse;
        ctx.fillStyle = "#ff8800";
        ctx.beginPath();
        ctx.arc(bulletX, bulletY, b.r * 1.8, 0, Math.PI * 2);
        ctx.fill();
        
        // Bright core
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = "#ffcc00";
        ctx.beginPath();
        ctx.arc(bulletX, bulletY, b.r * 1.2, 0, Math.PI * 2);
        ctx.fill();
        
        // White hot center
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(bulletX, bulletY, b.r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (b.effect === "burn" || b.glow) {
      // Outer glow
      ctx.shadowBlur = 12;
      ctx.shadowColor = b.color;
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(bulletX, bulletY, b.r * 1.4, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner bright core
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffaa44";
      ctx.beginPath();
      ctx.arc(bulletX, bulletY, b.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.crit) {
      ctx.shadowBlur = 6;
      ctx.shadowColor = "#ffd44a";
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(bulletX, bulletY, b.r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(bulletX, bulletY, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Draw boss danger zones FIRST (before entities) so they appear on the ground
  if (s.boss.active && s.boss.controller) {
    const dangerZones = s.boss.controller.getAllDangerZones(p, s.levelData);
    drawDangerZones(s, ctx, cam, dangerZones, isoScale);
  }

  // In isometric mode, we need to depth sort all entities (player + enemies) by isometric Y
  // Entities with higher isometric Y (further back) should be drawn first
  if (ISO_MODE) {
    const { w, h } = s.arena;
    const scale = isoScale;
    
    // Collect all entities with their isometric depth
    const entities = [];
    
    // Add player
    const playerZ = p.z || 0;
    const playerIso = worldToIso(p.x, p.y, playerZ, scale);
    const camIso = worldToIso(cam.x, cam.y, 0, scale);
    entities.push({
      type: 'player',
      entity: p,
      isoY: playerIso.y,
      color: p.iFrames > 0 ? "#9cffd6" : "#2ea8ff",
      screenX: w / 2 + playerIso.x - camIso.x,
      screenY: h / 2 + playerIso.y - camIso.y,
      z: playerZ,
    });
    
    // Add boss if active
    if (s.boss.active) {
      const b = s.boss;
      const bossIso = worldToIso(b.x, b.y, 0, scale);
      entities.push({
        type: 'boss',
        entity: b,
        isoY: bossIso.y,
        color: b.enraged ? "#ff5d5d" : "#ffd44a",
        screenX: w / 2 + bossIso.x - camIso.x,
        screenY: h / 2 + bossIso.y - camIso.y,
      });
    }
    
    // Add enemies
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      const slowed = e.slowT > 0;
      let col = slowed ? "#7bf1ff" : e.tier === "brute" ? "#ff7a3d" : e.tier === "spitter" ? "#ff5d5d" : e.tier === "runner" ? "#c23bff" : e.tier === "shocker" ? "#00ffff" : e.tier === "tank" ? "#8b4513" : "#e6e8ff";
      
      // Red flash when taking damage
      if (e.hitT > 0) {
        const flashIntensity = clamp(e.hitT / 0.12, 0, 1);
        col = lerpColor(col, "#ff5d5d", flashIntensity * 0.8);
      }
      
      const entityIso = worldToIso(e.x, e.y, 0, scale);
      const camIso = worldToIso(cam.x, cam.y, 0, scale);
      entities.push({
        type: 'enemy',
        entity: e,
        isoY: entityIso.y,
        color: col,
        screenX: w / 2 + entityIso.x - camIso.x,
        screenY: h / 2 + entityIso.y - camIso.y,
        isElite: e.isElite,
        isGoldenElite: e.isGoldenElite,
        poisonT: e.poisonT,
        burnT: e.burnT,
        hitT: e.hitT,
      });
    }
    
    // Sort by isometric Y (LOWER Y = further back, draw first)
    // In isometric view, entities with lower isoY appear higher on screen (further back)
    // Entities with higher isoY appear lower on screen (closer/in front)
    entities.sort((a, b) => a.isoY - b.isoY);
    
    // Draw all entities in sorted order (shadows first, then cubes)
    // First pass: draw all shadows
    for (const ent of entities) {
      const entZ = ent.z || 0;
      drawEntityAsCube(ctx, ent.screenX, ent.screenY, ent.entity.r, ent.color, scale, true, entZ);
    }
    
    // Second pass: draw all cubes in depth order (shadows already drawn)
    for (const ent of entities) {
      const entZ = ent.z || 0;
      if (ent.type === 'enemy') {
        // Draw elite glow effect (if any)
        if (ent.isElite) {
          ctx.shadowBlur = 15;
          ctx.shadowColor = ent.isGoldenElite ? "#ffd44a" : "#c23bff";
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = ent.isGoldenElite ? "#ffd44a" : "#c23bff";
          ctx.beginPath();
          ctx.arc(ent.screenX, ent.screenY, ent.entity.r * 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        
        // Check if this enemy has an explosive bullet injected
        let hasExplosive = false;
        let explosiveTimeLeft = 0;
        for (const bullet of s.bullets) {
          if (bullet.explosive && bullet.injected && bullet.injectedEnemy) {
            // Check if this bullet is attached to this enemy (by reference or position)
            if (bullet.injectedEnemy === ent.entity || 
                (bullet.injectedEnemy.x === ent.entity.x && bullet.injectedEnemy.y === ent.entity.y && bullet.injectedEnemy.hp > 0)) {
              hasExplosive = true;
              explosiveTimeLeft = bullet.explodeAfter || 0;
              break;
            }
          }
        }
        
        // Visual indicators for DoT effects
        if (ent.poisonT > 0) {
          ctx.strokeStyle = "#4dff88";
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.arc(ent.screenX, ent.screenY, ent.entity.r + 3, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (ent.burnT > 0) {
          ctx.strokeStyle = "#ff7a3d";
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.arc(ent.screenX, ent.screenY, ent.entity.r + 2, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        // Draw enemy cube
        ctx.globalAlpha = ent.hitT > 0 ? 0.7 : 1;
        drawIsometricCube(ctx, ent.screenX, ent.screenY, ent.entity.r, ent.color, scale, entZ);
        
        // Draw explosive countdown ring AFTER cube (so it's on top and visible)
        if (hasExplosive && explosiveTimeLeft > 0) {
          const urgency = 1 - (explosiveTimeLeft / 2.0); // 0 to 1 as countdown progresses
          const pulse = Math.sin(s.t * 12 + urgency * 10) * 0.3 + 0.7;
          const ringRadius = ent.entity.r + 10 + urgency * 8; // Ring grows as countdown approaches
          
          // Outer pulsing ring - very visible
          ctx.strokeStyle = explosiveTimeLeft < 0.5 ? "#ff0000" : "#ffaa00";
          ctx.lineWidth = 4 + urgency * 3;
          ctx.globalAlpha = 1.0 * pulse;
          ctx.shadowBlur = 10;
          ctx.shadowColor = explosiveTimeLeft < 0.5 ? "#ff0000" : "#ffaa00";
          ctx.beginPath();
          ctx.arc(ent.screenX, ent.screenY, ringRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
          
          // Inner bright ring
          ctx.strokeStyle = "#ffcc00";
          ctx.lineWidth = 3;
          ctx.globalAlpha = 1.0;
          ctx.beginPath();
          ctx.arc(ent.screenX, ent.screenY, ent.entity.r + 8, 0, Math.PI * 2);
          ctx.stroke();
          
          // Countdown text above enemy - very visible
          ctx.save();
          ctx.globalAlpha = 1.0;
          ctx.fillStyle = explosiveTimeLeft < 0.5 ? "#ff0000" : "#ffaa00";
          ctx.font = "bold 18px ui-sans-serif, system-ui";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.shadowBlur = 4;
          ctx.shadowColor = explosiveTimeLeft < 0.5 ? "#ff0000" : "#ffaa00";
          ctx.fillText(explosiveTimeLeft.toFixed(1), ent.screenX, ent.screenY - ent.entity.r - 25);
          ctx.restore();
        }
        
        // Draw HP bar
        const hpT = clamp(ent.entity.hp / ent.entity.maxHp, 0, 1);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(ent.screenX - ent.entity.r, ent.screenY - ent.entity.r - 10, ent.entity.r * 2, 4);
        ctx.fillStyle = "#1fe06a";
        ctx.fillRect(ent.screenX - ent.entity.r, ent.screenY - ent.entity.r - 10, ent.entity.r * 2 * hpT, 4);
        ctx.globalAlpha = 1;
      } else if (ent.type === 'boss') {
        // Check if boss has an explosive bullet injected
        let hasExplosive = false;
        let explosiveTimeLeft = 0;
        for (const bullet of s.bullets) {
          if (bullet.explosive && bullet.injected && bullet.injectedEnemy) {
            // Check if this bullet is attached to this boss (by reference or position)
            if (bullet.injectedEnemy === ent.entity || 
                (bullet.injectedEnemy.x === ent.entity.x && bullet.injectedEnemy.y === ent.entity.y && bullet.injectedEnemy.hp > 0)) {
              hasExplosive = true;
              explosiveTimeLeft = bullet.explodeAfter || 0;
              break;
            }
          }
        }
        
        // Draw explosive countdown ring (very visible)
        if (hasExplosive && explosiveTimeLeft > 0) {
          const urgency = 1 - (explosiveTimeLeft / 2.0);
          const pulse = Math.sin(s.t * 12 + urgency * 10) * 0.3 + 0.7;
          const ringRadius = ent.entity.r + 10 + urgency * 8;
          
          // Outer pulsing ring
          ctx.strokeStyle = explosiveTimeLeft < 0.5 ? "#ff0000" : "#ffaa00";
          ctx.lineWidth = 4 + urgency * 3;
          ctx.globalAlpha = 0.9 * pulse;
          ctx.beginPath();
          ctx.arc(ent.screenX, ent.screenY, ringRadius, 0, Math.PI * 2);
          ctx.stroke();
          
          // Inner bright ring
          ctx.strokeStyle = "#ffcc00";
          ctx.lineWidth = 3;
          ctx.globalAlpha = 1.0;
          ctx.beginPath();
          ctx.arc(ent.screenX, ent.screenY, ent.entity.r + 8, 0, Math.PI * 2);
          ctx.stroke();
          
          // Countdown text above boss
          ctx.save();
          ctx.globalAlpha = 1.0;
          ctx.fillStyle = explosiveTimeLeft < 0.5 ? "#ff0000" : "#ffaa00";
          ctx.font = "bold 18px ui-sans-serif, system-ui";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(explosiveTimeLeft.toFixed(1), ent.screenX, ent.screenY - ent.entity.r - 25);
          ctx.restore();
        }
        
        // Draw boss visual feedback during attacks (windup/active states)
        if (ent.entity.controller) {
          const bossState = ent.entity.controller.getCurrentState();
          if (bossState === BOSS_ABILITY_STATE.WINDUP || bossState === BOSS_ABILITY_STATE.ACTIVE) {
            const pulse = Math.sin(s.t * 15) * 0.3 + 0.7;
            const glowRadius = ent.entity.r * (1.3 + pulse * 0.2);
            const glowColor = bossState === BOSS_ABILITY_STATE.WINDUP ? 'rgba(255,220,0,0.6)' : 'rgba(255,50,50,0.7)';
            
            // Outer glow
            ctx.shadowBlur = 20;
            ctx.shadowColor = bossState === BOSS_ABILITY_STATE.WINDUP ? '#ffdd00' : '#ff0000';
            ctx.globalAlpha = pulse * 0.8;
            ctx.fillStyle = glowColor;
            ctx.beginPath();
            ctx.arc(ent.screenX, ent.screenY, glowRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            
            // Inner bright ring
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = bossState === BOSS_ABILITY_STATE.WINDUP ? '#ffdd00' : '#ff0000';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(ent.screenX, ent.screenY, ent.entity.r + 5, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        
        // Draw boss cube
        drawIsometricCube(ctx, ent.screenX, ent.screenY, ent.entity.r, ent.color, scale, entZ);
        
        // Draw boss HP bar (at top of screen)
        const hpT = clamp(ent.entity.hp / ent.entity.maxHp, 0, 1);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(w * 0.25, padding * 0.6, w * 0.5, 10);
        ctx.fillStyle = "#ffd44a";
        ctx.fillRect(w * 0.25, padding * 0.6, w * 0.5 * hpT, 10);
        ctx.globalAlpha = 1;
      } else {
        // Draw player cube
        drawIsometricCube(ctx, ent.screenX, ent.screenY, ent.entity.r, ent.color, scale, entZ);
      }
    }
  } else {
    // Top-down mode: draw danger zones first, then enemies and player
    if (s.boss.active && s.boss.controller) {
      const dangerZones = s.boss.controller.getAllDangerZones(p, s.levelData);
      drawDangerZones(s, ctx, cam, dangerZones, isoScale);
    }
    
    // Draw enemies and player normally (no depth sorting needed)
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      const slowed = e.slowT > 0;
      let col = slowed ? "#7bf1ff" : e.tier === "brute" ? "#ff7a3d" : e.tier === "spitter" ? "#ff5d5d" : e.tier === "runner" ? "#c23bff" : e.tier === "shocker" ? "#00ffff" : e.tier === "tank" ? "#8b4513" : "#e6e8ff";
      
      // Elite enemies have a glow effect
      if (e.isElite) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = e.isGoldenElite ? "#ffd44a" : "#c23bff";
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = e.isGoldenElite ? "#ffd44a" : "#c23bff";
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      
      // Red flash when taking damage
      if (e.hitT > 0) {
        const flashIntensity = clamp(e.hitT / 0.12, 0, 1);
        col = lerpColor(col, "#ff5d5d", flashIntensity * 0.8);
      }
      
      // Check if this enemy has an explosive bullet injected
      let hasExplosive = false;
      let explosiveTimeLeft = 0;
      for (const bullet of s.bullets) {
        if (bullet.explosive && bullet.injected && bullet.injectedEnemy) {
          // Check if this bullet is attached to this enemy (by reference or position)
          if (bullet.injectedEnemy === e || 
              (bullet.injectedEnemy.x === e.x && bullet.injectedEnemy.y === e.y && bullet.injectedEnemy.hp > 0)) {
            hasExplosive = true;
            explosiveTimeLeft = bullet.explodeAfter || 0;
            break;
          }
        }
      }
      
      // Visual indicators for DoT effects
      if (e.poisonT > 0) {
        ctx.strokeStyle = "#4dff88";
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (e.burnT > 0) {
        ctx.strokeStyle = "#ff7a3d";
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // Draw enemy (top-down view)
      ctx.globalAlpha = e.hitT > 0 ? 0.7 : 1;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw explosive countdown ring AFTER enemy (so it's on top and visible)
      if (hasExplosive && explosiveTimeLeft > 0) {
        const urgency = 1 - (explosiveTimeLeft / 2.0); // 0 to 1 as countdown progresses
        const pulse = Math.sin(s.t * 12 + urgency * 10) * 0.3 + 0.7;
        const ringRadius = e.r + 10 + urgency * 8; // Ring grows as countdown approaches
        
        // Outer pulsing ring - very visible
        ctx.strokeStyle = explosiveTimeLeft < 0.5 ? "#ff0000" : "#ffaa00";
        ctx.lineWidth = 4 + urgency * 3;
        ctx.globalAlpha = 1.0 * pulse;
        ctx.shadowBlur = 10;
        ctx.shadowColor = explosiveTimeLeft < 0.5 ? "#ff0000" : "#ffaa00";
        ctx.beginPath();
        ctx.arc(e.x, e.y, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        // Inner bright ring
        ctx.strokeStyle = "#ffcc00";
        ctx.lineWidth = 3;
        ctx.globalAlpha = 1.0;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 8, 0, Math.PI * 2);
        ctx.stroke();
        
        // Countdown text above enemy - very visible
        ctx.save();
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = explosiveTimeLeft < 0.5 ? "#ff0000" : "#ffaa00";
        ctx.font = "bold 18px ui-sans-serif, system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowBlur = 4;
        ctx.shadowColor = explosiveTimeLeft < 0.5 ? "#ff0000" : "#ffaa00";
        ctx.fillText(explosiveTimeLeft.toFixed(1), e.x, e.y - e.r - 25);
        ctx.restore();
      }

      const hpT = clamp(e.hp / e.maxHp, 0, 1);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(e.x - e.r, e.y - e.r - 10, e.r * 2, 4);
      ctx.fillStyle = "#1fe06a";
      ctx.fillRect(e.x - e.r, e.y - e.r - 10, e.r * 2 * hpT, 4);
      ctx.globalAlpha = 1;
    }

    if (s.boss.active) {
      const b = s.boss;
        
      // Check if boss has an explosive bullet injected
      let hasExplosive = false;
      let explosiveTimeLeft = 0;
      for (const bullet of s.bullets) {
        if (bullet.explosive && bullet.injected && bullet.injectedEnemy) {
          // Check if this bullet is attached to this boss (by reference or position)
          if (bullet.injectedEnemy === b || 
              (bullet.injectedEnemy.x === b.x && bullet.injectedEnemy.y === b.y && bullet.injectedEnemy.hp > 0)) {
            hasExplosive = true;
            explosiveTimeLeft = bullet.explodeAfter || 0;
            break;
          }
        }
      }
        
      // Draw explosive countdown ring (very visible)
      if (hasExplosive && explosiveTimeLeft > 0) {
        const urgency = 1 - (explosiveTimeLeft / 2.0);
        const pulse = Math.sin(s.t * 12 + urgency * 10) * 0.3 + 0.7;
        const ringRadius = b.r + 10 + urgency * 8;
        
        // Outer pulsing ring
        ctx.strokeStyle = explosiveTimeLeft < 0.5 ? "#ff0000" : "#ffaa00";
        ctx.lineWidth = 4 + urgency * 3;
        ctx.globalAlpha = 0.9 * pulse;
        ctx.beginPath();
        ctx.arc(b.x, b.y, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Inner bright ring
        ctx.strokeStyle = "#ffcc00";
        ctx.lineWidth = 3;
        ctx.globalAlpha = 1.0;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + 8, 0, Math.PI * 2);
        ctx.stroke();
        
        // Countdown text above boss
        ctx.save();
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = explosiveTimeLeft < 0.5 ? "#ff0000" : "#ffaa00";
        ctx.font = "bold 18px ui-sans-serif, system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(explosiveTimeLeft.toFixed(1), b.x, b.y - b.r - 25);
        ctx.restore();
      }
        
      // Draw boss visual feedback during attacks (windup/active states)
      if (b.controller) {
        const bossState = b.controller.getCurrentState();
        if (bossState === BOSS_ABILITY_STATE.WINDUP || bossState === BOSS_ABILITY_STATE.ACTIVE) {
          const pulse = Math.sin(s.t * 15) * 0.3 + 0.7;
          const glowRadius = b.r * (1.3 + pulse * 0.2);
          const glowColor = bossState === BOSS_ABILITY_STATE.WINDUP ? 'rgba(255,220,0,0.6)' : 'rgba(255,50,50,0.7)';
          
          // Outer glow
          ctx.shadowBlur = 20;
          ctx.shadowColor = bossState === BOSS_ABILITY_STATE.WINDUP ? '#ffdd00' : '#ff0000';
          ctx.globalAlpha = pulse * 0.8;
          ctx.fillStyle = glowColor;
          ctx.beginPath();
          ctx.arc(b.x, b.y, glowRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          
          // Inner bright ring
          ctx.globalAlpha = 1.0;
          ctx.strokeStyle = bossState === BOSS_ABILITY_STATE.WINDUP ? '#ffdd00' : '#ff0000';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r + 5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      
      ctx.globalAlpha = 1;
      ctx.fillStyle = b.enraged ? "#ff5d5d" : "#ffd44a";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();

      const hpT = clamp(b.hp / b.maxHp, 0, 1);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(w * 0.25, padding * 0.6, w * 0.5, 10);
      ctx.fillStyle = "#ffd44a";
      ctx.fillRect(w * 0.25, padding * 0.6, w * 0.5 * hpT, 10);
    }

    // Draw player (top-down view)
    ctx.globalAlpha = 1;
    const playerColor = p.iFrames > 0 ? "#9cffd6" : "#2ea8ff";
    ctx.fillStyle = playerColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Draw orbiting blades
  if (p.weapons) {
    for (const weapon of p.weapons) {
      if (weapon.id === "orbiting_blades" && weapon.weaponMode === "orbit" && weapon.orbitAngle !== undefined) {
        const orbitRadius = Math.max(40, (weapon.weaponMeleeR || 60) * p.sizeMult);
        const bladeCount = weapon.orbitBlades || 2;
        const angleStep = (Math.PI * 2) / bladeCount;
        
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = "#c0c0c0";
        ctx.fillStyle = "#ffffff";
        ctx.lineWidth = 2;
        
        for (let i = 0; i < bladeCount; i++) {
          const bladeAngle = weapon.orbitAngle + angleStep * i;
          let bladeX, bladeY;
          
          if (ISO_MODE) {
            // Convert to isometric coordinates for orbiting blades
            const { w, h } = s.arena;
            const scale = isoScale;
            const playerIso = worldToIso(p.x, p.y, 0, scale);
            const camIso = worldToIso(cam.x, cam.y, 0, scale);
            const playerScreenX = w / 2 + playerIso.x - camIso.x;
            const playerScreenY = h / 2 + playerIso.y - camIso.y;
            
            // Calculate blade position in world space, then convert to isometric
            const worldBladeX = p.x + Math.cos(bladeAngle) * orbitRadius;
            const worldBladeY = p.y + Math.sin(bladeAngle) * orbitRadius;
            const bladeIso = worldToIso(worldBladeX, worldBladeY, 0, scale);
            bladeX = w / 2 + bladeIso.x - camIso.x;
            bladeY = h / 2 + bladeIso.y - camIso.y;
          } else {
            bladeX = p.x + Math.cos(bladeAngle) * orbitRadius;
            bladeY = p.y + Math.sin(bladeAngle) * orbitRadius;
          }
          
          // Draw blade as a small rotating rectangle/sword shape
          ctx.save();
          ctx.translate(bladeX, bladeY);
          ctx.rotate(bladeAngle + Math.PI / 2); // Rotate blade perpendicular to orbit
          
          // Blade shape (small rectangle)
          const bladeLength = 12;
          const bladeWidth = 4;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(-bladeWidth / 2, -bladeLength / 2, bladeWidth, bladeLength);
          
          // Blade glow
          ctx.shadowBlur = 8;
          ctx.shadowColor = "#ffffff";
          ctx.strokeStyle = "#c0c0c0";
          ctx.lineWidth = 1;
          ctx.strokeRect(-bladeWidth / 2, -bladeLength / 2, bladeWidth, bladeLength);
          ctx.shadowBlur = 0;
          
          ctx.restore();
        }
      }
    }
  }

  if (p.shield > 0) {
    ctx.strokeStyle = "#9cffd6";
    ctx.globalAlpha = 0.9;
    // Shield thickness increases with charges: 1px base + 1px per charge (capped at reasonable max)
    const shieldThickness = 1 + Math.min(p.shield, 10); // Max 11px thickness
    ctx.lineWidth = shieldThickness;
    if (ISO_MODE) {
      const { w, h } = s.arena;
      const scale = isoScale;
      const playerIso = worldToIso(p.x, p.y, 0, scale);
      const camIso = worldToIso(cam.x, cam.y, 0, scale);
      const screenX = w / 2 + playerIso.x - camIso.x;
      const screenY = h / 2 + playerIso.y - camIso.y;
      ctx.beginPath();
      ctx.arc(screenX, screenY, p.r + 6, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  
  // Draw spikes for Spiky Shield (thorns)
  if (p.thorns > 0) {
    ctx.strokeStyle = "#ff7a3d";
    ctx.fillStyle = "#ff7a3d";
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 2;
    const spikeCount = 8;
    const spikeLength = 4 + p.thorns * 12; // Smaller spikes - scale with thorns value
    const spikeRadius = p.r + 4;
    if (ISO_MODE) {
      const { w, h } = s.arena;
      const scale = isoScale;
      const playerIso = worldToIso(p.x, p.y, 0, scale);
      const camIso = worldToIso(cam.x, cam.y, 0, scale);
      const centerX = w / 2 + playerIso.x - camIso.x;
      const centerY = h / 2 + playerIso.y - camIso.y;
      for (let i = 0; i < spikeCount; i++) {
        const angle = (i / spikeCount) * Math.PI * 2;
        const startX = centerX + Math.cos(angle) * spikeRadius;
        const startY = centerY + Math.sin(angle) * spikeRadius;
        const endX = centerX + Math.cos(angle) * (spikeRadius + spikeLength);
        const endY = centerY + Math.sin(angle) * (spikeRadius + spikeLength);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        // Draw small triangle at tip
        const tipAngle1 = angle + 0.3;
        const tipAngle2 = angle - 0.3;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX + Math.cos(tipAngle1) * 3, endY + Math.sin(tipAngle1) * 3);
        ctx.lineTo(endX + Math.cos(tipAngle2) * 3, endY + Math.sin(tipAngle2) * 3);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      for (let i = 0; i < spikeCount; i++) {
        const angle = (i / spikeCount) * Math.PI * 2;
        const startX = p.x + Math.cos(angle) * spikeRadius;
        const startY = p.y + Math.sin(angle) * spikeRadius;
        const endX = p.x + Math.cos(angle) * (spikeRadius + spikeLength);
        const endY = p.y + Math.sin(angle) * (spikeRadius + spikeLength);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        // Draw small triangle at tip
        const tipAngle1 = angle + 0.3;
        const tipAngle2 = angle - 0.3;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX + Math.cos(tipAngle1) * 3, endY + Math.sin(tipAngle1) * 3);
        ctx.lineTo(endX + Math.cos(tipAngle2) * 3, endY + Math.sin(tipAngle2) * 3);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  ctx.globalAlpha = 1;
  for (const q of s.particles) {
    const t = clamp(1 - q.t / q.life, 0, 1);
    const hue2 = q.hue == null ? hue : q.hue;
    
    let particleX, particleY;
    if (ISO_MODE) {
      const { w, h } = s.arena;
      const scale = isoScale;
      const particleIso = worldToIso(q.x, q.y, 0, scale);
      const camIso = worldToIso(cam.x, cam.y, 0, scale);
      particleX = w / 2 + particleIso.x - camIso.x;
      particleY = h / 2 + particleIso.y - camIso.y;
    } else {
      particleX = q.x;
      particleY = q.y;
    }
    
    if (q.glow) {
      // Glowing particles with outer glow
      ctx.save();
      ctx.globalAlpha = t * 0.4;
      ctx.fillStyle = `hsl(${hue2}, 90%, 70%)`;
      ctx.shadowBlur = 8;
      ctx.shadowColor = `hsl(${hue2}, 90%, 60%)`;
      ctx.beginPath();
      ctx.arc(particleX, particleY, q.r * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    
    ctx.globalAlpha = t;
    ctx.fillStyle = `hsl(${hue2}, 80%, ${q.glow ? 75 : 62}%)`;
    ctx.beginPath();
    ctx.arc(particleX, particleY, q.r, 0, Math.PI * 2);
    ctx.fill();
    
    if (q.trail) {
      // Draw trail
      ctx.globalAlpha = t * 0.3;
      ctx.beginPath();
      ctx.arc(particleX, particleY, q.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // Draw hit flashes
  if (s.hitFlashes) {
    for (const flash of s.hitFlashes) {
      const t = clamp(1 - flash.t / flash.life, 0, 1);
      let flashX, flashY;
      if (ISO_MODE) {
        const { w, h } = s.arena;
        const scale = isoScale;
        const flashIso = worldToIso(flash.x, flash.y, 0, scale);
        const camIso = worldToIso(cam.x, cam.y, 0, scale);
        flashX = w / 2 + flashIso.x - camIso.x;
        flashY = h / 2 + flashIso.y - camIso.y;
      } else {
        flashX = flash.x;
        flashY = flash.y;
      }
      ctx.save();
      ctx.globalAlpha = t * 0.6;
      ctx.fillStyle = flash.color;
      ctx.shadowBlur = 15;
      ctx.shadowColor = flash.color;
      ctx.beginPath();
      ctx.arc(flashX, flashY, 20 * flash.size * t, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Draw burning areas (ground fire) - more subtle visual
  for (const area of s.burningAreas) {
    const t = clamp(1 - area.t / area.life, 0, 1);
    const pulse = Math.sin(s.t * 6 + area.t * 2) * 0.3 + 0.7;
    
    let areaX, areaY;
    if (ISO_MODE) {
      const { w, h } = s.arena;
      const scale = isoScale;
      const areaIso = worldToIso(area.x, area.y, 0, scale);
      const camIso = worldToIso(cam.x, cam.y, 0, scale);
      areaX = w / 2 + areaIso.x - camIso.x;
      areaY = h / 2 + areaIso.y - camIso.y;
    } else {
      areaX = area.x;
      areaY = area.y;
    }
    
    // In isometric mode, draw as ellipse on the floor (ground plane)
    if (ISO_MODE) {
      // Outer glow - very subtle (ellipse on isometric ground)
      ctx.globalAlpha = t * 0.15 * pulse;
      ctx.fillStyle = "#ff7a3d";
      ctx.beginPath();
      // Ellipse: wider horizontally, shorter vertically (isometric projection)
      ctx.ellipse(areaX, areaY, area.r * 1.2, area.r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner ring - subtle pattern
      ctx.globalAlpha = t * 0.25 * pulse;
      ctx.fillStyle = "#ffaa44";
      ctx.beginPath();
      ctx.ellipse(areaX, areaY, area.r * 0.7 * 1.2, area.r * 0.7 * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Small bright core - very small and subtle
      ctx.globalAlpha = t * 0.4 * pulse;
      ctx.fillStyle = "#ffcc66";
      ctx.beginPath();
      ctx.ellipse(areaX, areaY, area.r * 0.3 * 1.2, area.r * 0.3 * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Top-down mode: draw as circles
      // Outer glow - very subtle
      ctx.globalAlpha = t * 0.15 * pulse;
      ctx.fillStyle = "#ff7a3d";
      ctx.beginPath();
      ctx.arc(areaX, areaY, area.r, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner ring - subtle pattern
      ctx.globalAlpha = t * 0.25 * pulse;
      ctx.fillStyle = "#ffaa44";
      ctx.beginPath();
      ctx.arc(areaX, areaY, area.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
      
      // Small bright core - very small and subtle
      ctx.globalAlpha = t * 0.4 * pulse;
      ctx.fillStyle = "#ffcc66";
      ctx.beginPath();
      ctx.arc(areaX, areaY, area.r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Reset alpha
    ctx.globalAlpha = 1.0;
  }

  // Draw auras (player AoE effects)
  for (const aura of s.auras) {
    const t = clamp(1 - aura.t / aura.life, 0, 1);
    ctx.globalAlpha = t * 0.4;
    ctx.strokeStyle = aura.color || "#ff7a3d";
    ctx.lineWidth = 2;
    if (ISO_MODE) {
      const { w, h } = s.arena;
      const scale = isoScale;
      const playerIso = worldToIso(p.x, p.y, 0, scale);
      const camIso = worldToIso(cam.x, cam.y, 0, scale);
      const centerX = w / 2 + playerIso.x - camIso.x;
      const centerY = h / 2 + playerIso.y - camIso.y;
      ctx.beginPath();
      ctx.arc(centerX, centerY, aura.r, 0, Math.PI * 2);
      ctx.stroke();
      // Pulsing effect
      const pulse = Math.sin(s.t * 8) * 0.2 + 0.8;
      ctx.globalAlpha = t * 0.2 * pulse;
      ctx.fillStyle = aura.color || "#ff7a3d";
      ctx.beginPath();
      ctx.arc(centerX, centerY, aura.r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, aura.r, 0, Math.PI * 2);
      ctx.stroke();
      // Pulsing effect
      const pulse = Math.sin(s.t * 8) * 0.2 + 0.8;
      ctx.globalAlpha = t * 0.2 * pulse;
      ctx.fillStyle = aura.color || "#ff7a3d";
      ctx.beginPath();
      ctx.arc(p.x, p.y, aura.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // Draw slice effects, shockwaves, and particles
  for (const f of s.floaters) {
    let floaterX, floaterY;
    if (ISO_MODE) {
      const { w, h } = s.arena;
      const scale = isoScale;
      // For floaters with velocity, calculate final position
      const finalX = f.x + (f.vx || 0) * (f.t || 0);
      const finalY = f.y + (f.vy || 0) * (f.t || 0);
      const floaterIso = worldToIso(finalX, finalY, 0, scale);
      const camIso = worldToIso(cam.x, cam.y, 0, scale);
      floaterX = w / 2 + floaterIso.x - camIso.x;
      floaterY = h / 2 + floaterIso.y - camIso.y;
    } else {
      floaterX = f.x + (f.vx || 0) * (f.t || 0);
      floaterY = f.y + (f.vy || 0) * (f.t || 0);
    }
    
    if (f.type === "shockwave") {
      const t = clamp(f.t / f.life, 0, 1);
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.8;
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 3 - t * 2;
      ctx.beginPath();
      ctx.arc(floaterX, floaterY, f.r * (0.3 + t * 0.7), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      continue;
    } else if (f.type === "particle") {
      const t = clamp(f.t / f.life, 0, 1);
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(floaterX, floaterY, 3 * (1 - t), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    } else if (f.type === "slice") {
      const t = clamp(1 - f.t / f.life, 0, 1);
      ctx.globalAlpha = t;
      ctx.strokeStyle = f.color || "#ffffff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      const startX = floaterX - Math.cos(f.angle) * f.length * 0.5;
      const startY = floaterY - Math.sin(f.angle) * f.length * 0.5;
      const endX = floaterX + Math.cos(f.angle) * f.length * 0.5;
      const endY = floaterY + Math.sin(f.angle) * f.length * 0.5;
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      // Add glow
      ctx.shadowBlur = 8;
      ctx.shadowColor = f.color || "#ffffff";
      ctx.stroke();
      ctx.shadowBlur = 0;
      continue;
    }
    
    const t = clamp(1 - f.t / f.life, 0, 1);
    ctx.globalAlpha = t;
    ctx.fillStyle = f.col;
    ctx.font = `${f.size}px ui-sans-serif, system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(f.text, floaterX, floaterY);
  }

  ctx.restore(); // End camera transform
  
  // No viewport border - the level boundaries are drawn in world space
}
