import React, { useEffect, useMemo, useRef, useState } from "react";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);

function lerpColor(color1, color2, t) {
  // Simple hex color lerp
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  if (!c1 || !c2) return color1;
  const r = Math.round(lerp(c1.r, c2.r, t));
  const g = Math.round(lerp(c1.g, c2.g, t));
  const b = Math.round(lerp(c1.b, c2.b, t));
  return `rgb(${r},${g},${b})`;
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}
const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};

function format(n) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function pickWeighted(items) {
  const total = items.reduce((s, it) => s + it.w, 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.w;
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function resolveKinematicCircleOverlap(kin, dyn, bounds) {
  const dx = kin.x - dyn.x;
  const dy = kin.y - dyn.y;
  const d = Math.hypot(dx, dy);
  const minD = kin.r + dyn.r;
  if (!(d < minD)) return false;

  const nx = d > 0.0001 ? dx / d : 1;
  const ny = d > 0.0001 ? dy / d : 0;
  const overlap = minD - d;

  kin.x += nx * (overlap + 0.01);
  kin.y += ny * (overlap + 0.01);

  dyn.x -= nx * (overlap * 0.2);
  dyn.y -= ny * (overlap * 0.2);

  if (bounds) {
    kin.x = clamp(kin.x, bounds.padding, bounds.w - bounds.padding);
    kin.y = clamp(kin.y, bounds.padding, bounds.h - bounds.padding);
    dyn.x = clamp(dyn.x, bounds.padding, bounds.w - bounds.padding);
    dyn.y = clamp(dyn.y, bounds.padding, bounds.h - bounds.padding);
  }
  return true;
}

function resolveDynamicCircleOverlap(a, b, bounds) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const d = Math.hypot(dx, dy);
  const minD = a.r + b.r;
  if (!(d < minD)) return false;

  const nx = d > 0.0001 ? dx / d : 1;
  const ny = d > 0.0001 ? dy / d : 0;
  const overlap = minD - d;

  a.x += nx * (overlap * 0.5);
  a.y += ny * (overlap * 0.5);
  b.x -= nx * (overlap * 0.5);
  b.y -= ny * (overlap * 0.5);

  if (bounds) {
    a.x = clamp(a.x, bounds.padding, bounds.w - bounds.padding);
    a.y = clamp(a.y, bounds.padding, bounds.h - bounds.padding);
    b.x = clamp(b.x, bounds.padding, bounds.w - bounds.padding);
    b.y = clamp(b.y, bounds.padding, bounds.h - bounds.padding);
  }
  return true;
}

function generateProceduralLevel(w, h, floor) {
  // Simple square map - start basic
  // Make the level larger than screen
  const scaleFactor = 2.5 + (floor - 1) * 0.2; // 2.5x for floor 1, scales up
  const levelW = w * scaleFactor;
  const levelH = h * scaleFactor;
  const padding = 40;
  
  // Determine biome based on floor
  const biomeTypes = ["grassland", "desert", "winter", "forest", "volcanic"];
  const biome = biomeTypes[(floor - 1) % biomeTypes.length];
  
  // Simple square walkable area (entire map minus padding)
  const walkableArea = {
    x: padding,
    y: padding,
    w: levelW - padding * 2,
    h: levelH - padding * 2,
  };
  
  // Create single walkable area for the entire map
  const walkableAreas = [walkableArea];
  
  // Simple room structure (just the main area)
  const rooms = [{
    x: padding,
    y: padding,
    w: levelW - padding * 2,
    h: levelH - padding * 2,
    id: 0,
    enemies: [],
    cleared: false
  }];
  
  // Empty arrays for now (can add later)
  const corridors = [];
  const obstacles = [];
  const grass = [];
  const water = [];
  const rocks = [];
  
  return { 
    rooms, 
    corridors, 
    obstacles, 
    grass, 
    water, 
    rocks, 
    biome, 
    w: levelW, 
    h: levelH, 
    walkableAreas 
  };
}

// Check if a point is in a walkable area
function isPointWalkable(x, y, levelData, playerRadius = 12) {
  if (!levelData || !levelData.walkableAreas) return true;
  
  // Check if point is inside any walkable area (with padding for player radius)
  for (const area of levelData.walkableAreas) {
    if (x >= area.x + playerRadius && 
        x <= area.x + area.w - playerRadius &&
        y >= area.y + playerRadius && 
        y <= area.y + area.h - playerRadius) {
      return true;
    }
  }
  return false;
}

// Find nearest walkable position
function findNearestWalkable(x, y, levelData, playerRadius = 12) {
  if (!levelData || !levelData.walkableAreas) return { x, y };
  
  if (isPointWalkable(x, y, levelData, playerRadius)) {
    return { x, y };
  }
  
  // Find closest walkable point
  let closestX = x;
  let closestY = y;
  let minDist = Infinity;
  
  for (const area of levelData.walkableAreas) {
    // Clamp to area bounds
    const clampedX = clamp(x, area.x + playerRadius, area.x + area.w - playerRadius);
    const clampedY = clamp(y, area.y + playerRadius, area.y + area.h - playerRadius);
    const dist = Math.hypot(x - clampedX, y - clampedY);
    
    if (dist < minDist) {
      minDist = dist;
      closestX = clampedX;
      closestY = clampedY;
    }
  }
  
  return { x: closestX, y: closestY };
}

const RARITY = {
  COMMON: "Common",
  UNCOMMON: "Uncommon",
  RARE: "Rare",
  LEGENDARY: "Legendary",
};

const RARITY_COLOR = {
  [RARITY.COMMON]: { bg: "#1fe06a", fg: "#0b1a12" },
  [RARITY.UNCOMMON]: { bg: "#2ea8ff", fg: "#06131d" },
  [RARITY.RARE]: { bg: "#c23bff", fg: "#12041a" },
  [RARITY.LEGENDARY]: { bg: "#ffd44a", fg: "#1b1200" },
};

const TYPE = {
  WEAPON: "Weapon",
  TOME: "Tome",
  ITEM: "Item",
};

const INTERACT = {
  CHEST: "Chest",
  SHRINE: "Shrine",
  MAGNET_SHRINE: "MagnetShrine",
  MICROWAVE: "Microwave",
  GREED: "GreedShrine",
  BOSS_TP: "BossTeleporter",
};

function xpToNext(level) {
  return Math.round(16 + level * 8 + Math.pow(level, 1.35) * 4);
}

function getRarityWeights(luck) {
  const L = clamp(luck, 0, 8);
  const common = Math.max(40, 78 - L * 9);
  const uncommon = 18 + L * 5;
  const rare = 4 + L * 2.6;
  const legendary = 0.7 + L * 0.9;
  return [
    { r: RARITY.COMMON, w: common },
    { r: RARITY.UNCOMMON, w: uncommon },
    { r: RARITY.RARE, w: rare },
    { r: RARITY.LEGENDARY, w: legendary },
  ];
}

function rollRarity(luck) {
  const weights = getRarityWeights(luck);
  return pickWeighted(weights.map((x) => ({ w: x.w, t: x.r }))).t;
}

function rarityMult(r) {
  if (r === RARITY.UNCOMMON) return 1.12;
  if (r === RARITY.RARE) return 1.28;
  if (r === RARITY.LEGENDARY) return 1.55;
  return 1;
}

function chestCost(chestOpens, floor) {
  const base = 6;
  const inc = 3;
  const floorAdd = Math.floor((floor - 1) * 1.2);
  return base + chestOpens * inc + floorAdd;
}

function mitigateDamage(amount, armor) {
  const a = clamp(armor, 0, 0.8);
  return amount * (1 - a);
}

function rollEvasion(evasion) {
  const e = clamp(evasion, 0, 0.75);
  return Math.random() < e;
}

function computeSpeed(p) {
  const raw = p.speedBase + p.speedBonus;
  const softCap = 360;
  if (raw <= softCap) return raw;
  return softCap + (raw - softCap) * 0.35;
}

function bumpShake(s, mag, time) {
  s.shakeMag = Math.max(s.shakeMag, mag);
  s.shakeT = Math.max(s.shakeT, time);
  s.shakeDur = Math.max(s.shakeDur, time);
}

function addParticle(s, x, y, n = 6, hue = null, opts = {}) {
  const size = opts.size || rand(1.5, 3.6);
  const speed = opts.speed || 1;
  const lifeMult = opts.lifeMult || 1;
  const gravity = opts.gravity !== false;
  
  for (let i = 0; i < n; i++) {
    s.particles.push({
      x,
      y,
      vx: rand(-160, 160) * speed,
      vy: rand(-210, 110) * speed,
      r: rand(size * 0.8, size * 1.2),
      t: 0,
      life: rand(0.22, 0.55) * lifeMult,
      hue,
      glow: opts.glow || false,
      trail: opts.trail || false,
    });
  }
}

function addExplosion(s, x, y, size = 1, hue = null) {
  const count = Math.round(12 * size);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const speed = rand(180, 320) * size;
    s.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: rand(2, 5) * size,
      t: 0,
      life: rand(0.3, 0.7),
      hue: hue || rand(0, 360),
      glow: true,
    });
  }
}

function addHitFlash(s, x, y, color = "#ffffff") {
  s.hitFlashes = s.hitFlashes || [];
  s.hitFlashes.push({
    x,
    y,
    t: 0,
    life: 0.15,
    color,
    size: 1,
  });
}

function statLine(label, a, b, fmt = (v) => v) {
  if (a === b) return null;
  return `${label}: ${fmt(a)} → ${fmt(b)}`;
}

function buildPreview(s, applyFn) {
  const before = deepClone(s.player);
  const after = deepClone(s.player);
  try {
    applyFn(after);
  } catch {
    return "";
  }

  const lines = [];
  
  // Calculate total damage from all weapons
  const beforeDmg = before.weapons ? before.weapons.reduce((sum, w) => sum + w.weaponDamage, 0) : 0;
  const afterDmg = after.weapons ? after.weapons.reduce((sum, w) => sum + w.weaponDamage, 0) : 0;
  lines.push(statLine("Damage", Math.round(beforeDmg), Math.round(afterDmg)));
  
  // Calculate average attack cooldown
  const beforeCd = before.weapons && before.weapons.length > 0 
    ? before.weapons.reduce((sum, w) => sum + w.attackCooldown, 0) / before.weapons.length 
    : 0.42;
  const afterCd = after.weapons && after.weapons.length > 0
    ? after.weapons.reduce((sum, w) => sum + w.attackCooldown, 0) / after.weapons.length
    : 0.42;
  lines.push(
    statLine(
      "Attack cd",
      Number(beforeCd.toFixed(3)),
      Number(afterCd.toFixed(3)),
      (v) => `${v}s`,
    ),
  );
  
  // Calculate total projectiles
  const beforeProj = before.weapons ? before.weapons.reduce((sum, w) => sum + w.projectiles, 0) : 0;
  const afterProj = after.weapons ? after.weapons.reduce((sum, w) => sum + w.projectiles, 0) : 0;
  lines.push(statLine("Projectiles", beforeProj, afterProj));
  
  // Calculate total bounces
  const beforeBounce = before.weapons ? before.weapons.reduce((sum, w) => sum + w.bounces, 0) : 0;
  const afterBounce = after.weapons ? after.weapons.reduce((sum, w) => sum + w.bounces, 0) : 0;
  lines.push(statLine("Bounces", beforeBounce, afterBounce));
  
  // Speed
  const beforeSpeed = Math.round(computeSpeed(before));
  const afterSpeed = Math.round(computeSpeed(after));
  if (beforeSpeed !== afterSpeed) {
    lines.push(`Speed: ${beforeSpeed} → ${afterSpeed}`);
  }
  
  // Max HP
  const beforeHp = Math.round(before.maxHp);
  const afterHp = Math.round(after.maxHp);
  if (beforeHp !== afterHp) {
    lines.push(`Max HP: ${beforeHp} → ${afterHp}`);
  }
  
  // Crit chance - always show if it changes
  const beforeCrit = Math.round(before.critChance * 100);
  const afterCrit = Math.round(after.critChance * 100);
  if (beforeCrit !== afterCrit) {
    lines.push(`Crit: ${beforeCrit}% → ${afterCrit}%`);
  }
  
  // Poison chance
  const beforePoison = Math.round(before.poisonChance * 100);
  const afterPoison = Math.round(after.poisonChance * 100);
  if (beforePoison !== afterPoison) {
    lines.push(`Poison: ${beforePoison}% → ${afterPoison}%`);
  }
  
  // Freeze chance
  const beforeFreeze = Math.round(before.freezeChance * 100);
  const afterFreeze = Math.round(after.freezeChance * 100);
  if (beforeFreeze !== afterFreeze) {
    lines.push(`Freeze: ${beforeFreeze}% → ${afterFreeze}%`);
  }
  
  // Regen
  if (Math.abs(before.regen - after.regen) > 0.01) {
    lines.push(`Regen: ${before.regen.toFixed(2)} → ${after.regen.toFixed(2)}`);
  }
  
  // Armor
  const beforeArmor = Math.round(before.armor * 100);
  const afterArmor = Math.round(after.armor * 100);
  if (beforeArmor !== afterArmor) {
    lines.push(`Armor: ${beforeArmor}% → ${afterArmor}%`);
  }
  
  // Gold gain
  if (Math.abs(before.goldGain - after.goldGain) > 0.01) {
    lines.push(`Gold gain: ${before.goldGain.toFixed(2)}x → ${after.goldGain.toFixed(2)}x`);
  }
  
  // XP gain
  if (Math.abs(before.xpGain - after.xpGain) > 0.01) {
    lines.push(`XP gain: ${before.xpGain.toFixed(2)}x → ${after.xpGain.toFixed(2)}x`);
  }
  
  // Luck
  if (Math.abs(before.luck - after.luck) > 0.01) {
    lines.push(`Luck: ${before.luck.toFixed(2)} → ${after.luck.toFixed(2)}`);
  }

  // Return all relevant changes (up to 5 lines for better visibility)
  return lines.slice(0, 5).join(" | ");
}

function makeIconDraw(kind) {
  if (kind === "revolver")
    return (ctx, x, y, s) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.2);
      ctx.globalAlpha = 0.95;
      ctx.fillRect(-s * 0.65, -s * 0.25, s * 1.3, s * 0.5);
      ctx.fillRect(s * 0.2, -s * 0.15, s * 0.7, s * 0.3);
      ctx.restore();
    };
  if (kind === "staff")
    return (ctx, x, y, s) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(0.6);
      ctx.fillRect(-s * 0.15, -s * 0.8, s * 0.3, s * 1.6);
      ctx.beginPath();
      ctx.arc(0, -s * 0.8, s * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
  if (kind === "sword")
    return (ctx, x, y, s) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.7);
      ctx.fillRect(-s * 0.08, -s * 0.8, s * 0.16, s * 1.35);
      ctx.fillRect(-s * 0.35, s * 0.25, s * 0.7, s * 0.18);
      ctx.restore();
    };
  if (kind === "time")
    return (ctx, x, y, s) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.75, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -s * 0.45);
      ctx.lineTo(s * 0.35, -s * 0.2);
      ctx.stroke();
      ctx.restore();
    };
  if (kind === "nuke")
    return (ctx, x, y, s) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(0.15);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const rr = i % 2 === 0 ? s * 0.8 : s * 0.35;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    };
  return (ctx, x, y, s) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
}

function runSelfTests() {
  try {
    console.assert(xpToNext(1) > 0, "xp req positive");
    console.assert(xpToNext(5) > xpToNext(1), "xp req grows");

    const cost0 = chestCost(0, 1);
    const cost1 = chestCost(1, 1);
    console.assert(cost1 > cost0, "chest cost increases");

    const armorRed = mitigateDamage(100, 0.2);
    console.assert(armorRed < 100, "armor reduces");

    const p = { x: 0, y: 0, r: 10 };
    const e = { x: 5, y: 0, r: 10 };
    resolveKinematicCircleOverlap(p, e);
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    console.assert(d >= p.r + e.r - 0.0001, "kin overlap resolve");

    const a = { x: 0, y: 0, r: 10 };
    const b = { x: 5, y: 0, r: 10 };
    resolveDynamicCircleOverlap(a, b);
    const d2v = Math.hypot(a.x - b.x, a.y - b.y);
    console.assert(d2v >= a.r + b.r - 0.0001, "dyn overlap resolve");
  } catch (e) {
    console.warn("Self tests failed", e);
  }
}

export default function NeonPitRoguelikeV3() {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const canvasHolderRef = useRef(null);
  const rafRef = useRef(0);
  const keysRef = useRef(new Set());
  const sizeRef = useRef({ w: 960, h: 540, dpr: 1 });

  const audioRef = useRef({
    ctx: null,
    master: null,
    musicGain: null,
    sfxGain: null,
    started: false,
    musicOn: true,
    sfxOn: true,
    muted: false,
    nextNoteT: 0,
    noteStep: 0,
  });

  const [ui, setUi] = useState({
    screen: "menu",
    score: 0,
    coins: 0,
    best: 0,
    level: 1,
    xp: 0,
    xpNeed: 0,
    timer: 600,
    hint: "",
    levelChoices: [],
    muted: false,
    musicOn: true,
    sfxOn: true,
    deathReason: "",
    showStats: false,
    selectedChar: "cowboy",
    pauseMenu: false, // Pause menu state
    showAdmin: false, // Admin section state
    bossTpX: null, // Boss teleporter X position
    bossTpY: null, // Boss teleporter Y position
  });

  const uiRef = useRef(ui);
  useEffect(() => {
    uiRef.current = ui;
  }, [ui]);

  const stateRef = useRef(null);

  function ensureAudio() {
    const a = audioRef.current;
    if (a.started) return;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);

    const musicGain = ctx.createGain();
    musicGain.gain.value = 0.55;
    musicGain.connect(master);

    const sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.95;
    sfxGain.connect(master);

    a.ctx = ctx;
    a.master = master;
    a.musicGain = musicGain;
    a.sfxGain = sfxGain;
    a.started = true;

    applyAudioToggles(uiRef.current);
  }

  function applyAudioToggles(nextUi) {
    const a = audioRef.current;
    if (!a.started) return;

    a.muted = !!nextUi.muted;
    a.musicOn = !!nextUi.musicOn;
    a.sfxOn = !!nextUi.sfxOn;

    if (a.master) a.master.gain.value = a.muted ? 0 : 0.85;
    if (a.musicGain) a.musicGain.gain.value = a.musicOn && !a.muted ? 0.55 : 0;
    if (a.sfxGain) a.sfxGain.gain.value = a.sfxOn && !a.muted ? 0.95 : 0;
  }

  function playBeep({ type = "sine", f0 = 440, f1 = 440, dur = 0.08, gain = 0.2, pan = 0, to = "sfx" }) {
    const a = audioRef.current;
    if (!a.started || a.muted) return;
    if (to === "sfx" && !a.sfxOn) return;
    if (to === "music" && !a.musicOn) return;

    const ctx = a.ctx;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

    osc.type = type;
    osc.frequency.setValueAtTime(f0, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, f1), ctx.currentTime + Math.max(0.01, dur));

    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);

    const dst = to === "music" ? a.musicGain : a.sfxGain;

    if (p) {
      p.pan.setValueAtTime(clamp(pan, -1, 1), ctx.currentTime);
      osc.connect(g);
      g.connect(p);
      p.connect(dst);
    } else {
      osc.connect(g);
      g.connect(dst);
    }

    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  function sfxShoot(xNorm = 0, variant = 0) {
    const variants = [
      { type: "triangle", f0: 900, f1: 520, dur: 0.045 }, // Default/revolver
      { type: "square", f0: 750, f1: 400, dur: 0.05 }, // Poison (lower, wetter)
      { type: "sawtooth", f0: 1100, f1: 600, dur: 0.04 }, // Freeze (higher, sharper)
      { type: "sawtooth", f0: 600, f1: 300, dur: 0.08 }, // Fire (lower, longer, whoosh)
      { type: "square", f0: 850, f1: 480, dur: 0.04 }, // Bone
    ];
    const v = variants[variant % variants.length];
    playBeep({ ...v, gain: variant === 3 ? 0.12 : 0.1, pan: xNorm });
  }
  function sfxHit(xNorm = 0, variant = 0) {
    const variants = [
      { type: "square", f0: 240, f1: 120, dur: 0.06 },
      { type: "sawtooth", f0: 220, f1: 100, dur: 0.055 },
      { type: "square", f0: 260, f1: 140, dur: 0.065 },
    ];
    const v = variants[variant % variants.length];
    playBeep({ ...v, gain: 0.13, pan: xNorm });
  }
  function sfxKill(xNorm = 0) {
    playBeep({ type: "sawtooth", f0: 520, f1: 160, dur: 0.07, gain: 0.13, pan: xNorm });
    // Add a satisfying pop
    playBeep({ type: "sine", f0: 200, f1: 80, dur: 0.08, gain: 0.08, pan: xNorm });
  }
  function sfxCoin(xNorm = 0) {
    playBeep({ type: "sine", f0: 860, f1: 1200, dur: 0.06, gain: 0.11, pan: xNorm });
    // Add sparkle
    playBeep({ type: "triangle", f0: 1200, f1: 1400, dur: 0.04, gain: 0.06, pan: xNorm });
  }
  function sfxCrit(xNorm = 0) {
    playBeep({ type: "sine", f0: 600, f1: 800, dur: 0.1, gain: 0.15, pan: xNorm });
    playBeep({ type: "triangle", f0: 1000, f1: 1200, dur: 0.08, gain: 0.1, pan: xNorm });
  }
  function sfxLevelUp() {
    playBeep({ type: "sine", f0: 400, f1: 800, dur: 0.2, gain: 0.18, pan: 0 });
    playBeep({ type: "sine", f0: 600, f1: 1000, dur: 0.18, gain: 0.15, pan: 0 });
  }
  function sfxLevel() {
    playBeep({ type: "triangle", f0: 520, f1: 1040, dur: 0.18, gain: 0.16, pan: 0 });
  }
  function sfxBoss() {
    playBeep({ type: "square", f0: 140, f1: 90, dur: 0.22, gain: 0.2, pan: 0 });
  }
  function sfxGameOver() {
    playBeep({ type: "sawtooth", f0: 220, f1: 80, dur: 0.35, gain: 0.22, pan: 0 });
  }
  function sfxInteract() {
    playBeep({ type: "sine", f0: 740, f1: 980, dur: 0.08, gain: 0.12, pan: 0 });
  }

  function tickMusic(dt, waveIntensity) {
    const a = audioRef.current;
    if (!a.started || a.muted || !a.musicOn) return;

    a.nextNoteT -= dt;
    if (a.nextNoteT > 0) return;

    const scale = [0, 2, 3, 5, 7, 10];
    const root = 196;

    const step = a.noteStep % 16;
    const deg = scale[[0, 2, 4, 2, 1, 3, 5, 3][Math.floor(step / 2) % 8]];
    const octave = step % 4 === 0 ? 1 : 0;
    const f = root * Math.pow(2, (deg + 12 * octave) / 12);

    const density = clamp(0.45 + waveIntensity * 0.22, 0.45, 0.82);

    playBeep({ type: "triangle", f0: f, f1: f * 0.998, dur: 0.11, gain: 0.08 * density, pan: -0.15, to: "music" });
    if (step % 4 === 2) {
      playBeep({ type: "sine", f0: f * 2, f1: f * 2, dur: 0.06, gain: 0.045 * density, pan: 0.12, to: "music" });
    }

    a.noteStep += 1;
    a.nextNoteT = 0.14;
  }

  const content = useMemo(() => {
    const weapons = [
      {
        id: "revolver",
        name: "Revolver",
        type: TYPE.WEAPON,
        base: {
          attackCooldown: 0.68, // Slower firing speed
          weaponDamage: 9,
          projectiles: 1,
          pierce: 0,
          spread: 0.02,
          bounces: 1, // Revolver bounces to 1 additional target
          effect: null,
          mode: "bullet",
        },
        levelBonuses: [
          (p) => (p.weaponDamage *= 1.12),
          (p) => (p.attackCooldown = Math.max(0.24, p.attackCooldown * 0.92)),
          (p) => (p.critChance = clamp(p.critChance + 0.03, 0, 0.8)),
          (p) => {
            // For weapons, p is the weapon object, not the player
            if (p.projectiles !== undefined) {
              p.projectiles = clamp(p.projectiles + 1, 1, 16);
            }
          },
          (p) => (p.weaponDamage *= 1.16),
        ],
        icon: makeIconDraw("revolver"),
      },
      {
        id: "firestaff",
        name: "Firestaff",
        type: TYPE.WEAPON,
        base: {
          attackCooldown: 0.78,
          weaponDamage: 12,
          projectiles: 1,
          pierce: 0,
          spread: 0.05,
          bounces: 0,
          effect: "burn",
          mode: "splash",
          splashR: 54,
        },
        levelBonuses: [
          (p) => (p.weaponDamage *= 1.14),
          (p) => (p.attackCooldown = Math.max(0.3, p.attackCooldown * 0.9)),
          (p) => (p.sizeMult *= 1.08),
          (p) => (p.weaponDamage *= 1.18),
        ],
        icon: makeIconDraw("staff"),
      },
      {
        id: "sword",
        name: "Sword",
        type: TYPE.WEAPON,
        base: {
          attackCooldown: 0.5,
          weaponDamage: 16,
          projectiles: 0,
          pierce: 999,
          spread: 0,
          bounces: 0,
          effect: null,
          mode: "melee",
          meleeR: 60,
        },
        levelBonuses: [
          (p) => (p.weaponDamage *= 1.15),
          (p) => (p.attackCooldown = Math.max(0.22, p.attackCooldown * 0.9)),
          (p) => (p.sizeMult *= 1.06),
          (p) => (p.weaponDamage *= 1.2),
        ],
        icon: makeIconDraw("sword"),
      },
      {
        id: "bone",
        name: "Bone",
        type: TYPE.WEAPON,
        base: {
          attackCooldown: 0.95, // Slower attack speed for level 1
          weaponDamage: 8,
          projectiles: 1,
          pierce: 0,
          spread: 0.12,
          bounces: 1, // Default bounce once when hitting enemy
          effect: null,
          mode: "bullet",
        },
        levelBonuses: [
          (p) => (p.weaponDamage *= 1.12),
          (p) => (p.bounces = clamp(p.bounces + 1, 0, 7)),
          (p) => (p.attackCooldown = Math.max(0.22, p.attackCooldown * 0.92)),
          (p) => {
            // For weapons, p is the weapon object, not the player
            if (p.projectiles !== undefined) {
              p.projectiles = clamp(p.projectiles + 1, 1, 16);
            }
          },
          (p) => (p.weaponDamage *= 1.16),
        ],
        icon: makeIconDraw("revolver"),
      },
      {
        id: "poison_flask",
        name: "Poison Flask",
        type: TYPE.WEAPON,
        base: {
          attackCooldown: 2.2, // Very slow attack speed - thrown flask
          weaponDamage: 10,
          projectiles: 1,
          pierce: 0,
          spread: 0.02,
          bounces: 0,
          effect: "poison",
          mode: "thrown", // Thrown flask that lands and splashes
          weaponSplashR: 65, // Splash radius
          bulletSpeedMult: 0.65, // Slower throw speed
        },
        levelBonuses: [
          (p) => (p.weaponDamage *= 1.14),
          (p) => (p.attackCooldown = Math.max(0.25, p.attackCooldown * 0.9)),
          (p) => {
            // For weapons, p is the weapon object, not the player
            if (p.projectiles !== undefined) {
              p.projectiles = clamp(p.projectiles + 1, 1, 16);
            }
          },
          (p) => (p.weaponDamage *= 1.18),
        ],
        icon: makeIconDraw("nuke"),
      },
      {
        id: "frostwand",
        name: "Frost Wand",
        type: TYPE.WEAPON,
        base: {
          attackCooldown: 0.68,
          weaponDamage: 9,
          projectiles: 1,
          pierce: 0,
          spread: 0.05,
          bounces: 0,
          effect: "freeze",
          mode: "bullet",
        },
        levelBonuses: [
          (p) => (p.weaponDamage *= 1.12),
          (p) => (p.freezeChance = clamp(p.freezeChance + 0.06, 0, 0.7)),
          (p) => (p.attackCooldown = Math.max(0.24, p.attackCooldown * 0.9)),
          (p) => (p.weaponDamage *= 1.18),
        ],
        icon: makeIconDraw("time"),
      },
      {
        id: "bow",
        name: "Bow",
        type: TYPE.WEAPON,
        base: {
          attackCooldown: 0.55,
          weaponDamage: 11,
          projectiles: 1,
          pierce: 0,
          spread: 0.03,
          bounces: 0,
          effect: null,
          mode: "bullet",
          bulletSpeedMult: 1.2,
        },
        levelBonuses: [
          (p) => (p.weaponDamage *= 1.13),
          (p) => (p.attackCooldown = Math.max(0.25, p.attackCooldown * 0.91)),
          (p) => {
            // For weapons, p is the weapon object, not the player
            if (p.projectiles !== undefined) {
              p.projectiles = clamp(p.projectiles + 1, 1, 16);
            }
          },
          (p) => (p.weaponDamage *= 1.17),
        ],
        icon: makeIconDraw("revolver"),
      },
      {
        id: "lightning_staff",
        name: "Lightning Staff",
        type: TYPE.WEAPON,
        base: {
          attackCooldown: 0.65,
          weaponDamage: 10,
          projectiles: 1,
          pierce: 2,
          spread: 0.04,
          bounces: 0,
          effect: "shock",
          mode: "bullet",
          bulletSpeedMult: 1.3,
        },
        levelBonuses: [
          (p) => (p.weaponDamage *= 1.14),
          (p) => (p.pierce = clamp(p.pierce + 1, 0, 8)),
          (p) => (p.attackCooldown = Math.max(0.24, p.attackCooldown * 0.9)),
          (p) => (p.weaponDamage *= 1.18),
        ],
        icon: makeIconDraw("staff"),
      },
      {
        id: "axe",
        name: "Axe",
        type: TYPE.WEAPON,
        base: {
          attackCooldown: 0.58,
          weaponDamage: 14,
          projectiles: 1,
          pierce: 1,
          spread: 0.08,
          bounces: 0,
          effect: null,
          mode: "bullet",
          bulletSpeedMult: 0.9,
        },
        levelBonuses: [
          (p) => (p.weaponDamage *= 1.15),
          (p) => (p.pierce = clamp(p.pierce + 1, 0, 5)),
          (p) => (p.attackCooldown = Math.max(0.24, p.attackCooldown * 0.92)),
          (p) => (p.weaponDamage *= 1.19),
        ],
        icon: makeIconDraw("sword"),
      },
      {
        id: "katana",
        name: "Katana",
        type: TYPE.WEAPON,
        base: {
          attackCooldown: 0.32,
          weaponDamage: 13,
          projectiles: 0,
          pierce: 999,
          spread: 0,
          bounces: 0,
          effect: null,
          mode: "melee",
          meleeR: 55,
        },
        levelBonuses: [
          (p) => (p.weaponDamage *= 1.16),
          (p) => (p.attackCooldown = Math.max(0.18, p.attackCooldown * 0.88)),
          (p) => (p.sizeMult *= 1.08),
          (p) => (p.weaponDamage *= 1.21),
        ],
        icon: makeIconDraw("sword"),
      },
      {
        id: "shotgun",
        name: "Shotgun",
        type: TYPE.WEAPON,
        base: {
          attackCooldown: 0.72,
          weaponDamage: 7,
          projectiles: 3,
          pierce: 0,
          spread: 0.18,
          bounces: 0,
          effect: null,
          mode: "bullet",
          bulletSpeedMult: 0.85,
        },
        levelBonuses: [
          (p) => (p.weaponDamage *= 1.12),
          (p) => {
            // For weapons, p is the weapon object, not the player
            if (p.projectiles !== undefined) {
              p.projectiles = clamp(p.projectiles + 1, 1, 16);
            }
          },
          (p) => (p.attackCooldown = Math.max(0.28, p.attackCooldown * 0.92)),
          (p) => (p.weaponDamage *= 1.16),
        ],
        icon: makeIconDraw("revolver"),
      },
      {
        id: "flamewalker",
        name: "Flamewalker",
        type: TYPE.WEAPON,
        base: {
          attackCooldown: 0.85, // Slower attack speed - spawns fire periodically
          weaponDamage: 6,
          projectiles: 0,
          pierce: 0,
          spread: 0,
          bounces: 0,
          effect: "burn",
          mode: "aura", // New mode for ground fire
          meleeR: 50,
        },
        levelBonuses: [
          (p) => (p.weaponDamage *= 1.14),
          (p) => (p.weaponMeleeR = (p.weaponMeleeR || 50) + 5),
          (p) => (p.weaponDamage *= 1.18),
        ],
        icon: makeIconDraw("staff"),
      },
      {
        id: "bananarang",
        name: "Bananarang",
        type: TYPE.WEAPON,
        base: {
          attackCooldown: 0.68,
          weaponDamage: 11,
          projectiles: 1,
          pierce: 999, // Pierce all targets
          spread: 0.05,
          bounces: 0, // No bounce, it returns instead
          effect: null,
          mode: "boomerang", // Special boomerang mode
          bulletSpeedMult: 0.65, // Slower speed for visibility
        },
        levelBonuses: [
          (p) => (p.weaponDamage *= 1.13),
          (p) => (p.attackCooldown = Math.max(0.26, p.attackCooldown * 0.91)),
          (p) => (p.bounces = clamp(p.bounces + 1, 0, 7)),
          (p) => (p.weaponDamage *= 1.17),
        ],
        icon: makeIconDraw("revolver"),
      },
    ];

    const tomes = [
      {
        id: "t_agility",
        name: "Agility Tome",
        type: TYPE.TOME,
        desc: "+Movement Speed",
        apply: (p, r) => {
          const m = rarityMult(r);
          p.speedBonus += 8 * m; // Reduced from 14
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "t_damage",
        name: "Damage Tome",
        type: TYPE.TOME,
        desc: "+Damage",
        apply: (p, r) => {
          const m = rarityMult(r);
          // Apply damage increase to all weapons
          if (p.weapons && p.weapons.length > 0) {
            for (const weapon of p.weapons) {
              weapon.weaponDamage *= 1 + 0.06 * m;
            }
          }
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "t_cooldown",
        name: "Cooldown Tome",
        type: TYPE.TOME,
        desc: "+Attack speed",
        apply: (p, r) => {
          const m = rarityMult(r);
          // Reduce cooldown on all weapons (lower cooldown = faster attacks)
          if (p.weapons && p.weapons.length > 0) {
            for (const weapon of p.weapons) {
              weapon.attackCooldown = Math.max(0.18, weapon.attackCooldown * (1 - 0.04 * m));
            }
          }
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "t_quantity",
        name: "Quantity Tome",
        type: TYPE.TOME,
        desc: "+Projectile count",
        apply: (p, r) => {
          // Always add projectiles based on rarity
          // Common: +1, Uncommon: +2, Rare: +2, Legendary: +3
          let projectilesToAdd = 1;
          if (r === RARITY.UNCOMMON || r === RARITY.RARE) {
            projectilesToAdd = 2;
          } else if (r === RARITY.LEGENDARY) {
            projectilesToAdd = 3;
          }
          
          // Add projectiles to all weapons (100% chance)
          if (p.weapons && p.weapons.length > 0) {
            for (const weapon of p.weapons) {
              weapon.projectiles = clamp(weapon.projectiles + projectilesToAdd, 1, 16);
            }
          }
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "t_precision",
        name: "Precision Tome",
        type: TYPE.TOME,
        desc: "+Crit chance",
        apply: (p, r) => {
          const m = rarityMult(r);
          p.critChance = clamp(p.critChance + 0.02 * m, 0, 0.8); // Reduced from 0.04
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "t_hp",
        name: "HP Tome",
        type: TYPE.TOME,
        desc: "+Max HP",
        apply: (p, r) => {
          const m = rarityMult(r);
          p.maxHp = Math.round(p.maxHp + 8 * m); // Reduced from 14
          p.hp = Math.min(p.maxHp, p.hp + Math.round(5 * m)); // Reduced from 8
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "t_regen",
        name: "Regen Tome",
        type: TYPE.TOME,
        desc: "+HP regen",
        apply: (p, r) => {
          const m = rarityMult(r);
          p.regen += 0.3 * m; // Reduced from 0.55
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "t_gold",
        name: "Gold Tome",
        type: TYPE.TOME,
        desc: "+Gold gain",
        apply: (p, r) => {
          const m = rarityMult(r);
          p.goldGain *= 1 + 0.06 * m; // Reduced from 0.12
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "t_luck",
        name: "Luck Tome",
        type: TYPE.TOME,
        desc: "+Luck",
        apply: (p, r) => {
          const m = rarityMult(r);
          p.luck += 0.18 * m; // Reduced from 0.32
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "t_xp",
        name: "XP Tome",
        type: TYPE.TOME,
        desc: "+XP gain",
        apply: (p, r) => {
          const m = rarityMult(r);
          p.xpGain *= 1 + 0.06 * m; // Reduced from 0.12
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "t_bounce",
        name: "Bounce Tome",
        type: TYPE.TOME,
        desc: "+1 Bounce to all weapons",
        apply: (p, r) => {
          const m = rarityMult(r);
          // Always add bounces to all weapons (guaranteed, scales with rarity)
          // Common: +1, Uncommon: +1, Rare: +2, Legendary: +2
          const bounceAdd = m < 1.5 ? 1 : 2;
          if (p.weapons && p.weapons.length > 0) {
            for (const weapon of p.weapons) {
              if (weapon.bounces !== undefined && weapon.bounces >= 0) {
                weapon.bounces = clamp(weapon.bounces + bounceAdd, 0, 8);
              }
            }
          }
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "t_freeze",
        name: "Freeze Tome",
        type: TYPE.TOME,
        desc: "+Freeze chance on hit",
        apply: (p, r) => {
          const m = rarityMult(r);
          p.freezeChance = clamp(p.freezeChance + 0.022 * m, 0, 0.65);
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "t_evasion",
        name: "Evasion Tome",
        type: TYPE.TOME,
        desc: "+Dodge chance",
        apply: (p, r) => {
          const m = rarityMult(r);
          p.evasion = clamp(p.evasion + 0.04 * m, 0, 0.6);
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "t_shield",
        name: "Shield Tome",
        type: TYPE.TOME,
        desc: "+Shield HP",
        apply: (p, r) => {
          const m = rarityMult(r);
          p.shield = Math.round((p.shield || 0) + 12 * m);
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "t_size",
        name: "Size Tome",
        type: TYPE.TOME,
        desc: "+Attack size",
        apply: (p, r) => {
          const m = rarityMult(r);
          p.sizeMult *= 1 + 0.11 * m;
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "t_knockback",
        name: "Knockback Tome",
        type: TYPE.TOME,
        desc: "+Knockback force",
        apply: (p, r) => {
          const m = rarityMult(r);
          // Increase knockback value directly (stacks additively)
          p.knockback = (p.knockback || 0) + (8 + 4 * m); // Common: +8, Uncommon: +12, Rare: +12, Legendary: +20
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "t_projectile_speed",
        name: "Projectile Speed Tome",
        type: TYPE.TOME,
        desc: "+Projectile speed",
        apply: (p, r) => {
          const m = rarityMult(r);
          p.bulletSpeedMult = (p.bulletSpeedMult || 1) * (1 + 0.12 * m);
        },
        icon: makeIconDraw("time"),
      },
    ];

    const items = [
      {
        id: "moldy_cheese",
        name: "Moldy Cheese",
        type: TYPE.ITEM,
        desc: "+Poison chance on hit",
        apply: (s, r) => {
          const m = rarityMult(r);
          s.player.poisonChance = clamp(s.player.poisonChance + 0.06 * m, 0, 0.85); // Reduced from 0.12
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "ice_crystal",
        name: "Ice Crystal",
        type: TYPE.ITEM,
        desc: "Freeze enemies in area on hit",
        apply: (s, r) => {
          // Ice Crystal freezes enemies in an area around the hit (AoE freeze)
          const m = rarityMult(r);
          s.player.iceCrystalFreezeChance = 0.2 + 0.15 * m; // 20-50% chance
          s.player.iceCrystalFreezeRadius = 35 + 15 * m; // AoE radius
          s.player.iceCrystalFreezeDuration = 1.4 + 0.4 * m; // Longer freeze duration
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "rubber_bullets",
        name: "Rubber Bullets",
        type: TYPE.ITEM,
        desc: "+Bounces",
        apply: (s, r) => {
          const m = rarityMult(r);
          s.player.bounces = clamp(s.player.bounces + (Math.random() < 0.6 ? 1 : 0) + (m > 1.2 ? 1 : 0), 0, 8);
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "time_bracelet",
        name: "Time Bracelet",
        type: TYPE.ITEM,
        desc: "Reduces cooldowns",
        apply: (s, r) => {
          const m = rarityMult(r);
          // Reduce ability cooldown (permanent reduction)
          // Common: -8%, Uncommon: -10%, Rare: -12%, Legendary: -15%
          const reduction = 0.08 + (m - 1) * 0.02;
          s.player.abilityCdMult = Math.max(0.5, (s.player.abilityCdMult || 1) * (1 - reduction));
          // Also reduce weapon attack cooldowns temporarily (haste multiplier > 1 speeds up)
          s.player.buffHasteT = Math.max(s.player.buffHasteT, 4 + 2.5 * m);
          s.player.buffHasteMult = Math.max(1.15, 1.1 + 0.12 * m); // > 1 speeds up cooldown reduction
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "nuke",
        name: "Nuke",
        type: TYPE.ITEM,
        desc: "Destroy most enemies",
        apply: (s) => {
          for (const e of s.enemies) e.hp -= 999999;
          if (s.boss.active) s.boss.hp -= Math.round(s.boss.maxHp * 0.28);
          bumpShake(s, 10, 0.12);
          s.hitStopT = Math.max(s.hitStopT, 0.08);
          addParticle(s, s.player.x, s.player.y, 38, 55);
          sfxBoss();
        },
        icon: makeIconDraw("nuke"),
      },
      {
        id: "patch",
        name: "Patch",
        type: TYPE.ITEM,
        desc: "Heal now for coins",
        apply: (s, r) => {
          const m = rarityMult(r);
          const p = s.player;
          const cost = Math.max(2, Math.round(3 + s.floor + 2 * (m - 1)));
          if (p.coins < cost) return;
          p.coins -= cost;
          p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * (0.16 + 0.1 * m)));
          addParticle(s, p.x, p.y, 18, 160);
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "glass",
        name: "Glass Cannon",
        type: TYPE.ITEM,
        desc: "Damage up, HP down",
        apply: (s, r) => {
          const m = rarityMult(r);
          const p = s.player;
          const cost = Math.max(4, Math.round(6 + s.floor));
          if (p.coins < cost) return;
          p.coins -= cost;
          p.weaponDamage *= 1 + 0.28 * m;
          p.maxHp = Math.max(50, Math.round(p.maxHp * (1 - 0.07 * m)));
          p.hp = Math.min(p.hp, p.maxHp);
        },
        icon: makeIconDraw("revolver"),
      },
      {
        id: "power_gloves",
        name: "Power Gloves",
        type: TYPE.ITEM,
        desc: "+Damage",
        apply: (s, r) => {
          const m = rarityMult(r);
          s.player.weaponDamage *= 1 + 0.14 * m;
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "borgar",
        name: "Borgar",
        type: TYPE.ITEM,
        desc: "+Max HP",
        apply: (s, r) => {
          const m = rarityMult(r);
          const p = s.player;
          p.maxHp = Math.round(p.maxHp + 10 * m);
          p.hp = Math.min(p.maxHp, p.hp + Math.round(7 * m));
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "oats",
        name: "Oats",
        type: TYPE.ITEM,
        desc: "+HP regen",
        apply: (s, r) => {
          const m = rarityMult(r);
          s.player.regen += 0.32 * m;
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "golden_glove",
        name: "Golden Glove",
        type: TYPE.ITEM,
        desc: "+Gold from kills",
        apply: (s, r) => {
          const m = rarityMult(r);
          s.player.goldGain *= 1 + 0.07 * m;
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "clover",
        name: "Clover",
        type: TYPE.ITEM,
        desc: "+Luck",
        apply: (s, r) => {
          const m = rarityMult(r);
          s.player.luck += 0.18 * m;
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "spiky_shield",
        name: "Spiky Shield",
        type: TYPE.ITEM,
        desc: "Reflect damage",
        apply: (s, r) => {
          const m = rarityMult(r);
          s.player.thorns = (s.player.thorns || 0) + 0.12 * m;
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "slurp_gloves",
        name: "Slurp Gloves",
        type: TYPE.ITEM,
        desc: "+Lifesteal",
        apply: (s, r) => {
          const m = rarityMult(r);
          s.player.lifesteal = (s.player.lifesteal || 0) + 0.06 * m;
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "mirror",
        name: "Mirror",
        type: TYPE.ITEM,
        desc: "Brief invincibility on hit",
        apply: (s, r) => {
          const m = rarityMult(r);
          s.player.iFrameOnHit = (s.player.iFrameOnHit || 0) + 0.12 * m;
        },
        icon: makeIconDraw("time"),
      },
      {
        id: "big_bonk",
        name: "Big Bonk",
        type: TYPE.ITEM,
        desc: "Low chance for extreme damage",
        apply: (s, r) => {
          const m = rarityMult(r);
          s.player.bigBonkChance = (s.player.bigBonkChance || 0) + 0.016 * m;
          s.player.bigBonkMult = (s.player.bigBonkMult || 1) + 0.4 * m;
        },
        icon: makeIconDraw("time"),
      },
    ];

    const characters = [
      {
        id: "cowboy",
        name: "Cowboy",
        subtitle: "Crit based",
        startWeapon: "revolver",
        stats: { hp: 95, speedBase: 270, critChance: 0.08 },
        space: { id: "roll", name: "Roll", cd: 2.8 },
        perk: "+1.5% Crit per level",
      },
      {
        id: "wizard",
        name: "Wizard",
        subtitle: "AoE fire",
        startWeapon: "firestaff",
        stats: { hp: 90, speedBase: 260, sizeMult: 1.08 },
        space: { id: "blink", name: "Blink", cd: 3.6 },
        perk: "+0.15 Luck per level",
      },
      {
        id: "brute",
        name: "Brute",
        subtitle: "Melee",
        startWeapon: "sword",
        stats: { hp: 125, speedBase: 245, armor: 0.06 },
        space: { id: "slam", name: "Slam", cd: 4.2 },
        perk: "+8 Max HP per level",
      },
    ];

    return { weapons, tomes, items, characters };
  }, []);

  function isFullscreen() {
    return !!document.fullscreenElement;
  }

  function requestFullscreen() {
    const el = wrapRef.current || canvasRef.current;
    if (!el) return;

    const trySetHint = (msg) => {
      setUi((u) => {
        const next = { ...u, hint: msg };
        uiRef.current = next;
        return next;
      });
    };

    try {
      if (!document.fullscreenElement) {
        const p = el.requestFullscreen?.();
        if (p && typeof p.catch === "function") p.catch(() => trySetHint("Fullscreen blocked in this environment"));
      } else {
        const p = document.exitFullscreen?.();
        if (p && typeof p.catch === "function") p.catch(() => trySetHint("Fullscreen blocked in this environment"));
      }
    } catch {
      trySetHint("Fullscreen blocked in this environment");
    }
  }

  function safeBest() {
    try {
      const v = Number(localStorage.getItem("neon_pit_best") || "0");
      return Number.isFinite(v) ? v : 0;
    } catch {
      return 0;
    }
  }

  function resizeCanvas() {
    const holder = canvasHolderRef.current;
    const c = canvasRef.current;
    if (!holder || !c) return;

    const rect = holder.getBoundingClientRect();
    const targetW = clamp(Math.floor(rect.width), 520, isFullscreen() ? 2200 : 1600);
    const targetH = clamp(Math.floor(rect.height), 420, isFullscreen() ? 1400 : 980);
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    sizeRef.current = { w: targetW, h: targetH, dpr };

    c.width = Math.floor(targetW * dpr);
    c.height = Math.floor(targetH * dpr);
    c.style.width = `${targetW}px`;
    c.style.height = `${targetH}px`;

    const s = stateRef.current;
    if (s) {
      s.arena.w = targetW;
      s.arena.h = targetH;
      const p = s.player;
      p.x = clamp(p.x, s.arena.padding, targetW - s.arena.padding);
      p.y = clamp(p.y, s.arena.padding, targetH - s.arena.padding);
    }
  }

  function spawnEnemy(s) {
    const { w, h, padding } = s.arena;
    const p = s.player;
    const minDistFromPlayer = 120;
    
    let x = 0;
    let y = 0;
    let validSpawn = false;
    let attempts = 0;
    
    // Try to spawn in walkable areas if level data exists
    if (s.levelData && s.levelData.walkableAreas && s.levelData.walkableAreas.length > 0) {
      while (!validSpawn && attempts < 50) {
        // Pick a random walkable area
        const area = s.levelData.walkableAreas[Math.floor(Math.random() * s.levelData.walkableAreas.length)];
        x = rand(area.x + 20, area.x + area.w - 20);
        y = rand(area.y + 20, area.y + area.h - 20);
        
        // Check distance from player
        const dist2 = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
        if (dist2 >= minDistFromPlayer * minDistFromPlayer) {
          validSpawn = true;
        }
        attempts++;
      }
    }
    
    // Fallback to edge spawning if no level data or all attempts failed
    if (!validSpawn) {
      attempts = 0;
      while (!validSpawn && attempts < 20) {
        const side = Math.floor(Math.random() * 4);
        const levelW = s.levelData ? s.levelData.w : w;
        const levelH = s.levelData ? s.levelData.h : h;
        
        if (side === 0) {
          x = rand(padding, levelW - padding);
          y = padding;
        } else if (side === 1) {
          x = levelW - padding;
          y = rand(padding, levelH - padding);
        } else if (side === 2) {
          x = rand(padding, levelW - padding);
          y = levelH - padding;
        } else {
          x = padding;
          y = rand(padding, levelH - padding);
        }
        
        // Check distance from player
        const dist2 = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
        if (dist2 >= minDistFromPlayer * minDistFromPlayer) {
          validSpawn = true;
        }
        attempts++;
      }
    }
    
    // Final fallback - spawn anywhere
    if (!validSpawn) {
      const levelW = s.levelData ? s.levelData.w : w;
      const levelH = s.levelData ? s.levelData.h : h;
      x = rand(padding, levelW - padding);
      y = rand(padding, levelH - padding);
    }

    // Enemy types based on floor - introduce new enemies at certain floors
    const tierWeights = [
      { w: 74, t: "grunt" },
      { w: 16, t: "brute" },
    ];
    
    // Runner appears starting floor 3
    if (s.floor >= 3) {
      tierWeights.push({ w: Math.max(0, -6 + s.floor * 1.2), t: "runner" });
    }
    
    // Spitter appears starting floor 5
    if (s.floor >= 5) {
      tierWeights.push({ w: Math.max(0, -10 + s.floor * 1.1), t: "spitter" });
    }
    
    // Could add more enemy types at higher floors here
    // Example: if (s.floor >= 10) { tierWeights.push({ w: 8, t: "new_enemy_type" }); }
    
    const tier = pickWeighted(tierWeights).t;

    const baseHp = tier === "brute" ? 110 : tier === "runner" ? 56 : tier === "spitter" ? 64 : 60;
    const baseSp = tier === "brute" ? 95 : tier === "runner" ? 230 : tier === "spitter" ? 120 : 150;
    const r = tier === "brute" ? 18 : tier === "runner" ? 12 : tier === "spitter" ? 15 : 14;

    // Enemies keep same HP and damage, only numbers increase
    // No HP/damage scaling with floor
    s.enemies.push({
      id: Math.random().toString(16).slice(2),
      x,
      y,
      r,
      hp: baseHp,
      maxHp: baseHp,
      speed: baseSp,
      tier,
      hitT: 0,
      spitT: 0,
      phase: rand(0, Math.PI * 2),
      xp: Math.round((tier === "brute" ? 7 : tier === "spitter" ? 6 : tier === "runner" ? 5 : 4) * p.difficultyTome),
      coin: tier === "brute" ? 5 : 4, // Increased base coin value
      poisonT: 0,
      poisonDps: 0,
      freezeT: 0, // Keep for backwards compatibility
      slowT: 0, // Slow effect (replaces freeze)
      slowMult: 1.0, // Speed multiplier when slowed
      burnT: 0,
      burnDps: 0,
      contactCd: rand(0.2, 0.5),
    });
  }

  function acquireTarget(s, fromX, fromY) {
    let best = null;
    let bestD2 = Infinity;

    if (s.boss.active) {
      best = { x: s.boss.x, y: s.boss.y, kind: "boss" };
      bestD2 = dist2(fromX, fromY, s.boss.x, s.boss.y);
    }

    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      const d2v = dist2(fromX, fromY, e.x, e.y);
      if (d2v < bestD2) {
        bestD2 = d2v;
        best = { x: e.x, y: e.y, kind: "enemy" };
      }
    }

    return best;
  }

  function pushCombatText(s, x, y, text, col, opts = {}) {
    s.floaters.push({
      x: x + rand(-10, 10),
      y: y + rand(-10, 6),
      text,
      t: 0,
      life: opts.life ?? 0.75,
      col,
      size: opts.size ?? 12,
      crit: !!opts.crit,
    });
  }

  function shootBullet(s, x, y, angle, dmg, speed, opts) {
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    const bullet = {
      x,
      y,
      px: x,
      py: y,
      vx,
      vy,
      r: opts?.r ?? 4,
      life: opts?.life ?? 1.05,
      t: 0,
      dmg,
      pierce: opts?.pierce ?? 0,
      enemy: !!opts?.enemy,
      color: opts?.color ?? "#e6e8ff",
      crit: !!opts?.crit,
      knock: opts?.knock ?? 0,
      bounces: opts?.bounces ?? 0,
      effect: opts?.effect ?? null,
      splashR: opts?.splashR ?? 0,
      glow: opts?.glow ?? false, // For firey effects
      boomerang: opts?.boomerang ?? false, // For boomerang weapons
      startX: x, // For boomerang return
      startY: y, // For boomerang return
      maxDist: opts?.maxDist ?? 400, // Max distance before returning
      hitEnemies: new Set(), // Track hit enemies for pierce/boomerang
      isBone: opts?.isBone ?? false, // For bone rotation
      rotation: angle, // Initial rotation angle for bone
      weaponId: opts?.weaponId, // Track which weapon this belongs to
    };

    s.bullets.push(bullet);

    const xNorm = clamp((x / (s.arena.w || 1)) * 2 - 1, -1, 1);
    if (!opts?.enemy) {
      const soundVariant = opts?.soundVariant ?? Math.floor(Math.random() * 3);
      sfxShoot(xNorm, soundVariant);
    }
    
    return bullet;
  }

  function applyWeapon(p, weaponDef, rarity, previewOnly) {
    const m = rarityMult(rarity);

    // Initialize weapons array if it doesn't exist
    if (!p.weapons) {
      p.weapons = [];
    }

    // Find existing weapon
    const existingWeapon = p.weapons.find((w) => w.id === weaponDef.id);

    if (!existingWeapon) {
      // Add new weapon
      if (!previewOnly) {
        const newWeapon = {
          id: weaponDef.id,
          level: 1,
          attackCooldown: weaponDef.base.attackCooldown * (1 - 0.05 * (m - 1)),
          weaponDamage: weaponDef.base.weaponDamage * (1 + 0.1 * (m - 1)), // Reduced from 0.18
          projectiles: weaponDef.base.projectiles + (rarity === RARITY.LEGENDARY ? 1 : 0),
          pierce: weaponDef.base.pierce,
          weaponSpread: weaponDef.base.spread,
          weaponMode: weaponDef.base.mode,
          weaponEffect: weaponDef.base.effect || null,
          weaponSplashR: weaponDef.base.splashR || 0,
          weaponMeleeR: weaponDef.base.meleeR || 0,
          bounces: weaponDef.base.bounces || 0,
          bulletSpeedMult: weaponDef.base.bulletSpeedMult || 1,
          bulletSizeMult: weaponDef.base.bulletSizeMult || 1,
          attackT: 0,
          hasActiveBoomerang: false, // For bananarang tracking
        };
        p.weapons.push(newWeapon);
        // Track collected weapon
        if (!p.collectedWeapons) p.collectedWeapons = [];
        if (!p.collectedWeapons.find(w => w.id === weaponDef.id)) {
          p.collectedWeapons.push({ id: weaponDef.id, name: weaponDef.name, icon: weaponDef.icon });
        }
      }
      return;
    }

    // Track collected weapon even if upgrading existing one
    if (!p.collectedWeapons) p.collectedWeapons = [];
    if (!p.collectedWeapons.find(w => w.id === weaponDef.id)) {
      p.collectedWeapons.push({ id: weaponDef.id, name: weaponDef.name, icon: weaponDef.icon });
    }
    
    // Upgrade existing weapon - when getting duplicate, randomly improve one stat
    const nextLevel = (existingWeapon.level || 1) + 1;
    const idx = (nextLevel - 2) % Math.max(1, weaponDef.levelBonuses.length);
    const fn = weaponDef.levelBonuses[idx];

    const before = {
      attackCooldown: existingWeapon.attackCooldown,
      weaponDamage: existingWeapon.weaponDamage,
      projectiles: existingWeapon.projectiles,
      pierce: existingWeapon.pierce,
      bounces: existingWeapon.bounces,
    };

    // Apply level bonus
    fn(existingWeapon);

    existingWeapon.weaponDamage *= 1 + 0.03 * (m - 1); // Reduced from 0.06
    existingWeapon.attackCooldown = Math.max(0.18, existingWeapon.attackCooldown * (1 - 0.015 * (m - 1))); // Reduced from 0.03
    
    // When getting duplicate weapon, improve one stat based on level (deterministic)
    // This cycles through: Projectile -> Damage -> Speed -> Bullet Speed
    const currentLevel = existingWeapon.level || 1;
    const upgradeIndex = (currentLevel - 1) % 4;
    
    if (upgradeIndex === 0) {
      // Add projectile
      existingWeapon.projectiles = clamp(existingWeapon.projectiles + 1, 1, 16);
    } else if (upgradeIndex === 1) {
      // Increase damage
      existingWeapon.weaponDamage *= 1.06; // Reduced from 1.12
    } else if (upgradeIndex === 2) {
      // Increase speed (reduce cooldown)
      existingWeapon.attackCooldown = Math.max(0.18, existingWeapon.attackCooldown * 0.96); // Reduced from 0.92
    } else {
      // Increase bullet speed
      existingWeapon.bulletSpeedMult = (existingWeapon.bulletSpeedMult || 1) * 1.04; // Reduced from 1.08
    }
    
    if (rarity === RARITY.LEGENDARY && Math.random() < 0.35) existingWeapon.projectiles = clamp(existingWeapon.projectiles + 1, 1, 16);

    if (!previewOnly) existingWeapon.level = nextLevel;

    existingWeapon.attackCooldown = Math.max(0.18, existingWeapon.attackCooldown);
    existingWeapon.weaponDamage = Math.max(1, existingWeapon.weaponDamage);
    existingWeapon.projectiles = clamp(existingWeapon.projectiles, 0, 16);
    existingWeapon.pierce = clamp(existingWeapon.pierce, 0, 12);
    existingWeapon.bounces = clamp(existingWeapon.bounces, 0, 8);

    if (previewOnly) {
      existingWeapon.attackCooldown = before.attackCooldown;
      existingWeapon.weaponDamage = before.weaponDamage;
      existingWeapon.projectiles = before.projectiles;
      existingWeapon.pierce = before.pierce;
      existingWeapon.bounces = before.bounces;
      existingWeapon.level = nextLevel;
    }
  }

  function fireWeapon(s) {
    const p = s.player;
    if (!p.weapons || p.weapons.length === 0) return;

    const tgt = acquireTarget(s, p.x, p.y);
    if (!tgt) return;

    const dx = tgt.x - p.x;
    const dy = tgt.y - p.y;
    const baseA = Math.atan2(dy, dx);

    const speed = 740 * p.projectileSpeed;
    const bulletR = 4.1 * p.sizeMult;
    const knock = p.knockback;

      // Fire each weapon
      for (const weapon of p.weapons) {
        if (weapon.attackT > 0) continue; // Weapon is on cooldown
        // For bananarang, check if previous projectile has returned
        if (weapon.id === "bananarang" && weapon.hasActiveBoomerang) {
          continue; // Wait for boomerang to return
        }

        // Flamewalker - spawn fire under player feet
        if (weapon.id === "flamewalker" && weapon.weaponMode === "aura") {
          const dmgBase = weapon.weaponDamage * (0.84 + 0.03 * s.floor);
          const crit = Math.random() < clamp(p.critChance, 0, 0.8);
          const dmg = crit ? dmgBase * 1.6 : dmgBase;
          const fireRadius = Math.max(45, (weapon.weaponMeleeR || 50) * p.sizeMult);
          
          // Spawn burning area under player
          s.burningAreas.push({
            x: p.x,
            y: p.y,
            t: 0,
            life: 4.0, // Duration in seconds
            r: fireRadius,
            dmg: dmg * 0.18, // Damage per tick
            tickRate: 0.4, // Damage every 0.4 seconds
            lastTick: 0,
          });
          
          // Visual effect
          addParticle(s, p.x, p.y, 12, 20, { size: 3, speed: 0.8 });
          weapon.attackT = weapon.attackCooldown;
          continue;
        }

        if (weapon.weaponMode === "melee") {
        const r = Math.max(34, (weapon.weaponMeleeR || 60) * p.sizeMult);
        const dmgBase = weapon.weaponDamage * (0.84 + 0.03 * s.floor);
        const crit = Math.random() < clamp(p.critChance, 0, 0.8);
        const dmg = crit ? dmgBase * 1.6 : dmgBase;

        for (const e of s.enemies) {
          if (e.hp <= 0) continue;
          if (dist2(p.x, p.y, e.x, e.y) <= (r + e.r) * (r + e.r)) {
            // Calculate slice angle from player to this specific enemy
            const dx = e.x - p.x;
            const dy = e.y - p.y;
            const sliceAngle = Math.atan2(dy, dx);
            
            // Add slice visual effect in direction of this enemy
            s.floaters.push({
              x: p.x,
              y: p.y,
              t: 0,
              life: 0.25,
              angle: sliceAngle,
              length: r * 1.5,
              type: "slice",
              color: crit ? "#ffd44a" : "#ffffff",
            });
            
            // Check for Big Bonk proc on melee
            let finalDmg = dmg;
            let isBigBonk = false;
            if (p.bigBonkChance > 0 && Math.random() < p.bigBonkChance) {
              finalDmg = dmg * (p.bigBonkMult || 1);
              isBigBonk = true;
            }
            
            e.hp -= finalDmg;
            e.hitT = 0.12;
            const dealt = Math.max(1, Math.round(finalDmg));
            
            if (isBigBonk) {
              pushCombatText(s, e.x, e.y - 14, `BIG BONK! ${dealt}`, "#ff0000", { size: 18, life: 1.2, crit: true });
              addExplosion(s, e.x, e.y, 1.5, 0);
              bumpShake(s, 6, 0.1);
            } else {
              pushCombatText(s, e.x, e.y - 14, String(dealt), crit ? "#ffd44a" : "#ffffff", { size: crit ? 14 : 12, life: 0.75, crit });
            }

            if (knock > 0) {
              const dx2 = e.x - p.x;
              const dy2 = e.y - p.y;
              const dd = Math.hypot(dx2, dy2) || 1;
              e.x += (dx2 / dd) * knock * 0.03;
              e.y += (dy2 / dd) * knock * 0.03;
            }

            if (p.poisonChance > 0 && Math.random() < p.poisonChance) {
              e.poisonT = Math.max(e.poisonT, 2.4);
              e.poisonDps = Math.max(e.poisonDps, Math.max(3, dmg * 0.3));
            }
            // Ice Crystal gives chance-based freeze, or regular freeze chance
            if (p.iceCrystalFreezeChance && Math.random() < p.iceCrystalFreezeChance) {
              e.freezeT = Math.max(e.freezeT, p.iceCrystalFreezeDuration || 1.2);
            } else if (p.freezeChance > 0 && Math.random() < p.freezeChance) {
              e.freezeT = Math.max(e.freezeT, 1.05);
            }
            
            // Flamewalker removed from melee - now uses aura mode
          }
        }

        addParticle(s, p.x, p.y, 4, 220);
        weapon.attackT = weapon.attackCooldown;
        continue;
      }

      // Ranged weapon
      const spread = weapon.weaponSpread;
      const count = Math.max(1, weapon.projectiles);

      const dmgBase = weapon.weaponDamage * (0.84 + 0.03 * s.floor);
      const crit = Math.random() < clamp(p.critChance, 0, 0.8);
      const dmg = crit ? dmgBase * 1.6 : dmgBase;

      // Weapon-specific colors and visuals
      let color = "#e6e8ff";
      let bulletSpeed = speed;
      let bulletSize = bulletR;
      let soundVariant = 0;
      let hasGlow = false;
      
      // Apply weapon-specific speed and size multipliers (from base or weapon object)
      const speedMult = weapon.bulletSpeedMult || weapon.weaponBulletSpeedMult || 1;
      const sizeMult = weapon.bulletSizeMult || weapon.weaponBulletSizeMult || 1;
      bulletSpeed *= speedMult;
      bulletSize *= sizeMult;
      
      if (weapon.weaponEffect === "poison") {
        color = "#4dff88"; // Green poison color
        soundVariant = 1; // Different sound for poison
        bulletSize *= 1.2; // Larger flask visual
        hasGlow = true; // Glow effect for poison flask
      } else if (weapon.weaponEffect === "freeze") {
        color = "#7bf1ff";
        soundVariant = 2;
        bulletSpeed *= 1.15; // Faster freeze bullets
        bulletSize *= 0.9;
      } else if (weapon.weaponEffect === "burn") {
        color = "#ff7a3d";
        soundVariant = 3; // Fire sound
        bulletSpeed *= 0.65; // Slower fireballs
        bulletSize *= 1.3; // Bigger fireballs
        hasGlow = true; // Firey glow effect
      } else if (weapon.id === "revolver") {
        color = "#ffd44a";
        soundVariant = 0;
        bulletSpeed *= 1.1;
      } else if (weapon.id === "bone") {
        color = "#ffffff";
        soundVariant = 4;
        bulletSpeed *= 0.4; // Much slower travel speed
      } else if (weapon.id === "lightning_staff") {
        color = "#ffff00";
        soundVariant = 2;
        bulletSpeed *= 1.3;
      } else if (weapon.id === "bow") {
        color = "#8b4513";
        soundVariant = 0;
      } else if (weapon.id === "bananarang") {
        color = "#ffd700";
        soundVariant = 0;
      }

      // Splash radius for splash and thrown modes (poison flask)
      const splashR = (weapon.weaponMode === "splash" || weapon.weaponMode === "thrown") 
        ? Math.max(26, (weapon.weaponSplashR || 54) * p.sizeMult) 
        : 0;

      // Check if boomerang weapon
      const isBoomerang = weapon.weaponMode === "boomerang";
      
      // Mark bananarang as having active boomerang
      if (isBoomerang) {
        weapon.hasActiveBoomerang = true;
      }
      
      if (count === 1) {
        // Single projectile - shoot straight forward
        shootBullet(s, p.x, p.y, baseA, dmg, bulletSpeed, {
          r: bulletSize * (isBoomerang ? 1.8 : 1), // Larger for bananarang visibility
          pierce: weapon.pierce,
          color,
          crit,
          knock,
          bounces: weapon.bounces,
          effect: weapon.weaponEffect,
          splashR,
          soundVariant,
          glow: hasGlow,
          boomerang: isBoomerang,
          maxDist: isBoomerang ? 400 : undefined, // Shorter max distance
          weaponId: isBoomerang ? weapon.id : undefined, // Track which weapon this belongs to
        });
      } else {
        // Multiple projectiles - first one straight forward, rest spread out with offset
        // First shot always straight forward (no spread, no offset)
        shootBullet(s, p.x, p.y, baseA, dmg, bulletSpeed, {
          r: bulletSize,
          pierce: weapon.pierce,
          color,
          crit,
          knock,
          bounces: weapon.bounces,
          effect: weapon.weaponEffect,
          splashR,
          soundVariant,
          glow: hasGlow,
          boomerang: isBoomerang,
          maxDist: isBoomerang ? 500 : undefined,
          isBone: weapon.id === "bone", // Mark bone bullets for rotation
          life: weapon.id === "bone" ? 4.0 : undefined, // Longer life for bone bullets
        });
        
        // Additional shots spread out in an arc - consistent angle progression
        // For 2 projectiles: small spread, for 3+: same angle increment per projectile
        const baseArc = 0.15; // Base arc for 2 projectiles
        const arcIncrement = 0.08; // Additional angle per extra projectile
        const arc = Math.min(0.4, baseArc + (count - 2) * arcIncrement); // Cap at 0.4 rad max
        const offsetDist = 12; // Distance to offset perpendicular to direction
        
        for (let i = 1; i < count; i++) {
          // Even distribution across arc
          const t = (count - 1) === 1 ? 0.5 : (i - 1) / (count - 1);
          // Spread angle with minimal randomness
          const spreadAngle = lerp(-arc, arc, t) + rand(-spread * 0.2, spread * 0.2);
          const a = baseA + spreadAngle;
          
          // Offset position perpendicular to the base angle to prevent overlap
          // This creates a fan pattern where projectiles don't spawn on top of each other
          const perpAngle = baseA + Math.PI / 2;
          const offsetX = Math.cos(perpAngle) * offsetDist * (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2);
          const offsetY = Math.sin(perpAngle) * offsetDist * (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2);
          
          // Also add a small forward offset so they don't overlap at spawn
          const forwardOffset = 6 * i;
          const forwardX = Math.cos(baseA) * forwardOffset;
          const forwardY = Math.sin(baseA) * forwardOffset;
          
          shootBullet(s, p.x + offsetX + forwardX, p.y + offsetY + forwardY, a, dmg, bulletSpeed, {
            r: bulletSize,
            pierce: weapon.pierce,
            color,
            crit,
            knock,
            bounces: weapon.bounces,
            effect: weapon.weaponEffect,
            splashR,
            soundVariant,
            glow: hasGlow,
            boomerang: isBoomerang,
            maxDist: isBoomerang ? 500 : undefined,
            isBone: weapon.id === "bone", // Mark bone bullets for rotation
            life: weapon.id === "bone" ? 4.0 : undefined, // Longer life for bone bullets
          });
        }
      }

      weapon.attackT = weapon.attackCooldown;
    }
  }

  function spawnInteractable(s, kind) {
    const { w, h, padding } = s.arena;
    let x, y;
    
    // For chests, spawn in random rooms across the level for better distribution
    if (kind === INTERACT.CHEST && s.levelData && s.levelData.rooms && s.levelData.rooms.length > 0) {
      // Pick a random room
      const room = s.levelData.rooms[Math.floor(Math.random() * s.levelData.rooms.length)];
      // Spawn in the center area of the room
      x = room.x + rand(room.w * 0.3, room.w * 0.7);
      y = room.y + rand(room.h * 0.3, room.h * 0.7);
    } else if (s.levelData) {
      // For other interactables, use level bounds
      x = rand(padding + 60, s.levelData.w - padding - 60);
      y = rand(padding + 60, s.levelData.h - padding - 60);
    } else {
      // Fallback to arena bounds
      x = rand(padding + 60, w - padding - 60);
      y = rand(padding + 60, h - padding - 60);
    }

    let cost = 0;
    if (kind === INTERACT.CHEST) cost = chestCost(s.chestOpens, s.floor);
    if (kind === INTERACT.MICROWAVE) cost = Math.round(8 + s.floor * 2);
    if (kind === INTERACT.GREED) cost = Math.round(8 + s.floor * 2);
    if (kind === INTERACT.SHRINE) cost = Math.round(6 + s.floor * 2);
    if (kind === INTERACT.BOSS_TP) cost = Math.round(12 + s.floor * 2);

    s.interact.push({
      id: Math.random().toString(16).slice(2),
      kind,
      x,
      y,
      r: 16,
      cost,
      used: false,
      t: 0,
    });
  }

  function rollChoicesOfType(s, forcedType = null) {
    const p = s.player;
    const luck = p.luck;

    const choices = [];
    const used = new Set();

    const wantWeapon = !p.weapons || p.weapons.length === 0 || Math.random() < 0.18;

    for (let i = 0; i < 3; i++) {
      let safe = 0;
      while (safe++ < 90) {
        const rarity = rollRarity(luck);

        const bucket =
          forcedType ||
          pickWeighted([
            { w: wantWeapon ? 28 : 18, t: TYPE.WEAPON },
            { w: 52, t: TYPE.TOME },
            { w: 20, t: TYPE.ITEM },
          ]).t;

        let entry = null;
        if (bucket === TYPE.WEAPON) entry = pickWeighted(content.weapons.map((w) => ({ w: 1, t: w }))).t;
        else if (bucket === TYPE.TOME) entry = pickWeighted(content.tomes.map((t) => ({ w: 1, t }))).t;
        else entry = pickWeighted(content.items.map((it) => ({ w: 1, t: it }))).t;

        // Prevent same item in different rarities - only allow one version
        const itemKey = `${bucket}:${entry.id}`;
        let alreadyUsed = false;
        for (const usedKey of used) {
          if (usedKey.startsWith(itemKey)) {
            alreadyUsed = true;
            break;
          }
        }
        if (alreadyUsed) continue;
        
        const key = `${bucket}:${entry.id}:${rarity}`;
        used.add(key);

        // For weapon upgrades, determine upgrade type before preview
        // Use deterministic selection based on weapon level for consistency
        let weaponUpgradeType = "";
        if (bucket === TYPE.WEAPON) {
          const existingWeapon = s.player.weapons?.find(w => w.id === entry.id);
          if (existingWeapon) {
            // Use level-based deterministic selection (cycles through upgrade types)
            const level = existingWeapon.level || 1;
            const upgradeIndex = (level - 1) % 4;
            if (upgradeIndex === 0) {
              weaponUpgradeType = "+1 Projectile";
            } else if (upgradeIndex === 1) {
              weaponUpgradeType = "+6% Damage";
            } else if (upgradeIndex === 2) {
              weaponUpgradeType = "+4% Attack Speed";
            } else {
              weaponUpgradeType = "+4% Projectile Speed";
            }
          }
        }
        
        const preview = buildPreview(s, (pp) => {
          if (bucket === TYPE.WEAPON) applyWeapon(pp, entry, rarity, true);
          else if (bucket === TYPE.TOME) entry.apply(pp, rarity);
        });

        // Generate detailed description with exact amounts based on rarity
        let detailedDesc = entry.desc || (bucket === TYPE.WEAPON ? "Equip or upgrade your weapon" : "");
        if (bucket === TYPE.WEAPON) {
          // Generate description for weapon upgrade
          const existingWeapon = s.player.weapons?.find(w => w.id === entry.id);
          if (existingWeapon) {
            // Show what will be upgraded
            const m = rarityMult(rarity);
            const levelBonus = existingWeapon.level || 1;
            const nextLevel = levelBonus + 1;
            
            detailedDesc = `Level ${nextLevel} ${entry.name} (${rarity})`;
            if (weaponUpgradeType) {
              detailedDesc += `\n${weaponUpgradeType}`;
            }
            // Add preview info from buildPreview
            if (preview) {
              detailedDesc += `\n${preview}`;
            }
          } else {
            detailedDesc = `New: ${entry.name} (${rarity})`;
          }
        } else if (bucket === TYPE.TOME && entry.apply) {
          const m = rarityMult(rarity);
          // Calculate exact amounts for common tomes
          if (entry.id === "t_damage") {
            const percent = Math.round(6 * m * 10) / 10;
            detailedDesc = `+${percent}% Damage to all weapons (${rarity})`;
          } else if (entry.id === "t_cooldown") {
            const percent = Math.round(8 * m);
            detailedDesc = `-${percent}% Attack Cooldown (${rarity})`;
          } else if (entry.id === "t_quantity") {
            let projectilesToAdd = 1;
            if (rarity === RARITY.UNCOMMON || rarity === RARITY.RARE) {
              projectilesToAdd = 2;
            } else if (rarity === RARITY.LEGENDARY) {
              projectilesToAdd = 3;
            }
            detailedDesc = `+${projectilesToAdd} Projectile${projectilesToAdd > 1 ? 's' : ''} (${rarity})`;
          } else if (entry.id === "t_precision") {
            const amount = Math.round(4 * m * 100) / 100;
            detailedDesc = `+${amount}% Crit Chance (${rarity})`;
          } else if (entry.id === "t_hp") {
            const amount = Math.round(14 * m);
            detailedDesc = `+${amount} Max HP (${rarity})`;
          } else if (entry.id === "t_regen") {
            const amount = Math.round(55 * m * 100) / 100;
            detailedDesc = `+${amount} HP Regen (${rarity})`;
          } else if (entry.id === "t_gold") {
            const percent = Math.round(12 * m);
            detailedDesc = `+${percent}% Gold Gain (${rarity})`;
          } else if (entry.id === "t_luck") {
            const amount = Math.round(32 * m * 100) / 100;
            detailedDesc = `+${amount} Luck (${rarity})`;
          } else if (entry.id === "t_xp") {
            const percent = Math.round(12 * m);
            detailedDesc = `+${percent}% XP Gain (${rarity})`;
          } else if (entry.id === "t_bounce") {
            const chance = Math.round((55 + 20 * m) * 10) / 10;
            detailedDesc = `${chance}% chance +1 Bounce (${rarity})`;
          } else if (entry.id === "t_agility") {
            const amount = Math.round(14 * m);
            detailedDesc = `+${amount} Movement Speed (${rarity})`;
          }
        }

        // Create apply function with proper closure and error handling
        const applyFn = () => {
          try {
            const currentState = stateRef.current;
            if (!currentState) return;
            
            if (bucket === TYPE.WEAPON) {
              const p = currentState.player;
              const existingWeapon = p.weapons?.find(w => w.id === entry.id);
              const beforeDmg = existingWeapon ? existingWeapon.weaponDamage : 0;
              const beforeProj = existingWeapon ? existingWeapon.projectiles : 0;
              const beforeCd = existingWeapon ? existingWeapon.attackCooldown : 0;
              
              applyWeapon(p, entry, rarity, false);
              
              // Show feedback for what was upgraded
              if (existingWeapon) {
                const afterDmg = existingWeapon.weaponDamage;
                const afterProj = existingWeapon.projectiles;
                const afterCd = existingWeapon.attackCooldown;
                
                if (Math.abs(afterDmg - beforeDmg) > 0.1) {
                  const dmgIncrease = Math.round((afterDmg - beforeDmg) * 10) / 10;
                  pushCombatText(currentState, p.x, p.y - 30, `+${dmgIncrease} Damage`, "#2ea8ff", { size: 13, life: 1.0 });
                }
                if (afterProj > beforeProj) {
                  pushCombatText(currentState, p.x, p.y - 45, `+${afterProj - beforeProj} Projectile`, "#ffd44a", { size: 13, life: 1.0 });
                }
                if (Math.abs(beforeCd - afterCd) > 0.01) {
                  const cdReduction = Math.round((beforeCd - afterCd) * 100) / 100;
                  pushCombatText(currentState, p.x, p.y - 60, `-${cdReduction}s Cooldown`, "#1fe06a", { size: 13, life: 1.0 });
                }
              } else {
                // New weapon
                pushCombatText(currentState, p.x, p.y - 30, `NEW: ${entry.name}`, "#ffd44a", { size: 14, life: 1.2 });
              }
              
              // Track collected weapon
              if (!p.collectedWeapons) p.collectedWeapons = [];
              if (!p.collectedWeapons.find(w => w.id === entry.id)) {
                p.collectedWeapons.push({ id: entry.id, name: entry.name, icon: entry.icon });
              }
              sfxInteract();
            } else if (bucket === TYPE.TOME) {
              const p = currentState.player;
              const beforeDmg = p.weapons ? p.weapons.reduce((sum, w) => sum + w.weaponDamage, 0) : 0;
              const beforeCrit = p.critChance;
              const beforeHp = p.maxHp;
              const beforeSpeed = p.speedBase + p.speedBonus;
              
              entry.apply(p, rarity);
              
              // Show feedback for what was upgraded
              if (entry.id === "t_damage") {
                const afterDmg = p.weapons ? p.weapons.reduce((sum, w) => sum + w.weaponDamage, 0) : 0;
                const dmgIncrease = Math.round((afterDmg - beforeDmg) * 10) / 10;
                if (dmgIncrease > 0.1) {
                  pushCombatText(currentState, p.x, p.y - 30, `+${dmgIncrease} Total Damage`, "#2ea8ff", { size: 13, life: 1.0 });
                }
              } else if (entry.id === "t_precision") {
                const critIncrease = Math.round((p.critChance - beforeCrit) * 100 * 10) / 10;
                if (critIncrease > 0.1) {
                  pushCombatText(currentState, p.x, p.y - 30, `+${critIncrease}% Crit`, "#ffd44a", { size: 13, life: 1.0 });
                }
              } else if (entry.id === "t_hp") {
                const hpIncrease = Math.round(p.maxHp - beforeHp);
                if (hpIncrease > 0) {
                  pushCombatText(currentState, p.x, p.y - 30, `+${hpIncrease} Max HP`, "#1fe06a", { size: 13, life: 1.0 });
                }
              } else if (entry.id === "t_agility") {
                const speedIncrease = Math.round((p.speedBase + p.speedBonus) - beforeSpeed);
                if (speedIncrease > 0) {
                  pushCombatText(currentState, p.x, p.y - 30, `+${speedIncrease} Speed`, "#c23bff", { size: 13, life: 1.0 });
                }
              } else if (entry.id === "t_quantity") {
                // Show feedback for quantity tome
                const m = rarityMult(rarity);
                let projectilesToAdd = 1;
                if (rarity === RARITY.UNCOMMON || rarity === RARITY.RARE) {
                  projectilesToAdd = 2;
                } else if (rarity === RARITY.LEGENDARY) {
                  projectilesToAdd = 3;
                }
                pushCombatText(currentState, p.x, p.y - 30, `+${projectilesToAdd} Projectile${projectilesToAdd > 1 ? 's' : ''}`, "#ffd44a", { size: 13, life: 1.0 });
              } else {
                pushCombatText(currentState, p.x, p.y - 30, `${entry.name}`, "#2ea8ff", { size: 13, life: 1.0 });
              }
              
              // Track collected tome
              if (!p.collectedTomes) p.collectedTomes = [];
              if (!p.collectedTomes.find(t => t.id === entry.id)) {
                p.collectedTomes.push({ id: entry.id, name: entry.name, icon: entry.icon });
              }
              sfxInteract();
            } else {
              entry.apply(currentState, rarity);
              // Track collected item
              if (!currentState.player.collectedItems) currentState.player.collectedItems = [];
              if (!currentState.player.collectedItems.find(it => it.id === entry.id)) {
                currentState.player.collectedItems.push({ id: entry.id, name: entry.name, icon: entry.icon });
              }
              sfxInteract();
            }
          } catch (error) {
            console.error("Error applying upgrade:", error, entry);
            // Still continue even if there's an error
            sfxInteract();
          }
        };
        
        choices.push({
          rarity,
          type: bucket,
          id: entry.id,
          name: entry.name,
          desc: detailedDesc,
          icon: entry.icon,
          preview,
          apply: applyFn,
        });

        break;
      }
    }

    return choices;
  }

  function rollLevelChoices(s) {
    return rollChoicesOfType(s, null);
  }

  function rollChestChoices(s) {
    const bucket = pickWeighted([
      { w: 26, t: TYPE.WEAPON },
      { w: 50, t: TYPE.TOME },
      { w: 24, t: TYPE.ITEM },
    ]).t;
    return { bucket, choices: rollChoicesOfType(s, bucket) };
  }

  function startBoss(s, seconds, bossX = null, bossY = null) {
    const { w, padding } = s.arena;
    s.boss.active = true;
    s.boss.r = 38;
    s.boss.maxHp = Math.round(980 + s.floor * 240);
    s.boss.hp = s.boss.maxHp;
    // Spawn boss at teleporter location if provided, otherwise center
    if (bossX !== null && bossY !== null) {
      s.boss.x = bossX;
      s.boss.y = bossY;
    } else {
      s.boss.x = w * 0.5;
      s.boss.y = padding + 90;
    }
    s.boss.timeLeft = seconds;
    s.boss.spitT = 0.6;
    s.boss.enraged = false;

    bumpShake(s, 8, 0.1);
    sfxBoss();
  }

  function makePlayer(charId, w, h) {
    const c = content.characters.find((x) => x.id === charId) || content.characters[0];

    const base = {
      x: w * 0.5,
      y: h * 0.55,
      r: 14,

      speedBase: 260,
      speedBonus: 0,

      hp: 100,
      maxHp: 100,
      regen: 0,

      xpGain: 1,
      luck: 0,
      difficultyTome: 1,

      goldGain: 1,

      sizeMult: 1,
      projectileSpeed: 1,

      critChance: 0,
      armor: 0,
      evasion: 0,
      knockback: 0,
      thorns: 0,
      lifesteal: 0,
      iFrameOnHit: 0,
      bigBonkChance: 0,
      bigBonkMult: 1,

      poisonChance: 0,
      freezeChance: 0,

      weapons: [],

      shieldPerWave: 0,
      shield: 0,
      iFrames: 0,

      abilityId: c.space.id,
      abilityCd: c.space.cd,
      abilityT: 0,
      abilityCdMult: 1, // Multiplier for ability cooldown reduction

      buffHasteT: 0,
      buffHasteMult: 1,

      magnet: 1,
      magnetT: 0, // Magnet shrine duration

      coins: 0,
      
      // Track collected upgrades for display
      collectedWeapons: [],
      collectedTomes: [],
      collectedItems: [],

      lastDamage: { src: "", amt: 0 },
    };

    const stats = c.stats || {};
    if (stats.hp != null) {
      base.hp = stats.hp;
      base.maxHp = stats.hp;
    }
    if (stats.speedBase != null) base.speedBase = stats.speedBase;
    if (stats.critChance != null) base.critChance = stats.critChance;
    if (stats.sizeMult != null) base.sizeMult = stats.sizeMult;
    if (stats.armor != null) base.armor = stats.armor;

    const wDef = content.weapons.find((ww) => ww.id === c.startWeapon);
    if (wDef) {
      base.weapons = [];
      base.collectedWeapons = [];
      base.collectedTomes = [];
      base.collectedItems = [];
      applyWeapon(base, wDef, RARITY.COMMON, false);
      // Track starting weapon
      if (!base.collectedWeapons.find(w => w.id === wDef.id)) {
        base.collectedWeapons.push({ id: wDef.id, name: wDef.name, icon: wDef.icon });
      }
    }

    base.charId = c.id;
    base.charName = c.name;

    return base;
  }

  function newRun(prevBest = 0, charId = "cowboy") {
    ensureAudio();

    const { w, h } = sizeRef.current;

    const player = makePlayer(charId, w, h);

    const s = {
      t: 0,
      running: true,
      freezeMode: null,
      floor: 1,
      score: 0,
      bgHue: Math.floor(rand(190, 250)),

      stageDur: 600,
      stageLeft: 600,
      maxStageTime: 900, // Max time before forced difficulty increase
      difficultyMultiplier: 1.0, // Increases over time
      floorStartTime: 0, // Time when floor started

      shakeT: 0,
      shakeDur: 0,
      shakeMag: 0,
      hitStopT: 0,

      worldScale: 0.92,

      arena: { w, h, padding: 28 },
      levelData: null, // Procedural level data
      player,

      level: 1,
      xp: 0,
      xpNeed: xpToNext(1),

      bullets: [],
      enemies: [],
      gems: [],
      coins: [],
      particles: [],
      floaters: [],
      hitFlashes: [],
      burningAreas: [], // Ground fire effects from flamewalker
      auras: [], // Player aura effects

      interact: [],
      chestOpens: 0,
      chestSpawnT: 12,

      spawn: { t: 1.2, delay: 0.78, cap: 10 },

      boss: { active: false, hp: 0, maxHp: 0, r: 0, x: 0, y: 0, timeLeft: 0, spitT: 0, enraged: false },
      bossPortalSpawned: false,
      camera: null,

      lastHitT: -999,

      schedule: { didSeven: false, didThree: false },

      uiPulseT: 0,
      _shieldTick: -1,
    };

    // Generate procedural level
    s.levelData = generateProceduralLevel(w, h, 1);
    s.floorStartTime = 0;
    
    // Initialize camera
    s.camera = { x: 0, y: 0 };
    
    // Spawn player in first room (center of first room, clamped to room bounds)
    const padding = s.arena.padding;
    if (s.levelData && s.levelData.rooms.length > 0) {
      const startRoom = s.levelData.rooms[0];
      // Ensure player spawns in the center of the room, within room bounds
      player.x = clamp(startRoom.x + startRoom.w / 2, startRoom.x + padding, startRoom.x + startRoom.w - padding);
      player.y = clamp(startRoom.y + startRoom.h / 2, startRoom.y + padding, startRoom.y + startRoom.h - padding);
      
      // Ensure player is in walkable area
      if (s.levelData.walkableAreas && !isPointWalkable(player.x, player.y, s.levelData, player.r || 12)) {
        const walkable = findNearestWalkable(player.x, player.y, s.levelData, player.r || 12);
        player.x = walkable.x;
        player.y = walkable.y;
      }
      
      // Set initial camera position
      s.camera.x = clamp(player.x - w / 2, 0, Math.max(0, s.levelData.w - w));
      s.camera.y = clamp(player.y - h / 2, 0, Math.max(0, s.levelData.h - h));
    } else {
      // Fallback if no level data
      player.x = w / 2;
      player.y = h / 2;
      s.camera.x = 0;
      s.camera.y = 0;
    }
    
    spawnInteractable(s, INTERACT.CHEST);

    stateRef.current = s;

    setUi((u) => ({
      ...u,
      screen: "running",
      selectedChar: charId,
      score: 0,
      coins: 0,
      best: prevBest,
      level: 1,
      xp: 0,
      xpNeed: s.xpNeed,
      timer: s.stageLeft,
      hint: "Collect XP gems to level up",
      levelChoices: [],
      deathReason: "",
      showStats: false,
    }));
  }

  function awardXP(s, amount, x, y) {
    const p = s.player;
    const xp = Math.round(amount * p.xpGain);
    s.xp += xp;

    if (Math.random() < 0.5) {
      s.particles.push({ x, y, vx: rand(-40, 40), vy: rand(-120, -40), r: 2.8, t: 0, life: rand(0.25, 0.45), hue: 170 });
    }

    let levelUpSafe = 0;
    while (s.xp >= s.xpNeed && levelUpSafe < 100) {
      levelUpSafe++;
      s.xp -= s.xpNeed;
      s.level += 1;
      s.xpNeed = xpToNext(s.level);

      p.iFrames = Math.max(p.iFrames, 1.25);
      if (p.hp <= 0) p.hp = 1;

      s.bullets = [];

      // Class-specific perks on level up
      if (p.charId === "cowboy") {
        // Cowboy: Increases crit by 1.5% each level
        p.critChance = clamp(p.critChance + 0.015, 0, 0.8);
        pushCombatText(s, p.x, p.y - 35, "+1.5% Crit", "#2ea8ff", { size: 11, life: 0.8 });
      } else if (p.charId === "wizard") {
        // Wizard: Increases luck by 0.15 each level
        p.luck += 0.15;
        pushCombatText(s, p.x, p.y - 35, "+0.15 Luck", "#c23bff", { size: 11, life: 0.8 });
      } else if (p.charId === "brute") {
        // Brute: Increases max HP by 8 each level
        p.maxHp = Math.round(p.maxHp + 8);
        p.hp = Math.min(p.maxHp, p.hp + 8);
        pushCombatText(s, p.x, p.y - 35, "+8 Max HP", "#1fe06a", { size: 11, life: 0.8 });
      }

      pushCombatText(s, p.x, p.y - 18, `LEVEL ${s.level}`, "#2ea8ff", { size: 14, life: 0.95 });
      addExplosion(s, p.x, p.y, 1.5, 200);

      sfxLevelUp();

      const choices = rollLevelChoices(s);
      const nextUi = {
        ...uiRef.current,
        screen: "levelup",
        level: s.level,
        xp: s.xp,
        xpNeed: s.xpNeed,
        score: s.score,
        coins: s.player.coins,
        timer: s.stageLeft,
        hint: "Level up",
        levelChoices: choices,
      };

      s.running = false;
      s.freezeMode = "levelup";

      uiRef.current = nextUi;
      setUi(nextUi);

      return true;
    }

    return false;
  }

  function nearestInteractable(s) {
    const p = s.player;
    let best = null;
    let bestD = Infinity;

    for (const it of s.interact) {
      if (it.used) continue;
      const d = Math.hypot(p.x - it.x, p.y - it.y);
      if (d < bestD) {
        bestD = d;
        best = it;
      }
    }

    return best && bestD <= 52 ? best : null;
  }

  function recordDamage(p, src, amt) {
    p.lastDamage = { src, amt: Math.round(amt) };
  }

  function applyPlayerDamage(s, amount, src, opts = {}) {
    const p = s.player;
    if (p.iFrames > 0 || p.hp <= 0) return false;

    if (rollEvasion(p.evasion)) {
      p.iFrames = 0.25;
      pushCombatText(s, p.x, p.y - 22, "EVADE", "#2ea8ff", { size: 12, life: 0.7 });
      return true;
    }

    const shakeMag = opts.shakeMag ?? 7;
    const shakeTime = opts.shakeTime ?? 0.09;
    const hitStop = opts.hitStop ?? 0.03;

    if (p.shield > 0) {
      p.shield -= 1;
      p.iFrames = 0.6;
      bumpShake(s, Math.min(7, shakeMag), shakeTime);
      if (hitStop > 0) s.hitStopT = Math.max(s.hitStopT, Math.min(0.02, hitStop));
      addParticle(s, p.x, p.y, 12, 165);
      pushCombatText(s, p.x, p.y - 22, "SHIELD", "#9cffd6", { size: 12, life: 0.7 });
      recordDamage(p, `${src} (shield)`, 0);
      return true;
    }

    const dmg = mitigateDamage(amount, p.armor);
    p.hp -= dmg;
    p.iFrames = 0.75;
    s.lastHitT = s.t;
    
    // Apply thorns damage to attacker if player has thorns
    if (p.thorns > 0 && opts.fromX !== undefined && opts.fromY !== undefined) {
      // Find nearest enemy to the damage source
      let nearestEnemy = null;
      let nearestD2 = Infinity;
      for (const e of s.enemies) {
        if (e.hp <= 0) continue;
        const d2 = dist2(opts.fromX, opts.fromY, e.x, e.y);
        if (d2 < nearestD2 && d2 < 100) { // Only if within 100 units
          nearestD2 = d2;
          nearestEnemy = e;
        }
      }
      // Also check boss
      if (s.boss.active && s.boss.hp > 0) {
        const bossD2 = dist2(opts.fromX, opts.fromY, s.boss.x, s.boss.y);
        if (bossD2 < nearestD2 && bossD2 < 100) {
          nearestEnemy = s.boss;
        }
      }
      
      if (nearestEnemy) {
        const thornsDmg = dmg * p.thorns;
        nearestEnemy.hp -= thornsDmg;
        if (nearestEnemy.hitT !== undefined) nearestEnemy.hitT = 0.12;
        pushCombatText(s, nearestEnemy.x, nearestEnemy.y - 14, `THORNS ${Math.round(thornsDmg)}`, "#ff7a3d", { size: 12, life: 0.8 });
        addParticle(s, nearestEnemy.x, nearestEnemy.y, 6, 20, { size: 2, speed: 0.6 });
      }
    }

    // Screen shake and push back on hit
    bumpShake(s, Math.max(shakeMag, 3.5), shakeTime); // Ensure minimum shake
    if (hitStop > 0) s.hitStopT = Math.max(s.hitStopT, Math.min(0.05, hitStop)); // Cap hitStop to prevent freeze
    
    // Push player back from damage source
    if (opts.pushBack !== false) {
      const pushDist = 25;
      // Try to find damage source direction
      if (opts.fromX !== undefined && opts.fromY !== undefined) {
        const dx = p.x - opts.fromX;
        const dy = p.y - opts.fromY;
        const dist = Math.hypot(dx, dy) || 1;
        p.x += (dx / dist) * pushDist;
        p.y += (dy / dist) * pushDist;
      } else {
        // Random push back if no source
        const angle = Math.random() * Math.PI * 2;
        p.x += Math.cos(angle) * pushDist;
        p.y += Math.sin(angle) * pushDist;
      }
    }
    
    addParticle(s, p.x, p.y, 16, 350);

    pushCombatText(s, p.x, p.y - 22, `-${Math.round(dmg)}`, "#ff5d5d", { size: 12, life: 0.85 });
    recordDamage(p, src, dmg);

    return true;
  }

  function tryUseInteractable(s) {
    const p = s.player;
    const best = nearestInteractable(s);
    if (!best) return;

    if (best.cost > 0 && p.coins < best.cost) {
      pushCombatText(s, p.x, p.y - 24, `Need ${best.cost}`, "#ffd44a", { size: 12, life: 0.7 });
      return;
    }
    if (best.cost > 0) p.coins -= best.cost;

    best.used = true;
    sfxInteract();

    if (best.kind === INTERACT.CHEST) {
      s.chestOpens += 1;
      // Removed "CHEST OPENED" text to avoid blocking upgrade display
      s.interact = s.interact.filter((x) => x.id !== best.id);
      s.bullets = [];

      const rolled = rollChestChoices(s);
      const nextUi = {
        ...uiRef.current,
        screen: "levelup",
        level: s.level,
        xp: s.xp,
        xpNeed: s.xpNeed,
        score: s.score,
        coins: s.player.coins,
        timer: s.stageLeft,
        hint: `Chest reward: ${rolled.bucket}`,
        levelChoices: rolled.choices,
      };

      uiRef.current = nextUi;
      setUi(nextUi);
      s.running = false;
      s.freezeMode = "levelup";

      s.chestSpawnT = 28 + rand(0, 18);
      return;
    }

    if (best.kind === INTERACT.SHRINE) {
      p.buffHasteT = Math.max(p.buffHasteT, 6);
      p.buffHasteMult = Math.max(p.buffHasteMult, 1.25); // > 1 speeds up (25% faster)
      bumpShake(s, 2, 0.06);
      // Visual feedback for speed boost
      addParticle(s, p.x, p.y, 20, 120, { size: 3, speed: 1.2 });
      pushCombatText(s, p.x, p.y - 30, `SPEED BOOST +${Math.round((p.buffHasteMult - 1) * 100)}%`, "#4dff88", { size: 16, life: 1.2 });
      s.interact = s.interact.filter((x) => x.id !== best.id);
      return;
    }

    if (best.kind === INTERACT.MAGNET_SHRINE) {
      // Magnet shrine - instantly pull all gold and XP on the floor
      bumpShake(s, 2, 0.06);
      addParticle(s, p.x, p.y, 20, 120, { size: 3, speed: 1.2 });
      pushCombatText(s, p.x, p.y - 30, "MAGNET SHRINE", "#ffd44a", { size: 16, life: 1.2 });
      
      // Instantly collect all XP gems on the floor
      for (const g of s.gems) {
        if (g.t <= g.life) {
          awardXP(s, g.v, g.x, g.y);
        }
      }
      s.gems = [];
      
      // Instantly collect all coins on the floor
      for (const c of s.coins) {
        if (c.t <= c.life) {
          const actualGold = Math.round(c.v * p.goldGain);
          p.coins += actualGold;
          s.score += actualGold * 3;
          pushCombatText(s, c.x, c.y - 14, `+${actualGold}`, "#ffd44a", { size: 11, life: 0.7 });
        }
      }
      s.coins = [];
      
      s.interact = s.interact.filter((x) => x.id !== best.id);
      return;
    }

    if (best.kind === INTERACT.MICROWAVE) {
      const heal = Math.round(p.maxHp * 0.35);
      p.hp = Math.min(p.maxHp, p.hp + heal);
      addParticle(s, p.x, p.y, 18, 160);
      pushCombatText(s, p.x, p.y - 30, `+${heal} HP`, "#4dff88", { size: 16, life: 1.2 });
      s.interact = s.interact.filter((x) => x.id !== best.id);
      return;
    }

    if (best.kind === INTERACT.GREED) {
      p.difficultyTome *= 1.15;
      s.spawn.delay = Math.max(0.26, s.spawn.delay * 0.92);
      pushCombatText(s, p.x, p.y - 30, "GREED SHRINE", "#ffd44a", { size: 16, life: 1.2 });
      s.interact = s.interact.filter((x) => x.id !== best.id);
      return;
    }

    if (best.kind === INTERACT.BOSS_TP) {
      // Store boss teleporter position for boss spawn
      const u = uiRef.current;
      u.bossTpX = best.x;
      u.bossTpY = best.y;
      s.interact = s.interact.filter((x) => x.id !== best.id);
      if (!s.boss.active) {
        startBoss(s, 120, best.x, best.y); // Spawn boss at teleporter location
        s.bossPortalSpawned = false; // Reset for next floor
      }
    }
  }

  function useAbility(s) {
    const p = s.player;
    if (p.abilityT > 0 || p.hp <= 0) return;

    const keys = keysRef.current;
    const mx = (keys.has("ArrowRight") || keys.has("d") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("a") ? 1 : 0);
    const my = (keys.has("ArrowDown") || keys.has("s") ? 1 : 0) - (keys.has("ArrowUp") || keys.has("w") ? 1 : 0);
    const len = Math.hypot(mx, my) || 1;
    const ux = len ? mx / len : 1;
    const uy = len ? my / len : 0;

    if (p.abilityId === "blink") {
      const dist = 190;
      // Use levelData bounds if available, otherwise fall back to arena
      const padding = s.arena.padding;
      const maxX = s.levelData ? s.levelData.w - padding : s.arena.w - padding;
      const maxY = s.levelData ? s.levelData.h - padding : s.arena.h - padding;
      p.x = clamp(p.x + ux * dist, padding, maxX);
      p.y = clamp(p.y + uy * dist, padding, maxY);
      p.iFrames = Math.max(p.iFrames, 0.4);
      addParticle(s, p.x, p.y, 16, 190);
      playBeep({ type: "triangle", f0: 840, f1: 520, dur: 0.09, gain: 0.14, pan: 0 });
      p.abilityT = p.abilityCd * (p.abilityCdMult || 1);
      return;
    }

    if (p.abilityId === "roll") {
      const dist = 140;
      const padding = s.arena.padding;
      // Use levelData bounds if available, otherwise fall back to arena bounds
      if (s.levelData) {
        p.x = clamp(p.x + ux * dist, padding, s.levelData.w - padding);
        p.y = clamp(p.y + uy * dist, padding, s.levelData.h - padding);
      } else {
        p.x = clamp(p.x + ux * dist, padding, s.arena.w - padding);
        p.y = clamp(p.y + uy * dist, padding, s.arena.h - padding);
      }
      p.iFrames = Math.max(p.iFrames, 0.55);

      const tgt = acquireTarget(s, p.x, p.y);
      if (tgt) {
        const dx = tgt.x - p.x;
        const dy = tgt.y - p.y;
        const a0 = Math.atan2(dy, dx);
        for (let i = 0; i < 3; i++) {
          const a = a0 + lerp(-0.08, 0.08, i / 2);
          shootBullet(s, p.x, p.y, a, p.weaponDamage * 0.55, 820, { r: 3.6, pierce: 0, color: "#e6e8ff", crit: false, knock: 0, bounces: 0, effect: null, life: 0.8 });
        }
      }

      addParticle(s, p.x, p.y, 14, 220);
      playBeep({ type: "triangle", f0: 640, f1: 420, dur: 0.07, gain: 0.12, pan: 0 });
      p.abilityT = p.abilityCd * (p.abilityCdMult || 1);
      return;
    }

    if (p.abilityId === "slam") {
      const r = 95 * p.sizeMult;
      // Calculate actual damage from weapons
      const totalWeaponDmg = p.weapons ? p.weapons.reduce((sum, w) => sum + w.weaponDamage, 0) : 0;
      const dmg = totalWeaponDmg * 1.35;
      bumpShake(s, 8, 0.12); // Stronger screen shake
      s.hitStopT = Math.max(s.hitStopT, 0.02);
      addParticle(s, p.x, p.y, 22, 40);
      
      // Shockwave effect for slam (replaces slice)
      for (let i = 0; i < 3; i++) {
        s.floaters.push({
          x: p.x,
          y: p.y,
          t: i * 0.05,
          life: 0.4,
          type: "shockwave",
          r: r * 0.3 + i * r * 0.35,
          color: i === 0 ? "#ff7a3d" : i === 1 ? "#ffaa44" : "#ffd44a",
        });
      }
      
      // Impact particles
      for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 * i) / 12;
        s.floaters.push({
          x: p.x,
          y: p.y,
          t: 0,
          life: 0.35,
          type: "particle",
          vx: Math.cos(angle) * (80 + Math.random() * 40),
          vy: Math.sin(angle) * (80 + Math.random() * 40),
          color: "#ffd44a",
        });
      }

      for (const e of s.enemies) {
        if (e.hp <= 0) continue;
        const d2v = dist2(p.x, p.y, e.x, e.y);
        if (d2v <= (r + e.r) * (r + e.r)) {
          e.hp -= dmg;
          e.hitT = 0.14;
          const dealt = Math.max(1, Math.round(dmg));
          pushCombatText(s, e.x, e.y - 14, String(dealt), "#ffd44a", { size: 14, life: 0.85, crit: true });

          const dx = e.x - p.x;
          const dy = e.y - p.y;
          const dd = Math.hypot(dx, dy) || 1;
          // Increased knockback for slam
          const knockbackDist = 95;
          e.x += (dx / dd) * knockbackDist;
          e.y += (dy / dd) * knockbackDist;
        }
      }

      playBeep({ type: "square", f0: 160, f1: 90, dur: 0.12, gain: 0.18, pan: 0 });
      p.abilityT = p.abilityCd * (p.abilityCdMult || 1);
    }
  }

  function update(s, dt) {
    const p = s.player;
    const { w, h, padding } = s.arena;
    
    // Initialize camera if needed
    if (!s.camera) {
      s.camera = { x: p.x - w / 2, y: p.y - h / 2 };
    }
    
    // Update camera to follow player
    const targetX = p.x - w / 2;
    const targetY = p.y - h / 2;
    s.camera.x = lerp(s.camera.x, targetX, dt * 4);
    s.camera.y = lerp(s.camera.y, targetY, dt * 4);
    
    // Clamp camera to level bounds
    if (s.levelData) {
      s.camera.x = clamp(s.camera.x, 0, Math.max(0, s.levelData.w - w));
      s.camera.y = clamp(s.camera.y, 0, Math.max(0, s.levelData.h - h));
    }

    s.t += dt;

    const intensity = clamp(1 - s.stageLeft / s.stageDur, 0, 1);
    tickMusic(dt, intensity);

    if (s.shakeT > 0) s.shakeT = Math.max(0, s.shakeT - dt);
    // hitStopT is now handled in the render loop to prevent freeze

    if (p.iFrames > 0) p.iFrames = Math.max(0, p.iFrames - dt);
    if (p.buffHasteT > 0) p.buffHasteT = Math.max(0, p.buffHasteT - dt);
    // Update ability cooldown with multiplier
    if (p.abilityT > 0) {
      const cdMult = p.abilityCdMult || 1;
      p.abilityT = Math.max(0, p.abilityT - dt * (1 / cdMult));
    }

    if (s.stageLeft > 0) s.stageLeft = Math.max(0, s.stageLeft - dt);

    // Spawn boss portal after some time or when player is ready
    if (!s.boss.active && !s.bossPortalSpawned) {
      const timeOnFloor = s.t - s.floorStartTime;
      // Spawn boss portal after 30 seconds or when stage time is low
      if (timeOnFloor > 30 || s.stageLeft < 120) {
        if (!s.schedule.didSeven) {
          s.schedule.didSeven = true;
          spawnInteractable(s, INTERACT.BOSS_TP);
          s.bossPortalSpawned = true;
        }
      }
    }
    
    // Increase difficulty over time
    const timeOnFloor = s.t - s.floorStartTime;
    s.difficultyMultiplier = 1.0 + Math.min(2.0, (timeOnFloor / s.maxStageTime) * 2.0);

    if (s.chestSpawnT > 0) s.chestSpawnT = Math.max(0, s.chestSpawnT - dt);
    const chestCount = s.interact.filter((it) => !it.used && it.kind === INTERACT.CHEST).length;
    // Spawn multiple chests across the level (2-4 chests at a time, spread across different rooms)
    const targetChestCount = s.levelData && s.levelData.rooms ? Math.min(4, Math.max(2, Math.floor(s.levelData.rooms.length * 0.4))) : 1;
    if (chestCount < targetChestCount && s.chestSpawnT <= 0 && s.stageLeft > 0) {
      spawnInteractable(s, INTERACT.CHEST);
      s.chestSpawnT = 28 + rand(0, 12); // Faster respawn for multiple chests
    }

    const keys = keysRef.current;
    const mx = (keys.has("ArrowRight") || keys.has("d") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("a") ? 1 : 0);
    const my = (keys.has("ArrowDown") || keys.has("s") ? 1 : 0) - (keys.has("ArrowUp") || keys.has("w") ? 1 : 0);
    const len = Math.hypot(mx, my) || 1;

    const baseV = computeSpeed(p);
    const baseVx = (mx / len) * baseV;
    const baseVy = (my / len) * baseV;

    // Try to move player
    const newX = p.x + baseVx * dt;
    const newY = p.y + baseVy * dt;
    
    // Check if new position is walkable
    if (s.levelData && s.levelData.walkableAreas) {
      // Try X movement first
      if (isPointWalkable(newX, p.y, s.levelData, p.r || 12)) {
        p.x = newX;
      }
      // Then try Y movement
      if (isPointWalkable(p.x, newY, s.levelData, p.r || 12)) {
        p.y = newY;
      }
      // If both failed, try to find nearest walkable position
      if (!isPointWalkable(p.x, p.y, s.levelData, p.r || 12)) {
        const walkable = findNearestWalkable(p.x, p.y, s.levelData, p.r || 12);
        p.x = walkable.x;
        p.y = walkable.y;
      }
    } else {
      // Fallback to simple bounds clamping
      p.x = clamp(newX, padding, (s.levelData ? s.levelData.w : w) - padding);
      p.y = clamp(newY, padding, (s.levelData ? s.levelData.h : h) - padding);
    }

    const haste = p.buffHasteT > 0 ? p.buffHasteMult : 1;
    
    // Update weapon cooldowns
    if (p.weapons) {
      for (const weapon of p.weapons) {
        weapon.attackT = Math.max(0, weapon.attackT - dt * haste);
      }
    }
    
    // Fire weapons that are ready
    fireWeapon(s);

    const diff = p.difficultyTome * s.difficultyMultiplier;
    s.spawn.t -= dt;
    const early = s.t < 18;
    // Enemy numbers increase with floor, not HP/damage
    const floorMultiplier = 1 + (s.floor - 1) * 0.15; // 15% more enemies per floor
    const cap = Math.round((s.spawn.cap + intensity * 10) * diff * floorMultiplier * (early ? 0.8 : 1));
    const delay = Math.max(0.18, (s.spawn.delay * (early ? 1.2 : 1)) / diff); // Faster spawns early
    if (s.spawn.t <= 0 && s.enemies.length < cap && s.stageLeft > 0) {
      const batch = clamp(Math.round((1 + intensity * 2 + Math.max(0, diff - 1) * 0.8) * floorMultiplier), 1, early ? 2 : Math.max(3, Math.floor(3 * floorMultiplier))); // More enemies per floor
      for (let i = 0; i < batch; i++) spawnEnemy(s);
      s.spawn.t = delay * rand(0.85, 1.25);
    }

    // Create bounds object for collision resolution - use level bounds if available
    const levelBounds = s.levelData ? {
      w: s.levelData.w,
      h: s.levelData.h,
      padding: padding
    } : s.arena;
    
    // Enemy-to-enemy collision
    for (let i = 0; i < s.enemies.length; i++) {
      for (let j = i + 1; j < s.enemies.length; j++) {
        resolveDynamicCircleOverlap(s.enemies[i], s.enemies[j], levelBounds);
      }
    }

    for (const e of s.enemies) {
      if (e.hitT > 0) e.hitT = Math.max(0, e.hitT - dt);
      if (e.contactCd > 0) e.contactCd = Math.max(0, e.contactCd - dt);

      if (e.poisonT > 0) {
        e.poisonT = Math.max(0, e.poisonT - dt);
        if (e.poisonDps > 0) {
          const dmg = e.poisonDps * dt;
          e.hp -= dmg;
          e.hitT = Math.max(e.hitT, 0.03);
          // Combat text for poison DoT (every 0.5 seconds)
          if (!e._lastPoisonText || e._lastPoisonText <= 0) {
            pushCombatText(s, e.x, e.y - 14, `-${Math.round(dmg * 10)}`, "#4dff88", { size: 9, life: 0.4 });
            e._lastPoisonText = 0.5;
          } else {
            e._lastPoisonText -= dt;
          }
        }
      }
      if (e.burnT > 0) {
        e.burnT = Math.max(0, e.burnT - dt);
        if (e.burnDps > 0) {
          const dmg = e.burnDps * dt;
          e.hp -= dmg;
          e.hitT = Math.max(e.hitT, 0.03);
          // Combat text for burn DoT (every 0.5 seconds)
          if (!e._lastBurnText || e._lastBurnText <= 0) {
            pushCombatText(s, e.x, e.y - 14, `-${Math.round(dmg * 10)}`, "#ff7a3d", { size: 9, life: 0.4 });
            e._lastBurnText = 0.5;
          } else {
            e._lastBurnText -= dt;
          }
        }
      }
      // Changed freeze to slow effect
      if (e.slowT > 0) {
        e.slowT = Math.max(0, e.slowT - dt);
        continue;
      }

      e.phase += dt * (e.tier === "runner" ? 8 : 3);

      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d;
      const uy = dy / d;

      if (e.tier === "spitter") {
        e.spitT = Math.max(0, e.spitT - dt);
        const desired = 240;
        const push = d < desired ? -1 : 1;
        const slowMult = e.slowT > 0 ? (e.slowMult || 0.5) : 1.0;
        const newEx = e.x + ux * e.speed * dt * 0.62 * push * slowMult;
        const newEy = e.y + uy * e.speed * dt * 0.62 * push * slowMult;
        
        // Check if new position is walkable
        if (s.levelData && s.levelData.walkableAreas) {
          if (isPointWalkable(newEx, e.y, s.levelData, e.r || 8)) {
            e.x = newEx;
          }
          if (isPointWalkable(e.x, newEy, s.levelData, e.r || 8)) {
            e.y = newEy;
          }
        } else {
          e.x = newEx;
          e.y = newEy;
        }

        if (d < 460 && e.spitT <= 0) {
          const a = Math.atan2(dy, dx);
          shootBullet(s, e.x, e.y, a, 14 + s.floor * 0.95, 470, { enemy: true, r: 7.2, life: 2.2, color: "#ff5d5d" });
          e.spitT = 1.05;
        }
      } else {
        const slowMult = e.slowT > 0 ? (e.slowMult || 0.5) : 1.0;
        const newEx = e.x + ux * e.speed * dt * slowMult;
        const newEy = e.y + uy * e.speed * dt * slowMult;
        
        // Check if new position is walkable
        if (s.levelData && s.levelData.walkableAreas) {
          if (isPointWalkable(newEx, e.y, s.levelData, e.r || 8)) {
            e.x = newEx;
          }
          if (isPointWalkable(e.x, newEy, s.levelData, e.r || 8)) {
            e.y = newEy;
          }
        } else {
          e.x = newEx;
          e.y = newEy;
        }
      }

      // Clamp enemies to level bounds
      if (s.levelData) {
        e.x = clamp(e.x, padding, s.levelData.w - padding);
        e.y = clamp(e.y, padding, s.levelData.h - padding);
      } else {
        e.x = clamp(e.x, padding, w - padding);
        e.y = clamp(e.y, padding, h - padding);
      }

      const overlapped = resolveKinematicCircleOverlap(p, e, levelBounds);
      if (overlapped && e.contactCd <= 0) {
        const xNorm = clamp((p.x / (s.arena.w || 1)) * 2 - 1, -1, 1);
        const did = applyPlayerDamage(s, 18 + s.floor * 0.9, `${e.tier} contact`, { shakeMag: 1.6, shakeTime: 0.06, hitStop: 0, fromX: e.x, fromY: e.y });
        if (did) sfxHit(xNorm);
        e.contactCd = 0.95;
        const dd = Math.hypot(e.x - p.x, e.y - p.y) || 1;
        e.x += ((e.x - p.x) / dd) * 22;
        e.y += ((e.y - p.y) / dd) * 22;
      }
    }

    // Get level bounds for bullet checks
    const levelW = s.levelData ? s.levelData.w : w;
    const levelH = s.levelData ? s.levelData.h : h;

    for (const b of s.bullets) {
      b.t += dt;
      b.px = b.x;
      b.py = b.y;
      
      // Update rotation for bone bullets
      if (b.isBone) {
        b.rotation += dt * 8; // Rotate 8 radians per second (fast spinning)
      }
      
      // Boomerang return logic
      if (b.boomerang && !b.enemy) {
        const distFromStart = Math.hypot(b.x - b.startX, b.y - b.startY);
        const distFromPlayer = Math.hypot(b.x - p.x, b.y - p.y);
        
        // If traveled max distance or hit player, return
        if (distFromStart > b.maxDist || distFromPlayer < 20) {
          // Return to player
          const dx = p.x - b.x;
          const dy = p.y - b.y;
          const dist = Math.hypot(dx, dy) || 1;
          const speed = Math.hypot(b.vx, b.vy);
          b.vx = (dx / dist) * speed * 1.2; // Faster return
          b.vy = (dy / dist) * speed * 1.2;
          
          // If close enough to player, destroy bullet and mark weapon as ready
          if (distFromPlayer < 15) {
            b.t = b.life + 1;
            // Mark bananarang weapon as ready for next attack
            if (b.weaponId === "bananarang") {
              const weapon = p.weapons?.find(w => w.id === "bananarang");
              if (weapon) {
                weapon.hasActiveBoomerang = false;
              }
            }
            continue;
          }
        }
      }
      
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Wall bounce (only if no enemy bounce happened)
      if (!b.enemy && b.bounces > 0 && !b.boomerang) {
        let bounced = false;
        if (b.x < padding) {
          b.x = padding;
          b.vx = Math.abs(b.vx);
          bounced = true;
        } else if (b.x > levelW - padding) {
          b.x = levelW - padding;
          b.vx = -Math.abs(b.vx);
          bounced = true;
        }
        if (b.y < padding) {
          b.y = padding;
          b.vy = Math.abs(b.vy);
          bounced = true;
        } else if (b.y > levelH - padding) {
          b.y = levelH - padding;
          b.vy = -Math.abs(b.vy);
          bounced = true;
        }
        if (bounced) b.bounces -= 1;
      }

      // Apply splash damage when bullet expires or goes out of bounds (for splash weapons - player bullets only)
      if (!b.enemy && b.splashR > 0 && (b.t >= b.life || b.x < padding - 60 || b.x > levelW - padding + 60 || b.y < padding - 60 || b.y > levelH - padding + 60)) {
        const r2 = b.splashR * b.splashR;
        let hitAny = false;
        for (const ee of s.enemies) {
          if (ee.hp <= 0) continue;
          if (dist2(ee.x, ee.y, b.x, b.y) <= r2) {
            ee.hp -= b.dmg * 0.65;
            ee.hitT = 0.12;
            hitAny = true;
            const dealt = Math.max(1, Math.round(b.dmg * 0.65));
            pushCombatText(s, ee.x, ee.y - 14, String(dealt), "#ff7a3d", { size: 12, life: 0.75 });
            
            // Apply poison to all enemies hit by splash (for poison flask)
            if (b.effect === "poison") {
              const poisonDuration = 3.5;
              const poisonDpsMult = 0.4;
              ee.poisonT = Math.max(ee.poisonT || 0, poisonDuration);
              ee.poisonDps = Math.max(ee.poisonDps || 0, Math.max(3, b.dmg * poisonDpsMult));
            }
          }
        }
        if (s.boss.active) {
          const bossD2 = dist2(s.boss.x, s.boss.y, b.x, b.y);
          if (bossD2 <= r2) {
            s.boss.hp -= b.dmg * 0.65;
            hitAny = true;
            const dealt = Math.max(1, Math.round(b.dmg * 0.65));
            pushCombatText(s, s.boss.x, s.boss.y - s.boss.r - 10, String(dealt), "#ff7a3d", { size: 12, life: 0.75 });
            
            // Apply poison to boss hit by splash (for poison flask)
            if (b.effect === "poison") {
              // Boss poison handling would go here if needed
            }
          }
        }
        if (hitAny) {
          addParticle(s, b.x, b.y, 10, 30);
        }
      }

      // Don't destroy boomerang bullets at boundaries - they return to player
      if (!b.boomerang && (b.x < padding - 60 || b.x > levelW - padding + 60 || b.y < padding - 60 || b.y > levelH - padding + 60)) {
        b.t = b.life + 1;
      }

      if (b.enemy) {
        const rr = (p.r + b.r) * (p.r + b.r);
        if (p.hp > 0 && dist2(p.x, p.y, b.x, b.y) < rr) {
          const xNorm = clamp((p.x / (s.arena.w || 1)) * 2 - 1, -1, 1);
          const did = applyPlayerDamage(s, b.dmg, "projectile", { shakeMag: 4.8, shakeTime: 0.08, hitStop: 0, fromX: b.x, fromY: b.y }); // No hitStop for boss bullets to prevent freeze
          if (did) {
            sfxHit(xNorm);
            addHitFlash(s, p.x, p.y, "#ff5d5d");
          }
          b.t = b.life + 1;
        }
        continue;
      }

      let hitSomething = false;

      for (const e of s.enemies) {
        if (e.hp <= 0) continue;
        // Skip already hit enemies for boomerang and bounce weapons (unless piercing)
        if (b.hitEnemies && b.hitEnemies.has(e) && !b.boomerang && b.pierce === 0) continue;
        
        const rr = (e.r + b.r) * (e.r + b.r);
        if (dist2(e.x, e.y, b.x, b.y) < rr) {
          hitSomething = true;
          
          // Check for Big Bonk proc BEFORE applying damage
          let finalDmg = b.dmg;
          let isBigBonk = false;
          if (p.bigBonkChance > 0 && Math.random() < p.bigBonkChance) {
            finalDmg = b.dmg * (p.bigBonkMult || 1);
            isBigBonk = true;
          }
          
          e.hp -= finalDmg;
          e.hitT = 0.12;
          
          // Add hit flash
          addHitFlash(s, e.x, e.y, (isBigBonk || b.crit) ? "#ffd44a" : "#ffffff");

        const dealt = Math.max(1, Math.round(finalDmg));
          const hitXNorm = clamp((e.x / (s.arena.w || 1)) * 2 - 1, -1, 1);
          if (isBigBonk) {
            // Big Bonk visual feedback
            pushCombatText(s, e.x, e.y - 14, `BIG BONK! ${dealt}`, "#ff0000", { size: 18, life: 1.2, crit: true });
            addExplosion(s, e.x, e.y, 1.5, 0); // Red explosion
            bumpShake(s, 6, 0.1);
            sfxCrit(hitXNorm);
          } else if (b.crit) {
            pushCombatText(s, e.x, e.y - 14, String(dealt), "#ffd44a", { size: 14, life: 0.85, crit: true });
            addExplosion(s, e.x, e.y, 0.6, 50);
            sfxCrit(hitXNorm);
          } else {
            pushCombatText(s, e.x, e.y - 14, String(dealt), "#ffffff", { size: 12, life: 0.75 });
            addParticle(s, e.x, e.y, 4, null, { size: 2, speed: 0.8 });
            sfxHit(hitXNorm, Math.floor(Math.random() * 3));
          }

          // Poison effect always applies if bullet has poison effect, or chance-based
          const procPoison = b.effect === "poison" || (p.poisonChance > 0 && Math.random() < p.poisonChance);
          // Changed freeze to slow effect (less OP)
          let procSlow = false;
          if (b.effect === "freeze") {
            procSlow = true;
          } else if (p.iceCrystalFreezeChance && Math.random() < p.iceCrystalFreezeChance) {
            procSlow = true;
          } else if (p.freezeChance > 0 && Math.random() < p.freezeChance) {
            procSlow = true;
          }
          const procBurn = b.effect === "burn";

          if (procPoison) {
            // Poison DoT: longer duration and higher DPS for poison flask
            const poisonDuration = b.effect === "poison" ? 3.5 : 2.4;
            const poisonDpsMult = b.effect === "poison" ? 0.4 : 0.32;
            e.poisonT = Math.max(e.poisonT || 0, poisonDuration);
            e.poisonDps = Math.max(e.poisonDps || 0, Math.max(3, b.dmg * poisonDpsMult));
          }
          
          if (procSlow) {
            const slowDuration = p.iceCrystalFreezeChance ? (p.iceCrystalFreezeDuration || 1.2) : 1.05;
            const slowAmount = 0.5; // 50% speed reduction
            e.slowT = Math.max(e.slowT || 0, slowDuration);
            e.slowMult = slowAmount; // Store slow multiplier
            
            // Ice Crystal AoE slow - slow nearby enemies
            if (p.iceCrystalFreezeRadius && p.iceCrystalFreezeChance && Math.random() < p.iceCrystalFreezeChance) {
              const slowR2 = p.iceCrystalFreezeRadius * p.iceCrystalFreezeRadius;
              for (const ee of s.enemies) {
                if (ee.hp <= 0 || ee === e) continue;
                if (dist2(ee.x, ee.y, e.x, e.y) <= slowR2) {
                  ee.slowT = Math.max(ee.slowT || 0, slowDuration);
                  ee.slowMult = slowAmount;
                }
              }
            }
          }
          if (procBurn) {
            e.burnT = Math.max(e.burnT || 0, 2.0);
            e.burnDps = Math.max(e.burnDps || 0, Math.max(3, b.dmg * 0.22));
          }

          // For thrown weapons (poison flask), trigger splash on hit
          if (b.splashR > 0 && b.effect === "poison") {
            const r2 = b.splashR * b.splashR;
            for (const ee of s.enemies) {
              if (ee.hp <= 0) continue;
              if (ee === e) continue; // Already hit the main target
              if (dist2(ee.x, ee.y, b.x, b.y) <= r2) {
                ee.hp -= b.dmg * 0.65;
                ee.hitT = 0.12;
                const dealt = Math.max(1, Math.round(b.dmg * 0.65));
                pushCombatText(s, ee.x, ee.y - 14, String(dealt), "#4dff88", { size: 12, life: 0.75 });
                
                // Apply poison to all enemies hit by splash
                const poisonDuration = 3.5;
                const poisonDpsMult = 0.4;
                ee.poisonT = Math.max(ee.poisonT || 0, poisonDuration);
                ee.poisonDps = Math.max(ee.poisonDps || 0, Math.max(3, b.dmg * poisonDpsMult));
              }
            }
            if (s.boss.active) {
              const bossD2 = dist2(s.boss.x, s.boss.y, b.x, b.y);
              if (bossD2 <= r2) {
                s.boss.hp -= b.dmg * 0.65;
                const dealt = Math.max(1, Math.round(b.dmg * 0.65));
                pushCombatText(s, s.boss.x, s.boss.y - s.boss.r - 10, String(dealt), "#4dff88", { size: 12, life: 0.75 });
              }
            }
            // Green poison splash effect
            addParticle(s, b.x, b.y, 15, 120, { size: 4, speed: 1.0 });
            // Remove bullet after splash
            b.t = b.life + 1;
          } else if (b.splashR > 0) {
            // Regular splash (non-poison) - only on expiration
            const r2 = b.splashR * b.splashR;
            for (const ee of s.enemies) {
              if (ee.hp <= 0) continue;
              if (ee === e) continue;
              if (dist2(ee.x, ee.y, b.x, b.y) <= r2) {
                ee.hp -= b.dmg * 0.65;
                ee.hitT = 0.12;
                const dealt = Math.max(1, Math.round(b.dmg * 0.65));
                pushCombatText(s, ee.x, ee.y - 14, String(dealt), "#ff7a3d", { size: 12, life: 0.75 });
              }
            }
            if (s.boss.active) {
              const bossD2 = dist2(s.boss.x, s.boss.y, b.x, b.y);
              if (bossD2 <= r2) {
                s.boss.hp -= b.dmg * 0.65;
                const dealt = Math.max(1, Math.round(b.dmg * 0.65));
                pushCombatText(s, s.boss.x, s.boss.y - s.boss.r - 10, String(dealt), "#ff7a3d", { size: 12, life: 0.75 });
              }
            }
            addParticle(s, b.x, b.y, 10, 30);
          }

          // Apply knockback from player's knockback stat
          if (p.knockback > 0) {
            const dx = e.x - b.x;
            const dy = e.y - b.y;
            const dd = Math.hypot(dx, dy) || 1;
            e.x += (dx / dd) * p.knockback * 0.03;
            e.y += (dy / dd) * p.knockback * 0.03;
          }
          
          // Sound already played above for crit/normal hits

          // Track hit enemies for boomerang and bounce (to prevent re-hitting)
          if (!b.hitEnemies) {
            b.hitEnemies = new Set();
          }
          b.hitEnemies.add(e);
          
          // Handle pierce (boomerang pierces all, regular pierce has count)
          if (b.boomerang || b.pierce > 0) {
            if (b.pierce > 0 && !b.boomerang) {
              b.pierce -= 1;
            }
            // Continue to next enemy (don't break) - boomerang always pierces
          } else if (b.bounces > 0) {
            // Always bounce - find nearest enemy that hasn't been hit
            let nearestEnemy = null;
            let nearestD2 = Infinity;
            for (const ee of s.enemies) {
              if (ee.hp <= 0 || ee === e || b.hitEnemies.has(ee)) continue; // Skip dead, current, and already hit enemies
              const d2 = dist2(ee.x, ee.y, b.x, b.y);
              if (d2 < nearestD2) {
                nearestD2 = d2;
                nearestEnemy = ee;
              }
            }
            // Also check boss
            if (s.boss.active && s.boss.hp > 0 && !b.hitEnemies.has(s.boss)) {
              const bossD2 = dist2(s.boss.x, s.boss.y, b.x, b.y);
              if (bossD2 < nearestD2) {
                nearestEnemy = s.boss;
              }
            }
            
            if (nearestEnemy) {
              // Bounce to nearest enemy - redirect bullet immediately
              const dx = nearestEnemy.x - b.x;
              const dy = nearestEnemy.y - b.y;
              const dist = Math.hypot(dx, dy) || 1;
              const speed = Math.hypot(b.vx, b.vy);
              b.vx = (dx / dist) * speed;
              b.vy = (dy / dist) * speed;
              b.bounces -= 1;
              // Move bullet slightly toward target to ensure it hits
              b.x += (dx / dist) * 5;
              b.y += (dy / dist) * 5;
              // Continue to hit the bounced target (don't break)
              // The bullet will hit nearestEnemy in this same frame
            } else {
              // No more targets, destroy bullet
              b.t = b.life + 1;
              break;
            }
            // Continue loop to hit bounced target immediately
          } else {
            // No pierce, no bounces - destroy bullet
            b.t = b.life + 1;
            break;
          }
        }
      }

      if (!hitSomething && s.boss.active && b.t <= b.life) {
        const rr = (s.boss.r + b.r) * (s.boss.r + b.r);
        if (dist2(s.boss.x, s.boss.y, b.x, b.y) < rr) {
          s.boss.hp -= b.dmg;
          b.t = b.life + 1;

          const dealt = Math.max(1, Math.round(b.dmg));
          if (b.crit) pushCombatText(s, s.boss.x, s.boss.y - s.boss.r - 10, String(dealt), "#ffd44a", { size: 14, life: 0.85, crit: true });
          else pushCombatText(s, s.boss.x, s.boss.y - s.boss.r - 10, String(dealt), "#ffffff", { size: 12, life: 0.75 });

          const xNorm = clamp((b.x / (s.arena.w || 1)) * 2 - 1, -1, 1);
          sfxHit(xNorm);
        }
      }
    }

    s.bullets = s.bullets.filter((b) => b.t <= b.life);

    s.enemies = s.enemies.filter((e) => {
      if (e.hp > 0) return true;

      const x = e.x;
      const y = e.y;

      s.score += Math.round(20 + s.floor * 4);

      // XP and Gold drop at enemy death location (no velocity, stay in place)
      // Add small random offset to prevent overlapping
      const gemOffset = 12;
      const gemX = e.x + rand(-gemOffset, gemOffset);
      const gemY = e.y + rand(-gemOffset, gemOffset);
      s.gems.push({ x: gemX, y: gemY, r: 8, v: e.xp, vx: 0, vy: 0, t: 0, life: 18 });

      if (Math.random() < 0.7) {
        // Store base coin value and goldGain at creation time
        // Gold gain will be applied when picked up
        // Add offset to prevent overlapping with gems
        const coinOffset = 12;
        const coinX = e.x + rand(-coinOffset, coinOffset);
        const coinY = e.y + rand(-coinOffset, coinOffset);
        s.coins.push({ 
          x: coinX, 
          y: coinY, 
          r: 8, 
          v: e.coin, // Base coin value (will be multiplied by current goldGain when picked up)
          vx: 0, 
          vy: 0, 
          t: 0, 
          life: 18 
        });
      }

      // Spawn temporary shrines (speed, heal, magnet)
      if (Math.random() < 0.016) {
        const shrineType = pickWeighted([
          { w: 1, t: INTERACT.SHRINE }, // Speed shrine
          { w: 1, t: INTERACT.MICROWAVE }, // Heal shrine
          { w: 1, t: INTERACT.MAGNET_SHRINE }, // Magnet shrine
        ]).t;
        spawnInteractable(s, shrineType);
      }
      if (Math.random() < 0.012) spawnInteractable(s, INTERACT.MICROWAVE);
      if (Math.random() < 0.01) spawnInteractable(s, INTERACT.GREED);

      // Enhanced death effects
      const deathHue = e.tier === "brute" ? 0 : e.tier === "runner" ? 48 : e.tier === "spitter" ? 140 : 210;
      addExplosion(s, x, y, 1.2, deathHue);
      addParticle(s, x, y, 20, deathHue, { size: 2.5, speed: 1.2, glow: true });
      const xNorm = clamp((x / (s.arena.w || 1)) * 2 - 1, -1, 1);
      sfxKill(xNorm);

      return false;
    });

    const pickRadius = 100 * p.magnet;

    for (const g of s.gems) {
      g.t += dt;
      // No gravity or movement - XP stays where it drops
      // (removed all velocity/physics code)

      // Clamp to level bounds (but no bouncing since there's no velocity)
      if (s.levelData) {
        g.x = clamp(g.x, padding, s.levelData.w - padding);
        g.y = clamp(g.y, padding, s.levelData.h - padding);
      } else {
        g.x = clamp(g.x, padding, w - padding);
        g.y = clamp(g.y, padding, h - padding);
      }

      const dd = Math.hypot(p.x - g.x, p.y - g.y);
      if (dd < pickRadius) {
        const ux = (p.x - g.x) / (dd || 1);
        const uy = (p.y - g.y) / (dd || 1);
        g.x += ux * (560 * dt) * (1 - dd / pickRadius);
        g.y += uy * (560 * dt) * (1 - dd / pickRadius);
      }

      const rr = (p.r + g.r) * (p.r + g.r);
      if (dist2(p.x, p.y, g.x, g.y) < rr) {
        const leveled = awardXP(s, g.v, g.x, g.y);
        g.t = g.life + 1;
        if (leveled) {
          s.gems = s.gems.filter((gg) => gg.t <= gg.life);
          return;
        }
      }
    }
    s.gems = s.gems.filter((g) => g.t <= g.life);

    for (const c of s.coins) {
      c.t += dt;
      // No gravity or movement - coins stay where they drop
      // (removed all velocity/physics code)

      // Clamp coins to level bounds
      if (s.levelData) {
        c.x = clamp(c.x, padding, s.levelData.w - padding);
        c.y = clamp(c.y, padding, s.levelData.h - padding);
      } else {
        c.x = clamp(c.x, padding, w - padding);
        c.y = clamp(c.y, padding, h - padding);
      }

      const dd = Math.hypot(p.x - c.x, p.y - c.y);
      if (dd < pickRadius) {
        const ux = (p.x - c.x) / (dd || 1);
        const uy = (p.y - c.y) / (dd || 1);
        c.x += ux * (520 * dt) * (1 - dd / pickRadius);
        c.y += uy * (520 * dt) * (1 - dd / pickRadius);
      }

      const rr = (p.r + c.r) * (p.r + c.r);
      if (dist2(p.x, p.y, c.x, c.y) < rr) {
        // Apply current goldGain when picked up (not when created)
        // c.v is the base coin value, multiply by current goldGain
        const actualGold = Math.round(c.v * p.goldGain);
        p.coins += actualGold;
        s.score += actualGold * 3;
        pushCombatText(s, c.x, c.y - 14, `+${actualGold}`, "#ffd44a", { size: 11, life: 0.7 });
        c.t = c.life + 1;
        const xNorm = clamp((c.x / (s.arena.w || 1)) * 2 - 1, -1, 1);
        sfxCoin(xNorm);
      }
    }
    s.coins = s.coins.filter((c) => c.t <= c.life);

    if (p.regen > 0 && p.hp > 0 && p.hp < p.maxHp) {
      p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
    }

    if (Math.floor(s.stageLeft) % 60 === 0 && s._shieldTick !== Math.floor(s.stageLeft)) {
      s._shieldTick = Math.floor(s.stageLeft);
      p.shield = p.shieldPerWave;
    }

    if (s.boss.active) {
      s.boss.timeLeft = Math.max(0, s.boss.timeLeft - dt);

      const dx = p.x - s.boss.x;
      const dy = p.y - s.boss.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d;
      const uy = dy / d;

      const enr = s.boss.hp / s.boss.maxHp < 0.35;
      s.boss.enraged = enr;
      const bossSpeed = (120 + s.floor * 5) * (enr ? 1.2 : 1);

      s.boss.x += ux * bossSpeed * dt;
      s.boss.y += uy * bossSpeed * dt;
      // Clamp boss to level bounds
      if (s.levelData) {
        s.boss.x = clamp(s.boss.x, padding, s.levelData.w - padding);
        s.boss.y = clamp(s.boss.y, padding, s.levelData.h - padding);
      } else {
        s.boss.x = clamp(s.boss.x, padding, w - padding);
        s.boss.y = clamp(s.boss.y, padding, h - padding);
      }

      s.boss.spitT = Math.max(0, s.boss.spitT - dt);
      if (s.boss.spitT <= 0) {
        const a = Math.atan2(dy, dx);
        const shots = enr ? 3 : 2;
        for (let i = 0; i < shots; i++) {
          const aa = a + lerp(-0.22, 0.22, shots === 1 ? 0.5 : i / (shots - 1));
          shootBullet(s, s.boss.x, s.boss.y, aa, 18 + s.floor * 1.2, 520, { enemy: true, r: 8.2, life: 2.2, color: "#ff5d5d" });
        }
        s.boss.spitT = enr ? 0.55 : 0.85;
      }

      const bossBounds = s.levelData ? {
        w: s.levelData.w,
        h: s.levelData.h,
        padding: padding
      } : s.arena;
      const overlapped = resolveKinematicCircleOverlap(p, s.boss, bossBounds);
      if (overlapped) {
        const xNorm = clamp((p.x / (s.arena.w || 1)) * 2 - 1, -1, 1);
        const did = applyPlayerDamage(s, 30 + s.floor * 1.1, "boss contact", { shakeMag: 2.2, shakeTime: 0.07, hitStop: 0.01, fromX: s.boss.x, fromY: s.boss.y });
        if (did) sfxHit(xNorm);
      }

      if (s.boss.hp <= 0) {
        s.boss.active = false;
        s.score += Math.round(1200 + s.floor * 180);
        p.coins += Math.round(18 + s.floor * 3);
        bumpShake(s, 7, 0.1);
        s.hitStopT = Math.max(s.hitStopT, 0.05);
        addExplosion(s, s.boss.x, s.boss.y, 2.0, 300);
        
        // Advance to next floor - clear everything and generate new floor
        s.floor += 1;
        s.stageLeft = s.stageDur;
        s.bgHue = (s.bgHue + 18) % 360;
        s.schedule.didSeven = false;
        s.schedule.didThree = false;
        s.bossPortalSpawned = false;
        s.difficultyMultiplier = 1.0;
        s.floorStartTime = s.t;
        
        // Clear all enemies, bullets, gems, coins, interactables, particles, etc.
        s.enemies = [];
        s.bullets = [];
        s.gems = [];
        s.coins = [];
        s.interact = [];
        s.particles = [];
        s.floaters = [];
        s.hitFlashes = [];
        s.burningAreas = [];
        s.auras = [];
        
        // Generate new procedural level
        s.levelData = generateProceduralLevel(s.arena.w, s.arena.h, s.floor);
        
        // Move player to first room of new floor
        const padding = s.arena.padding;
        if (s.levelData.rooms.length > 0) {
          const startRoom = s.levelData.rooms[0];
          p.x = clamp(startRoom.x + startRoom.w / 2, startRoom.x + padding, startRoom.x + startRoom.w - padding);
          p.y = clamp(startRoom.y + startRoom.h / 2, startRoom.y + padding, startRoom.y + startRoom.h - padding);
          
          // Ensure player is in walkable area
          if (s.levelData.walkableAreas && !isPointWalkable(p.x, p.y, s.levelData, p.r || 12)) {
            const walkable = findNearestWalkable(p.x, p.y, s.levelData, p.r || 12);
            p.x = walkable.x;
            p.y = walkable.y;
          }
          
          // Reset camera to player position
          s.camera.x = clamp(p.x - s.arena.w / 2, 0, Math.max(0, s.levelData.w - s.arena.w));
          s.camera.y = clamp(p.y - s.arena.h / 2, 0, Math.max(0, s.levelData.h - s.arena.h));
        }
        
        // Spawn new chest on new floor
        spawnInteractable(s, INTERACT.CHEST);
        p.shield = p.shieldPerWave;
        s.uiPulseT = 0.25;
        s.chestSpawnT = 18;
      }

      if (s.boss.timeLeft <= 0) {
        applyPlayerDamage(s, 9999, "boss timer", { shakeMag: 0, shakeTime: 0, hitStop: 0 });
      }
    }

    // Floor transition happens when boss is defeated, not on timer
    // (Boss must be defeated to progress)

    for (const q of s.particles) {
      q.t += dt;
      if (q.gravity !== false) {
        q.vy += 650 * dt;
      }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vx *= 0.98; // Slight friction
    }
    s.particles = s.particles.filter((q) => q.t <= q.life);
    
    // Update hit flashes
    if (s.hitFlashes) {
      for (const flash of s.hitFlashes) {
        flash.t += dt;
      }
      s.hitFlashes = s.hitFlashes.filter((f) => f.t <= f.life);
    }

    for (const f of s.floaters) {
      f.t += dt;
      if (f.type !== "slice" && f.type !== "shockwave" && f.type !== "particle") {
        f.y -= 26 * dt;
      }
    }
    s.floaters = s.floaters.filter((f) => f.t <= f.life);
    
    // Update burning areas (ground fire from flamewalker)
    if (!s.burningAreas) s.burningAreas = [];
    for (const area of s.burningAreas) {
      area.t += dt;
      if (area.lastTick === undefined) area.lastTick = 0;
      area.lastTick += dt;
      
        // Damage enemies in area and apply burn for duration
        if (area.lastTick >= area.tickRate) {
          area.lastTick = 0;
          const r2 = area.r * area.r;
          for (const e of s.enemies) {
            if (e.hp <= 0) continue;
            if (dist2(e.x, e.y, area.x, area.y) <= r2) {
              const dmg = area.dmg;
              e.hp -= dmg;
              e.hitT = 0.08;
              // Combat text for flamewalker DoT
              pushCombatText(s, e.x, e.y - 14, `-${Math.round(dmg)}`, "#ff7a3d", { size: 10, life: 0.5 });
              // Apply burn for the full duration while in flames
              e.burnT = Math.max(e.burnT || 0, area.life - area.t + 0.5); // Burn for remaining fire duration + buffer
              e.burnDps = Math.max(e.burnDps || 0, Math.max(2, area.dmg * 0.35));
            }
          }
        if (s.boss.active && s.boss.hp > 0) {
          const bossD2 = dist2(s.boss.x, s.boss.y, area.x, area.y);
          if (bossD2 <= r2) {
            s.boss.hp -= area.dmg * 0.5;
          }
        }
      }
    }
    s.burningAreas = s.burningAreas.filter((a) => a.t < a.life);
    
    // Update auras (player AoE effects)
    if (!s.auras) s.auras = [];
    for (const aura of s.auras) {
      aura.t += dt;
      if (aura.lastTick === undefined) aura.lastTick = 0;
      aura.lastTick += dt;
      
      // Damage enemies in aura radius around player
      if (aura.lastTick >= aura.tickRate) {
        aura.lastTick = 0;
        const r2 = aura.r * aura.r;
        for (const e of s.enemies) {
          if (e.hp <= 0) continue;
          if (dist2(e.x, e.y, p.x, p.y) <= r2) {
            e.hp -= aura.dmg;
            e.hitT = 0.08;
            if (aura.effect === "burn") {
              e.burnT = Math.max(e.burnT || 0, 1.5);
              e.burnDps = Math.max(e.burnDps || 0, Math.max(2, aura.dmg * 0.3));
            }
          }
        }
        if (s.boss.active && s.boss.hp > 0) {
          const bossD2 = dist2(s.boss.x, s.boss.y, p.x, p.y);
          if (bossD2 <= r2) {
            s.boss.hp -= aura.dmg * 0.5;
          }
        }
      }
    }
    s.auras = s.auras.filter((a) => a.t < a.life);

    if (s.uiPulseT > 0) s.uiPulseT = Math.max(0, s.uiPulseT - dt);

    if (p.hp <= 0) {
      p.hp = 0;
      s.running = false;
    }
  }

  function drawWorld(s, ctx) {
    const { w, h, padding } = s.arena;
    const p = s.player;

    ctx.clearRect(0, 0, w, h);

    const hue = s.bgHue;
    ctx.globalAlpha = 1;
    
    // Apply camera transform
    const cam = s.camera || { x: 0, y: 0 };
    ctx.save();
    ctx.translate(-cam.x, -cam.y);

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
    
    // Draw simple square map background
    ctx.fillStyle = `hsl(${bgHue}, ${bgSat}%, ${bgLight}%)`;
    if (s.levelData) {
      // Fill entire level area
      ctx.fillRect(0, 0, s.levelData.w, s.levelData.h);
      
      // Draw walkable area (simple square)
      if (s.levelData.rooms && s.levelData.rooms.length > 0) {
        const room = s.levelData.rooms[0];
        ctx.fillStyle = `hsl(${roomHue}, ${roomSat}%, ${roomLight}%)`;
        ctx.fillRect(room.x, room.y, room.w, room.h);
        
        // Draw border around walkable area
        ctx.strokeStyle = `hsl(${bgHue}, ${bgSat}%, ${bgLight - 5}%)`;
        ctx.lineWidth = 4;
        ctx.strokeRect(room.x, room.y, room.w, room.h);
      }
      
      // Draw outer boundary
      ctx.strokeStyle = `hsl(${roomHue}, ${roomSat + 10}%, ${roomLight + 8}%)`;
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, s.levelData.w, s.levelData.h);
    } else {
      // Fallback if no level data
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = `hsl(${hue}, 45%, 18%)`;
      ctx.lineWidth = 2;
      ctx.strokeRect(padding, padding, w - padding * 2, h - padding * 2);
    }

    let ox = 0;
    let oy = 0;
    if (s.shakeT > 0 && s.shakeDur > 0) {
      const t = s.shakeT / s.shakeDur;
      const mag = s.shakeMag * t;
      ox = Math.sin(s.t * 53) * mag;
      oy = Math.cos(s.t * 61) * mag;
    }

    const sc = s.worldScale ?? 1;
    ctx.save();
    ctx.translate(w * 0.5 + ox, h * 0.5 + oy);
    ctx.scale(sc, sc);
    ctx.translate(-w * 0.5, -h * 0.5);

    for (const it of s.interact) {
      if (it.used) continue;
      ctx.save();
      ctx.translate(it.x, it.y);
      
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
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      const labelW = 70;
      ctx.fillRect(-labelW/2, -8, labelW, 16);
      ctx.fillStyle = "#e6e8ff";
      ctx.font = "10px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      let label = "";
      if (it.kind === INTERACT.CHEST) label = "Chest";
      else if (it.kind === INTERACT.SHRINE) label = "Speed";
      else if (it.kind === INTERACT.MAGNET_SHRINE) label = "Magnet";
      else if (it.kind === INTERACT.MICROWAVE) label = "Heal";
      else if (it.kind === INTERACT.GREED) label = "Greed";
      else if (it.kind === INTERACT.BOSS_TP) label = "Boss";
      
      ctx.fillText(label, 0, 0);
      ctx.restore();
      
      ctx.restore();
    }

    for (const g of s.gems) {
      const a = clamp(1 - g.t / 0.35, 0, 1);
      ctx.globalAlpha = 0.75 + a * 0.25;
      ctx.fillStyle = "#4dff88";
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const c of s.coins) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#ffd44a";
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    for (const b of s.bullets) {
      // Draw bullet trail
      if (b.px !== undefined && b.py !== undefined) {
        const dx = b.x - b.px;
        const dy = b.y - b.py;
        const dist = Math.hypot(dx, dy);
        if (dist > 0) {
          ctx.save();
          ctx.globalAlpha = 0.4;
          ctx.strokeStyle = b.color;
          ctx.lineWidth = b.r * 1.5;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(b.px, b.py);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          ctx.restore();
        }
      }
      
      // Draw bullet with glow
      ctx.save();
      
      // Firey effect for burn weapons
      // Check boomerang first (before other effects)
      if (b.boomerang) {
        // Special drawing for boomerang (bananarang) - highly visible
        ctx.save();
        // Outer glow - very visible
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#ffd700";
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = "#ffd700";
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Main body - bright yellow
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = "#ffd700";
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner highlight
        ctx.fillStyle = "#ffed4e";
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 0.6, 0, Math.PI * 2);
        ctx.fill();
        
        // Center dot
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
      } else if (b.isBone) {
        // Special drawing for bone - draw as rotating rectangle
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rotation || 0);
        ctx.fillStyle = b.color || "#ffffff";
        // Draw bone as a rectangle (longer than wide)
        ctx.fillRect(-b.r * 1.5, -b.r * 0.6, b.r * 3, b.r * 1.2);
        // Add slight highlight
        ctx.fillStyle = "#f0f0f0";
        ctx.fillRect(-b.r * 1.5, -b.r * 0.6, b.r * 3, b.r * 0.4);
        ctx.restore();
      } else if (b.effect === "burn" || b.glow) {
        // Outer glow
        ctx.shadowBlur = 12;
        ctx.shadowColor = b.color;
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 1.4, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner bright core
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#ffaa44";
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 0.7, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.crit) {
        ctx.shadowBlur = 6;
        ctx.shadowColor = "#ffd44a";
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      const slowed = e.slowT > 0;
      let col = slowed ? "#7bf1ff" : e.tier === "brute" ? "#ff7a3d" : e.tier === "spitter" ? "#ff5d5d" : e.tier === "runner" ? "#c23bff" : "#e6e8ff";
      
      // Red flash when taking damage
      if (e.hitT > 0) {
        const flashIntensity = clamp(e.hitT / 0.12, 0, 1);
        col = lerpColor(col, "#ff5d5d", flashIntensity * 0.8);
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
      
      ctx.fillStyle = col;
      ctx.globalAlpha = e.hitT > 0 ? 0.7 : 1;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();

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

    ctx.globalAlpha = 1;
    ctx.fillStyle = p.iFrames > 0 ? "rgba(156,255,214,0.9)" : "#2ea8ff";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();

    if (p.shield > 0) {
      ctx.strokeStyle = "#9cffd6";
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Draw spikes for Spiky Shield (thorns)
    if (p.thorns > 0) {
      ctx.strokeStyle = "#ff7a3d";
      ctx.fillStyle = "#ff7a3d";
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 2;
      const spikeCount = 8;
      const spikeLength = 6 + p.thorns * 20; // Scale with thorns value
      const spikeRadius = p.r + 4;
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

    ctx.globalAlpha = 1;
    for (const q of s.particles) {
      const t = clamp(1 - q.t / q.life, 0, 1);
      const hue2 = q.hue == null ? hue : q.hue;
      
      if (q.glow) {
        // Glowing particles with outer glow
        ctx.save();
        ctx.globalAlpha = t * 0.4;
        ctx.fillStyle = `hsl(${hue2}, 90%, 70%)`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = `hsl(${hue2}, 90%, 60%)`;
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      
      ctx.globalAlpha = t;
      ctx.fillStyle = `hsl(${hue2}, 80%, ${q.glow ? 75 : 62}%)`;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
      ctx.fill();
      
      if (q.trail) {
        // Draw trail
        ctx.globalAlpha = t * 0.3;
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Draw hit flashes
    if (s.hitFlashes) {
      for (const flash of s.hitFlashes) {
        const t = clamp(1 - flash.t / flash.life, 0, 1);
        ctx.save();
        ctx.globalAlpha = t * 0.6;
        ctx.fillStyle = flash.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = flash.color;
        ctx.beginPath();
        ctx.arc(flash.x, flash.y, 20 * flash.size * t, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Draw burning areas (ground fire) - more subtle visual
    for (const area of s.burningAreas) {
      const t = clamp(1 - area.t / area.life, 0, 1);
      const pulse = Math.sin(s.t * 6 + area.t * 2) * 0.3 + 0.7;
      
      // Outer glow - very subtle
      ctx.globalAlpha = t * 0.15 * pulse;
      ctx.fillStyle = "#ff7a3d";
      ctx.beginPath();
      ctx.arc(area.x, area.y, area.r, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner ring - subtle pattern
      ctx.globalAlpha = t * 0.25 * pulse;
      ctx.fillStyle = "#ffaa44";
      ctx.beginPath();
      ctx.arc(area.x, area.y, area.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
      
      // Small bright core - very small and subtle
      ctx.globalAlpha = t * 0.4 * pulse;
      ctx.fillStyle = "#ffcc66";
      ctx.beginPath();
      ctx.arc(area.x, area.y, area.r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      
      // Reset alpha
      ctx.globalAlpha = 1.0;
    }
    
    // Draw auras (player AoE effects)
    for (const aura of s.auras) {
      const t = clamp(1 - aura.t / aura.life, 0, 1);
      ctx.globalAlpha = t * 0.4;
      ctx.strokeStyle = aura.color || "#ff7a3d";
      ctx.lineWidth = 2;
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
    
    // Draw slice effects, shockwaves, and particles
    for (const f of s.floaters) {
      if (f.type === "shockwave") {
        const t = clamp(f.t / f.life, 0, 1);
        ctx.save();
        ctx.globalAlpha = (1 - t) * 0.8;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 3 - t * 2;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (0.3 + t * 0.7), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        continue;
      } else if (f.type === "particle") {
        const t = clamp(f.t / f.life, 0, 1);
        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(f.x + (f.vx || 0) * f.t, f.y + (f.vy || 0) * f.t, 3 * (1 - t), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      } else if (f.type === "slice") {
        const t = clamp(1 - f.t / f.life, 0, 1);
        ctx.globalAlpha = t;
        ctx.strokeStyle = f.color || "#ffffff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        const startX = f.x - Math.cos(f.angle) * f.length * 0.5;
        const startY = f.y - Math.sin(f.angle) * f.length * 0.5;
        const endX = f.x + Math.cos(f.angle) * f.length * 0.5;
        const endY = f.y + Math.sin(f.angle) * f.length * 0.5;
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
      ctx.fillText(f.text, f.x, f.y);
    }

    ctx.restore(); // End camera transform
    
    // No viewport border - the level boundaries are drawn in world space
  }

  function drawMinimap(s, ctx) {
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

  function drawHud(s, ctx) {
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

    // Ability hotbar (WoW/League style)
    if (p.abilityId) {
      const { h } = s.arena;
      const hotbarSize = 48;
      const hotbarX = centerX - hotbarSize / 2;
      const hotbarY = h - 80; // Bottom of screen
      const cooldownPercent = p.abilityT > 0 ? Math.min(1, p.abilityT / (p.abilityCd * (p.abilityCdMult || 1))) : 0;
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
      } else if (p.abilityId === "roll") {
        // Roll icon - dash symbol
        ctx.strokeStyle = "#ffd44a";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(10, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(8, 0, 3, 0, Math.PI * 2);
        ctx.fill();
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
        const timeLeft = (p.abilityCd * (p.abilityCdMult || 1)) - p.abilityT;
        ctx.fillText(timeLeft.toFixed(1), hotbarX + hotbarSize / 2, hotbarY + hotbarSize / 2);
      }
      
      // Keybind text (bottom)
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "10px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText("SPACE", hotbarX + hotbarSize / 2, hotbarY + hotbarSize + 12);
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

  function drawOverlay(s, ctx) {
    const { w, h } = s.arena;
    const u = uiRef.current;
    
    // Ensure we're in screen space (reset any transforms)
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform to identity
    
    // Draw minimap in overlay (always on top)
    if (s && u.screen === "running") {
      if (s.levelData) {
        drawMinimap(s, ctx);
      }
    }

    if (u.screen === "running") {
      // Pause menu
      if (u.pauseMenu) {
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
        
        // Admin section
        if (u.showAdmin) {
          ctx.fillStyle = "rgba(20,30,40,0.95)";
          ctx.fillRect(w * 0.5 - 200, 100, 400, h - 200);
          ctx.strokeStyle = "#ffd44a";
          ctx.lineWidth = 3;
          ctx.strokeRect(w * 0.5 - 200, 100, 400, h - 200);
          
          ctx.fillStyle = "#ffd44a";
          ctx.font = "bold 20px ui-sans-serif, system-ui";
          ctx.fillText("ADMIN PANEL", w * 0.5, 140);
          
          const adminY = 180;
          const adminButtonH = 40;
          const adminSpacing = 50;
          let adminButtonIndex = 0;
          
          // Test functions
          const adminFunctions = [
            { name: "Level Up", action: "levelup" },
            { name: "Spawn Boss", action: "spawnBoss" },
            { name: "Spawn Chest", action: "spawnChest" },
            { name: "Spawn Speed Shrine", action: "spawnSpeed" },
            { name: "Spawn Heal Shrine", action: "spawnHeal" },
            { name: "Spawn Magnet Shrine", action: "spawnMagnet" },
            { name: "Full Heal", action: "fullHeal" },
            { name: "Add 1000 Gold", action: "addGold" },
            { name: "Add 1000 XP", action: "addXP" },
            { name: "Kill All Enemies", action: "killAll" },
            { name: "Close Admin", action: "closeAdmin" },
          ];
          
          for (const func of adminFunctions) {
            const y = adminY + adminButtonIndex * adminSpacing;
            ctx.fillStyle = "rgba(60,80,100,0.8)";
            ctx.fillRect(w * 0.5 - 180, y, 360, adminButtonH);
            ctx.strokeStyle = "#ffd44a";
            ctx.lineWidth = 1;
            ctx.strokeRect(w * 0.5 - 180, y, 360, adminButtonH);
            ctx.fillStyle = "#e6e8ff";
            ctx.font = "14px ui-sans-serif, system-ui";
            ctx.fillText(func.name, w * 0.5, y + 25);
            adminButtonIndex++;
          }
        }
        
        ctx.restore();
        return;
      }
      
      if (u.showStats) {
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

    if (u.screen === "levelup") {
      const choices = u.levelChoices || [];
      ctx.fillStyle = "rgba(0,0,0,0.76)";
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = "#e6e8ff";
      ctx.font = "18px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Choose an upgrade", w * 0.5, 78);
      ctx.font = "12px ui-sans-serif, system-ui";
      ctx.fillStyle = "rgba(230,232,255,0.8)";
      ctx.fillText("Click or press 1 2 3", w * 0.5, 100);

      const cardW = Math.min(320, Math.max(240, w * 0.26));
      const cardH = 180; // Increased height for description + preview stats
      const gap = 18;
      const totalW = cardW * 3 + gap * 2;
      const startX = w * 0.5 - totalW * 0.5;
      const y = h * 0.5 - cardH * 0.5;

      for (let i = 0; i < 3; i++) {
        const c = choices[i];
        const x = startX + i * (cardW + gap);
        ctx.save();
        ctx.translate(x, y);

        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, cardW, cardH);

        if (c) {
          const col = RARITY_COLOR[c.rarity] || RARITY_COLOR[RARITY.COMMON];
          ctx.fillStyle = col.bg;
          ctx.fillRect(0, 0, cardW, 8);

          ctx.fillStyle = "#e6e8ff";
          ctx.font = "14px ui-sans-serif, system-ui";
          ctx.textAlign = "left";
          ctx.fillText(`${i + 1}. ${c.name}`, 12, 32);

          ctx.font = "12px ui-sans-serif, system-ui";
          ctx.fillStyle = "rgba(230,232,255,0.85)";
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

          ctx.fillStyle = "rgba(230,232,255,0.7)";
          ctx.fillText("Click to pick", 12, cardH - 12);

          ctx.fillStyle = "rgba(230,232,255,0.95)";
          ctx.strokeStyle = "rgba(230,232,255,0.14)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cardW - 26, 28, 12, 0, Math.PI * 2);
          ctx.stroke();
          ctx.save();
          ctx.translate(cardW - 26, 28);
          const iconSize = 8;
          if (typeof c.icon === "function") c.icon(ctx, 0, 0, iconSize);
          ctx.restore();
        }

        ctx.restore();
      }

      ctx.restore();
      return;
    }

    if (u.screen === "dead") {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.78)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#e6e8ff";
      ctx.font = "22px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Game Over", w * 0.5, h * 0.35);
      ctx.font = "13px ui-sans-serif, system-ui";
      ctx.fillStyle = "rgba(230,232,255,0.85)";
      ctx.fillText(`Score ${format(u.score)}`, w * 0.5, h * 0.35 + 34);
      if (u.deathReason) ctx.fillText(u.deathReason, w * 0.5, h * 0.35 + 56);
      ctx.fillText("Press E", w * 0.5, h * 0.35 + 88);
      ctx.restore();
      return;
    }

    if (u.screen === "menu") {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#e6e8ff";
      ctx.font = "22px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Neon Pit", w * 0.5, 86);

      ctx.font = "13px ui-sans-serif, system-ui";
      ctx.fillStyle = "rgba(230,232,255,0.85)";
      ctx.fillText("WASD move", w * 0.5, 118);
      ctx.fillText("Space ability", w * 0.5, 140);
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
        const active = uiRef.current.selectedChar === c.id;

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
        ctx.fillText(`Space: ${c.space.name}`, 12, 98);
        ctx.fillStyle = active ? "rgba(46,168,255,0.9)" : "rgba(200,220,255,0.85)";
        ctx.font = "11px ui-sans-serif, system-ui";
        ctx.fillText(`Perk: ${c.perk}`, 12, 120);

        ctx.restore();
      }

      ctx.fillStyle = "rgba(230,232,255,0.9)";
      ctx.font = "14px ui-sans-serif, system-ui";
      ctx.fillText("Press E to start", w * 0.5, h - 80);
      if (u.best > 0) {
        ctx.fillStyle = "rgba(230,232,255,0.7)";
        ctx.font = "12px ui-sans-serif, system-ui";
        ctx.fillText(`Best ${format(u.best)}`, w * 0.5, h - 54);
      }
      ctx.restore();
      return;
    }
  }

  function handleAdminAction(s, action) {
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
          startBoss(s, 120, p.x, p.y);
        }
        break;
      case "spawnChest":
        spawnInteractable(s, INTERACT.CHEST);
        break;
      case "spawnSpeed":
        spawnInteractable(s, INTERACT.SHRINE);
        break;
      case "spawnHeal":
        spawnInteractable(s, INTERACT.MICROWAVE);
        break;
      case "spawnMagnet":
        spawnInteractable(s, INTERACT.MAGNET_SHRINE);
        break;
      case "fullHeal":
        p.hp = p.maxHp;
        p.shield = p.maxShield || 0;
        pushCombatText(s, p.x, p.y - 30, "FULL HEAL", "#1fe06a", { size: 16, life: 1.2 });
        break;
      case "addGold":
        p.coins += 1000;
        s.score += 1000 * 3;
        pushCombatText(s, p.x, p.y - 30, "+1000 Gold", "#ffd44a", { size: 16, life: 1.2 });
        break;
      case "addXP":
        s.xp += 1000;
        pushCombatText(s, p.x, p.y - 30, "+1000 XP", "#2ea8ff", { size: 16, life: 1.2 });
        break;
      case "killAll":
        // Kill all enemies
        for (const e of s.enemies) {
          if (e.hp > 0) {
            e.hp = 0;
            addParticle(s, e.x, e.y, 12, 200, { size: 2.5, speed: 1.2 });
          }
        }
        pushCombatText(s, p.x, p.y - 30, "ALL ENEMIES KILLED", "#ff5d5d", { size: 16, life: 1.2 });
        break;
    }
  }

  function pickChoice(i) {
    const s = stateRef.current;
    if (!s) return;
    const u = uiRef.current;
    if (u.screen !== "levelup") return;

    const c = u.levelChoices?.[i];
    if (!c) return;

    c.apply();
    
    // Show popup text for the upgrade
    const p = s.player;
    pushCombatText(s, p.x, p.y - 30, c.name.toUpperCase(), "#9cffd6", { size: 18, life: 1.5 });

    s.running = true;
    s.freezeMode = null;

    const nextUi = {
      ...u,
      screen: "running",
      level: s.level,
      xp: s.xp,
      xpNeed: s.xpNeed,
      score: s.score,
      coins: s.player.coins,
      timer: s.stageLeft,
      hint: "",
      levelChoices: [],
    };

    uiRef.current = nextUi;
    setUi(nextUi);
  }

  function setMenuChar(id) {
    setUi((u) => {
      const next = { ...u, selectedChar: id };
      uiRef.current = next;
      return next;
    });
  }

  function setPaused(paused) {
    const s = stateRef.current;
    if (!s) return;
    const u = uiRef.current;

    if (paused) {
      if (u.screen !== "running") return;
      s.running = false;
      s.freezeMode = "tab";
      const nextUi = { ...u, showStats: true, hint: "" };
      uiRef.current = nextUi;
      setUi(nextUi);
      return;
    }

    if (u.showStats) {
      s.running = true;
      s.freezeMode = null;
      const nextUi = { ...u, showStats: false };
      uiRef.current = nextUi;
      setUi(nextUi);
    }
  }

  useEffect(() => {
    runSelfTests();
  }, []);

  useEffect(() => {
    resizeCanvas();
    const onResize = () => resizeCanvas();
    window.addEventListener("resize", onResize);
    document.addEventListener("fullscreenchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("fullscreenchange", onResize);
    };
  }, []);

  useEffect(() => {
    const down = (e) => {
      const k = e.key;
      const keyCode = e.keyCode || e.which;
      const keyLower = k ? k.toLowerCase() : "";

      if (k === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        const u = uiRef.current;
        if (u.screen === "running") {
          setPaused(!u.showStats);
        }
        return;
      }

      if (k === "f" || k === "F") {
        e.preventDefault();
        ensureAudio();
        requestFullscreen();
        return;
      }

      if (k === "1" || k === "2" || k === "3") {
        const u = uiRef.current;
        if (u.screen === "menu") {
          const id = content.characters[Number(k) - 1]?.id;
          if (id) setMenuChar(id);
        }
        if (u.screen === "levelup") pickChoice(Number(k) - 1);
      }

      // Check for E key - multiple ways to detect it
      if (k === "e" || k === "E" || keyLower === "e" || keyCode === 69) {
        e.preventDefault();
        e.stopPropagation();
        const s = stateRef.current;
        const u = uiRef.current;
        
        // Check menu screen first
        if (u.screen === "menu") {
          ensureAudio();
          const best = safeBest();
          newRun(best, u.selectedChar);
          return;
        }
        
        // Check dead screen
        if (u.screen === "dead") {
          ensureAudio();
          const best = safeBest();
          const char = s?.player?.charId || u.selectedChar;
          newRun(best, char);
          return;
        }
        
        // Check running game for interactables
        if (s && u.screen === "running" && s.running) {
          tryUseInteractable(s);
        }
      }

      // A and D keys for character selection in menu
      if ((k === "a" || k === "A" || k === "d" || k === "D") && uiRef.current.screen === "menu") {
        e.preventDefault();
        const u = uiRef.current;
        const currentIndex = content.characters.findIndex(c => c.id === u.selectedChar);
        if (currentIndex >= 0) {
          let newIndex;
          if (k === "a" || k === "A") {
            // Next character (move right)
            newIndex = currentIndex < content.characters.length - 1 ? currentIndex + 1 : 0;
          } else {
            // Previous character (move left)
            newIndex = currentIndex > 0 ? currentIndex - 1 : content.characters.length - 1;
          }
          setMenuChar(content.characters[newIndex].id);
        }
      }

      if (k === " " || k === "Spacebar") {
        const s = stateRef.current;
        const u = uiRef.current;
        if (s && u.screen === "running" && s.running) {
          useAbility(s);
        } else if (u.screen === "menu") {
          // Space can also start game from menu
          ensureAudio();
          const best = safeBest();
          newRun(best, u.selectedChar);
        }
      }

      if (k === "Escape") {
        const u = uiRef.current;
        if (u.screen === "running") {
          if (u.showStats && !u.pauseMenu) {
            // Close stats, open pause menu
            setUi(prev => ({ ...prev, showStats: false, pauseMenu: true }));
          } else if (u.pauseMenu) {
            // Close pause menu, resume game
            setUi(prev => ({ ...prev, pauseMenu: false, showAdmin: false }));
          } else {
            // Open pause menu
            setUi(prev => ({ ...prev, pauseMenu: true }));
          }
        }
      }

      if (uikIsLevelupGuard()) {
        return;
      }

      // Normalize letter keys to lowercase to handle Shift properly
      // Arrow keys are kept as-is
      if (k && k.length === 1 && /[a-zA-Z]/.test(k)) {
        keysRef.current.add(k.toLowerCase());
      } else {
        keysRef.current.add(k);
      }
    };

    const up = (e) => {
      const k = e.key;
      
      // Normalize letter keys to lowercase (same as keydown)
      if (k && k.length === 1 && /[a-zA-Z]/.test(k)) {
        keysRef.current.delete(k.toLowerCase());
        keysRef.current.delete(k.toUpperCase()); // Also remove uppercase version if it exists
      } else {
        keysRef.current.delete(k);
      }
    };

    const blur = () => {
      keysRef.current.clear();
    };

    function uikIsLevelupGuard() {
      const u = uiRef.current;
      return u.screen === "levelup";
    }

    // Attach event listeners to both window and document for better compatibility
    window.addEventListener("keydown", down, true); // Use capture phase
    document.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up);
    document.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down, true);
      document.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up);
      document.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [content]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    const onPointerDown = (e) => {
      ensureAudio();
      c.setPointerCapture?.(e.pointerId);

      const s = stateRef.current;
      const u = uiRef.current;
      
      // Pause game updates when pause menu is open
      if (u.screen === "running" && u.pauseMenu) {
        return;
      }
      
      if (!s) {
        if (u.screen === "menu") {
          const rect = c.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;

          const cardW = Math.min(300, Math.max(220, sizeRef.current.w * 0.24));
          const gap = 18;
          const totalW = cardW * 3 + gap * 2;
          const startX = sizeRef.current.w * 0.5 - totalW * 0.5;
          const topY = 300;
          const cardH = 120;

          for (let i = 0; i < 3; i++) {
            const cx = startX + i * (cardW + gap);
            if (x >= cx && x <= cx + cardW && y >= topY && y <= topY + cardH) {
              setMenuChar(content.characters[i].id);
              return;
            }
          }
        }
        return;
      }

      // Pause menu click handling
      if (u.screen === "running" && u.pauseMenu) {
        const rect = c.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const w = s.arena.w;
        const h = s.arena.h;
        
        const buttonX = w * 0.5 - 120;
        const buttonW = 240;
        const buttonH = 50;
        const buttonY = 180;
        const buttonSpacing = 70;
        
        // Continue button
        if (x >= buttonX && x <= buttonX + buttonW && y >= buttonY && y <= buttonY + buttonH) {
          setUi(prev => ({ ...prev, pauseMenu: false, showAdmin: false }));
          return;
        }
        
        // New Game button
        if (x >= buttonX && x <= buttonX + buttonW && y >= buttonY + buttonSpacing && y <= buttonY + buttonSpacing + buttonH) {
          ensureAudio();
          const best = safeBest();
          newRun(best, u.selectedChar);
          setUi(prev => ({ ...prev, pauseMenu: false, showAdmin: false }));
          return;
        }
        
        // Admin button
        if (x >= buttonX && x <= buttonX + buttonW && y >= buttonY + buttonSpacing * 2 && y <= buttonY + buttonSpacing * 2 + buttonH) {
          setUi(prev => ({ ...prev, showAdmin: !prev.showAdmin }));
          return;
        }
        
        // Admin section buttons
        if (u.showAdmin) {
          const adminX = w * 0.5 - 180;
          const adminW = 360;
          const adminButtonH = 40;
          const adminY = 180;
          const adminSpacing = 50;
          
          const adminFunctions = [
            { name: "Level Up", action: "levelup" },
            { name: "Spawn Boss", action: "spawnBoss" },
            { name: "Spawn Chest", action: "spawnChest" },
            { name: "Spawn Speed Shrine", action: "spawnSpeed" },
            { name: "Spawn Heal Shrine", action: "spawnHeal" },
            { name: "Spawn Magnet Shrine", action: "spawnMagnet" },
            { name: "Full Heal", action: "fullHeal" },
            { name: "Add 1000 Gold", action: "addGold" },
            { name: "Add 1000 XP", action: "addXP" },
            { name: "Kill All Enemies", action: "killAll" },
            { name: "Close Admin", action: "closeAdmin" },
          ];
          
          for (let i = 0; i < adminFunctions.length; i++) {
            const adminButtonY = adminY + i * adminSpacing;
            if (x >= adminX && x <= adminX + adminW && y >= adminButtonY && y <= adminButtonY + adminButtonH) {
              handleAdminAction(s, adminFunctions[i].action);
              if (adminFunctions[i].action === "closeAdmin") {
                setUi(prev => ({ ...prev, showAdmin: false }));
              }
              return;
            }
          }
        }
      }

      if (u.screen === "levelup") {
        const rect = c.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const w = s.arena.w;
        const h = s.arena.h;

        const cardW = Math.min(320, Math.max(240, w * 0.26));
        const cardH = 130;
        const gap = 18;
        const totalW = cardW * 3 + gap * 2;
        const startX = w * 0.5 - totalW * 0.5;
        const topY = h * 0.5 - cardH * 0.5;

        for (let i = 0; i < 3; i++) {
          const cx = startX + i * (cardW + gap);
          // Fix click detection - account for card height properly
          if (x >= cx && x <= cx + cardW && y >= topY && y <= topY + cardH) {
            e.preventDefault();
            e.stopPropagation();
            pickChoice(i);
            return;
          }
        }
      }
    };

    c.addEventListener("pointerdown", onPointerDown);
    return () => {
      c.removeEventListener("pointerdown", onPointerDown);
    };
  }, [content]);

  useEffect(() => {
    const step = () => {
      const c = canvasRef.current;
      const s = stateRef.current;
      if (!c) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      const { w, h, dpr } = sizeRef.current;
      const ctx = c.getContext("2d");
      if (!ctx) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const now = performance.now();
      const last = step._last ?? now;
      step._last = now;
      const dt = clamp((now - last) / 1000, 0, 0.05);

      if (s) {
        const u = uiRef.current;
        if (u.screen === "running" && s.running && !u.pauseMenu) {
          // Always update hitStopT, but only update game logic when hitStopT is 0
          if (s.hitStopT > 0) {
            s.hitStopT = Math.max(0, s.hitStopT - dt);
          }
          if (s.hitStopT <= 0) {
            try {
              update(s, dt);
            } catch (error) {
              console.error("Update error:", error);
              // Prevent freeze by resetting state
              s.running = false;
            }
          }
        }

        drawWorld(s, ctx);
        drawHud(s, ctx);

        const u2 = uiRef.current;
        if (u2.screen === "running" && !u2.pauseMenu) {
          u2.score = s.score;
          u2.level = s.level;
          u2.xp = s.xp;
          u2.xpNeed = s.xpNeed;
          u2.coins = s.player.coins;
          u2.timer = s.stageLeft;
        }

        if (s.player.hp <= 0 && uiRef.current.screen !== "dead") {
          sfxGameOver();
          const best = safeBest();
          const score = s.score;
          const nextBest = Math.max(best, score);
          try {
            localStorage.setItem("neon_pit_best", String(nextBest));
          } catch {
            void 0;
          }
          const reason = s.player.lastDamage?.src ? `Killed by ${s.player.lastDamage.src}` : "";
          const nextUi = { ...uiRef.current, screen: "dead", score, best: nextBest, deathReason: reason, levelChoices: [], showStats: false };
          uiRef.current = nextUi;
          setUi(nextUi);
        }

        drawOverlay(s, ctx);
      } else {
        const fakeS = {
          arena: { w, h },
          player: { coins: 0 },
        };
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#06070c";
        ctx.fillRect(0, 0, w, h);
        drawOverlay(fakeS, ctx);
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#05060b",
        overflow: "hidden",
      }}
    >
      <div
        ref={canvasHolderRef}
        style={{
          width: "min(1100px, 100%)",
          height: "min(680px, 100%)",
          aspectRatio: "16 / 9",
          borderRadius: 18,
          border: "1px solid rgba(230,232,255,0.12)",
          boxShadow: "0 16px 60px rgba(0,0,0,0.55)",
          position: "relative",
        }}
      >
        <canvas ref={canvasRef} tabIndex={0} style={{ width: "100%", height: "100%", borderRadius: 18, display: "block", outline: "none" }} />
      </div>
    </div>
  );
}
