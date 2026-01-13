/**
 * Handle admin panel button clicks
 */
export function handleAdminClick(x, y, w, h, stateRef, uiRef, content, handleAdminActionFn, setUi) {
  const adminPanelX = w * 0.5 - 220;
  const adminPanelY = 100;
  const adminPanelW = 440;
  const adminPanelH = h - 200;
  
  // Check if click is inside admin panel
  if (x < adminPanelX || x > adminPanelX + adminPanelW ||
      y < adminPanelY || y > adminPanelY + adminPanelH) {
    return;
  }
  
  const s = stateRef.current;
  const ui = uiRef.current;
  
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
  
  // Check category tab clicks
  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const catX = w * 0.5 - 170 + i * 90;
    if (x >= catX && x <= catX + categoryW &&
        y >= categoryY && y <= categoryY + categoryH) {
      setUi((u) => ({ ...u, adminCategory: cat.cat }));
      return;
    }
  }
  
  // Admin buttons layout - two columns
  const adminY = 175;
  const adminButtonH = 26;
  const adminSpacing = 28;
  const adminCol1X = w * 0.5 - 200;
  const adminCol2X = w * 0.5 + 20;
  const adminButtonW = 180;
  
  let adminFunctions = [];
  
  if (ui.adminCategory === "main" || !ui.adminCategory) {
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
    }));
    adminFunctions.push({ name: "Back", action: "backToMain" });
  } else if (ui.adminCategory === "tomes") {
    adminFunctions = content.tomes.map(t => ({
      name: t.name.length > 20 ? t.name.substring(0, 20) : t.name,
      action: `giveTome:${t.id}`,
    }));
    adminFunctions.push({ name: "Back", action: "backToMain" });
  } else if (ui.adminCategory === "items") {
    adminFunctions = content.items.map(it => ({
      name: it.name.length > 20 ? it.name.substring(0, 20) : it.name,
      action: `giveItem:${it.id}`,
    }));
    adminFunctions.push({ name: "Back", action: "backToMain" });
  }
  
  // Check button clicks - two column layout
  for (let i = 0; i < adminFunctions.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const btnX = col === 0 ? adminCol1X : adminCol2X;
    const btnY = adminY + row * adminSpacing;
    
    if (x >= btnX && x <= btnX + adminButtonW &&
        y >= btnY && y <= btnY + adminButtonH) {
      handleAdminActionFn(s, adminFunctions[i].action);
      return;
    }
  }
}

/**
 * Execute admin panel actions
 */
export function handleAdminAction(s, action, INTERACT, startBossFn, spawnInteractableFn, applyWeaponFn, setUi, content, RARITY) {
  // Note: Don't check s.running here - admin panel is used from pause menu when s.running=false
  if (!s || !s.player) return;
  const p = s.player;
  
  switch (action) {
    case "levelup":
      // Trigger level up
      s.xp = s.xpNeed;
      break;
    case "spawnBoss":
      // Spawn boss at player location
      if (!s.boss.active) {
        startBossFn(s, 120, p.x, p.y);
      }
      break;
    case "spawnChest":
      spawnInteractableFn(s, INTERACT.CHEST);
      break;
    case "spawnSpeed":
      spawnInteractableFn(s, INTERACT.SHRINE);
      break;
    case "spawnHeal":
      spawnInteractableFn(s, INTERACT.MICROWAVE);
      break;
    case "spawnMagnet":
      spawnInteractableFn(s, INTERACT.MAGNET_SHRINE);
      break;
    case "fullHeal":
      p.hp = p.maxHp;
      break;
    case "addGold":
      p.coins += 1000;
      break;
    case "addXP":
      s.xp += 1000;
      break;
    case "killAll":
      for (const e of s.enemies) {
        e.hp = 0;
      }
      break;
    case "giveAllWeapons":
      for (const w of content.weapons) {
        // Always apply weapon to level it up (allows stacking)
        applyWeaponFn(p, w, RARITY.LEGENDARY, false);
        // Only add to collected list if not already there
        if (!p.collectedWeapons.find(x => x.id === w.id)) {
          p.collectedWeapons.push({ ...w, rarity: RARITY.LEGENDARY });
        }
      }
      break;
    case "giveAllTomes":
      for (const t of content.tomes) {
        // Always apply tome to level it up (allows stacking)
        applyWeaponFn(p, t, RARITY.LEGENDARY, false);
        // Only add to collected list if not already there
        if (!p.collectedTomes.find(x => x.id === t.id)) {
          p.collectedTomes.push({ ...t, rarity: RARITY.LEGENDARY });
        }
      }
      break;
    case "giveAllItems":
      for (const it of content.items) {
        // Always apply item to level it up (allows stacking)
        applyWeaponFn(p, it, RARITY.LEGENDARY, false);
        // Only add to collected list if not already there
        if (!p.collectedItems.find(x => x.id === it.id)) {
          p.collectedItems.push({ ...it, rarity: RARITY.LEGENDARY });
        }
      }
      break;
    case "closeAdmin":
      setUi((u) => ({ ...u, showAdmin: false }));
      break;
    default:
      if (action.startsWith("giveWeapon:")) {
        const weaponId = action.split(":")[1];
        const weapon = content.weapons.find((w) => w.id === weaponId);
        if (weapon) {
          // Always apply weapon to level it up (allows stacking)
          applyWeaponFn(p, weapon, RARITY.LEGENDARY, false);
          // Only add to collected list if not already there
          if (!p.collectedWeapons.find((x) => x.id === weaponId)) {
            p.collectedWeapons.push({ ...weapon, rarity: RARITY.LEGENDARY });
          }
        }
      } else if (action.startsWith("giveTome:")) {
        const tomeId = action.split(":")[1];
        const tome = content.tomes.find((t) => t.id === tomeId);
        if (tome) {
          // Always apply tome to level it up (allows stacking)
          applyWeaponFn(p, tome, RARITY.LEGENDARY, false);
          // Only add to collected list if not already there
          if (!p.collectedTomes.find((x) => x.id === tomeId)) {
            p.collectedTomes.push({ ...tome, rarity: RARITY.LEGENDARY });
          }
        }
      } else if (action.startsWith("giveItem:")) {
        const itemId = action.split(":")[1];
        const item = content.items.find((it) => it.id === itemId);
        if (item) {
          // Always apply item to level it up (allows stacking)
          applyWeaponFn(p, item, RARITY.LEGENDARY, false);
          // Only add to collected list if not already there
          if (!p.collectedItems.find((x) => x.id === itemId)) {
            p.collectedItems.push({ ...item, rarity: RARITY.LEGENDARY });
          }
        }
      } else if (action === "backToMain") {
        setUi((u) => ({ ...u, adminCategory: "main" }));
      }
      break;
  }
}
