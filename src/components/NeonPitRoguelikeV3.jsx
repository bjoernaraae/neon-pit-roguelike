import React, { useEffect, useMemo, useRef, useState } from "react";
import { clamp, lerp, rand, dist2, format } from "../utils/math.js";
import { hexToRgb, lerpColor, adjustBrightness } from "../utils/color.js";
import { deepClone, pickWeighted } from "../utils/data.js";
import { getVisualRadius, resolveKinematicOverlap, resolveDynamicOverlap } from "../game/systems/CollisionSystem.js";
import { isPointWalkable, findNearestWalkable, hasLineOfSight, circleOverlapsRect } from "../game/world/WalkabilitySystem.js";
import { generateFlowField, getFlowDirection } from "../game/systems/PathfindingSystem.js";
import { BSPNode, generateBSPDungeon, convertBSPToGrid, generateWallInfluenceMap } from "../game/world/BSPDungeonGenerator.js";
import { generateProceduralLevel } from "../game/world/LevelGenerator.js";

// Aliases for backward compatibility
const getVisualCubeRadius = getVisualRadius;
const resolveKinematicCircleOverlap = resolveKinematicOverlap;
const resolveDynamicCircleOverlap = resolveDynamicOverlap;



// ============================================================================
// COLLISION DETECTION SYSTEM
// ============================================================================
// Hybrid approach: Grid quick rejection + precise circle-rectangle overlap
// Uses exact room/corridor bounds from BSP generation (no expansion)
// Visual bounds = collision bounds for perfect accuracy

// Helper: Check if circle overlaps rectangle
// ============================================================================
// PATHFINDING & LINE OF SIGHT SYSTEM
// ============================================================================




// ============================================================================
// ISOMETRIC TRANSFORMATION FUNCTIONS
// ============================================================================

import { ISO_MODE } from "../data/constants.js";
import { worldToIso, isoToWorld, getIsoDepth, transformInputForIsometric, drawIsometricCube, drawEntityAsCube, drawIsometricRectangle } from "../rendering/IsometricRenderer.js";



import { RARITY, RARITY_COLOR, TYPE, INTERACT } from "../data/constants.js";

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
    adminCategory: "main", // Admin category: "main", "weapons", "tomes", "items"
    bossTpX: null, // Boss teleporter X position
    bossTpY: null, // Boss teleporter Y position
  });

  // ISO_SCALE state for dynamic adjustment during testing
  const [isoScale, setIsoScale] = useState(0.01);
  const isoScaleRef = useRef(isoScale);
  useEffect(() => {
    isoScaleRef.current = isoScale;
  }, [isoScale]);

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
          meleeR: 68,
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
          (p) => (p.attackCooldown = Math.max(0.24, p.attackCooldown * 0.9)),
          (p) => (p.weaponDamage *= 1.18),
          (p) => (p.projectileSpeed *= 1.08),
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
          // This includes bananarang - quantity tome increases bananarang count
          if (p.weapons && p.weapons.length > 0) {
            for (const weapon of p.weapons) {
              // For bananarang, quantity tome increases the number of bananarangs you can have
              // But bananarang is limited to 1 active at a time, so this affects the upgrade path
              // Instead, we'll increase the weapon's projectiles stat (which affects other upgrades)
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
          // Common/Uncommon: +1, Rare/Legendary: +2
          const bounceAdd = m < 1.5 ? 1 : 2;
          if (p.weapons && p.weapons.length > 0) {
            for (const weapon of p.weapons) {
              if (weapon.bounces !== undefined && weapon.bounces >= 0) {
                weapon.bounces = clamp(weapon.bounces + bounceAdd, 0, 8);
              }
            }
          }
          // Also add to player's base bounce stat for future weapons
          p.bounces = (p.bounces || 0) + bounceAdd;
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
        desc: "+Max Shield HP",
        apply: (p, r) => {
          const m = rarityMult(r);
          p.maxShield = Math.round((p.maxShield || 0) + 8 * m); // Reduced from 12, caps at reasonable amount
          // Also add current shield if below max
          if (!p.shield || p.shield < p.maxShield) {
            p.shield = Math.min(p.maxShield, (p.shield || 0) + 8 * m);
          }
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
      {
        id: "t_jump",
        name: "Jump Tome",
        type: TYPE.TOME,
        desc: "+Jump height",
        apply: (p, r) => {
          const m = rarityMult(r);
          // Increase jump height multiplier (stacks multiplicatively)
          p.jumpHeight = (p.jumpHeight || 1.0) * (1 + 0.15 * m); // Common: +15%, Uncommon: +17%, Rare: +19%, Legendary: +23%
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
        stats: { hp: 95, speedBase: 200, critChance: 0.08 },
        space: { id: "quickdraw", name: "Quick Draw", cd: 8.0 },
        perk: "+1.5% Crit per level",
      },
      {
        id: "wizard",
        name: "Wizard",
        subtitle: "AoE fire",
        startWeapon: "firestaff",
        stats: { hp: 90, speedBase: 190, sizeMult: 1.08 },
        space: { id: "blink", name: "Blink", cd: 3.6 },
        perk: "+0.15 Luck per level",
      },
      {
        id: "brute",
        name: "Brute",
        subtitle: "Melee",
        startWeapon: "sword",
        stats: { hp: 125, speedBase: 180, armor: 0.06 },
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
    
    // Try to spawn in rooms/corridors if level data exists
    if (s.levelData) {
      // Combine rooms and corridors for spawn selection
      const allAreas = [...(s.levelData.rooms || []), ...(s.levelData.corridors || [])];
      if (allAreas.length > 0) {
        while (!validSpawn && attempts < 50) {
          // Pick a random room or corridor
          const area = allAreas[Math.floor(Math.random() * allAreas.length)];
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
    
    // Shocker appears starting floor 7 (new enemy type - electric)
    if (s.floor >= 7) {
      tierWeights.push({ w: Math.max(0, -8 + s.floor * 0.8), t: "shocker" });
    }
    
    // Tank appears starting floor 9 (new enemy type - slow but tanky)
    if (s.floor >= 9) {
      tierWeights.push({ w: Math.max(0, -5 + s.floor * 0.6), t: "tank" });
    }
    
    const tier = pickWeighted(tierWeights).t;

    // Determine if this is an elite enemy (5% chance, higher on later floors)
    const eliteChance = 0.05 + (s.floor - 1) * 0.01;
    const isElite = Math.random() < eliteChance;
    
    // Golden elite (1% chance, scales with floor) - drops extra gold
    const goldenEliteChance = 0.01 + (s.floor - 1) * 0.005;
    const isGoldenElite = isElite && Math.random() < goldenEliteChance;

    const baseHp = tier === "brute" ? 110 : tier === "runner" ? 56 : tier === "spitter" ? 64 : tier === "shocker" ? 72 : tier === "tank" ? 180 : 60;
    // Reduced enemy speeds by ~50% total for slower-paced gameplay
    const baseSp = tier === "brute" ? 47 : tier === "runner" ? 113 : tier === "spitter" ? 59 : tier === "shocker" ? 69 : tier === "tank" ? 34 : 74;
    const r = tier === "brute" ? 18 : tier === "runner" ? 12 : tier === "spitter" ? 15 : tier === "shocker" ? 14 : tier === "tank" ? 22 : 14;

    // Elite enemies are much tougher: 3x HP, 1.4x size, 1.5x speed, damage reduction
    const hpMult = isElite ? 3.0 : 1.0;
    const sizeMult = isElite ? 1.4 : 1.0;
    const speedMult = isElite ? 1.5 : 1.0;
    const finalHp = Math.round(baseHp * hpMult);
    const finalR = r * sizeMult;
    const finalSpeed = baseSp * speedMult;
    
    // Elite special abilities and weaknesses
    let eliteAbility = null;
    let eliteWeakness = null;
    let eliteArmor = 0; // Damage reduction (0-1)
    
    if (isElite) {
      // Random elite ability
      const abilityRoll = Math.random();
      if (abilityRoll < 0.25) {
        eliteAbility = "regeneration"; // Heals over time
      } else if (abilityRoll < 0.5) {
        eliteAbility = "shield"; // Damage reduction
        eliteArmor = 0.3; // 30% damage reduction
      } else if (abilityRoll < 0.75) {
        eliteAbility = "teleport"; // Can teleport/dash
      } else {
        eliteAbility = "rage"; // Gets faster and stronger as HP drops
      }
      
      // Random weakness (takes extra damage from certain sources)
      const weaknessRoll = Math.random();
      if (weaknessRoll < 0.33) {
        eliteWeakness = "fire"; // Weak to fire/burn damage
      } else if (weaknessRoll < 0.66) {
        eliteWeakness = "poison"; // Weak to poison damage
      } else {
        eliteWeakness = "melee"; // Weak to melee attacks
      }
    }

    // Coin calculation: base 2 for normal mobs, scales with HP
    // Elite enemies give more, golden elites give even more
    let baseCoin = 2;
    if (tier === "brute") baseCoin = 3;
    else if (tier === "tank") baseCoin = 4;
    
    // Scale coin with HP (harder enemies = more gold)
    const coinFromHp = Math.round(finalHp / 30); // 1 coin per 30 HP
    let finalCoin = baseCoin + coinFromHp;
    
    if (isElite) {
      finalCoin = Math.round(finalCoin * 2.5); // Elites give 2.5x base
    }
    if (isGoldenElite) {
      finalCoin = Math.round(finalCoin * 3); // Golden elites give 3x more
    }

    s.enemies.push({
      id: Math.random().toString(16).slice(2),
      x,
      y,
      r: finalR,
      hp: finalHp,
      maxHp: finalHp,
      speed: finalSpeed,
      tier,
      isElite,
      isGoldenElite,
      eliteAbility,
      eliteWeakness,
      eliteArmor,
      eliteRegenT: 0, // Regeneration timer
      eliteTeleportT: 0, // Teleport cooldown
      hitT: 0,
      spitT: 0,
      phase: rand(0, Math.PI * 2),
      xp: Math.round((tier === "brute" ? 7 : tier === "spitter" ? 6 : tier === "runner" ? 5 : tier === "shocker" ? 6 : tier === "tank" ? 8 : 4) * p.difficultyTome * (isElite ? 2 : 1)),
      coin: finalCoin,
      poisonT: 0,
      poisonDps: 0,
      freezeT: 0, // Keep for backwards compatibility
      slowT: 0, // Slow effect (replaces freeze)
      slowMult: 1.0, // Speed multiplier when slowed
      burnT: 0,
      burnDps: 0,
      contactCd: 0, // Start at 0 so enemies can hit immediately when they touch
      z: 0, // Initialize z position for isometric depth
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
      originalSpeed: speed, // Store original speed for return phase
      hitEnemies: new Set(), // Track hit enemies for pierce/boomerang
      isBone: opts?.isBone ?? false, // For bone rotation
      rotation: opts?.isBone ? angle : (opts?.boomerang ? 0 : angle), // Initial rotation angle
      weaponId: opts?.weaponId, // Track which weapon this belongs to
      explosive: opts?.explosive || false, // Delayed explosive bullet
      injected: opts?.injected || false, // Whether bullet is injected onto enemy
      injectedEnemy: opts?.injectedEnemy || null, // Reference to enemy bullet is attached to
      explodeAfter: opts?.explodeAfter || 0, // Time until explosion
      explosionRadius: opts?.explosionRadius || 0, // Explosion AoE radius
      explosionDmg: opts?.explosionDmg || 0, // Explosion damage
      seeking: opts?.seeking || false, // Whether bullet seeks nearest enemy
    };

    s.bullets.push(bullet);

    const xNorm = clamp((x / (s.arena.w || 1)) * 2 - 1, -1, 1);
    if (!opts?.enemy) {
      const soundVariant = opts?.soundVariant ?? Math.floor(Math.random() * 3);
      sfxShoot(xNorm, soundVariant);
  }

    return bullet;
  }

  function applyWeapon(p, weaponDef, rarity, previewOnly, forcedUpgradeType = null) {
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
          // Weapon-specific properties (initialized based on weapon type)
          boomerangMaxDist: weaponDef.id === "bananarang" ? 250 : undefined,
          boomerangReturnSpeedMult: weaponDef.id === "bananarang" ? 1 : undefined,
          boneRotationSpeed: weaponDef.id === "bone" ? 8 : undefined,
          flamewalkerDuration: weaponDef.id === "flamewalker" ? 4.0 : undefined,
          meleeKnockbackMult: weaponDef.base.mode === "melee" ? 1 : undefined,
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
    
    // Weapon-specific upgrades based on weapon type
    const weaponId = existingWeapon.id;
    
    // Get weapon-specific upgrade cycle
    let upgradeTypes = [];
    if (weaponId === "bananarang") {
      // Bananarang-specific upgrades: Range -> Attack Speed -> Damage -> Return Speed
      upgradeTypes = ["range", "attackSpeed", "damage", "returnSpeed"];
    } else if (weaponId === "bone") {
      // Bone-specific upgrades: Projectile -> Damage -> Attack Speed -> Rotation Speed
      upgradeTypes = ["projectile", "damage", "attackSpeed", "rotationSpeed"];
    } else if (weaponId === "flamewalker") {
      // Flamewalker-specific upgrades: Radius -> Damage -> Attack Speed -> Duration
      upgradeTypes = ["radius", "damage", "attackSpeed", "duration"];
    } else if (weaponId === "poison_flask") {
      // Poison flask-specific upgrades: Projectile -> Damage -> Attack Speed -> Splash Radius
      upgradeTypes = ["projectile", "damage", "attackSpeed", "splashRadius"];
    } else if (weaponId === "revolver" || weaponId === "bow" || weaponId === "lightning_staff") {
      // Ranged weapons: Projectile -> Damage -> Attack Speed -> Bullet Speed
      upgradeTypes = ["projectile", "damage", "attackSpeed", "bulletSpeed"];
    } else if (existingWeapon.weaponMode === "melee") {
      // Melee weapons: Range -> Damage -> Attack Speed -> Knockback
      upgradeTypes = ["range", "damage", "attackSpeed", "knockback"];
    } else {
      // Default: Projectile -> Damage -> Attack Speed -> Bullet Speed
      upgradeTypes = ["projectile", "damage", "attackSpeed", "bulletSpeed"];
    }
    
    // Use forced upgrade type if provided, otherwise randomly select
    // Reduce chance of projectile upgrades (quantity) - make it less common
    let upgradeType = forcedUpgradeType;
    if (!upgradeType) {
      // Weighted random selection - reduce projectile chance
      const weights = upgradeTypes.map(t => t === "projectile" ? 0.15 : 0.85 / (upgradeTypes.length - 1));
      let rand = Math.random();
      let sum = 0;
      for (let i = 0; i < upgradeTypes.length; i++) {
        sum += weights[i];
        if (rand < sum) {
          upgradeType = upgradeTypes[i];
          break;
        }
      }
      if (!upgradeType) upgradeType = upgradeTypes[Math.floor(Math.random() * upgradeTypes.length)];
    }
    
    // Apply weapon-specific upgrade
    if (upgradeType === "projectile") {
      existingWeapon.projectiles = clamp(existingWeapon.projectiles + 1, 1, 16);
    } else if (upgradeType === "damage") {
      existingWeapon.weaponDamage *= 1.06;
    } else if (upgradeType === "attackSpeed") {
      existingWeapon.attackCooldown = Math.max(0.18, existingWeapon.attackCooldown * 0.96);
    } else if (upgradeType === "bulletSpeed") {
      existingWeapon.bulletSpeedMult = (existingWeapon.bulletSpeedMult || 1) * 1.04;
    } else if (upgradeType === "range") {
      // For bananarang: increase maxDist
      if (weaponId === "bananarang") {
        existingWeapon.boomerangMaxDist = (existingWeapon.boomerangMaxDist || 250) + 30;
      } else if (existingWeapon.weaponMeleeR) {
        // For melee: increase melee range
        existingWeapon.weaponMeleeR = (existingWeapon.weaponMeleeR || 60) * 1.08;
      }
    } else if (upgradeType === "returnSpeed") {
      // Bananarang-specific: increase return speed multiplier
      existingWeapon.boomerangReturnSpeedMult = (existingWeapon.boomerangReturnSpeedMult || 1) * 1.15;
    } else if (upgradeType === "rotationSpeed") {
      // Bone-specific: increase rotation speed
      existingWeapon.boneRotationSpeed = (existingWeapon.boneRotationSpeed || 8) * 1.2;
    } else if (upgradeType === "radius") {
      // Flamewalker-specific: increase aura radius
      existingWeapon.weaponMeleeR = (existingWeapon.weaponMeleeR || 50) * 1.1;
    } else if (upgradeType === "duration") {
      // Flamewalker-specific: increase burn duration (stored in weapon for reference)
      existingWeapon.flamewalkerDuration = (existingWeapon.flamewalkerDuration || 4.0) * 1.15;
    } else if (upgradeType === "splashRadius") {
      // Poison flask-specific: increase splash radius
      existingWeapon.weaponSplashR = (existingWeapon.weaponSplashR || 54) * 1.12;
    } else if (upgradeType === "knockback") {
      // Melee-specific: increase knockback (stored in weapon for reference)
      existingWeapon.meleeKnockbackMult = (existingWeapon.meleeKnockbackMult || 1) * 1.2;
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

    // Check line of sight before allowing player to shoot
    if (s.levelData && !hasLineOfSight(p.x, p.y, tgt.x, tgt.y, s.levelData, 10)) {
      return; // No line of sight, can't shoot
    }

    const dx = tgt.x - p.x;
    const dy = tgt.y - p.y;
    const baseA = Math.atan2(dy, dx);

    const speed = 580 * p.projectileSpeed; // Reduced from 740 for slower-paced gameplay
    const bulletR = 4.1 * p.sizeMult;
    const knock = p.knockback;

      // Fire each weapon
      for (const weapon of p.weapons) {
        // For bananarang, check if there's already an active boomerang FIRST (before cooldown check)
        // This prevents firing even if cooldown is 0
        if (weapon.id === "bananarang" && weapon.weaponMode === "boomerang") {
          // Count active boomerangs for this weapon (not marked for destruction)
          // Check both t <= life AND that it hasn't returned yet (returning flag doesn't mean it's back)
          const activeBoomerangs = s.bullets.filter(bb => 
            bb.boomerang && 
            bb.weaponId === "bananarang" && 
            bb.t <= bb.life // Not marked for destruction (b.t > b.life means destroyed)
          );
          
          // Only fire if there are no active boomerangs (only 1 at a time)
          if (activeBoomerangs.length > 0) {
            continue; // Wait for boomerang to return - don't check cooldown, don't fire
          }
        }
        
        if (weapon.attackT > 0) continue; // Weapon is on cooldown

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
            
            // Apply lifesteal if player has it (melee)
            if (p.lifesteal > 0) {
              const healAmount = finalDmg * p.lifesteal;
              p.hp = Math.min(p.maxHp, p.hp + healAmount);
              // Visual feedback for lifesteal
              if (healAmount > 0.5) {
                pushCombatText(s, p.x, p.y - 30, `+${Math.round(healAmount)}`, "#4dff88", { size: 10, life: 0.6 });
              }
            }
            
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
              // Increased knockback multiplier from 0.03 to 0.15 (5x stronger)
              e.x += (dx2 / dd) * knock * 0.15;
              e.y += (dy2 / dd) * knock * 0.15;
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
      const isBoomerang = weapon.weaponMode === "boomerang";
      // For boomerang weapons, always fire only 1 projectile at a time
      const count = isBoomerang ? 1 : Math.max(1, weapon.projectiles);

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

      // For boomerang weapons, set cooldown to prevent firing until banana returns
      // The main cooldown will be reset when the boomerang returns
      if (isBoomerang) {
        // Set a longer cooldown to ensure banana must return before next shot
        // This acts as a safety net in case the active boomerang check fails
        weapon.attackT = 5.0; // Long cooldown - will be reset to 2.0 when banana returns
      } else {
        weapon.attackT = weapon.attackCooldown;
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
          maxDist: isBoomerang ? (weapon.boomerangMaxDist || 250) : undefined, // Use weapon-specific max distance
          weaponId: isBoomerang ? weapon.id : undefined, // Track which weapon this belongs to
          life: isBoomerang ? 10.0 : undefined, // Long life for boomerang to complete round trip
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
          maxDist: isBoomerang ? (weapon.boomerangMaxDist || 250) : undefined,
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
            maxDist: isBoomerang ? (weapon.boomerangMaxDist || 250) : undefined,
            isBone: weapon.id === "bone", // Mark bone bullets for rotation
            life: weapon.id === "bone" ? 4.0 : undefined, // Longer life for bone bullets
          });
        }
      }

      // Only set weapon cooldown if it's NOT a boomerang weapon
      // Boomerang weapons get their cooldown when the boomerang returns
      if (!isBoomerang) {
        weapon.attackT = weapon.attackCooldown;
      }
    }
  }

  function spawnInteractable(s, kind) {
    const { w, h, padding } = s.arena;
    let x, y;
    let attempts = 0;
    const maxAttempts = 50;
    
    // Try to find a walkable position
    do {
      // For chests, spawn in random rooms across the level for better distribution
      if (kind === INTERACT.CHEST && s.levelData && s.levelData.rooms && s.levelData.rooms.length > 0) {
        // Pick a random room
        const room = s.levelData.rooms[Math.floor(Math.random() * s.levelData.rooms.length)];
        // Spawn in the center area of the room
        x = room.x + rand(room.w * 0.3, room.w * 0.7);
        y = room.y + rand(room.h * 0.3, room.h * 0.7);
      } else if (s.levelData && s.levelData.rooms && s.levelData.rooms.length > 0) {
        // For other interactables, try to spawn in a random room first
        const room = s.levelData.rooms[Math.floor(Math.random() * s.levelData.rooms.length)];
        x = room.x + rand(room.w * 0.3, room.w * 0.7);
        y = room.y + rand(room.h * 0.3, room.h * 0.7);
      } else if (s.levelData) {
        // Fallback to level bounds
        x = rand(padding + 60, s.levelData.w - padding - 60);
        y = rand(padding + 60, s.levelData.h - padding - 60);
      } else {
        // Fallback to arena bounds
        x = rand(padding + 60, w - padding - 60);
        y = rand(padding + 60, h - padding - 60);
      }
      
      // Ensure position is walkable
      if (s.levelData && isPointWalkable(x, y, s.levelData, 20)) {
        break; // Found walkable position
      }
      
      attempts++;
    } while (attempts < maxAttempts);
    
    // If still not walkable after max attempts, find nearest walkable position
    if (s.levelData && !isPointWalkable(x, y, s.levelData, 20)) {
      const walkable = findNearestWalkable(x, y, s.levelData, 20);
      x = walkable.x;
      y = walkable.y;
    }

    let cost = 0;
    if (kind === INTERACT.CHEST) cost = chestCost(s.chestOpens, s.floor);
    // Shrines are now free (repurposed as permanent buff stations)
    if (kind === INTERACT.MICROWAVE) cost = 0; // Free
    if (kind === INTERACT.GREED) cost = Math.round(8 + s.floor * 2);
    if (kind === INTERACT.SHRINE) cost = 0; // Free
    if (kind === INTERACT.MAGNET_SHRINE) cost = 0; // Free (but these won't spawn anymore)
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
        // Use random selection from weapon-specific upgrade types
        let weaponUpgradeType = "";
        let selectedUpgradeType = null;
        if (bucket === TYPE.WEAPON) {
          const existingWeapon = s.player.weapons?.find(w => w.id === entry.id);
          if (existingWeapon) {
            const weaponId = existingWeapon.id;
            
            // Get weapon-specific upgrade cycle
            let upgradeTypes = [];
            if (weaponId === "bananarang") {
              upgradeTypes = ["range", "attackSpeed", "damage", "returnSpeed"];
            } else if (weaponId === "bone") {
              upgradeTypes = ["projectile", "damage", "attackSpeed", "rotationSpeed"];
            } else if (weaponId === "flamewalker") {
              upgradeTypes = ["radius", "damage", "attackSpeed", "duration"];
            } else if (weaponId === "poison_flask") {
              upgradeTypes = ["projectile", "damage", "attackSpeed", "splashRadius"];
            } else if (weaponId === "revolver" || weaponId === "bow" || weaponId === "lightning_staff") {
              upgradeTypes = ["projectile", "damage", "attackSpeed", "bulletSpeed"];
            } else if (existingWeapon.weaponMode === "melee") {
              upgradeTypes = ["range", "damage", "attackSpeed", "knockback"];
            } else {
              upgradeTypes = ["projectile", "damage", "attackSpeed", "bulletSpeed"];
            }
            
            // Randomly select upgrade type
            const upgradeType = upgradeTypes[Math.floor(Math.random() * upgradeTypes.length)];
            selectedUpgradeType = upgradeType;
            
            // Generate description text for upgrade type
            if (upgradeType === "projectile") {
              weaponUpgradeType = "+1 Projectile";
            } else if (upgradeType === "damage") {
              weaponUpgradeType = "+6% Damage";
            } else if (upgradeType === "attackSpeed") {
              weaponUpgradeType = "+4% Attack Speed";
            } else if (upgradeType === "bulletSpeed") {
              weaponUpgradeType = "+4% Projectile Speed";
            } else if (upgradeType === "range") {
              if (weaponId === "bananarang") {
                weaponUpgradeType = "+30 Range";
              } else {
                weaponUpgradeType = "+8% Melee Range";
              }
            } else if (upgradeType === "returnSpeed") {
              weaponUpgradeType = "+15% Return Speed";
            } else if (upgradeType === "rotationSpeed") {
              weaponUpgradeType = "+20% Rotation Speed";
            } else if (upgradeType === "radius") {
              weaponUpgradeType = "+10% Aura Radius";
            } else if (upgradeType === "duration") {
              weaponUpgradeType = "+15% Burn Duration";
            } else if (upgradeType === "splashRadius") {
              weaponUpgradeType = "+12% Splash Radius";
            } else if (upgradeType === "knockback") {
              weaponUpgradeType = "+20% Knockback";
            }
          }
        }

        const preview = buildPreview(s, (pp) => {
          if (bucket === TYPE.WEAPON) applyWeapon(pp, entry, rarity, true, selectedUpgradeType);
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
            const bounceAdd = m < 1.5 ? 1 : 2;
            detailedDesc = `+${bounceAdd} Bounce to all weapons (${rarity})`;
          } else if (entry.id === "t_agility") {
            const amount = Math.round(14 * m);
            detailedDesc = `+${amount} Movement Speed (${rarity})`;
          }
        }

        // Create apply function with proper closure and error handling
        // Capture the upgrade type in the closure
        const capturedUpgradeType = selectedUpgradeType;
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
              
              // Use the captured upgrade type
              applyWeapon(p, entry, rarity, false, capturedUpgradeType);
              
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
          weaponUpgradeType: selectedUpgradeType, // Store the selected upgrade type
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
    // Ensure boss doesn't spawn on top of player
    const p = s.player;
    if (bossX !== null && bossY !== null) {
      // Check distance from player, if too close, offset
      const dist = Math.hypot(bossX - p.x, bossY - p.y);
      if (dist < 150) {
        // Too close, offset away from player
        const angle = Math.atan2(bossY - p.y, bossX - p.x);
        s.boss.x = p.x + Math.cos(angle) * 150;
        s.boss.y = p.y + Math.sin(angle) * 150;
      } else {
        s.boss.x = bossX;
        s.boss.y = bossY;
      }
    } else {
      // Spawn away from player if no teleporter
      const angle = Math.random() * Math.PI * 2;
      s.boss.x = p.x + Math.cos(angle) * 200;
      s.boss.y = p.y + Math.sin(angle) * 200;
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

      speedBase: 110, // Reduced from 200 for slower-paced gameplay
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
      maxShield: 0, // Maximum shield capacity from tomes
      iFrames: 0,

      abilityId: c.space.id,
      abilityCd: c.space.cd,
      abilityT: 0,
      abilityCdMult: 1, // Multiplier for ability cooldown reduction
      
      // Jump properties
      z: 0, // Vertical position (for isometric depth)
      jumpT: 0, // Jump timer (counts down)
      jumpV: 0, // Jump velocity (vertical)
      jumpVx: 0, // Jump horizontal velocity X
      jumpVy: 0, // Jump horizontal velocity Y
      jumpHeight: 1.0, // Jump height multiplier (upgradeable)
      jumpLandingGrace: 0, // Grace period after landing to prevent immediate collision

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
      consumables: [], // Consumable items dropped by enemies (Speed, Heal, Magnet potions)
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

      // Preserve explosive bullets (injected or seeking) and boomerang bullets when leveling up
      s.bullets = s.bullets.filter(b => 
        (b.explosive && ((b.injected && b.injectedEnemy) || (b.seeking && !b.injected))) ||
        (b.boomerang && b.t < b.life)
      );

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

    // Calculate damage after armor
    const dmg = mitigateDamage(amount, p.armor);
    
    // Shield blocks a percentage of damage (60-80% based on shield amount)
    if (p.shield > 0) {
      const shieldBlockPercent = Math.min(0.8, 0.6 + (p.shield / Math.max(1, p.maxShield || 50)) * 0.2); // 60-80% block
      const blockedDmg = dmg * shieldBlockPercent;
      const actualDmg = dmg - blockedDmg;
      
      // Shield: 1 hit = 1 charge removed (simplified)
      p.shield = Math.max(0, p.shield - 1);
      
      // Apply remaining damage to HP
      if (actualDmg > 0) {
        p.hp -= actualDmg;
        p.iFrames = 0.75;
        s.lastHitT = s.t;
      bumpShake(s, Math.min(7, shakeMag), shakeTime);
      if (hitStop > 0) s.hitStopT = Math.max(s.hitStopT, Math.min(0.02, hitStop));
        addParticle(s, p.x, p.y, 12, 200);
        recordDamage(p, src, Math.round(actualDmg));
      } else {
        // Shield blocked all damage
        p.iFrames = 0.6;
        bumpShake(s, Math.min(7, shakeMag * 0.7), shakeTime);
        if (hitStop > 0) s.hitStopT = Math.max(s.hitStopT, Math.min(0.02, hitStop * 0.7));
      addParticle(s, p.x, p.y, 12, 165);
        pushCombatText(s, p.x, p.y - 22, `SHIELD -${Math.round(blockedDmg)}`, "#9cffd6", { size: 12, life: 0.7 });
      recordDamage(p, `${src} (shield)`, 0);
      }
      return true;
    }

    // No shield - take full damage
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
      // Preserve explosive bullets (injected or seeking) and boomerang bullets when opening chest
      s.bullets = s.bullets.filter(b => 
        (b.explosive && ((b.injected && b.injectedEnemy) || (b.seeking && !b.injected))) ||
        (b.boomerang && b.t < b.life)
      );

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
      // Shrine repurposed as permanent buff station - gives small permanent stat boost
      // Can be used multiple times, but with diminishing returns
      const statBoost = 0.02; // 2% permanent boost
      p.weaponDamage = (p.weaponDamage || 1) * (1 + statBoost);
      p.maxHp = Math.round((p.maxHp || 100) * (1 + statBoost));
      p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * statBoost));
      bumpShake(s, 2, 0.06);
      addParticle(s, p.x, p.y, 20, 200, { size: 3, speed: 1.2 });
      pushCombatText(s, p.x, p.y - 30, "+2% STATS", "#ffd44a", { size: 16, life: 1.2 });
      // Shrine doesn't disappear - can be used multiple times
      return;
    }

    if (best.kind === INTERACT.MICROWAVE) {
      // Microwave repurposed as permanent HP boost station
      const hpBoost = Math.round(p.maxHp * 0.05); // 5% max HP boost
      p.maxHp = Math.round(p.maxHp + hpBoost);
      p.hp = Math.min(p.maxHp, p.hp + hpBoost);
      addParticle(s, p.x, p.y, 18, 160);
      pushCombatText(s, p.x, p.y - 30, `+${hpBoost} MAX HP`, "#4dff88", { size: 16, life: 1.2 });
      // Microwave doesn't disappear - can be used multiple times
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
    
    // For quickdraw ability, check if there's already an active seeking explosive bullet
    if (p.abilityId === "quickdraw") {
      // Check if there's an active explosive bullet that's seeking (not yet injected)
      const hasActiveSeekingBullet = s.bullets.some(b => 
        b.explosive && b.seeking && !b.injected && b.playerAbilityRef === p
      );
      if (hasActiveSeekingBullet) {
        // Already have a bullet seeking, can't use ability again yet
        return;
      }
    }
    

    const keys = keysRef.current;
    let mx = (keys.has("ArrowRight") || keys.has("d") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("a") ? 1 : 0);
    let my = (keys.has("ArrowDown") || keys.has("s") ? 1 : 0) - (keys.has("ArrowUp") || keys.has("w") ? 1 : 0);
    
    // Transform input directions for isometric mode
    let ux, uy;
    if (ISO_MODE && (mx !== 0 || my !== 0)) {
      const transformed = transformInputForIsometric(mx, my);
      ux = transformed.x;
      uy = transformed.y;
    } else {
    const len = Math.hypot(mx, my) || 1;
      ux = len ? mx / len : 1;
      uy = len ? my / len : 0;
    }

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

    // ALTERNATIVE COWBOY SPECIAL POWERS (for future implementation):
    // 1. "Fan the Hammer" - Rapid fire 6-8 shots in a cone toward nearest enemy (high damage, focused)
    // 2. "Dead Eye" - Time slows by 50% for 3 seconds, all shots guaranteed crits
    // 3. "Ricochet Shot" - One massive damage shot that bounces between 5-8 enemies
    // 4. "High Noon" - Lock onto all visible enemies, then fire powerful shots at each simultaneously
    // 5. "Duel" - Single massive damage shot (3-4x weapon damage) at nearest enemy with guaranteed crit
    // 6. "Bullet Storm" - Continuous rapid fire in all directions for 2 seconds (damage over time)
    // 7. "Showdown" - Mark all enemies in range, after 1 second all marked enemies take massive damage
    // 8. "Trick Shot" - Fire 3 shots that curve and seek nearest enemies
    
    if (p.abilityId === "quickdraw") {
      // Explosive Shot: Injects onto an enemy, then explodes after 2 seconds
      const tgt = acquireTarget(s, p.x, p.y);
      if (tgt) {
        const dx = tgt.x - p.x;
        const dy = tgt.y - p.y;
        const angle = Math.atan2(dy, dx);
        
        // Reduced damage (1.2x total weapon damage instead of 2.5x)
        const totalDmg = (p.weapons ? p.weapons.reduce((sum, w) => sum + w.weaponDamage, 0) : 0) * 1.2;
        // Guaranteed crit for explosive shot
        const dmg = totalDmg * 1.6;
        
        // Fire one large explosive bullet that seeks enemies
        const explosiveBullet = shootBullet(s, p.x, p.y, angle, dmg, 100, { // Very slow for visibility
          r: 7.0, // Large bullet
          pierce: 0, // No pierce - it will stick to enemy
          color: "#ffaa00", // Orange/gold color
          crit: true, // Always crit
          knock: 0, // No knockback on hit (will explode later)
          bounces: 0,
          effect: null,
          life: 12.0, // Longer life since it's very slow
        });
        
        // Mark this bullet as injectable explosive
        explosiveBullet.explosive = true;
        explosiveBullet.injected = false; // Not yet injected onto enemy
        explosiveBullet.injectedEnemy = null; // Will store reference to enemy
        explosiveBullet.explodeAfter = 2.0; // Explode 2 seconds after injection
        explosiveBullet.explosionRadius = 120; // Large explosion radius
        explosiveBullet.explosionDmg = dmg * 0.8; // Explosion damage (reduced from 1.2x)
        explosiveBullet.seeking = true; // Bullet seeks nearest enemy
        explosiveBullet.playerAbilityRef = p; // Store player reference for cooldown start on injection
        
        // DON'T start cooldown here - it will start when bullet injects onto enemy
        // Ability is disabled while seeking (checked in useAbility function)
      } else {
        // No target found - still fire bullet (it will seek when enemies spawn)
        // But don't start cooldown yet - wait for it to hit something
        const explosiveBullet = shootBullet(s, p.x, p.y, 0, dmg, 100, {
          r: 7.0,
          pierce: 0,
          color: "#ffaa00",
          crit: true,
          knock: 0,
          bounces: 0,
          effect: null,
          life: 12.0,
        });
        
        explosiveBullet.explosive = true;
        explosiveBullet.injected = false;
        explosiveBullet.injectedEnemy = null;
        explosiveBullet.explodeAfter = 2.0;
        explosiveBullet.explosionRadius = 120;
        explosiveBullet.explosionDmg = dmg * 0.8;
        explosiveBullet.seeking = true;
        explosiveBullet.playerAbilityRef = p;
      }
      
      // Visual effects
      addParticle(s, p.x, p.y, 20, 40);
      playBeep({ type: "square", f0: 200, f1: 120, dur: 0.12, gain: 0.18, pan: 0 }); // Deeper, more powerful sound
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
      if (ISO_MODE) {
        // In isometric mode, camera is at player position (we convert to isometric when rendering)
        s.camera = { x: p.x, y: p.y };
      } else {
        // In top-down mode, camera is offset to center player on screen
        s.camera = { x: p.x - w / 2, y: p.y - h / 2 };
      }
    }
    
    // Update camera to follow player
    if (ISO_MODE) {
      // In isometric mode, camera follows player directly (no offset)
      // We'll convert to isometric and center when rendering
      s.camera.x = lerp(s.camera.x, p.x, dt * 4);
      s.camera.y = lerp(s.camera.y, p.y, dt * 4);
    } else {
      // In top-down mode, camera is offset to center player on screen
      const targetX = p.x - w / 2;
      const targetY = p.y - h / 2;
      s.camera.x = lerp(s.camera.x, targetX, dt * 4);
      s.camera.y = lerp(s.camera.y, targetY, dt * 4);
      
      // Clamp camera to level bounds (only needed for top-down mode)
      if (s.levelData) {
        s.camera.x = clamp(s.camera.x, 0, Math.max(0, s.levelData.w - w));
        s.camera.y = clamp(s.camera.y, 0, Math.max(0, s.levelData.h - h));
      }
    }

    s.t += dt;

    const intensity = clamp(1 - s.stageLeft / s.stageDur, 0, 1);
    tickMusic(dt, intensity);
    
    // Generate Flow Field once per frame (Dijkstra Map from player position)
    // RESET STATE: Ensure old pathfindingGrid is completely overwritten (already handled by level generation)
    if (s.levelData && s.levelData.pathfindingGrid) {
      // #region agent log
      const gridType = s.levelData.pathfindingGrid?.constructor?.name;
      const isArray = Array.isArray(s.levelData.pathfindingGrid);
      const hasLength = typeof s.levelData.pathfindingGrid?.length === 'number';
      if (Math.random() < 0.1) {
        fetch('http://127.0.0.1:7242/ingest/f7ace1fb-1ecf-4f19-b232-cce80869f22f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'update:before_gen',message:'Before flow field generation',data:{playerX:p.x,playerY:p.y,hasGrid:!!s.levelData?.pathfindingGrid,gridType,isArray,hasLength,gridLength:s.levelData.pathfindingGrid?.length,firstRowIsArray:Array.isArray(s.levelData.pathfindingGrid?.[0])},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
      }
      // #endregion
      try {
        s.flowFieldData = generateFlowField(
          p.x,
          p.y,
          s.levelData.pathfindingGrid,
          s.levelData.pathfindingGridSize || 10
        );
        // #region agent log
        if (Math.random() < 0.1) {
          fetch('http://127.0.0.1:7242/ingest/f7ace1fb-1ecf-4f19-b232-cce80869f22f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'update:flow_field_gen',message:'Flow field generated',data:{playerX:p.x,playerY:p.y,hasFlowField:!!s.flowFieldData,hasGrid:!!s.levelData?.pathfindingGrid,gridSize:s.levelData?.pathfindingGridSize},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'A'})}).catch(()=>{});
        }
        // #endregion
      } catch (error) {
        // Flow field generation failed - log error and set to null
        console.error('Flow field generation error:', error);
        s.flowFieldData = null;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f7ace1fb-1ecf-4f19-b232-cce80869f22f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'update:flow_field_error',message:'Flow field generation failed',data:{error:error.message,playerX:p.x,playerY:p.y},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      }
    } else {
      s.flowFieldData = null;
      // #region agent log
      if (Math.random() < 0.1) {
        fetch('http://127.0.0.1:7242/ingest/f7ace1fb-1ecf-4f19-b232-cce80869f22f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'update:no_flow_field',message:'Flow field not generated',data:{hasLevelData:!!s.levelData,hasGrid:!!s.levelData?.pathfindingGrid},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'A'})}).catch(()=>{});
      }
      // #endregion
    }

    if (s.shakeT > 0) s.shakeT = Math.max(0, s.shakeT - dt);
    // hitStopT is now handled in the render loop to prevent freeze

    if (p.iFrames > 0) p.iFrames = Math.max(0, p.iFrames - dt);
    if (p.buffHasteT > 0) p.buffHasteT = Math.max(0, p.buffHasteT - dt);
    
    // Update jump physics
    if (p.jumpT > 0) {
      p.jumpT = Math.max(0, p.jumpT - dt);
      if (p.jumpV !== undefined) {
        // Apply gravity
        p.jumpV -= 800 * dt; // Gravity acceleration
        if (p.z === undefined) p.z = 0;
        p.z += p.jumpV * dt;
        
        // Apply horizontal jump velocity for diagonal jump arc
        if (p.jumpVx !== undefined && p.jumpVy !== undefined && (p.jumpVx !== 0 || p.jumpVy !== 0)) {
          // Check if new position with jump velocity is walkable
          const newJumpX = p.x + p.jumpVx * dt;
          const newJumpY = p.y + p.jumpVy * dt;
          
          // Apply jump movement with collision checks
          if (s.levelData) {
            // Try X movement first
            if (isPointWalkable(newJumpX, p.y, s.levelData, p.r || 12)) {
              p.x = newJumpX;
            }
            // Then try Y movement
            if (isPointWalkable(p.x, newJumpY, s.levelData, p.r || 12)) {
              p.y = newJumpY;
            }
          } else {
            // Fallback: no level data, allow movement
            p.x = newJumpX;
            p.y = newJumpY;
          }
          
          // Gradually reduce horizontal velocity (air resistance)
          p.jumpVx *= (1 - dt * 2.5); // Decay over time
          p.jumpVy *= (1 - dt * 2.5);
          
          // Stop horizontal velocity if it's very small
          if (Math.abs(p.jumpVx) < 1) p.jumpVx = 0;
          if (Math.abs(p.jumpVy) < 1) p.jumpVy = 0;
        }
        
      // Ground check
      if (p.z < 0) {
        p.z = 0;
        p.jumpV = 0;
        p.jumpT = 0;
        p.jumpVx = 0;
        p.jumpVy = 0;
        p.jumpLandingGrace = 0.15;
      }
      }
    } else if (p.z !== undefined && p.z > 0) {
      // Fall down if not jumping
      p.jumpV = (p.jumpV || 0) - 800 * dt;
      p.z += p.jumpV * dt;
      
      // Apply remaining horizontal velocity during fall
      if (p.jumpVx !== undefined && p.jumpVy !== undefined && (p.jumpVx !== 0 || p.jumpVy !== 0)) {
        const newJumpX = p.x + p.jumpVx * dt;
        const newJumpY = p.y + p.jumpVy * dt;
        
        // Apply jump movement with collision checks
        if (s.levelData) {
          // Try X movement first
          if (isPointWalkable(newJumpX, p.y, s.levelData, p.r || 12)) {
            p.x = newJumpX;
          }
          // Then try Y movement
          if (isPointWalkable(p.x, newJumpY, s.levelData, p.r || 12)) {
            p.y = newJumpY;
          }
        } else {
          // Fallback: no level data, allow movement
          p.x = newJumpX;
          p.y = newJumpY;
        }
        
        // Gradually reduce horizontal velocity
        p.jumpVx *= (1 - dt * 2.5);
        p.jumpVy *= (1 - dt * 2.5);
        
        if (Math.abs(p.jumpVx) < 1) p.jumpVx = 0;
        if (Math.abs(p.jumpVy) < 1) p.jumpVy = 0;
      }
      
      // Ground check during fall
      if (p.z < 0) {
        p.z = 0;
        p.jumpV = 0;
        p.jumpVx = 0;
        p.jumpVy = 0;
        p.jumpLandingGrace = 0.15;
      }
    } else {
      // On ground, ensure z is 0
      if (p.z === undefined || p.z > 0) {
        p.z = 0;
      }
      // Clear horizontal jump velocity
      if (p.jumpVx !== undefined) p.jumpVx = 0;
      if (p.jumpVy !== undefined) p.jumpVy = 0;
    }
    
    // Update landing grace period
    if (p.jumpLandingGrace > 0) {
      p.jumpLandingGrace = Math.max(0, p.jumpLandingGrace - dt);
    }
    // Magnet shrine effect countdown
    if (p.magnetT > 0) {
      p.magnetT = Math.max(0, p.magnetT - dt);
      if (p.magnetT <= 0) {
        p.magnet = 1; // Reset to base magnet when effect ends
      }
    }
    // Gold boost effect countdown
    if (p.goldBoostT > 0) {
      p.goldBoostT = Math.max(0, p.goldBoostT - dt);
      if (p.goldBoostT <= 0) {
        p.goldBoostMult = 1; // Reset to base gold gain when effect ends
      }
    }
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
    let mx = (keys.has("ArrowRight") || keys.has("d") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("a") ? 1 : 0);
    let my = (keys.has("ArrowDown") || keys.has("s") ? 1 : 0) - (keys.has("ArrowUp") || keys.has("w") ? 1 : 0);
    
    // Transform input directions for isometric mode
    let dirX, dirY;
    if (ISO_MODE && (mx !== 0 || my !== 0)) {
      const transformed = transformInputForIsometric(mx, my);
      dirX = transformed.x;
      dirY = transformed.y;
    } else {
    const len = Math.hypot(mx, my) || 1;
      dirX = len ? mx / len : 1;
      dirY = len ? my / len : 0;
    }

    const baseV = computeSpeed(p);
    const baseVx = dirX * baseV;
    const baseVy = dirY * baseV;
    
    // Apply knockback (decay over time)
    if (!p.knockbackVx) p.knockbackVx = 0;
    if (!p.knockbackVy) p.knockbackVy = 0;
    // Decay knockback velocity
    p.knockbackVx *= (1 - dt * 4.0); // Decay rate
    p.knockbackVy *= (1 - dt * 4.0);
    // Stop if very small
    if (Math.abs(p.knockbackVx) < 1) p.knockbackVx = 0;
    if (Math.abs(p.knockbackVy) < 1) p.knockbackVy = 0;

    // Try to move player (movement + knockback)
    // Separate movement and knockback to ensure knockback respects walls
    const playerRadius = p.r || 12;
    
    // First, try regular movement
    const newX = p.x + baseVx * dt;
    const newY = p.y + baseVy * dt;
    
    // Check collision for X movement
    if (s.levelData) {
      if (isPointWalkable(newX, p.y, s.levelData, playerRadius)) {
        p.x = newX;
      }
      // Check collision for Y movement
      if (isPointWalkable(p.x, newY, s.levelData, playerRadius)) {
        p.y = newY;
      }
    } else {
      // Fallback: no level data, allow movement
      p.x = newX;
      p.y = newY;
    }
    
    // Apply knockback, but only if it doesn't push through walls
    if (p.knockbackVx !== 0 || p.knockbackVy !== 0) {
      const knockbackX = p.x + p.knockbackVx * dt;
      const knockbackY = p.y + p.knockbackVy * dt;
      
      if (s.levelData) {
        // Try knockback X movement
        if (isPointWalkable(knockbackX, p.y, s.levelData, playerRadius)) {
          p.x = knockbackX;
        } else {
          // Knockback hit a wall, stop knockback in that direction
          p.knockbackVx = 0;
        }
        // Try knockback Y movement
        if (isPointWalkable(p.x, knockbackY, s.levelData, playerRadius)) {
          p.y = knockbackY;
        } else {
          // Knockback hit a wall, stop knockback in that direction
          p.knockbackVy = 0;
        }
      } else {
        // Fallback: apply knockback
        p.x = knockbackX;
        p.y = knockbackY;
      }
    }
    
    // Final safety check: if player ended up in a wall, find nearest walkable position
    if (s.levelData && !isPointWalkable(p.x, p.y, s.levelData, playerRadius)) {
      const walkable = findNearestWalkable(p.x, p.y, s.levelData, playerRadius);
      p.x = walkable.x;
      p.y = walkable.y;
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
          let dmg = e.burnDps * dt;
          // Elite armor reduces DoT damage too
          if (e.isElite && e.eliteArmor > 0) {
            dmg *= (1 - e.eliteArmor);
          }
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

      // Initialize enemy state if needed
      if (!e.state) e.state = "idle"; // idle, alert, lost
      if (!e.lostSightT) e.lostSightT = 0;

      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      
      // Line of sight check (only check if within reasonable distance)
      const hasLOS = d < 800 && hasLineOfSight(e.x, e.y, p.x, p.y, s.levelData, 10);
      
      // FLOW FIELD PATHFINDING - Use flow field direction (no direct player reference)
      let moveDirX = 0;
      let moveDirY = 0;
      
      // Get movement direction from flow field
      if (s.flowFieldData) {
        const flowDir = getFlowDirection(e.x, e.y, s.flowFieldData);
        moveDirX = flowDir.x;
        moveDirY = flowDir.y;
        // #region agent log
        if (Math.random() < 0.01) { // Sample 1% of enemies to avoid log spam
          fetch('http://127.0.0.1:7242/ingest/f7ace1fb-1ecf-4f19-b232-cce80869f22f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'enemy:flow_field',message:'Enemy using flow field',data:{enemyX:e.x,enemyY:e.y,flowDirX:flowDir.x,flowDirY:flowDir.y,moveDirX,moveDirY},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        }
        // #endregion
      } else {
        // No flow field - fallback to direct movement
        moveDirX = dx / d;
        moveDirY = dy / d;
        // #region agent log
        if (Math.random() < 0.01) { // Sample 1% of enemies
          fetch('http://127.0.0.1:7242/ingest/f7ace1fb-1ecf-4f19-b232-cce80869f22f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'enemy:fallback',message:'Enemy using fallback direct movement',data:{enemyX:e.x,enemyY:e.y,hasFlowField:!!s.flowFieldData,moveDirX,moveDirY},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        }
        // #endregion
      }
      
      const ux = moveDirX;
      const uy = moveDirY;

        // Calculate movement speed
        const slowMult = e.slowT > 0 ? (e.slowMult || 0.5) : 1.0;
        let moveSpeed = e.speed * dt * slowMult;

      if (e.tier === "spitter") {
        e.spitT = Math.max(0, e.spitT - dt);
        const desired = 240;
        const push = d < desired ? -1 : 1;
          moveSpeed *= 0.62 * push;
        }
        
        // Track enemy position for stuck detection
        if (!e.lastX) e.lastX = e.x;
        if (!e.lastY) e.lastY = e.y;
        if (!e.stuckT) e.stuckT = 0;
        
        // Check if enemy is stuck (hasn't moved much - more sensitive detection)
        const movedDist = Math.hypot(e.x - e.lastX, e.y - e.lastY);
        if (movedDist < 2) { // More sensitive - detect stuck faster
          e.stuckT += dt;
        } else {
          e.stuckT = 0; // Reset stuck timer if moving
        }
        
        // Try to move in desired direction
        const newEx = e.x + ux * moveSpeed;
        const newEy = e.y + uy * moveSpeed;
        
        // Move enemy with collision checks (same system as player)
        const enemyRadius = e.r || 14;
        let movedX = false;
        let movedY = false;
        
        if (s.levelData) {
          // Try diagonal movement first (better for corners)
          if (isPointWalkable(newEx, newEy, s.levelData, enemyRadius)) {
            e.x = newEx;
            e.y = newEy;
            movedX = true;
            movedY = true;
          } else {
            // Diagonal blocked, try X and Y separately
            if (isPointWalkable(newEx, e.y, s.levelData, enemyRadius)) {
              e.x = newEx;
              movedX = true;
            }
            if (isPointWalkable(e.x, newEy, s.levelData, enemyRadius)) {
              e.y = newEy;
              movedY = true;
            }
            
            // If stuck at corner, try wall sliding (perpendicular movement)
            if (!movedX && !movedY && e.stuckT > 0.1) {
              // Try moving perpendicular to desired direction (wall sliding)
              const perpX = e.x + uy * moveSpeed * 0.8;
              const perpY = e.y - ux * moveSpeed * 0.8;
              if (isPointWalkable(perpX, perpY, s.levelData, enemyRadius)) {
                e.x = perpX;
                e.y = perpY;
                movedX = true;
                movedY = true;
              } else {
                // Try opposite perpendicular
                const perpX2 = e.x - uy * moveSpeed * 0.8;
                const perpY2 = e.y + ux * moveSpeed * 0.8;
                if (isPointWalkable(perpX2, perpY2, s.levelData, enemyRadius)) {
                  e.x = perpX2;
                  e.y = perpY2;
                  movedX = true;
                  movedY = true;
                }
              }
            }
          }
        } else {
          // Fallback: no level data, allow movement
          e.x = newEx;
          e.y = newEy;
          movedX = true;
          movedY = true;
        }
        
        // Final safety check: if enemy ended up in a wall, find nearest walkable position
        if (s.levelData && !isPointWalkable(e.x, e.y, s.levelData, enemyRadius)) {
          const walkable = findNearestWalkable(e.x, e.y, s.levelData, enemyRadius);
          e.x = walkable.x;
          e.y = walkable.y;
        }
        
        e.lastX = e.x;
        e.lastY = e.y;

        // Spitter shooting (only if we have line of sight)
        if (e.tier === "spitter" && d < 460 && e.spitT <= 0 && hasLOS) {
          const a = Math.atan2(dy, dx);
          shootBullet(s, e.x, e.y, a, 14 + s.floor * 0.95, 470, { enemy: true, r: 7.2, life: 2.2, color: "#ff5d5d" });
          e.spitT = 1.05;
      }

      // Clamp enemies to level bounds
      if (s.levelData) {
        e.x = clamp(e.x, padding, s.levelData.w - padding);
        e.y = clamp(e.y, padding, s.levelData.h - padding);
      } else {
      e.x = clamp(e.x, padding, w - padding);
      e.y = clamp(e.y, padding, h - padding);
      }

      // Always check collision - resolveKinematicCircleOverlap handles jump safety
      // Only skip if in landing grace period
      if (p.jumpLandingGrace !== undefined && p.jumpLandingGrace > 0) {
        // Just landed, skip collision during grace period
      } else {
        const overlapped = resolveKinematicCircleOverlap(p, e, levelBounds, s.levelData);
        
        // Melee damage: Only apply to melee enemies (brute, runner, tank, and default/grunt) when actually overlapping
        // Ranged enemies (spitter, shocker) should not deal contact damage
        // Default enemy type (grunt) is melee - all enemies except spitter and shocker can melee
        const checkBrute = e.tier === "brute";
        const checkRunner = e.tier === "runner";
        const checkTank = e.tier === "tank";
        const checkNotRanged = (e.tier !== "spitter" && e.tier !== "shocker");
        const isMeleeEnemy = checkBrute || checkRunner || checkTank || checkNotRanged;
        
        // #region agent log
        if (e.r <= 15) {
          const dx = p.x - e.x;
          const dy = p.y - e.y;
          const dist = Math.hypot(dx, dy);
          const pVisualR = getVisualCubeRadius(p.r || 14);
          const eVisualR = getVisualCubeRadius(e.r);
          const canDamage = overlapped && isMeleeEnemy && (e.contactCd === undefined || e.contactCd <= 0);
          fetch('http://127.0.0.1:7242/ingest/f7ace1fb-1ecf-4f19-b232-cce80869f22f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'enemy:damage_check',message:'Damage check for small enemy',data:{tier:e.tier,enemyR:e.r,enemyVisualR:eVisualR,playerR:p.r||14,playerVisualR:pVisualR,overlapped,isMeleeEnemy,checkBrute,checkRunner,checkTank,checkNotRanged,contactCd:e.contactCd,dist:dist.toFixed(2),minDist:(pVisualR+eVisualR).toFixed(2),canDamage,blockedByOverlap:!overlapped,blockedByMelee:!isMeleeEnemy,blockedByCooldown:(e.contactCd!==undefined&&e.contactCd>0)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H5'})}).catch(()=>{});
        }
        // #endregion
        
        // Apply damage if overlapping, is melee enemy, and cooldown is ready
        // Note: overlapped is true when visual cubes are touching (from resolveKinematicCircleOverlap)
        // If enemy is pushing player, they should be able to deal damage
        // Check contactCd with undefined safety
        // If overlapped is true, that means visual cubes are touching, so damage should apply
        // No need for additional distance check - overlapped already confirms they're touching
        if (overlapped && isMeleeEnemy && (e.contactCd === undefined || e.contactCd <= 0)) {
          // #region agent log
          if (e.r <= 15) fetch('http://127.0.0.1:7242/ingest/f7ace1fb-1ecf-4f19-b232-cce80869f22f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'enemy:damage_applied',message:'Damage being applied to player',data:{tier:e.tier,enemyR:e.r,enemyVisualR:getVisualCubeRadius(e.r),playerR:p.r||14,playerVisualR:getVisualCubeRadius(p.r||14),damage:((18+s.floor*0.9)*0.5).toFixed(1)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          const dx = p.x - e.x;
          const dy = p.y - e.y;
          const dist = Math.hypot(dx, dy) || 1;
          // Enemy is overlapping and close enough - apply damage and knockback
          
          const xNorm = clamp((p.x / (s.arena.w || 1)) * 2 - 1, -1, 1);
          // Elite enemies deal more contact damage (but half damage for contact)
          const baseDmg = 18 + s.floor * 0.9;
          const eliteDmgMult = e.isElite ? (e.eliteAbility === "rage" ? 1 + (1 - e.hp / e.maxHp) * 0.5 : 1.3) : 1;
          const contactDmg = (baseDmg * eliteDmgMult) * 0.5; // Half damage for contact
          const did = applyPlayerDamage(s, contactDmg, `${e.tier} contact`, { shakeMag: 1.6, shakeTime: 0.06, hitStop: 0, fromX: e.x, fromY: e.y });
          if (did) sfxHit(xNorm);
          e.contactCd = 0.6; // Reduced from 0.95 to allow more frequent hits when in contact
          
          // Apply knockback to player (away from enemy)
          const knockbackForce = 90; // Reduced from 180 for less aggressive knockback
          if (!p.knockbackVx) p.knockbackVx = 0;
          if (!p.knockbackVy) p.knockbackVy = 0;
          p.knockbackVx += ((p.x - e.x) / dist) * knockbackForce;
          p.knockbackVy += ((p.y - e.y) / dist) * knockbackForce;
          
          // Push enemy back slightly
          e.x += ((e.x - p.x) / dist) * 22;
          e.y += ((e.y - p.y) / dist) * 22;
        }
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
      
      // Update rotation for boomerang (bananarang) - spinning effect
      if (b.boomerang) {
        if (!b.rotation) b.rotation = 0;
        b.rotation += dt * 12; // Fast spinning for visibility
      }
      
      // Boomerang return logic
      if (b.boomerang && !b.enemy) {
        const distFromStart = Math.hypot(b.x - b.startX, b.y - b.startY);
        const distFromPlayer = Math.hypot(b.x - p.x, b.y - p.y);
        
        // Track if we're in return phase
        // Return if: traveled max distance OR been alive for 3 seconds (fallback)
        if (!b.returning) {
          const wasReturning = b.returning;
          b.returning = distFromStart > b.maxDist || b.t > 3.0;
          // When starting to return, create a separate set for return hits
          if (b.returning && !wasReturning) {
            b.returnHitEnemies = new Set(); // Track enemies hit on return trip
          }
        }
        
        if (b.returning) {
          // Return to player with fixed speed (don't multiply - use original bullet speed)
          const dx = p.x - b.x;
          const dy = p.y - b.y;
          const dist = Math.hypot(dx, dy) || 1;
          // Use the original bullet speed (stored when created) with weapon's return speed multiplier
          const baseReturnSpeed = b.originalSpeed || 400;
          // Get return speed multiplier from weapon if available
          const weapon = p.weapons?.find(w => w.id === b.weaponId);
          const returnSpeedMult = weapon?.boomerangReturnSpeedMult || 1;
          const returnSpeed = baseReturnSpeed * returnSpeedMult;
          b.vx = (dx / dist) * returnSpeed;
          b.vy = (dy / dist) * returnSpeed;
        }
        
        // If close enough to player during return phase, destroy bullet and start weapon cooldown
        // BUT don't destroy explosive bullets (they need to inject onto enemies)
        if (distFromPlayer < 25 && b.returning && !b.explosive) {
          // Destroy the bullet first
          b.t = b.life + 1;
          
          // Start weapon cooldown when banana returns
          if (b.weaponId === "bananarang") {
            const weapon = p.weapons?.find(w => w.id === "bananarang");
            if (weapon) {
              weapon.attackT = 2.0; // 2 second cooldown after return
            }
          }
          continue;
        }
        // If not returning yet, bullet continues with its original velocity (handled in normal movement below)
      }
      
      // Handle explosive bullets that seek and inject onto enemies
      if (b.explosive && !b.injected && b.seeking) {
        // Find nearest enemy to seek
        let nearestEnemy = null;
        let nearestD2 = Infinity;
        for (const ee of s.enemies) {
          if (ee.hp <= 0) continue;
          const d2 = dist2(ee.x, ee.y, b.x, b.y);
          if (d2 < nearestD2) {
            nearestD2 = d2;
            nearestEnemy = ee;
          }
        }
        // Also check boss
        if (s.boss.active && s.boss.hp > 0) {
          const bossD2 = dist2(s.boss.x, s.boss.y, b.x, b.y);
          if (bossD2 < nearestD2) {
            nearestEnemy = s.boss;
          }
        }
        
        // Home in on nearest enemy
        if (nearestEnemy) {
          const dx = nearestEnemy.x - b.x;
          const dy = nearestEnemy.y - b.y;
          const dist = Math.hypot(dx, dy) || 1;
          const speed = Math.hypot(b.vx, b.vy);
          // Gradually turn toward target
          const turnRate = 8.0; // How fast it turns (radians per second)
          const currentAngle = Math.atan2(b.vy, b.vx);
          const targetAngle = Math.atan2(dy, dx);
          let angleDiff = targetAngle - currentAngle;
          // Normalize angle difference to [-PI, PI]
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          const newAngle = currentAngle + clamp(angleDiff, -turnRate * dt, turnRate * dt);
          b.vx = Math.cos(newAngle) * speed;
          b.vy = Math.sin(newAngle) * speed;
        } else {
          // No target found - bullet should just continue moving in its current direction
          // It will expire after maxSeekTime (handled in bullet filter)
          // Don't do anything special, just let it move normally
        }
      }
      
      // If injected, follow the enemy's position
      if (b.explosive && b.injected && b.injectedEnemy) {
        // Check if enemy still exists and is alive
        if (b.injectedEnemy.hp > 0) {
          b.x = b.injectedEnemy.x;
          b.y = b.injectedEnemy.y;
          // Countdown to explosion
          b.explodeAfter -= dt;
          
          // Add visual tick effect - pulsing particles during countdown
          if (Math.random() < 0.4) { // 40% chance per frame to add particle
            const angle = Math.random() * Math.PI * 2;
            const dist = b.injectedEnemy.r + 5;
            s.particles.push({
              x: b.injectedEnemy.x + Math.cos(angle) * dist,
              y: b.injectedEnemy.y + Math.sin(angle) * dist,
              vx: Math.cos(angle) * 25,
              vy: Math.sin(angle) * 25,
              r: 3,
              t: 0,
              life: 0.4,
              hue: 40, // Orange
              glow: true,
            });
          }
        } else {
          // Enemy died, explode immediately
          b.explodeAfter = 0;
        }
      } else {
        // Normal bullet movement
        const newX = b.x + b.vx * dt;
        const newY = b.y + b.vy * dt;
        
        // Check wall collision for all bullets (they can't go through walls)
        if (s.levelData) {
          // Use bullet radius for wall check
          const bulletRadius = b.r || 4;
          if (!isPointWalkable(newX, newY, s.levelData, bulletRadius)) {
            // Hit a wall, destroy bullet
            // For splash weapons, trigger splash damage on wall hit
            if (!b.enemy && b.splashR > 0) {
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
            b.t = b.life + 1;
            continue;
          }
        }
        
        // Apply bullet movement
        b.x = newX;
        b.y = newY;
      }

      // Handle explosion (either after injection timer or if enemy died)
      // Check BEFORE other destruction conditions
      // IMPORTANT: Only explode if injected onto an ENEMY (not player), and enemy still exists
      if (b.explosive && b.injected && b.injectedEnemy && 
          b.injectedEnemy !== p && // Never explode if injected onto player (shouldn't happen, but safety check)
          (b.injectedEnemy.hp !== undefined || b.injectedEnemy === s.boss) && // Must be an enemy or boss
          b.explodeAfter !== undefined && b.explodeAfter <= 0) {
        // Time to explode!
        const explosionR = b.explosionRadius || 120;
        const explosionDmg = b.explosionDmg || b.dmg * 0.8;
        const r2 = explosionR * explosionR;
        const explosionX = b.x;
        const explosionY = b.y;
        
        // Damage all enemies in explosion radius
        let hitAny = false;
        for (const ee of s.enemies) {
          if (ee.hp <= 0) continue;
          if (dist2(ee.x, ee.y, explosionX, explosionY) <= r2) {
            ee.hp -= explosionDmg;
            ee.hitT = 0.15;
            hitAny = true;
            const dealt = Math.max(1, Math.round(explosionDmg));
            pushCombatText(s, ee.x, ee.y - 14, String(dealt), "#ffaa00", { size: 16, life: 0.9, crit: true });
            
            // Apply knockback
            const dx = ee.x - explosionX;
            const dy = ee.y - explosionY;
            const dd = Math.hypot(dx, dy) || 1;
            ee.x += (dx / dd) * 40; // Moderate knockback
            ee.y += (dy / dd) * 40;
          }
        }
        
        // Damage boss if in range
        if (s.boss.active && s.boss.hp > 0) {
          const bossD2 = dist2(s.boss.x, s.boss.y, explosionX, explosionY);
          if (bossD2 <= r2) {
            s.boss.hp -= explosionDmg;
            hitAny = true;
            const dealt = Math.max(1, Math.round(explosionDmg));
            pushCombatText(s, s.boss.x, s.boss.y - s.boss.r - 10, String(dealt), "#ffaa00", { size: 16, life: 0.9, crit: true });
          }
        }
        
        // Always show explosion effect, even if no enemies hit
        // Massive explosion effect
        addExplosion(s, explosionX, explosionY, 3.0, 40); // Larger orange explosion
        addParticle(s, explosionX, explosionY, 40, 40, { size: 5, speed: 2.0, glow: true });
        
        // Add multiple shockwave rings for visibility
        for (let i = 0; i < 3; i++) {
          s.floaters.push({
            x: explosionX,
            y: explosionY,
            t: i * 0.05,
            life: 0.5,
            type: "shockwave",
            r: explosionR * (0.2 + i * 0.3),
            color: i === 0 ? "#ffaa00" : i === 1 ? "#ff8800" : "#ff6600",
          });
        }
        
        bumpShake(s, 12, 0.2); // Stronger shake
        s.hitStopT = Math.max(s.hitStopT, 0.05); // Longer hit stop
        
        // Sound effect
        const xNorm = clamp((explosionX / (s.arena.w || 1)) * 2 - 1, -1, 1);
        playBeep({ type: "square", f0: 80, f1: 40, dur: 0.3, gain: 0.3, pan: xNorm * 0.3 });
        
        // Destroy bullet after explosion
        b.t = b.life + 1;
        continue;
      }

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
            
            // Apply knockback to player (away from bullet direction)
            const dd = Math.hypot(b.x - p.x, b.y - p.y) || 1;
            const knockbackForce = 200; // Knockback force for bullets
            if (!p.knockbackVx) p.knockbackVx = 0;
            if (!p.knockbackVy) p.knockbackVy = 0;
            // Knockback in direction bullet was traveling (or away from player if at same position)
            if (dd > 0.1) {
              p.knockbackVx += ((p.x - b.x) / dd) * knockbackForce;
              p.knockbackVy += ((p.y - b.y) / dd) * knockbackForce;
            } else {
              // Use bullet velocity direction if positions are too close
              const bSpeed = Math.hypot(b.vx || 0, b.vy || 0) || 1;
              p.knockbackVx += ((b.vx || 0) / bSpeed) * knockbackForce;
              p.knockbackVy += ((b.vy || 0) / bSpeed) * knockbackForce;
            }
          }
          b.t = b.life + 1;
        }
        continue;
      }

      let hitSomething = false;

      for (const e of s.enemies) {
        if (e.hp <= 0) continue;
        // Skip already hit enemies
        // For boomerang: check outbound hits when going out, return hits when returning
        if (b.boomerang) {
          if (!b.returning && b.hitEnemies && b.hitEnemies.has(e)) {
            continue; // Already hit on outbound trip
          }
          if (b.returning && b.returnHitEnemies && b.returnHitEnemies.has(e)) {
            continue; // Already hit on return trip
          }
        } else if (b.hitEnemies && b.hitEnemies.has(e) && b.pierce === 0) {
          continue; // Regular bullet already hit this enemy
        }
        
        const rr = (e.r + b.r) * (e.r + b.r);
        if (dist2(e.x, e.y, b.x, b.y) < rr) {
          // Special handling for explosive bullets - inject onto enemy instead of dealing damage
          if (b.explosive && !b.injected) {
            // Inject bullet onto enemy
            b.injected = true;
            b.injectedEnemy = e;
            b.vx = 0; // Stop movement
            b.vy = 0;
            b.x = e.x; // Snap to enemy position
            b.y = e.y;
            b.explodeAfter = 2.0; // Start 2 second countdown
          hitSomething = true;
            
            // Start cooldown when bullet injects (only if not already on cooldown)
            if (b.playerAbilityRef) {
              const p = b.playerAbilityRef;
              // Start cooldown (8 seconds base, modified by cooldown multiplier)
              // Only start if not already on cooldown (to prevent resetting)
              if (p.abilityT <= 0) {
                p.abilityT = p.abilityCd * (p.abilityCdMult || 1);
              }
              b.playerAbilityRef = null; // Clear reference
            }
            
            // Visual feedback for injection
            addParticle(s, e.x, e.y, 8, 40, { size: 2, speed: 0.6 });
            pushCombatText(s, e.x, e.y - 14, "INJECTED", "#ffaa00", { size: 12, life: 0.8 });
            
            // Don't destroy bullet, don't deal damage - it will explode later
            continue; // Skip rest of hit processing
          }
          
          hitSomething = true;
          
          // Check for Big Bonk proc BEFORE applying damage
          let finalDmg = b.dmg;
          let isBigBonk = false;
          if (p.bigBonkChance > 0 && Math.random() < p.bigBonkChance) {
            finalDmg = b.dmg * (p.bigBonkMult || 1);
            isBigBonk = true;
          }
          
          // Apply elite weaknesses (extra damage)
          if (e.isElite && e.eliteWeakness) {
            if (e.eliteWeakness === "fire" && (b.effect === "burn" || b.glow)) {
              finalDmg *= 1.5; // 50% more damage from fire
            } else if (e.eliteWeakness === "poison" && b.effect === "poison") {
              finalDmg *= 1.5; // 50% more damage from poison
            } else if (e.eliteWeakness === "melee" && b.melee) {
              finalDmg *= 1.5; // 50% more damage from melee
            }
          }
          
          // Apply elite armor (damage reduction)
          if (e.isElite && e.eliteArmor > 0) {
            finalDmg *= (1 - e.eliteArmor);
          }
          
          e.hp -= finalDmg;
          e.hitT = 0.12;
          
          // Apply lifesteal if player has it
          if (p.lifesteal > 0) {
            const healAmount = finalDmg * p.lifesteal;
            p.hp = Math.min(p.maxHp, p.hp + healAmount);
            // Visual feedback for lifesteal
            if (healAmount > 0.5) {
              pushCombatText(s, p.x, p.y - 30, `+${Math.round(healAmount)}`, "#4dff88", { size: 10, life: 0.6 });
            }
          }

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
                let poisonDps = Math.max(3, b.dmg * poisonDpsMult);
                // Elite weakness to poison increases poison damage
                if (ee.isElite && ee.eliteWeakness === "poison") {
                  poisonDps *= 1.5;
                }
                ee.poisonDps = Math.max(ee.poisonDps || 0, poisonDps);
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
            // Increased knockback multiplier from 0.03 to 0.15 (5x stronger)
            e.x += (dx / dd) * p.knockback * 0.15;
            e.y += (dy / dd) * p.knockback * 0.15;
          }
          
          // Sound already played above for crit/normal hits

          // Track hit enemies for boomerang and bounce (to prevent re-hitting)
          if (b.boomerang) {
            // For boomerang, track hits separately for outbound and return trips
            if (!b.returning) {
              // Outbound trip - track in hitEnemies
              if (!b.hitEnemies) {
                b.hitEnemies = new Set();
              }
              b.hitEnemies.add(e);
            } else {
              // Return trip - track in returnHitEnemies
              if (!b.returnHitEnemies) {
                b.returnHitEnemies = new Set();
              }
              b.returnHitEnemies.add(e);
            }
          } else {
            // Regular bullets - track in hitEnemies
            if (!b.hitEnemies) {
              b.hitEnemies = new Set();
            }
            b.hitEnemies.add(e);
          }
          
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
          // Special handling for explosive bullets - inject onto boss instead of dealing damage
          if (b.explosive && !b.injected) {
            // Inject bullet onto boss
            b.injected = true;
            b.injectedEnemy = s.boss;
            b.vx = 0; // Stop movement
            b.vy = 0;
            b.x = s.boss.x; // Snap to boss position
            b.y = s.boss.y;
            b.explodeAfter = 2.0; // Start 2 second countdown
            
            // Reset cooldown to full 8 seconds when bullet injects
            if (b.playerAbilityRef) {
              const p = b.playerAbilityRef;
              // Reset to full cooldown (8 seconds)
              p.abilityT = p.abilityCd * (p.abilityCdMult || 1);
              b.playerAbilityRef = null; // Clear reference
            }
            
            // Visual feedback for injection
            addParticle(s, s.boss.x, s.boss.y, 8, 40, { size: 2, speed: 0.6 });
            pushCombatText(s, s.boss.x, s.boss.y - s.boss.r - 10, "INJECTED", "#ffaa00", { size: 12, life: 0.8 });
            
            // Don't destroy bullet, don't deal damage - it will explode later
            continue; // Skip rest of hit processing
          }
          
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

    // Filter out bullets, but keep explosive bullets (seeking or injected) that haven't exploded yet
    s.bullets = s.bullets.filter((b) => {
      // Keep explosive bullets even if their life expired:
      // - Injected bullets explode on timer (explodeAfter), not life
      // - Seeking bullets need to find a target, so keep them alive longer
      if (b.explosive) {
        if (b.injected && b.injectedEnemy && b.explodeAfter !== undefined && b.explodeAfter > 0) {
          return true; // Injected bullet waiting to explode
        }
        if (b.seeking && !b.injected) {
          // Seeking bullet - keep alive for longer to find target, but expire after extended time
          const maxSeekTime = 15.0; // Allow up to 15 seconds to find a target
          if (b.t > maxSeekTime) {
            // Bullet expired without finding target - start cooldown now
            if (b.playerAbilityRef) {
              const p = b.playerAbilityRef;
              p.abilityT = p.abilityCd * (p.abilityCdMult || 1);
              b.playerAbilityRef = null;
            }
            return false; // Destroy the bullet
          }
          return true; // Still seeking, keep it alive
        }
      }
      // Boomerang bullets persist until they return to player (handled in update loop)
      // But if they're marked for destruction (b.t > b.life), destroy them
      if (b.boomerang) {
        return b.t <= b.life; // Keep boomerang bullets alive until they return (then b.t > b.life)
      }
      // Normal bullets are destroyed when life expires
      return b.t <= b.life;
    });

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

      // Always drop gold (removed chance-based drop)
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

      // Drop consumable potions from enemies (rare drop)
      if (Math.random() < 0.025) { // 2.5% chance for rare consumable drop
        const consumableType = pickWeighted([
          { w: 1, t: "speed" }, // Speed potion
          { w: 1, t: "heal" }, // Heal potion
          { w: 1, t: "magnet" }, // Magnet potion
          { w: 1, t: "gold" }, // Gold boost potion (new)
        ]).t;
        const potionOffset = 12;
        const potionX = e.x + rand(-potionOffset, potionOffset);
        const potionY = e.y + rand(-potionOffset, potionOffset);
        s.consumables.push({
          x: potionX,
          y: potionY,
          r: 10,
          type: consumableType,
          vx: 0,
          vy: 0,
          t: 0,
          life: 25, // Longer life than coins/gems
        });
      }

      // Enhanced death effects
      const deathHue = e.tier === "brute" ? 0 : e.tier === "runner" ? 48 : e.tier === "spitter" ? 140 : e.tier === "shocker" ? 180 : e.tier === "tank" ? 30 : 210;
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
        // Apply current goldGain and goldBoost when picked up (not when created)
        // c.v is the base coin value, multiply by current goldGain and goldBoost
        const goldMult = (p.goldGain || 1) * (p.goldBoostMult || 1);
        const actualGold = Math.round(c.v * goldMult);
        p.coins += actualGold;
        s.score += actualGold * 3;
        pushCombatText(s, c.x, c.y - 14, `+${actualGold}`, "#ffd44a", { size: 11, life: 0.7 });
        c.t = c.life + 1;
        const xNorm = clamp((c.x / (s.arena.w || 1)) * 2 - 1, -1, 1);
        sfxCoin(xNorm);
      }
    }
    s.coins = s.coins.filter((c) => c.t <= c.life);

    // Update and collect consumables
    for (const cons of s.consumables) {
      cons.t += dt;
      
      // Clamp to level bounds
      if (s.levelData) {
        cons.x = clamp(cons.x, padding, s.levelData.w - padding);
        cons.y = clamp(cons.y, padding, s.levelData.h - padding);
      } else {
        cons.x = clamp(cons.x, padding, w - padding);
        cons.y = clamp(cons.y, padding, h - padding);
      }

      const dd = Math.hypot(p.x - cons.x, p.y - cons.y);
      if (dd < pickRadius) {
        const ux = (p.x - cons.x) / (dd || 1);
        const uy = (p.y - cons.y) / (dd || 1);
        cons.x += ux * (560 * dt) * (1 - dd / pickRadius);
        cons.y += uy * (560 * dt) * (1 - dd / pickRadius);
      }

      const rr = (p.r + cons.r) * (p.r + cons.r);
      if (dist2(p.x, p.y, cons.x, cons.y) < rr) {
        // Consume the potion
        if (cons.type === "speed") {
          p.buffHasteT = Math.max(p.buffHasteT, 6);
          p.buffHasteMult = Math.max(p.buffHasteMult, 1.25);
          bumpShake(s, 2, 0.06);
          addParticle(s, p.x, p.y, 20, 120, { size: 3, speed: 1.2 });
          pushCombatText(s, p.x, p.y - 30, `SPEED BOOST +${Math.round((p.buffHasteMult - 1) * 100)}%`, "#4dff88", { size: 16, life: 1.2 });
        } else if (cons.type === "heal") {
          const heal = Math.round(p.maxHp * 0.35);
          p.hp = Math.min(p.maxHp, p.hp + heal);
          addParticle(s, p.x, p.y, 18, 160);
          pushCombatText(s, p.x, p.y - 30, `+${heal} HP`, "#4dff88", { size: 16, life: 1.2 });
        } else if (cons.type === "magnet") {
          p.magnetT = Math.max(p.magnetT || 0, 10.0);
          p.magnet = Math.max(p.magnet || 1, 50);
          bumpShake(s, 2, 0.06);
          addParticle(s, p.x, p.y, 20, 120, { size: 3, speed: 1.2 });
          pushCombatText(s, p.x, p.y - 30, "MAGNET ACTIVATED", "#ffd44a", { size: 16, life: 1.2 });
        } else if (cons.type === "gold") {
          // Temporary gold gain boost (30 seconds, +50% gold gain)
          p.goldBoostT = Math.max(p.goldBoostT || 0, 30.0);
          p.goldBoostMult = Math.max(p.goldBoostMult || 1, 1.5);
          bumpShake(s, 2, 0.06);
          addParticle(s, p.x, p.y, 20, 60, { size: 3, speed: 1.2 });
          pushCombatText(s, p.x, p.y - 30, "+50% GOLD GAIN", "#ffd44a", { size: 16, life: 1.2 });
        }
        cons.t = cons.life + 1; // Mark for removal
      }
    }
    s.consumables = s.consumables.filter((c) => c.t <= c.life);

    if (p.regen > 0 && p.hp > 0 && p.hp < p.maxHp) {
      p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
    }

    // Shield regeneration (only if player has maxShield from tomes or shieldPerWave from items)
    if (Math.floor(s.stageLeft) % 60 === 0 && s._shieldTick !== Math.floor(s.stageLeft)) {
      s._shieldTick = Math.floor(s.stageLeft);
      // Regenerate shield: use shieldPerWave if set, otherwise regenerate 30% of maxShield
      if (p.shieldPerWave > 0) {
      p.shield = p.shieldPerWave;
      } else if (p.maxShield > 0) {
        const regenAmount = p.maxShield * 0.3; // Regenerate 30% of max shield
        p.shield = Math.min(p.maxShield, (p.shield || 0) + regenAmount);
      }
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
      const bossSpeed = (84 + s.floor * 3.5) * (enr ? 1.2 : 1); // Reduced by ~30% for slower-paced gameplay

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
        // Check line of sight before boss can shoot
        const bossHasLOS = !s.levelData || hasLineOfSight(s.boss.x, s.boss.y, p.x, p.y, s.levelData, 10);
        if (bossHasLOS) {
          const a = Math.atan2(dy, dx);
          const shots = enr ? 3 : 2;
          for (let i = 0; i < shots; i++) {
            const aa = a + lerp(-0.22, 0.22, shots === 1 ? 0.5 : i / (shots - 1));
            shootBullet(s, s.boss.x, s.boss.y, aa, 18 + s.floor * 1.2, 520, { enemy: true, r: 8.2, life: 2.2, color: "#ff5d5d" });
          }
          s.boss.spitT = enr ? 0.55 : 0.85;
        }
      }

      const bossBounds = s.levelData ? {
        w: s.levelData.w,
        h: s.levelData.h,
        padding: padding
      } : s.arena;
      // Always check collision - resolveKinematicCircleOverlap handles jump safety
      // Only skip if in landing grace period
      if (p.jumpLandingGrace !== undefined && p.jumpLandingGrace > 0) {
        // Just landed, skip collision during grace period
      } else {
        const overlapped = resolveKinematicCircleOverlap(p, s.boss, bossBounds, s.levelData);
      if (overlapped) {
        const xNorm = clamp((p.x / (s.arena.w || 1)) * 2 - 1, -1, 1);
          const did = applyPlayerDamage(s, 30 + s.floor * 1.1, "boss contact", { shakeMag: 2.2, shakeTime: 0.07, hitStop: 0.01, fromX: s.boss.x, fromY: s.boss.y });
          if (did) {
            sfxHit(xNorm);
            
            // Apply knockback to player (away from boss)
            const dd = Math.hypot(s.boss.x - p.x, s.boss.y - p.y) || 1;
            const knockbackForce = 220; // Stronger knockback from boss
            if (!p.knockbackVx) p.knockbackVx = 0;
            if (!p.knockbackVy) p.knockbackVy = 0;
            p.knockbackVx += ((p.x - s.boss.x) / dd) * knockbackForce;
            p.knockbackVy += ((p.y - s.boss.y) / dd) * knockbackForce;
          }
        }
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
        // Preserve explosive bullets (injected or seeking) and boomerang bullets when starting new floor
        s.bullets = s.bullets.filter(b => 
          (b.explosive && ((b.injected && b.injectedEnemy) || (b.seeking && !b.injected))) ||
          (b.boomerang && b.t < b.life)
        );
        s.gems = [];
        s.coins = [];
        s.consumables = [];
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
          if (s.levelData && !isPointWalkable(p.x, p.y, s.levelData, p.r || 12)) {
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
        const scale = isoScaleRef.current;
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
      
      // Draw water features (if any) - on top of walkable areas
      if (s.levelData.water && s.levelData.water.length > 0) {
        ctx.fillStyle = `hsl(${bgHue + 20}, ${bgSat + 10}%, ${bgLight + 5}%)`;
        ctx.globalAlpha = 0.4;
        for (const water of s.levelData.water) {
          ctx.fillRect(water.x, water.y, water.w, water.h);
        }
        ctx.globalAlpha = 1;
      }
      
      // Draw grass patches for visual variety
      if (s.levelData.grass && s.levelData.grass.length > 0) {
        ctx.fillStyle = `hsl(${roomHue + 10}, ${roomSat + 5}%, ${roomLight + 3}%)`;
        ctx.globalAlpha = 0.5; // Increased visibility
        for (const patch of s.levelData.grass) {
          if (ISO_MODE) {
            const { w, h } = s.arena;
            const scale = isoScaleRef.current;
            const patchIso = worldToIso(patch.x, patch.y, 0, scale);
            const camIso = worldToIso(cam.x, cam.y, 0, scale);
            const screenX = w / 2 + patchIso.x - camIso.x;
            const screenY = h / 2 + patchIso.y - camIso.y;
            ctx.beginPath();
            ctx.arc(screenX, screenY, patch.r, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.arc(patch.x, patch.y, patch.r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }
      
      // Draw rock decorations
      if (s.levelData.rocks && s.levelData.rocks.length > 0) {
        ctx.fillStyle = `hsl(${bgHue}, ${bgSat - 10}%, ${bgLight + 5}%)`;
        ctx.globalAlpha = 0.8; // Increased visibility
        for (const rock of s.levelData.rocks) {
          if (ISO_MODE) {
            const { w, h } = s.arena;
            const scale = isoScaleRef.current;
            const rockIso = worldToIso(rock.x, rock.y, 0, scale);
            const camIso = worldToIso(cam.x, cam.y, 0, scale);
            const screenX = w / 2 + rockIso.x - camIso.x;
            const screenY = h / 2 + rockIso.y - camIso.y;
            ctx.beginPath();
            ctx.arc(screenX, screenY, rock.r, 0, Math.PI * 2);
            ctx.fill();
            // Add some detail
            ctx.fillStyle = `hsl(${bgHue}, ${bgSat - 15}%, ${bgLight + 2}%)`;
            ctx.beginPath();
            ctx.arc(screenX - rock.r * 0.3, screenY - rock.r * 0.3, rock.r * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `hsl(${bgHue}, ${bgSat - 10}%, ${bgLight + 5}%)`;
          } else {
            ctx.beginPath();
            ctx.arc(rock.x, rock.y, rock.r, 0, Math.PI * 2);
            ctx.fill();
            // Add some detail
            ctx.fillStyle = `hsl(${bgHue}, ${bgSat - 15}%, ${bgLight + 1}%)`;
            ctx.beginPath();
            ctx.arc(rock.x - rock.r * 0.3, rock.y - rock.r * 0.3, rock.r * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `hsl(${bgHue}, ${bgSat - 10}%, ${bgLight + 5}%)`;
          }
        }
        ctx.globalAlpha = 1;
      }
      
      // No borders - unified floor design (removed puzzle piece lines)
      
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
        const scale = isoScaleRef.current;
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
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      const labelW = 70;
      ctx.fillRect(-labelW/2, -8, labelW, 16);
      ctx.fillStyle = "#e6e8ff";
      ctx.font = "10px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      let label = "";
      if (it.kind === INTERACT.CHEST) label = "Chest";
      else if (it.kind === INTERACT.SHRINE) label = "Buff";
      else if (it.kind === INTERACT.MICROWAVE) label = "HP+";
      else if (it.kind === INTERACT.GREED) label = "Greed";
      else if (it.kind === INTERACT.BOSS_TP) label = "Boss";
      
      ctx.fillText(label, 0, 0);
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
        const scale = isoScaleRef.current;
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
        const scale = isoScaleRef.current;
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
        const scale = isoScaleRef.current;
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
        const scale = isoScaleRef.current;
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

    // In isometric mode, we need to depth sort all entities (player + enemies) by isometric Y
    // Entities with higher isometric Y (further back) should be drawn first
    if (ISO_MODE) {
      const { w, h } = s.arena;
      const scale = isoScaleRef.current;
      
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
      // Top-down mode: draw enemies and player normally (no depth sorting needed)
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

    if (p.shield > 0) {
      ctx.strokeStyle = "#9cffd6";
      ctx.globalAlpha = 0.9;
      // Shield thickness increases with charges: 1px base + 1px per charge (capped at reasonable max)
      const shieldThickness = 1 + Math.min(p.shield, 10); // Max 11px thickness
      ctx.lineWidth = shieldThickness;
      if (ISO_MODE) {
        const { w, h } = s.arena;
        const scale = isoScaleRef.current;
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
        const scale = isoScaleRef.current;
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
        const scale = isoScaleRef.current;
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
          const scale = isoScaleRef.current;
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
        const scale = isoScaleRef.current;
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
        const scale = isoScaleRef.current;
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
        const scale = isoScaleRef.current;
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
    
    // ISO_SCALE display (only in isometric mode)
    if (ISO_MODE) {
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(centerX + 210, topY, 80, 24);
      ctx.fillStyle = "#ff7a3d";
      ctx.font = "bold 12px ui-sans-serif, system-ui";
      ctx.textAlign = "left";
      ctx.fillText(`ISO: ${isoScaleRef.current.toFixed(3)}`, centerX + 215, topY + 12);
    }

    // Ability hotbar (WoW/League style)
    if (p.abilityId) {
      const { h } = s.arena;
      const hotbarSize = 48;
      const hotbarX = centerX - hotbarSize / 2;
      const hotbarY = h - 80; // Bottom of screen
      const cooldownPercent = p.abilityT > 0 ? Math.min(1, p.abilityT / (p.abilityCd * (p.abilityCdMult || 1))) : 0;
      
      // For quickdraw ability, check if there's an active seeking bullet
      let hasActiveSeekingBullet = false;
      if (p.abilityId === "quickdraw") {
        hasActiveSeekingBullet = s.bullets.some(b => 
          b.explosive && b.seeking && !b.injected && b.playerAbilityRef === p
        );
      }
      
      // Ability is ready only if cooldown is 0 AND no active seeking bullet
      const isReady = cooldownPercent === 0 && !hasActiveSeekingBullet;
      
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
            const isActive = u.adminCategory === cat.cat;
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
          
          if (u.adminCategory === "main") {
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
          } else if (u.adminCategory === "weapons") {
            adminFunctions = content.weapons.map(w => ({
              name: w.name.length > 20 ? w.name.substring(0, 20) : w.name,
              action: `giveWeapon:${w.id}`,
              weaponId: w.id,
            }));
            adminFunctions.push({ name: "Back", action: "backToMain" });
          } else if (u.adminCategory === "tomes") {
            adminFunctions = content.tomes.map(t => ({
              name: t.name.length > 20 ? t.name.substring(0, 20) : t.name,
              action: `giveTome:${t.id}`,
              tomeId: t.id,
            }));
            adminFunctions.push({ name: "Back", action: "backToMain" });
          } else if (u.adminCategory === "items") {
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
        ctx.fillText(`Shift: ${c.space.name}`, 12, 98);
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
      case "giveAllWeapons":
        // Give all weapons at legendary rarity
        const allWeapons = content.weapons;
        for (const weapon of allWeapons) {
          applyWeapon(p, weapon, RARITY.LEGENDARY, false);
        }
        pushCombatText(s, p.x, p.y - 30, "ALL WEAPONS ADDED", "#ffd44a", { size: 16, life: 1.2 });
        break;
      case "giveAllTomes":
        // Give all tomes at legendary rarity
        const allTomes = content.tomes;
        for (const tome of allTomes) {
          tome.apply(p, RARITY.LEGENDARY);
        }
        pushCombatText(s, p.x, p.y - 30, "ALL TOMES ADDED", "#2ea8ff", { size: 16, life: 1.2 });
        break;
      case "giveAllItems":
        // Give all items at legendary rarity
        const allItems = content.items;
        for (const item of allItems) {
          item.apply(s, RARITY.LEGENDARY);
        }
        pushCombatText(s, p.x, p.y - 30, "ALL ITEMS ADDED", "#1fe06a", { size: 16, life: 1.2 });
        break;
      default:
        // Handle individual upgrades (giveWeapon:id, giveTome:id, giveItem:id)
        if (action.startsWith("giveWeapon:")) {
          const weaponId = action.split(":")[1];
          const weapon = content.weapons.find(w => w.id === weaponId);
          if (weapon) {
            applyWeapon(p, weapon, RARITY.LEGENDARY, false);
            pushCombatText(s, p.x, p.y - 30, `${weapon.name} ADDED`, "#ffd44a", { size: 14, life: 1.0 });
          }
        } else if (action.startsWith("giveTome:")) {
          const tomeId = action.split(":")[1];
          const tome = content.tomes.find(t => t.id === tomeId);
          if (tome) {
            tome.apply(p, RARITY.LEGENDARY);
            pushCombatText(s, p.x, p.y - 30, `${tome.name} ADDED`, "#2ea8ff", { size: 14, life: 1.0 });
          }
        } else if (action.startsWith("giveItem:")) {
          const itemId = action.split(":")[1];
          const item = content.items.find(it => it.id === itemId);
          if (item) {
            item.apply(s, RARITY.LEGENDARY);
            pushCombatText(s, p.x, p.y - 30, `${item.name} ADDED`, "#1fe06a", { size: 14, life: 1.0 });
          }
        }
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
          // Space is now jump
          const p = s.player;
          // Allow jump if on ground (no cooldown - enemies can hit you when low to prevent spam)
          if (p.jumpT <= 0 && (p.z === undefined || p.z <= 0)) {
            p.jumpT = 0.4; // Jump duration
            const baseJumpV = 160; // Base jump velocity (reduced from 280)
            p.jumpV = baseJumpV * (p.jumpHeight || 1.0); // Scale with jump height upgrade
            if (p.z === undefined) p.z = 0;
            
            // Set horizontal jump velocity based on movement direction for diagonal jump arc
            const keys = keysRef.current;
            let mx = (keys.has("ArrowRight") || keys.has("d") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("a") ? 1 : 0);
            let my = (keys.has("ArrowDown") || keys.has("s") ? 1 : 0) - (keys.has("ArrowUp") || keys.has("w") ? 1 : 0);
            
            if (mx !== 0 || my !== 0) {
              // Transform input for isometric if needed
              let dirX, dirY;
              if (ISO_MODE) {
                const transformed = transformInputForIsometric(mx, my);
                dirX = transformed.x;
                dirY = transformed.y;
              } else {
                const len = Math.hypot(mx, my) || 1;
                dirX = mx / len;
                dirY = my / len;
              }
              
              // Set horizontal jump velocity (will be applied during jump for diagonal arc)
              const jumpHorizontalSpeed = 180; // Horizontal speed during jump
              p.jumpVx = dirX * jumpHorizontalSpeed;
              p.jumpVy = dirY * jumpHorizontalSpeed;
            } else {
              // No movement input, no horizontal velocity
              p.jumpVx = 0;
              p.jumpVy = 0;
            }
          }
        } else if (u.screen === "menu") {
          // Space can also start game from menu
          ensureAudio();
          const best = safeBest();
          newRun(best, u.selectedChar);
        }
      }
      
      if (k === "Shift" || k === "ShiftLeft" || k === "ShiftRight") {
        const s = stateRef.current;
        const u = uiRef.current;
        if (s && u.screen === "running" && s.running) {
          useAbility(s);
        }
      }

      if (k === "Escape") {
        e.preventDefault();
        e.stopPropagation();
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
        return;
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

  // Scroll wheel listener for ISO_SCALE adjustment (only when ISO_MODE is true)
  useEffect(() => {
    if (!ISO_MODE) return;
    
    const onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.001 : 0.001;
      setIsoScale(prev => clamp(prev + delta, 0.001, 1.0));
    };
    
    const c = canvasRef.current;
    if (c) {
      c.addEventListener("wheel", onWheel, { passive: false });
    }
    
    return () => {
      if (c) {
        c.removeEventListener("wheel", onWheel);
      }
    };
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    const onPointerDown = (e) => {
      ensureAudio();
      c.setPointerCapture?.(e.pointerId);

      const s = stateRef.current;
      const u = uiRef.current;
      
      // Pause menu click handling - MUST be checked first before early returns
      if (u.screen === "running" && u.pauseMenu) {
        const rect = c.getBoundingClientRect();
        // Get CSS pixel coordinates (matches overlay drawing which uses setTransform(1,0,0,1,0,0))
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const w = s ? s.arena.w : sizeRef.current.w;
        const h = s ? s.arena.h : sizeRef.current.h;
        
        // Admin section buttons - CHECK FIRST when admin panel is open
        // This prevents clicks from falling through to pause menu buttons below
        if (u.showAdmin && s) {
          // Category buttons click detection
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
            const catX = w * 0.5 - 170 + i * 90;
            const clickPadding = 2;
            if (x >= catX - clickPadding && x <= catX + categoryW + clickPadding && 
                y >= categoryY - clickPadding && y <= categoryY + categoryH + clickPadding) {
              e.preventDefault();
              e.stopPropagation();
              setUi(prev => ({ ...prev, adminCategory: categories[i].cat }));
              return;
            }
          }
          
          // Two-column layout for click detection
          const adminCol1X = w * 0.5 - 200;
          const adminCol2X = w * 0.5 + 20;
          const adminButtonW = 180;
          const adminButtonH = 26;
          const adminSpacing = 28;
          const adminY = 175;
          
          let adminFunctions = [];
          
          if (u.adminCategory === "main") {
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
          } else if (u.adminCategory === "weapons") {
            adminFunctions = content.weapons.map(w => ({
              name: w.name.length > 20 ? w.name.substring(0, 20) : w.name,
              action: `giveWeapon:${w.id}`,
              weaponId: w.id,
            }));
            adminFunctions.push({ name: "Back", action: "backToMain" });
          } else if (u.adminCategory === "tomes") {
            adminFunctions = content.tomes.map(t => ({
              name: t.name.length > 20 ? t.name.substring(0, 20) : t.name,
              action: `giveTome:${t.id}`,
              tomeId: t.id,
            }));
            adminFunctions.push({ name: "Back", action: "backToMain" });
          } else if (u.adminCategory === "items") {
            adminFunctions = content.items.map(it => ({
              name: it.name.length > 20 ? it.name.substring(0, 20) : it.name,
              action: `giveItem:${it.id}`,
              itemId: it.id,
            }));
            adminFunctions.push({ name: "Back", action: "backToMain" });
          }
          
          const maxVisible = 20; // Increased to show all items
          const startIndex = 0;
          const endIndex = Math.min(adminFunctions.length, startIndex + maxVisible);
          
          for (let i = startIndex; i < endIndex; i++) {
            const displayIndex = i - startIndex;
            const col = displayIndex % 2;
            const row = Math.floor(displayIndex / 2);
            const buttonX = col === 0 ? adminCol1X : adminCol2X;
            const buttonY = adminY + row * adminSpacing;
            
            // Add small padding to click detection for better reliability
            const clickPadding = 2;
            if (x >= buttonX - clickPadding && x <= buttonX + adminButtonW + clickPadding && 
                y >= buttonY - clickPadding && y <= buttonY + adminButtonH + clickPadding) {
              e.preventDefault();
              e.stopPropagation();
              const action = adminFunctions[i].action;
              if (action === "backToMain") {
                setUi(prev => ({ ...prev, adminCategory: "main" }));
              } else if (action === "closeAdmin") {
                setUi(prev => ({ ...prev, showAdmin: false }));
              } else {
                handleAdminAction(s, action);
              }
              return;
            }
          }
          
          // If click was in admin panel area but didn't hit a button, consume it to prevent fall-through
          const adminPanelTop = 100;
          const adminPanelBottom = h - 100;
          const adminPanelLeft = w * 0.5 - 220;
          const adminPanelRight = w * 0.5 + 220;
          if (x >= adminPanelLeft && x <= adminPanelRight && 
              y >= adminPanelTop && y <= adminPanelBottom) {
            e.preventDefault();
            e.stopPropagation();
            return; // Consume click to prevent it from hitting pause menu buttons
          }
        }
        
        // Pause menu buttons (only checked if admin panel is not open or click is outside admin area)
        const buttonX = w * 0.5 - 120;
        const buttonW = 240;
        const buttonH = 50;
        const buttonY = 180;
        const buttonSpacing = 70;
        
        // Continue button
        if (x >= buttonX && x <= buttonX + buttonW && y >= buttonY && y <= buttonY + buttonH) {
          e.preventDefault();
          e.stopPropagation();
          setUi(prev => ({ ...prev, pauseMenu: false, showAdmin: false }));
          return;
        }
        
        // New Game button - return to character selection
        if (x >= buttonX && x <= buttonX + buttonW && y >= buttonY + buttonSpacing && y <= buttonY + buttonSpacing + buttonH) {
          e.preventDefault();
          e.stopPropagation();
          // Return to menu (character selection)
          setUi(prev => ({ ...prev, screen: "menu", pauseMenu: false, showAdmin: false }));
          return;
        }
        
        // Admin button
        if (x >= buttonX && x <= buttonX + buttonW && y >= buttonY + buttonSpacing * 2 && y <= buttonY + buttonSpacing * 2 + buttonH) {
          e.preventDefault();
          e.stopPropagation();
          setUi(prev => ({ ...prev, showAdmin: !prev.showAdmin }));
          return;
        }
        
        // If we're in pause menu, don't process other clicks
        return;
      }
      
      // Pause game updates when pause menu is open (but allow clicks above)
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
