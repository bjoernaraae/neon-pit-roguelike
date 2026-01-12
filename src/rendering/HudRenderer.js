/**
 * HudRenderer - Handles rendering of all UI elements
 * 
 * This module contains functions for drawing:
 * - HUD (health, XP, gold, floor, ability hotbar)
 * - Minimap (top-right corner)
 * - Overlay screens (levelup, menu, pause, stats, death)
 */

import { format } from "../utils/math.js";
import { computeSpeed } from "../utils/gameMath.js";
import { ISO_MODE, INTERACT, RARITY, RARITY_COLOR } from "../data/constants.js";

// Latest updates constant (should eventually be moved to constants.js)
const LATEST_UPDATES = [
  "• Enhanced upgrade visuals & fanfare",
  "• Improved boss mechanics & telegraphs",
  "• Balanced economy & chest costs",
  "• New keyboard controls (A/D/E)",
  "• Map generation improvements"
];

/**
 * Draws the minimap in the top-right corner
 * @param {Object} s - Game state
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 */
export function drawMinimap(s, ctx) {
  const { w, h } = s.arena;
  
  // Ensure we're in screen space (reset any transforms)
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform to identity
  
  const mapSize = 120;
  const mapX = w - mapSize - 10;
  const mapY = 10;
  
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "rgba(0,0,0,0.8)";
  ctx.fillRect(mapX, mapY, mapSize, mapSize);
  ctx.strokeStyle = "rgba(230,232,255,0.5)";
  ctx.lineWidth = 1;
  ctx.strokeRect(mapX, mapY, mapSize, mapSize);
  
  if (s.levelData) {
    const levelW = s.levelData.w || w;
    const levelH = s.levelData.h || h;
    const scale = mapSize / Math.max(levelW, levelH);
    
    // Minimal classic minimap - just show room outlines and key points
    ctx.strokeStyle = "rgba(46,168,255,0.4)";
    ctx.lineWidth = 1;
    
    // Draw room outlines only (minimal)
    for (const room of s.levelData.rooms) {
      ctx.strokeRect(mapX + room.x * scale, mapY + room.y * scale, room.w * scale, room.h * scale);
    }
    
    // Draw corridor lines (minimal)
    ctx.strokeStyle = "rgba(46,168,255,0.25)";
    for (const corr of s.levelData.corridors) {
      ctx.strokeRect(mapX + corr.x * scale, mapY + corr.y * scale, corr.w * scale, corr.h * scale);
    }
    
    // Draw interactables as small dots
    for (const it of s.interact) {
      if (it.used) continue;
      ctx.fillStyle = it.kind === INTERACT.CHEST ? "#ffd44a" : it.kind === INTERACT.BOSS_TP ? "#ff5d5d" : "#2ea8ff";
      ctx.beginPath();
      ctx.arc(mapX + it.x * scale, mapY + it.y * scale, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw player as small dot
    ctx.fillStyle = "#2ea8ff";
    ctx.beginPath();
    ctx.arc(mapX + s.player.x * scale, mapY + s.player.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw boss if active
    if (s.boss.active) {
      ctx.fillStyle = "#ff5d5d";
      ctx.beginPath();
      ctx.arc(mapX + s.boss.x * scale, mapY + s.boss.y * scale, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  ctx.restore();
}

/**
 * Draws the main HUD (health, XP, gold, floor, ability hotbar)
 * @param {Object} s - Game state
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} isoScale - Isometric scale factor (for ISO_MODE display)
 * @param {Object} content - Game content (weapons, tomes, items, characters)
 */
export function drawHud(s, ctx, isoScale, content) {
  const { w } = s.arena;
  const p = s.player;

  // Ensure we're in screen space (reset any transforms)
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform to identity

  const centerX = w * 0.5;
  const topY = 10;
  const iconSize = 16;
  const spacing = 8;

  ctx.globalAlpha = 0.95;
  
  // HP
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(centerX - 80, topY, 70, 24);
  ctx.fillStyle = "#1fe06a";
  ctx.font = "bold 14px ui-sans-serif, system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  // HP icon (heart)
  ctx.beginPath();
  ctx.arc(centerX - 75, topY + 12, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e6e8ff";
  ctx.fillText(`${Math.round(p.hp)}/${Math.round(p.maxHp)}`, centerX - 60, topY + 12);

  // XP
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(centerX - 5, topY, 70, 24);
  ctx.fillStyle = "#2ea8ff";
  // XP icon (star)
  ctx.beginPath();
  ctx.moveTo(centerX, topY + 6);
  ctx.lineTo(centerX + 3, topY + 10);
  ctx.lineTo(centerX + 7, topY + 10);
  ctx.lineTo(centerX + 4, topY + 13);
  ctx.lineTo(centerX + 5, topY + 18);
  ctx.lineTo(centerX, topY + 15);
  ctx.lineTo(centerX - 5, topY + 18);
  ctx.lineTo(centerX - 4, topY + 13);
  ctx.lineTo(centerX - 7, topY + 10);
  ctx.lineTo(centerX - 3, topY + 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e6e8ff";
  ctx.fillText(`${format(s.xp)}/${format(s.xpNeed)}`, centerX + 5, topY + 12);

  // Gold
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(centerX + 70, topY, 70, 24);
  ctx.fillStyle = "#ffd44a";
  // Gold icon (coin)
  ctx.beginPath();
  ctx.arc(centerX + 75, topY + 12, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e6e8ff";
  ctx.fillText(format(p.coins), centerX + 85, topY + 12);

  // Floor display (moved to top HUD)
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(centerX + 145, topY, 60, 24);
  ctx.fillStyle = "#c23bff";
  ctx.font = "bold 14px ui-sans-serif, system-ui";
  ctx.textAlign = "left";
  ctx.fillText(`F${s.floor}`, centerX + 150, topY + 12);
  
  // ISO_SCALE display (only in isometric mode)
  if (ISO_MODE) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(centerX + 210, topY, 80, 24);
    ctx.fillStyle = "#ff7a3d";
    ctx.font = "bold 12px ui-sans-serif, system-ui";
    ctx.textAlign = "left";
    ctx.fillText(`ISO: ${isoScale.toFixed(3)}`, centerX + 215, topY + 12);
  }

  // Ability hotbar (WoW/League style)
  if (p.abilityId) {
    const { h } = s.arena;
    const hotbarSize = 48;
    const hotbarX = centerX - hotbarSize / 2;
    const hotbarY = h - 80; // Bottom of screen
    const cooldownPercent = p.abilityT > 0 ? Math.min(1, p.abilityT / (p.abilityCd * (p.abilityCdMult || 1))) : 0;
    
    // Ability is ready when cooldown is 0 (cooldown now starts immediately when ability is used)
    const isReady = cooldownPercent === 0;
    
    // Background square
    ctx.fillStyle = isReady ? "rgba(40,60,80,0.9)" : "rgba(80,20,20,0.9)";
    ctx.fillRect(hotbarX, hotbarY, hotbarSize, hotbarSize);
    
    // Border
    ctx.strokeStyle = isReady ? "#1fe06a" : "#ff5d5d";
    ctx.lineWidth = 3;
    ctx.strokeRect(hotbarX, hotbarY, hotbarSize, hotbarSize);
    
    // Ability icon (simple shape based on ability)
    ctx.save();
    ctx.translate(hotbarX + hotbarSize / 2, hotbarY + hotbarSize / 2);
    ctx.globalAlpha = isReady ? 1.0 : 0.3;
    if (p.abilityId === "blink") {
      // Blink icon - teleport symbol
      ctx.fillStyle = "#2ea8ff";
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, -4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 4, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.abilityId === "quickdraw") {
      // Quick Draw icon - crosshair/revolver symbol
      ctx.strokeStyle = "#ffd44a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(10, 0);
      ctx.moveTo(0, -10);
      ctx.lineTo(0, 10);
      ctx.stroke();
    } else if (p.abilityId === "slam") {
      // Slam icon - impact symbol
      ctx.fillStyle = "#ff7a3d";
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!", 0, 0);
    }
    ctx.restore();
    
    // Circular cooldown overlay (red tint when on cooldown)
    if (!isReady) {
      ctx.save();
      ctx.translate(hotbarX + hotbarSize / 2, hotbarY + hotbarSize / 2);
      ctx.rotate(-Math.PI / 2); // Start from top
      ctx.fillStyle = "rgba(255,0,0,0.6)";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, hotbarSize / 2, 0, Math.PI * 2 * cooldownPercent);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    
    // Timer text
    if (!isReady) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // p.abilityT counts DOWN from full cooldown to 0, so it IS the time left
      const timeLeft = Math.max(0, p.abilityT);
      ctx.fillText(timeLeft.toFixed(1), hotbarX + hotbarSize / 2, hotbarY + hotbarSize / 2);
    }
    
    // Keybind text (bottom)
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "10px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.fillText("SHIFT", hotbarX + hotbarSize / 2, hotbarY + hotbarSize + 12);
  }

  // Boss HP bar (always visible when boss is active)
  if (s.boss.active && s.boss.maxHp > 0) {
    const bossBarY = p.abilityId ? topY + 65 : topY + 35;
    const bossBarW = 300;
    const bossBarX = centerX - bossBarW / 2;
    const hpPercent = Math.max(0, Math.min(1, s.boss.hp / s.boss.maxHp));
    
    // Background
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(bossBarX, bossBarY, bossBarW, 20);
    
    // HP bar
    ctx.fillStyle = hpPercent > 0.5 ? "#1fe06a" : hpPercent > 0.25 ? "#ffd44a" : "#ff5d5d";
    ctx.fillRect(bossBarX + 2, bossBarY + 2, (bossBarW - 4) * hpPercent, 16);
    
    // Border
    ctx.strokeStyle = "rgba(230,232,255,0.8)";
    ctx.lineWidth = 2;
    ctx.strokeRect(bossBarX, bossBarY, bossBarW, 20);
    
    // Text
    ctx.fillStyle = "#e6e8ff";
    ctx.font = "bold 12px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`BOSS: ${Math.round(s.boss.hp)}/${Math.round(s.boss.maxHp)}`, centerX, bossBarY + 13);
  }

  // Draw collected upgrades at the bottom
  const bottomY = s.arena.h - 30;
  const upgradeIconSize = 24;
  const iconSpacing = 28;
  let iconX = 20;
  
  ctx.globalAlpha = 0.95;
  
  // Ensure arrays exist
  if (!p.collectedWeapons) p.collectedWeapons = [];
  if (!p.collectedTomes) p.collectedTomes = [];
  if (!p.collectedItems) p.collectedItems = [];
  
  // Draw weapons
  if (p.collectedWeapons && p.collectedWeapons.length > 0) {
    for (const weapon of p.collectedWeapons) {
      ctx.save();
      ctx.translate(iconX, bottomY);
      if (weapon.icon) {
        weapon.icon(ctx, upgradeIconSize);
      } else {
        // Fallback icon
        ctx.fillStyle = "#2ea8ff";
        ctx.fillRect(-upgradeIconSize/2, -upgradeIconSize/2, upgradeIconSize, upgradeIconSize);
      }
      ctx.restore();
      iconX += iconSpacing;
    }
  }
  
  // Draw tomes
  if (p.collectedTomes && p.collectedTomes.length > 0) {
    for (const tome of p.collectedTomes) {
      ctx.save();
      ctx.translate(iconX, bottomY);
      if (tome.icon) {
        tome.icon(ctx, upgradeIconSize);
      } else {
        // Fallback icon
        ctx.fillStyle = "#1fe06a";
        ctx.fillRect(-upgradeIconSize/2, -upgradeIconSize/2, upgradeIconSize, upgradeIconSize);
      }
      ctx.restore();
      iconX += iconSpacing;
    }
  }
  
  // Draw items
  if (p.collectedItems && p.collectedItems.length > 0) {
    for (const item of p.collectedItems) {
      ctx.save();
      ctx.translate(iconX, bottomY);
      if (item.icon) {
        item.icon(ctx, upgradeIconSize);
      } else {
        // Fallback icon
        ctx.fillStyle = "#ffd44a";
        ctx.fillRect(-upgradeIconSize/2, -upgradeIconSize/2, upgradeIconSize, upgradeIconSize);
      }
      ctx.restore();
      iconX += iconSpacing;
    }
  }

  ctx.restore();
}

/**
 * Draws overlay screens (levelup, menu, pause, stats, death)
 * @param {Object} s - Game state
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} ui - UI state (from uiRef.current)
 * @param {Object} content - Game content (weapons, tomes, items, characters)
 * @param {number} isoScale - Isometric scale factor (for ISO_MODE display)
 * @param {Object} state - Full game state (for levelup screen)
 */
export function drawOverlay(s, ctx, ui, content, isoScale, state) {
  const { w, h } = s.arena;
  
  // Ensure we're in screen space (reset any transforms)
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform to identity
  
  // Draw minimap in overlay (always on top)
  if (s && ui.screen === "running") {
    if (s.levelData) {
      drawMinimap(s, ctx);
    }
  }

  if (ui.screen === "running") {
    // Pause menu
    if (ui.pauseMenu) {
      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.fillRect(0, 0, w, h);
      
      ctx.fillStyle = "#e6e8ff";
      ctx.font = "bold 24px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText("PAUSED", w * 0.5, 100);
      
      // Menu buttons
      const buttonY = 180;
      const buttonH = 50;
      const buttonSpacing = 70;
      
      // Continue button
      ctx.fillStyle = "rgba(40,60,80,0.9)";
      ctx.fillRect(w * 0.5 - 120, buttonY, 240, buttonH);
      ctx.strokeStyle = "#1fe06a";
      ctx.lineWidth = 2;
      ctx.strokeRect(w * 0.5 - 120, buttonY, 240, buttonH);
      ctx.fillStyle = "#1fe06a";
      ctx.font = "18px ui-sans-serif, system-ui";
      ctx.fillText("Continue (ESC)", w * 0.5, buttonY + 32);
      
      // New Game button
      ctx.fillStyle = "rgba(40,60,80,0.9)";
      ctx.fillRect(w * 0.5 - 120, buttonY + buttonSpacing, 240, buttonH);
      ctx.strokeStyle = "#2ea8ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(w * 0.5 - 120, buttonY + buttonSpacing, 240, buttonH);
      ctx.fillStyle = "#2ea8ff";
      ctx.fillText("New Game", w * 0.5, buttonY + buttonSpacing + 32);
      
      // Admin button
      ctx.fillStyle = "rgba(40,60,80,0.9)";
      ctx.fillRect(w * 0.5 - 120, buttonY + buttonSpacing * 2, 240, buttonH);
      ctx.strokeStyle = "#ffd44a";
      ctx.lineWidth = 2;
      ctx.strokeRect(w * 0.5 - 120, buttonY + buttonSpacing * 2, 240, buttonH);
      ctx.fillStyle = "#ffd44a";
      ctx.fillText("Admin", w * 0.5, buttonY + buttonSpacing * 2 + 32);
      
      // Mute button
      const muteButtonX = w * 0.5 - 120;
      const muteButtonY = buttonY + buttonSpacing * 3;
      const muteButtonW = 240;
      const muteButtonH = 50;
      const isMuted = ui.muted;
      
      ctx.fillStyle = isMuted ? "rgba(200,60,60,0.9)" : "rgba(40,60,80,0.9)";
      ctx.fillRect(muteButtonX, muteButtonY, muteButtonW, muteButtonH);
      ctx.strokeStyle = isMuted ? "#ff5d5d" : "#2ea8ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(muteButtonX, muteButtonY, muteButtonW, muteButtonH);
      ctx.fillStyle = isMuted ? "#ff5d5d" : "#2ea8ff";
      ctx.font = "18px ui-sans-serif, system-ui";
      ctx.fillText(isMuted ? "🔇 Muted (M)" : "🔊 Sound (M)", w * 0.5, muteButtonY + 32);
      
      // Music volume control
      const volumeButtonY = muteButtonY + buttonSpacing;
      const volumeBarW = 200;
      const volumeBarH = 8;
      const volumeBarX = w * 0.5 - volumeBarW / 2;
      const volumeBarY = volumeButtonY + 21;
      const musicVolume = ui.musicVolume !== undefined ? ui.musicVolume : 0.5;
      
      // Volume label
      ctx.fillStyle = "#e6e8ff";
      ctx.font = "14px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Music Volume", w * 0.5, volumeButtonY + 16);
      
      // Volume bar background
      ctx.fillStyle = "rgba(40,60,80,0.9)";
      ctx.fillRect(volumeBarX, volumeBarY, volumeBarW, volumeBarH);
      ctx.strokeStyle = "#2ea8ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(volumeBarX, volumeBarY, volumeBarW, volumeBarH);
      
      // Volume bar fill
      ctx.fillStyle = "#2ea8ff";
      ctx.fillRect(volumeBarX, volumeBarY, volumeBarW * musicVolume, volumeBarH);
      
      // Volume buttons
      const volButtonSize = 24;
      const volMinusX = volumeBarX - volButtonSize - 8;
      const volPlusX = volumeBarX + volumeBarW + 8;
      const volButtonY = volumeButtonY + 10;
      
      // Minus button
      ctx.fillStyle = "rgba(40,60,80,0.9)";
      ctx.fillRect(volMinusX, volButtonY, volButtonSize, volButtonSize);
      ctx.strokeStyle = "#2ea8ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(volMinusX, volButtonY, volButtonSize, volButtonSize);
      ctx.fillStyle = "#2ea8ff";
      ctx.font = "16px ui-sans-serif, system-ui";
      ctx.fillText("-", volMinusX + volButtonSize / 2, volButtonY + 18);
      
      // Plus button
      ctx.fillStyle = "rgba(40,60,80,0.9)";
      ctx.fillRect(volPlusX, volButtonY, volButtonSize, volButtonSize);
      ctx.strokeStyle = "#2ea8ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(volPlusX, volButtonY, volButtonSize, volButtonSize);
      ctx.fillStyle = "#2ea8ff";
      ctx.fillText("+", volPlusX + volButtonSize / 2, volButtonY + 18);
      
      // Admin section
      if (ui.showAdmin) {
        ctx.fillStyle = "rgba(20,30,40,0.95)";
        ctx.fillRect(w * 0.5 - 220, 100, 440, h - 200);
        ctx.strokeStyle = "#ffd44a";
        ctx.lineWidth = 3;
        ctx.strokeRect(w * 0.5 - 220, 100, 440, h - 200);
        
        ctx.fillStyle = "#ffd44a";
        ctx.font = "bold 18px ui-sans-serif, system-ui";
        ctx.fillText("ADMIN PANEL", w * 0.5, 130);
        
        // Category buttons at top
        const categoryY = 145;
        const categoryW = 85;
        const categoryH = 22;
        const categories = [
          { name: "Main", cat: "main" },
          { name: "Weapons", cat: "weapons" },
          { name: "Tomes", cat: "tomes" },
          { name: "Items", cat: "items" },
        ];
        
        for (let i = 0; i < categories.length; i++) {
          const cat = categories[i];
          const catX = w * 0.5 - 170 + i * 90;
          const isActive = ui.adminCategory === cat.cat;
          ctx.fillStyle = isActive ? "rgba(100,120,140,0.9)" : "rgba(60,80,100,0.6)";
          ctx.fillRect(catX, categoryY, categoryW, categoryH);
          ctx.strokeStyle = isActive ? "#ffd44a" : "#888";
          ctx.lineWidth = isActive ? 2 : 1;
          ctx.strokeRect(catX, categoryY, categoryW, categoryH);
          ctx.fillStyle = isActive ? "#ffd44a" : "#aaa";
          ctx.font = "11px ui-sans-serif, system-ui";
          ctx.fillText(cat.name, catX + categoryW / 2, categoryY + 15);
        }
        
        // More compact layout - two columns
        const adminY = 175;
        const adminButtonH = 26;
        const adminSpacing = 28;
        const adminCol1X = w * 0.5 - 200;
        const adminCol2X = w * 0.5 + 20;
        const adminButtonW = 180;
        
        let adminFunctions = [];
        
        if (ui.adminCategory === "main") {
          adminFunctions = [
            { name: "Level Up", action: "levelup" },
            { name: "Spawn Boss", action: "spawnBoss" },
            { name: "Spawn Chest", action: "spawnChest" },
            { name: "Speed Shrine", action: "spawnSpeed" },
            { name: "Heal Shrine", action: "spawnHeal" },
            { name: "Magnet Shrine", action: "spawnMagnet" },
            { name: "Full Heal", action: "fullHeal" },
            { name: "+1000 Gold", action: "addGold" },
            { name: "+1000 XP", action: "addXP" },
            { name: "Kill All", action: "killAll" },
            { name: "All Weapons", action: "giveAllWeapons" },
            { name: "All Tomes", action: "giveAllTomes" },
            { name: "All Items", action: "giveAllItems" },
            { name: "Close Admin", action: "closeAdmin" },
          ];
        } else if (ui.adminCategory === "weapons") {
          adminFunctions = content.weapons.map(w => ({
            name: w.name.length > 20 ? w.name.substring(0, 20) : w.name,
            action: `giveWeapon:${w.id}`,
            weaponId: w.id,
          }));
          adminFunctions.push({ name: "Back", action: "backToMain" });
        } else if (ui.adminCategory === "tomes") {
          adminFunctions = content.tomes.map(t => ({
            name: t.name.length > 20 ? t.name.substring(0, 20) : t.name,
            action: `giveTome:${t.id}`,
            tomeId: t.id,
          }));
          adminFunctions.push({ name: "Back", action: "backToMain" });
        } else if (ui.adminCategory === "items") {
          adminFunctions = content.items.map(it => ({
            name: it.name.length > 20 ? it.name.substring(0, 20) : it.name,
            action: `giveItem:${it.id}`,
            itemId: it.id,
          }));
          adminFunctions.push({ name: "Back", action: "backToMain" });
        }
        
        // Draw buttons (show all items - increased from 12)
        const maxVisible = 20; // Increased to show all items
        const startIndex = 0;
        const endIndex = Math.min(adminFunctions.length, startIndex + maxVisible);
        
        for (let i = startIndex; i < endIndex; i++) {
          const func = adminFunctions[i];
          const displayIndex = i - startIndex;
          const col = displayIndex % 2;
          const row = Math.floor(displayIndex / 2);
          const x = col === 0 ? adminCol1X : adminCol2X;
          const y = adminY + row * adminSpacing;
          
          ctx.fillStyle = "rgba(60,80,100,0.8)";
          ctx.fillRect(x, y, adminButtonW, adminButtonH);
          ctx.strokeStyle = "#ffd44a";
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, adminButtonW, adminButtonH);
          ctx.fillStyle = "#e6e8ff";
          ctx.font = "11px ui-sans-serif, system-ui";
          ctx.fillText(func.name, x + adminButtonW / 2, y + 17);
        }
        
        if (adminFunctions.length > maxVisible) {
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.font = "10px ui-sans-serif, system-ui";
          ctx.fillText(`Showing ${startIndex + 1}-${endIndex} of ${adminFunctions.length}`, w * 0.5, h - 120);
        }
      }
      
      ctx.restore();
      return;
    }
    
    if (ui.showStats) {
      ctx.fillStyle = "rgba(0,0,0,0.72)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#e6e8ff";
      ctx.font = "18px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Stats", w * 0.5, 70);

      const p = s.player;
      const totalDmg = p.weapons ? p.weapons.reduce((sum, w) => sum + w.weaponDamage, 0) : 0;
      const totalProj = p.weapons ? p.weapons.reduce((sum, w) => sum + w.projectiles, 0) : 0;
      const totalBounce = p.weapons ? p.weapons.reduce((sum, w) => sum + w.bounces, 0) : 0;
      const avgCd = p.weapons && p.weapons.length > 0 
        ? p.weapons.reduce((sum, w) => sum + w.attackCooldown, 0) / p.weapons.length 
        : 0;
      const weaponsList = p.weapons && p.weapons.length > 0
        ? p.weapons.map(w => `${w.id} Lv${w.level}`).join(", ")
        : "None";
      const lines = [
        `Character: ${p.charName}`,
        `Weapons: ${weaponsList}`,
        `Total Damage: ${Math.round(totalDmg)}`,
        `Avg Attack cd: ${avgCd.toFixed(2)}s`,
        `Total Projectiles: ${totalProj}`,
        `Total Bounces: ${totalBounce}`,
        `Move: ${Math.round(computeSpeed(p))}`,
        `Crit: ${Math.round(p.critChance * 100)}%`,
        `Poison: ${Math.round(p.poisonChance * 100)}%`,
        `Freeze: ${Math.round(p.freezeChance * 100)}%`,
        `Regen: ${p.regen.toFixed(2)}`,
        `Armor: ${Math.round(p.armor * 100)}%`,
        `Evasion: ${Math.round(p.evasion * 100)}%`,
        `Luck: ${p.luck.toFixed(2)}`,
        `XP gain: ${p.xpGain.toFixed(2)}`,
        `Gold gain: ${p.goldGain.toFixed(2)}`,
        `Ability: ${p.abilityId} cd ${p.abilityCd.toFixed(1)}s`,
        `Shield: ${p.shield}`,
        `Time left: ${Math.ceil(s.stageLeft)}s`,
      ];

      ctx.font = "13px ui-sans-serif, system-ui";
      ctx.textAlign = "left";
      const startX = Math.max(20, w * 0.2);
      let yy = 110;
      for (const line of lines) {
        ctx.fillText(line, startX, yy);
        yy += 22;
      }
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(230,232,255,0.8)";
      ctx.fillText("Tab to resume", w * 0.5, h - 40);
    }
    ctx.restore();
    return;
  }

  if (ui.screen === "levelup") {
    const choices = ui.levelChoices || [];
    const selectedIndex = ui.selectedChoiceIndex || 0;
    
    console.log("LEVELUP SCREEN RENDERING - Choices:", choices.length, "Has choices:", choices.length > 0, "Fanfare:", ui.levelUpFanfareT);
    
    // ALWAYS show choices - fanfare should not block cards (FIXED)
    const showChoices = true;
    
    // Draw dark overlay background (since main render loop draws it at wrong opacity)
    ctx.fillStyle = "rgba(0,0,0,0.76)";
    ctx.fillRect(0, 0, w, h);
    
    // Level up fanfare: animated text and screen flash (rarity-colored)
    if (ui.levelUpFanfareT > 0) {
      const fanfareProgress = 1 - (ui.levelUpFanfareT / 2.5);
      const textScale = 1 + Math.sin(fanfareProgress * Math.PI) * 0.3; // Scale from 1.0 to 1.3
      const textAlpha = Math.min(1, fanfareProgress * 2);
      const glowIntensity = Math.sin(fanfareProgress * Math.PI * 4) * 0.5 + 0.5;
      
      // Get rarity color for fanfare
      const rarityCol = RARITY_COLOR[ui.highestRarity] || RARITY_COLOR[RARITY.COMMON];
      const rarityOrder = { [RARITY.COMMON]: 0, [RARITY.UNCOMMON]: 1, [RARITY.RARE]: 2, [RARITY.LEGENDARY]: 3 };
      const rarityLevel = rarityOrder[ui.highestRarity] || 0;
      
      // More intense effects for higher rarities
      const intensityMult = 1 + rarityLevel * 0.3; // 1.0, 1.3, 1.6, 1.9
      const flashIntensity = rarityLevel >= 2 ? 1.2 : rarityLevel >= 1 ? 0.8 : 0.5; // Stronger flash for Rare/Legendary
      
      ctx.save();
      ctx.globalAlpha = textAlpha;
      // Parse hex color to RGB
      const hex = rarityCol.bg;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      ctx.fillStyle = `rgba(${r},${g},${b},${0.8 + glowIntensity * 0.2})`;
      ctx.font = `bold ${Math.round(24 + textScale * 8 * intensityMult)}px ui-sans-serif, system-ui`;
      ctx.textAlign = "center";
      ctx.shadowBlur = 20 * glowIntensity * intensityMult;
      ctx.shadowColor = rarityCol.bg;
      ctx.fillText("LEVEL UP!", w * 0.5, h * 0.35);
      ctx.shadowBlur = 0;
      ctx.restore();
      
      // Screen flash effect (rarity-colored, more intense for higher rarities)
      if (fanfareProgress < 0.15) {
        const flashAlpha = (0.15 - fanfareProgress) / 0.15 * flashIntensity;
        ctx.globalAlpha = flashAlpha;
        ctx.fillStyle = rarityCol.bg;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1.0;
      }
      
      // Rarity-colored border flash (more pulses for higher rarities)
      const pulseCount = rarityLevel >= 3 ? 8 : rarityLevel >= 2 ? 6 : 4;
      const borderAlpha = Math.sin(fanfareProgress * Math.PI * pulseCount) * 0.4 + 0.3;
      ctx.strokeStyle = `${rarityCol.bg}${Math.floor(borderAlpha * 255).toString(16).padStart(2, '0')}`;
      ctx.lineWidth = 8 + rarityLevel * 2; // Thicker border for higher rarities
      ctx.strokeRect(0, 0, w, h);
    }
    
    // Chest opening fanfare: light beam effect
    if (ui.chestOpenFanfareT > 0 && !showChoices) {
      const fanfareProgress = 1 - (ui.chestOpenFanfareT / 0.3);
      const beamAlpha = Math.sin(fanfareProgress * Math.PI) * 0.6;
      
      // Light beam from center
      const gradient = ctx.createLinearGradient(w * 0.5, h * 0.3, w * 0.5, h * 0.7);
      gradient.addColorStop(0, `rgba(255,212,74,${beamAlpha})`);
      gradient.addColorStop(0.5, `rgba(255,212,74,${beamAlpha * 0.5})`);
      gradient.addColorStop(1, `rgba(255,212,74,0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(w * 0.3, h * 0.3, w * 0.4, h * 0.4);
    }
    
    // ALWAYS show choices - fanfare should not block cards
    if (true) {
      ctx.fillStyle = "#e6e8ff";
      ctx.font = "18px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Choose an upgrade", w * 0.5, 78);
      ctx.font = "12px ui-sans-serif, system-ui";
      ctx.fillStyle = "rgba(230,232,255,0.8)";
      ctx.fillText("A/D to scroll, E to select | Click or press 1 2 3", w * 0.5, 100);

    // Position cards by center to avoid scaling issues
    const cardW = Math.min(320, Math.max(240, w * 0.26));
    const cardH = 180;
    const gap = 18;
    
    // Account for max scale (1.05x) when calculating spacing
    const maxScaledW = cardW * 1.05;
    const spacing = maxScaledW + gap; // Space between card centers
    
    // Center the group of 3 cards
    const screenCenterX = w * 0.5;
    const leftCardCenterX = screenCenterX - spacing;
    const centerCardCenterX = screenCenterX;
    const rightCardCenterX = screenCenterX + spacing;
    
    const cardCenters = [leftCardCenterX, centerCardCenterX, rightCardCenterX];
    const y = h * 0.5 - cardH * 0.5;
    
    // Staggered card animation - cards appear one at a time
    const cardDelay = 0.2; // Delay between each card (seconds) - slightly longer for more suspense
    const cardAnimDuration = 0.5; // Animation duration for each card - slightly longer
    const fanfareTime = ui.levelUpFanfareT || 0;
    const fanfareDuration = 2.5;
    const timeSinceFanfare = Math.max(0, fanfareDuration - fanfareTime);

    // Always draw 3 rectangles (cards) - if choice is missing, draw placeholder
    for (let i = 0; i < 3; i++) {
      const c = choices[i];
      // If no choice, draw a HUGE bright neon purple placeholder card to make it impossible to miss
      if (!c) {
        console.warn("MISSING CARD AT INDEX", i, "- Drawing placeholder");
        // Draw HUGE bright neon purple placeholder card
        const cardCenterX = cardCenters[i];
        const placeholderW = 300;
        const placeholderH = 400;
        const placeholderX = cardCenterX - placeholderW / 2;
        const placeholderY = h * 0.5 - placeholderH / 2;
        
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        // BRIGHT neon purple background
        ctx.fillStyle = "#9D4EDD"; // Neon purple
        ctx.fillRect(placeholderX, placeholderY, placeholderW, placeholderH);
        // BRIGHT border
        ctx.strokeStyle = "#E0AAFF"; // Lighter purple border
        ctx.lineWidth = 6;
        ctx.strokeRect(placeholderX, placeholderY, placeholderW, placeholderH);
        // Draw text to indicate missing card
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 24px ui-sans-serif, system-ui";
        ctx.textAlign = "center";
        ctx.fillText("NO CARD", cardCenterX, h * 0.5);
        ctx.restore();
        continue;
      }
      
      // Calculate card entrance animation
      const cardStartTime = i * cardDelay;
      const cardAnimProgress = Math.max(0, Math.min(1, (timeSinceFanfare - cardStartTime) / cardAnimDuration));
      const cardEase = 1 - Math.pow(1 - cardAnimProgress, 3); // Ease out cubic
      
      // Card is hidden until its animation starts
      if (cardAnimProgress <= 0) continue;
      
      const isSelected = i === selectedIndex;
      const col = RARITY_COLOR[c.rarity] || RARITY_COLOR[RARITY.COMMON];
      
      // Enhanced selection animation: bounce, glow, and pulse effects
      const gameTime = state?.t || 0;
      let selectionScale = isSelected ? 1.08 : 0.98; // Larger scale when selected
      let selectionGlow = isSelected ? 1.0 : 0.3;
      
      // Bounce effect when selected (spring animation)
      if (isSelected) {
        const bounceTime = gameTime * 12; // Fast bounce
        const bounceAmount = Math.abs(Math.sin(bounceTime)) * 0.05; // Bounce up to 5% extra
        selectionScale += bounceAmount;
        
        // Pulse glow intensity
        const glowPulse = Math.sin(gameTime * 15) * 0.3 + 0.7; // Pulse between 0.4 and 1.0
        selectionGlow = glowPulse;
      }
      
      const pulse = Math.sin(gameTime * 8) * 0.1 + 0.9;
      const borderPulse = isSelected ? 1.0 + Math.sin(gameTime * 12) * 0.3 : 1.0; // Stronger pulse when selected
      
      // Card center position
      const cardCenterX = cardCenters[i];
      
      ctx.save();
      // Reset transform to ensure clean state
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // Scale around card center
      ctx.translate(cardCenterX, y + cardH / 2);
      
      // Entrance animation: scale from 0.3 to final scale, fade in, slide up slightly
      const entranceScale = 0.3 + cardEase * (selectionScale - 0.3);
      const entranceAlpha = cardEase;
      const entranceY = (1 - cardEase) * 30; // Slide up from below
      
      ctx.scale(entranceScale, entranceScale);
      ctx.globalAlpha = entranceAlpha;
      ctx.translate(0, entranceY);
      ctx.translate(-cardW / 2, -cardH / 2);

      // Rarity-colored background gradient (more intense when selected)
      const gradient = ctx.createLinearGradient(0, 0, cardW, cardH);
      const bgAlpha = 0.15 + (isSelected ? 0.25 : 0); // Much brighter when selected
      gradient.addColorStop(0, `rgba(0,0,0,0.55)`);
      gradient.addColorStop(0.5, `${col.bg}${Math.floor(bgAlpha * 255).toString(16).padStart(2, '0')}`);
      gradient.addColorStop(1, `rgba(0,0,0,0.55)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, cardW, cardH);
      
      // Glowing aura around selected card
      if (isSelected) {
        const auraAlpha = selectionGlow * 0.4;
        const auraSize = 15 + Math.sin(gameTime * 10) * 5; // Pulsing aura
        ctx.shadowBlur = auraSize;
        ctx.shadowColor = col.bg;
        ctx.globalAlpha = auraAlpha * entranceAlpha;
        ctx.fillStyle = col.bg;
        ctx.fillRect(-auraSize, -auraSize, cardW + auraSize * 2, cardH + auraSize * 2);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = entranceAlpha;
      }

      // Rarity-colored border (thicker for higher rarity and when selected)
      let borderWidth = (c.rarity === RARITY.LEGENDARY ? 4 : c.rarity === RARITY.RARE ? 3 : c.rarity === RARITY.UNCOMMON ? 2 : 1);
      if (isSelected) {
        borderWidth = borderWidth * 1.5 * borderPulse; // Much thicker when selected
      } else {
        borderWidth = borderWidth * borderPulse;
      }
      ctx.strokeStyle = col.bg;
      ctx.lineWidth = borderWidth;
      ctx.globalAlpha = selectionGlow * entranceAlpha;
      
      // Double border effect for selected cards
      if (isSelected) {
        ctx.shadowBlur = 10 * selectionGlow;
        ctx.shadowColor = col.bg;
      }
      ctx.strokeRect(0, 0, cardW, cardH);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = entranceAlpha; // Keep entrance alpha for all drawing

      // Top rarity bar
      ctx.fillStyle = col.bg;
      ctx.fillRect(0, 0, cardW, 8);

      // Rarity glow effect
      if (c.rarity === RARITY.LEGENDARY || c.rarity === RARITY.RARE) {
        ctx.shadowBlur = 15 * selectionGlow * pulse;
        ctx.shadowColor = col.bg;
        ctx.fillStyle = `${col.bg}${Math.floor(selectionGlow * 0.3 * 255).toString(16).padStart(2, '0')}`;
        ctx.fillRect(0, 0, cardW, cardH);
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = "#e6e8ff";
      ctx.font = "14px ui-sans-serif, system-ui";
      ctx.textAlign = "left";
      ctx.globalAlpha = entranceAlpha; // Apply entrance alpha to text
      ctx.fillText(`${i + 1}. ${c.name}`, 12, 32);

      ctx.font = "12px ui-sans-serif, system-ui";
      ctx.fillStyle = col.bg;
      ctx.fillText(`${c.type} • ${c.rarity}`, 12, 52);

        // Show description first
        if (c.desc) {
          ctx.fillStyle = "rgba(230,232,255,0.85)";
          ctx.font = "11px ui-sans-serif, system-ui";
          ctx.fillText(c.desc, 12, 74);
        }
        
        // Show preview (before/after values) below description
        if (c.preview) {
          ctx.fillStyle = "rgba(156,255,214,0.95)";
          ctx.font = "10px ui-sans-serif, system-ui";
          // Split preview into multiple lines if needed
          const previewLines = c.preview.split(" | ");
          let yPos = c.desc ? 90 : 74; // Start below desc if it exists
          for (let i = 0; i < Math.min(previewLines.length, 4); i++) {
            ctx.fillText(previewLines[i], 12, yPos);
            yPos += 14;
          }
        }

        // Enhanced selection indicator with pulsing effect
        if (isSelected) {
          const indicatorPulse = Math.sin(gameTime * 15) * 0.3 + 0.7;
          ctx.fillStyle = col.bg;
          ctx.font = `bold 12px ui-sans-serif, system-ui`;
          ctx.globalAlpha = indicatorPulse * entranceAlpha;
          ctx.shadowBlur = 8 * selectionGlow;
          ctx.shadowColor = col.bg;
          ctx.fillText("► SELECTED ◄", 12, cardH - 12);
          ctx.shadowBlur = 0;
          ctx.font = "12px ui-sans-serif, system-ui"; // Reset font
          ctx.globalAlpha = entranceAlpha;
        } else {
          ctx.fillStyle = "rgba(230,232,255,0.5)";
          ctx.fillText("Click to pick", 12, cardH - 12);
        }

        // Icon with rarity glow
        ctx.save();
        ctx.translate(cardW - 26, 28);
        if (c.rarity === RARITY.LEGENDARY || c.rarity === RARITY.RARE) {
          ctx.shadowBlur = 8 * selectionGlow;
          ctx.shadowColor = col.bg;
        }
        ctx.fillStyle = "rgba(230,232,255,0.95)";
        ctx.strokeStyle = col.bg;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.stroke();
        const iconSize = 8;
        if (typeof c.icon === "function") c.icon(ctx, 0, 0, iconSize);
        ctx.shadowBlur = 0;
        ctx.restore();
        
        // Enhanced particles for selected card - all rarities get particles
        if (isSelected && state) {
          const particleCount = c.rarity === RARITY.LEGENDARY ? 8 : c.rarity === RARITY.RARE ? 6 : c.rarity === RARITY.UNCOMMON ? 4 : 3;
          const baseDist = c.rarity === RARITY.LEGENDARY ? 40 : c.rarity === RARITY.RARE ? 35 : 30;
          for (let p = 0; p < particleCount; p++) {
            const angle = (Math.PI * 2 * p) / particleCount + gameTime * 3; // Faster rotation
            const dist = baseDist + Math.sin(gameTime * 6 + p) * 12; // More dynamic movement
            const px = cardW / 2 + Math.cos(angle) * dist;
            const py = cardH / 2 + Math.sin(angle) * dist;
            const particleSize = 2 + Math.sin(gameTime * 8 + p) * 1.5; // Pulsing particles
            ctx.fillStyle = col.bg;
            ctx.globalAlpha = (selectionGlow * 0.8 + 0.2) * entranceAlpha;
            ctx.beginPath();
            ctx.arc(px, py, particleSize, 0, Math.PI * 2);
            ctx.fill();
            
            // Outer glow for particles
            ctx.shadowBlur = 6;
            ctx.shadowColor = col.bg;
            ctx.beginPath();
            ctx.arc(px, py, particleSize * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
          ctx.globalAlpha = entranceAlpha;
        }
      }

      ctx.globalAlpha = 1.0; // Reset alpha after card
      ctx.restore(); // Restore card transform
    }

    ctx.restore();
    return;
  }

  if (ui.screen === "dead") {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.78)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#e6e8ff";
    ctx.font = "22px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Game Over", w * 0.5, h * 0.35);
    ctx.font = "13px ui-sans-serif, system-ui";
    ctx.fillStyle = "rgba(230,232,255,0.85)";
    ctx.fillText(`Score ${format(ui.score)}`, w * 0.5, h * 0.35 + 34);
    if (ui.deathReason) ctx.fillText(ui.deathReason, w * 0.5, h * 0.35 + 56);
    ctx.fillText("Press E", w * 0.5, h * 0.35 + 88);
    ctx.restore();
    return;
  }

  if (ui.screen === "menu") {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#e6e8ff";
    ctx.font = "22px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Neon Pit", w * 0.5, 86);

    // Latest Updates section (left side)
    const updatesX = 20;
    const updatesY = 120;
    const updatesW = Math.min(320, w * 0.32);
    const updatesH = 140;
    
    // Background for updates panel
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(updatesX, updatesY, updatesW, updatesH);
    ctx.strokeStyle = "rgba(46,168,255,0.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(updatesX, updatesY, updatesW, updatesH);
    
    // Updates title
    ctx.fillStyle = "#2ea8ff";
    ctx.font = "bold 14px ui-sans-serif, system-ui";
    ctx.textAlign = "left";
    ctx.fillText("📋 Latest Updates", updatesX + 10, updatesY + 22);
    
    // Updates content
    ctx.font = "11px ui-sans-serif, system-ui";
    ctx.fillStyle = "rgba(230,232,255,0.9)";
    let updateY = updatesY + 42;
    for (const update of LATEST_UPDATES) {
      ctx.fillText(update, updatesX + 12, updateY);
      updateY += 18;
    }

    ctx.font = "13px ui-sans-serif, system-ui";
    ctx.fillStyle = "rgba(230,232,255,0.85)";
    ctx.textAlign = "center";
    ctx.fillText("WASD move", w * 0.5, 118);
    ctx.fillText("Space jump | Shift ability", w * 0.5, 140);
    ctx.fillText("E interact", w * 0.5, 162);
    ctx.fillText("F fullscreen", w * 0.5, 184);
    ctx.fillText("Tab stats and pause", w * 0.5, 206);

    ctx.font = "16px ui-sans-serif, system-ui";
    ctx.fillStyle = "#e6e8ff";
    ctx.fillText("Choose character", w * 0.5, 260);

    const cards = content.characters;
    const cardW = Math.min(300, Math.max(220, w * 0.24));
    const cardH = 140;
    const gap = 18;
    const totalW = cardW * 3 + gap * 2;
    const startX = w * 0.5 - totalW * 0.5;
    const y = 300;

    for (let i = 0; i < 3; i++) {
      const c = cards[i];
      const x = startX + i * (cardW + gap);
      const active = ui.selectedChar === c.id;

      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = active ? "rgba(46,168,255,0.18)" : "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, cardW, cardH);
      ctx.strokeStyle = active ? "rgba(46,168,255,0.65)" : "rgba(230,232,255,0.12)";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, cardW, cardH);

      ctx.fillStyle = "#e6e8ff";
      ctx.font = "16px ui-sans-serif, system-ui";
      ctx.textAlign = "left";
      ctx.fillText(`${i + 1}. ${c.name}`, 12, 32);
      ctx.font = "12px ui-sans-serif, system-ui";
      ctx.fillStyle = "rgba(230,232,255,0.8)";
      ctx.fillText(c.subtitle, 12, 54);
      ctx.fillText(`Start: ${c.startWeapon}`, 12, 76);
      ctx.fillText(`Shift: ${c.space.name}`, 12, 98);
      ctx.fillStyle = active ? "rgba(46,168,255,0.9)" : "rgba(200,220,255,0.85)";
      ctx.font = "11px ui-sans-serif, system-ui";
      ctx.fillText(`Perk: ${c.perk}`, 12, 120);

      ctx.restore();
    }

    ctx.fillStyle = "rgba(230,232,255,0.9)";
    ctx.font = "14px ui-sans-serif, system-ui";
    ctx.fillText("Press E to start", w * 0.5, h - 80);
    if (ui.best > 0) {
      ctx.fillStyle = "rgba(230,232,255,0.7)";
      ctx.font = "12px ui-sans-serif, system-ui";
      ctx.fillText(`Best ${format(ui.best)}`, w * 0.5, h - 54);
    }
    
    // Mute button
    const muteButtonX = w - 140;
    const muteButtonY = 20;
    const muteButtonW = 120;
    const muteButtonH = 35;
    const isMuted = ui.muted;
    
    ctx.fillStyle = isMuted ? "rgba(200,60,60,0.8)" : "rgba(40,60,80,0.9)";
    ctx.fillRect(muteButtonX, muteButtonY, muteButtonW, muteButtonH);
    ctx.strokeStyle = isMuted ? "#ff5d5d" : "#2ea8ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(muteButtonX, muteButtonY, muteButtonW, muteButtonH);
    ctx.fillStyle = isMuted ? "#ff5d5d" : "#2ea8ff";
    ctx.font = "14px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.fillText(isMuted ? "🔇 Muted (M)" : "🔊 Sound (M)", muteButtonX + muteButtonW / 2, muteButtonY + 24);
    
    // Music volume control
    const volumeY = muteButtonY + muteButtonH + 10;
    const volumeW = 120;
    const volumeH = 20;
    const volumeBarW = 100;
    const volumeBarH = 6;
    const volumeBarX = muteButtonX + (muteButtonW - volumeBarW) / 2;
    const volumeBarY = volumeY + (volumeH - volumeBarH) / 2;
    const musicVolume = ui.musicVolume !== undefined ? ui.musicVolume : 0.5;
    
    // Volume label
    ctx.fillStyle = "rgba(230,232,255,0.9)";
    ctx.font = "11px ui-sans-serif, system-ui";
    ctx.textAlign = "left";
    ctx.fillText("Volume", muteButtonX, volumeY - 2);
    
    // Volume bar background
    ctx.fillStyle = "rgba(40,60,80,0.9)";
    ctx.fillRect(volumeBarX, volumeBarY, volumeBarW, volumeBarH);
    ctx.strokeStyle = "#2ea8ff";
    ctx.lineWidth = 1;
    ctx.strokeRect(volumeBarX, volumeBarY, volumeBarW, volumeBarH);
    
    // Volume bar fill
    ctx.fillStyle = "#2ea8ff";
    ctx.fillRect(volumeBarX, volumeBarY, volumeBarW * musicVolume, volumeBarH);
    
    // Volume buttons
    const volButtonSize = 18;
    const volButtonY = volumeY;
    const volMinusX = volumeBarX - volButtonSize - 4;
    const volPlusX = volumeBarX + volumeBarW + 4;
    
    // Minus button
    ctx.fillStyle = "rgba(40,60,80,0.9)";
    ctx.fillRect(volMinusX, volButtonY, volButtonSize, volButtonSize);
    ctx.strokeStyle = "#2ea8ff";
    ctx.lineWidth = 1;
    ctx.strokeRect(volMinusX, volButtonY, volButtonSize, volButtonSize);
    ctx.fillStyle = "#2ea8ff";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.fillText("-", volMinusX + volButtonSize / 2, volButtonY + 14);
    
    // Plus button
    ctx.fillStyle = "rgba(40,60,80,0.9)";
    ctx.fillRect(volPlusX, volButtonY, volButtonSize, volButtonSize);
    ctx.strokeStyle = "#2ea8ff";
    ctx.lineWidth = 1;
    ctx.strokeRect(volPlusX, volButtonY, volButtonSize, volButtonSize);
    ctx.fillStyle = "#2ea8ff";
    ctx.fillText("+", volPlusX + volButtonSize / 2, volButtonY + 14);
    
    ctx.restore();
    return;
  }
}
