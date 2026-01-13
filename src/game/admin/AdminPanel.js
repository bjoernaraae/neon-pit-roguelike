/**
 * Handle admin panel button clicks
 */
export function handleAdminClick(x, y, w, h, stateRef, content, handleAdminActionFn) {
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
  const buttonStartY = adminPanelY + 60;
  const buttonH = 26;
  const buttonSpacing = 34;
  const buttonW = 180;
  
  // Admin functions to display
  const adminFunctions = [
    { name: "Level Up", action: "levelup" },
    { name: "Spawn Boss", action: "spawnBoss" },
    { name: "Spawn Chest", action: "spawnChest" },
    { name: "Spawn Speed", action: "spawnSpeed" },
    { name: "Spawn Heal", action: "spawnHeal" },
    { name: "Spawn Magnet", action: "spawnMagnet" },
    { name: "Full Heal", action: "fullHeal" },
    { name: "+1000 Gold", action: "addGold" },
    { name: "+1000 XP", action: "addXP" },
    { name: "Kill All", action: "killAll" },
    { name: "Give All Weapons", action: "giveAllWeapons" },
    { name: "Give All Tomes", action: "giveAllTomes" },
    { name: "Give All Items", action: "giveAllItems" },
  ];
  
  // Check button clicks
  for (let i = 0; i < adminFunctions.length; i++) {
    const btnY = buttonStartY + i * buttonSpacing;
    const btnX = adminPanelX + (adminPanelW - buttonW) / 2;
    
    if (x >= btnX && x <= btnX + buttonW &&
        y >= btnY && y <= btnY + buttonH) {
      handleAdminActionFn(s, adminFunctions[i].action);
      return;
    }
  }
}

/**
 * Execute admin panel actions
 */
export function handleAdminAction(s, action, INTERACT, startBossFn, spawnInteractableFn, applyWeaponFn, setUi, content, RARITY) {
  if (!s || !s.running) return;
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
        if (!p.collectedWeapons.find(x => x.id === w.id)) {
          applyWeaponFn(p, w, RARITY.LEGENDARY, false);
          p.collectedWeapons.push({ ...w, rarity: RARITY.LEGENDARY });
        }
      }
      break;
    case "giveAllTomes":
      for (const t of content.tomes) {
        if (!p.collectedTomes.find(x => x.id === t.id)) {
          applyWeaponFn(p, t, RARITY.LEGENDARY, false);
          p.collectedTomes.push({ ...t, rarity: RARITY.LEGENDARY });
        }
      }
      break;
    case "giveAllItems":
      for (const it of content.items) {
        if (!p.collectedItems.find(x => x.id === it.id)) {
          applyWeaponFn(p, it, RARITY.LEGENDARY, false);
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
        if (weapon && !p.collectedWeapons.find((x) => x.id === weaponId)) {
          applyWeaponFn(p, weapon, RARITY.LEGENDARY, false);
          p.collectedWeapons.push({ ...weapon, rarity: RARITY.LEGENDARY });
        }
      } else if (action.startsWith("giveTome:")) {
        const tomeId = action.split(":")[1];
        const tome = content.tomes.find((t) => t.id === tomeId);
        if (tome && !p.collectedTomes.find((x) => x.id === tomeId)) {
          applyWeaponFn(p, tome, RARITY.LEGENDARY, false);
          p.collectedTomes.push({ ...tome, rarity: RARITY.LEGENDARY });
        }
      } else if (action.startsWith("giveItem:")) {
        const itemId = action.split(":")[1];
        const item = content.items.find((it) => it.id === itemId);
        if (item && !p.collectedItems.find((x) => x.id === itemId)) {
          applyWeaponFn(p, item, RARITY.LEGENDARY, false);
          p.collectedItems.push({ ...item, rarity: RARITY.LEGENDARY });
        }
      } else if (action === "backToMain") {
        setUi((u) => ({ ...u, adminCategory: "main" }));
      }
      break;
  }
}
