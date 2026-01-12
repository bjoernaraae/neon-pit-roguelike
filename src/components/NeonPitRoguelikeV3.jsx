import React, { useEffect, useMemo, useRef, useState } from "react";
import { clamp, lerp, rand, dist2, format } from "../utils/math.js";
import { hexToRgb, lerpColor, adjustBrightness } from "../utils/color.js";
import { deepClone, pickWeighted } from "../utils/data.js";
import { xpToNext, computeSpeed, statLine, buildPreview as buildPreviewUtil } from "../utils/gameMath.js";
import { getVisualRadius, resolveKinematicOverlap, resolveDynamicOverlap } from "../game/systems/CollisionSystem.js";
import { isPointWalkable, findNearestWalkable, hasLineOfSight, circleOverlapsRect } from "../game/world/WalkabilitySystem.js";
import { generateFlowField, getFlowDirection } from "../game/systems/PathfindingSystem.js";
import { BSPNode, generateBSPDungeon, convertBSPToGrid, generateWallInfluenceMap } from "../game/world/BSPDungeonGenerator.js";
import { generateProceduralLevel } from "../game/world/LevelGenerator.js";
import menuMusicUrl from "../audio/music/Menu.mp3";
import battleMusicUrl from "../audio/music/Battle.mp3";

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
import { drawWorld } from "../rendering/WorldRenderer.js";
import { drawHud, drawOverlay } from "../rendering/HudRenderer.js";
import { BossController, ConeAttackAbility, LineDashAbility, RingPulseAbility, TeleportAbility, ChargeAbility, MultiShotAbility, BOSS_ABILITY_STATE, DANGER_ZONE_TYPE } from "../game/systems/BossAbilitySystem.js";



import { RARITY, RARITY_COLOR, TYPE, INTERACT } from "../data/constants.js";
import { createGameContent } from "../data/index.js";

// Latest updates/changelog - update this with recent changes
const LATEST_UPDATES = [
  "â€¢ Fixed menu and battle music playback",
  "â€¢ Fixed pause menu button clicks and added keyboard navigation (W/S/E)",
  "â€¢ Added music volume controls (A/D keys)",
  "â€¢ Fixed camera shifting during upgrade selection",
  "â€¢ Fixed shift key movement lock issue",
  "â€¢ Chest purchases now show 3 upgrade options",
  "â€¢ Enhanced upgrade visuals & fanfare",
  "â€¢ Improved boss mechanics & telegraphs"
];


function getRarityWeights(luck) {
  const L = clamp(luck, 0, 8);
  const common = Math.max(40, 78 - L * 9);
  const uncommon = 18 + L * 5;
  const rare = 4 + L * 2.6;
  const legendary = 0.7 + L * 0.9;
  
  // Validate weights are positive numbers
  const weights = [
    { r: RARITY.COMMON, w: Math.max(0, common) },
    { r: RARITY.UNCOMMON, w: Math.max(0, uncommon) },
    { r: RARITY.RARE, w: Math.max(0, rare) },
    { r: RARITY.LEGENDARY, w: Math.max(0, legendary) },
  ];
  
  // Ensure at least one weight is positive to prevent pickWeighted errors
  const totalWeight = weights.reduce((sum, w) => sum + w.w, 0);
  if (totalWeight <= 0) {
    // Fallback: all equal weights if something went wrong
    return weights.map(w => ({ ...w, w: 1 }));
  }
  
  return weights;
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
  const base = 20; // Increased from 6 - much more expensive starting cost
  // Truly exponential increase: cost = base * (multiplier ^ chestOpens)
  // This creates: 20, 36, 65, 117, 211, 380, 684, 1231, etc.
  const multiplier = 1.8; // Increased from 1.5 - each chest costs 1.8x the previous (much steeper)
  const floorMultiplier = 1 + (floor - 1) * 0.2; // +20% per floor (increased from 15%)
  const exponentialCost = base * Math.pow(multiplier, chestOpens) * floorMultiplier;
  return Math.round(exponentialCost);
}

function mitigateDamage(amount, armor) {
  const a = clamp(armor, 0, 0.8);
  return amount * (1 - a);
}

function rollEvasion(evasion) {
  const e = clamp(evasion, 0, 0.75);
  return Math.random() < e;
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
    resolveKinematicCircleOverlap(p, e, null, null);
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    // Use visual radius (40% of original) for the assertion
    const visualR = (p.r || 10) * 0.4;
    const visualRE = (e.r || 10) * 0.4;
    console.assert(d >= visualR + visualRE - 0.0001, "kin overlap resolve");

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
  const lastTimeRef = useRef(performance.now());
  const jumpKeyJustPressedRef = useRef(false);

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
    menuMusic: null,
    battleMusic: null,
    currentTrack: null, // 'menu' or 'battle' or null
    fadeTime: 0,
    fadeDuration: 0.5, // seconds to fade between tracks
    muffled: false, // true when on levelup screen
    muffledVolume: 0.5, // volume multiplier when muffled (50% of normal)
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
    musicVolume: 0.5, // Music volume 0-1
    deathReason: "",
    showStats: false,
    selectedChar: "cowboy",
    pauseMenu: false, // Pause menu state
    showAdmin: false, // Admin section state
    adminCategory: "main", // Admin category: "main", "weapons", "tomes", "items"
    bossTpX: null, // Boss teleporter X position
    bossTpY: null, // Boss teleporter Y position
    selectedChoiceIndex: 0, // Selected upgrade index for keyboard navigation
    levelUpFanfareT: 0, // Level up fanfare animation timer
    chestOpenFanfareT: 0, // Chest opening fanfare animation timer
    highestRarity: RARITY.COMMON, // Highest rarity in current choices for fanfare color
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

  // Run self-tests on component mount
  useEffect(() => {
    runSelfTests();
  }, []);

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

    // Initialize HTML5 Audio elements for music
    const menuMusic = new Audio(menuMusicUrl);
    menuMusic.loop = true;
    menuMusic.volume = 0;
    menuMusic.preload = "auto";

    const battleMusic = new Audio(battleMusicUrl);
    battleMusic.loop = true;
    battleMusic.volume = 0;
    battleMusic.preload = "auto";

    // Handle audio context resume on user interaction
    const resumeAudio = () => {
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      // Try to play music (will work after user interaction)
      if (a.currentTrack === "menu" && menuMusic.paused) {
        menuMusic.play().catch(() => {});
      }
      if (a.currentTrack === "battle" && battleMusic.paused) {
        battleMusic.play().catch(() => {});
      }
    };
    
    // Pause initially - will start playing when updateMusic is called
    menuMusic.pause();
    battleMusic.pause();

    a.ctx = ctx;
    a.master = master;
    a.musicGain = musicGain;
    a.sfxGain = sfxGain;
    a.menuMusic = menuMusic;
    a.battleMusic = battleMusic;
    a.started = true;
    a.resumeAudio = resumeAudio;

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

    // Update music volume based on settings
    updateMusicVolume();
  }

  function updateMusicVolume() {
    const a = audioRef.current;
    if (!a.started) return;
    
    // Get muted state and volume from UI state (more reliable)
    const u = uiRef.current;
    const isMuted = u ? u.muted : a.muted;
    const musicVolume = u ? (u.musicVolume !== undefined ? u.musicVolume : 0.5) : 0.5;
    
    if (!a.menuMusic || !a.battleMusic) return;

    const baseVolume = a.musicOn && !isMuted ? musicVolume : 0;
    const targetVolume = a.muffled ? baseVolume * a.muffledVolume : baseVolume;
    
    // STABILIZE AUDIO: Only set volume, don't set to 0 (let muted state handle that)
    if (a.menuMusic) {
      if (a.currentTrack === "menu") {
        a.menuMusic.volume = targetVolume;
      }
    }
    if (a.battleMusic) {
      if (a.currentTrack === "battle") {
        a.battleMusic.volume = targetVolume;
      }
    }
  }

  function updateMusic(dt) {
    const a = audioRef.current;
    // Ensure audio is initialized
    if (!a.started) {
      ensureAudio();
      return;
    }
    if (!a.menuMusic || !a.battleMusic) return;

    const u = uiRef.current;
    const s = stateRef.current;

    // Determine what track should be playing
    let desiredTrack = null;
    let shouldMuffle = false;
    
    if (u.screen === "menu") {
      desiredTrack = "menu";
      // Switch to menu music if not already playing
      if (a.currentTrack !== "menu") {
        // Pause battle music
        if (a.battleMusic && !a.battleMusic.paused) {
          a.battleMusic.pause();
        }
        // Start menu music
        if (a.menuMusic) {
          a.menuMusic.currentTime = 0;
          if (a.ctx && a.ctx.state === "suspended") {
            a.ctx.resume().catch(() => {});
          }
          a.menuMusic.play().catch(() => {});
          a.currentTrack = "menu";
        }
      } else if (a.menuMusic && a.menuMusic.paused) {
        // Resume menu music if paused
        a.menuMusic.play().catch(() => {});
      }
    } else if (u.screen === "levelup") {
      // On levelup screen, keep current track but muffle it
      desiredTrack = a.currentTrack; // Keep playing current track
      shouldMuffle = true;
    } else if (u.screen === "running" && s) {
      // Check if in combat: enemies present or boss active
      const hasEnemies = s.enemies && s.enemies.length > 0 && s.enemies.some(e => e.hp > 0);
      const hasBoss = s.boss && s.boss.active;
      
      if (hasEnemies || hasBoss) {
        desiredTrack = "battle";
        // Ensure battle music starts when in combat
        if (a.currentTrack !== "battle" && a.battleMusic && a.battleMusic.paused) {
          a.battleMusic.currentTime = 0;
          if (a.ctx && a.ctx.state === "suspended") {
            a.ctx.resume().catch(() => {});
          }
          a.battleMusic.play().catch(() => {});
        }
      } else {
        // No combat, but still in game - play menu music
        desiredTrack = "menu";
      }
    }
    // For "dead" or other screens, desiredTrack stays null (no music)

    // Update muffled state with smooth transition
    if (a.muffled !== shouldMuffle) {
      a.muffled = shouldMuffle;
      // Volume will be updated in the normal flow below
    }

    // Handle track transitions
    // Only transition if we're actually changing tracks (not just muffling)
    if (desiredTrack !== a.currentTrack && desiredTrack !== null) {
      if (a.fadeTime <= 0) {
        // Start fade transition
        a.fadeTime = a.fadeDuration;
      }
      
      a.fadeTime = Math.max(0, a.fadeTime - dt);
      const fadeProgress = a.fadeTime / a.fadeDuration;
      
      if (fadeProgress <= 0) {
        // Fade complete, switch tracks
        if (a.currentTrack === "menu" && a.menuMusic) {
          a.menuMusic.pause();
        }
        if (a.currentTrack === "battle" && a.battleMusic) {
          a.battleMusic.pause();
        }
        
        a.currentTrack = desiredTrack;
        
        if (desiredTrack === "menu" && a.menuMusic) {
          a.menuMusic.currentTime = 0;
          // Resume audio context if needed
          if (a.ctx && a.ctx.state === "suspended") {
            a.ctx.resume().catch(() => {});
          }
          a.menuMusic.play().catch(() => {});
        } else if (desiredTrack === "battle" && a.battleMusic) {
          a.battleMusic.currentTime = 0;
          // Resume audio context if needed
          if (a.ctx && a.ctx.state === "suspended") {
            a.ctx.resume().catch(() => {});
          }
          a.battleMusic.play().catch(() => {});
        }
        // Update volume after track change
        updateMusicVolume();
      } else {
        // Fade in progress
        const u = uiRef.current;
        const isMuted = u ? u.muted : a.muted;
        const musicVolume = u ? (u.musicVolume !== undefined ? u.musicVolume : 0.5) : 0.5;
        const baseVolume = a.musicOn && !isMuted ? musicVolume : 0;
        const targetVolume = a.muffled ? baseVolume * a.muffledVolume : baseVolume;
        const fadeOutVol = targetVolume * fadeProgress;
        const fadeInVol = desiredTrack ? targetVolume * (1 - fadeProgress) : 0;
        
        if (a.currentTrack === "menu" && a.menuMusic) {
          a.menuMusic.volume = fadeOutVol;
        }
        if (a.currentTrack === "battle" && a.battleMusic) {
          a.battleMusic.volume = fadeOutVol;
        }
        
        if (desiredTrack === "menu" && a.menuMusic) {
          if (a.menuMusic.paused) {
            a.menuMusic.currentTime = 0;
            // Resume audio context if needed
            if (a.ctx && a.ctx.state === "suspended") {
              a.ctx.resume().catch(() => {});
            }
            a.menuMusic.play().catch(() => {});
          }
          a.menuMusic.volume = fadeInVol;
        } else if (desiredTrack === "battle" && a.battleMusic) {
          if (a.battleMusic.paused) {
            a.battleMusic.currentTime = 0;
            // Resume audio context if needed
            if (a.ctx && a.ctx.state === "suspended") {
              a.ctx.resume().catch(() => {});
            }
            a.battleMusic.play().catch(() => {});
          }
          a.battleMusic.volume = fadeInVol;
        }
      }
    } else if (desiredTrack === null && a.currentTrack !== null) {
      // Fading out to silence (e.g., dead screen)
      if (a.fadeTime <= 0) {
        a.fadeTime = a.fadeDuration;
      }
      a.fadeTime = Math.max(0, a.fadeTime - dt);
      const fadeProgress = a.fadeTime / a.fadeDuration;
      const u = uiRef.current;
      const isMuted = u ? u.muted : a.muted;
      const musicVolume = u ? (u.musicVolume !== undefined ? u.musicVolume : 0.5) : 0.5;
      const baseVolume = a.musicOn && !isMuted ? musicVolume : 0;
      const fadeOutVol = baseVolume * fadeProgress;
      
      if (a.currentTrack === "menu" && a.menuMusic) {
        a.menuMusic.volume = fadeOutVol;
        if (fadeProgress <= 0) {
          a.menuMusic.pause();
          a.currentTrack = null;
        }
      }
      if (a.currentTrack === "battle" && a.battleMusic) {
        a.battleMusic.volume = fadeOutVol;
        if (fadeProgress <= 0) {
          a.battleMusic.pause();
          a.currentTrack = null;
        }
      }
    } else {
      // Same track (or levelup keeping current track), just update volume (handles muffled state changes)
      updateMusicVolume();
    }
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
    return createGameContent(
      makeIconDraw,
      rarityMult,
      bumpShake,
      addParticle,
      sfxBoss
    );
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
    const coinFromHp = Math.round(finalHp / 40); // Reduced from 30 - 1 coin per 40 HP (less gold)
    let finalCoin = baseCoin + coinFromHp;
    
    if (isElite) {
      finalCoin = Math.round(finalCoin * 2.5); // Elites give 2.5x base
    }
    if (isGoldenElite) {
      finalCoin = Math.round(finalCoin * 3); // Golden elites give 3x more
    }
    
    // Reduce gold gain by 50%
    finalCoin = Math.round(finalCoin * 0.5);

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
      // Add new weapon (even in preview mode so preview can read its stats)
      const newWeapon = {
        id: weaponDef.id,
        level: 1,
        attackCooldown: weaponDef.base.attackCooldown * (1 - 0.05 * (m - 1)),
        weaponDamage: weaponDef.base.weaponDamage * (1 + 0.06 * (m - 1)), // Reduced from 0.1 to 0.06 (40% less effective)
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
        orbitBlades: weaponDef.id === "orbiting_blades" ? 2 : undefined,
        orbitAngle: weaponDef.id === "orbiting_blades" ? 0 : undefined,
      };
      p.weapons.push(newWeapon);
      // Track collected weapon (only if not preview)
      if (!previewOnly) {
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

    existingWeapon.weaponDamage *= 1 + 0.02 * (m - 1); // Reduced from 0.03 to 0.02 (33% less effective)
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
      // Multiplicative attack speed upgrade (reduces cooldown by 4% = 1/0.96)
      const currentCd = existingWeapon.attackCooldown || 0.42;
      existingWeapon.attackCooldown = Math.max(0.18, currentCd * 0.96);
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

    // Validate and clamp all weapon stats to prevent NaN/undefined
    existingWeapon.attackCooldown = Math.max(0.18, isNaN(existingWeapon.attackCooldown) || existingWeapon.attackCooldown === undefined ? 0.42 : existingWeapon.attackCooldown);
    existingWeapon.weaponDamage = Math.max(1, isNaN(existingWeapon.weaponDamage) || existingWeapon.weaponDamage === undefined ? 1 : existingWeapon.weaponDamage);
    existingWeapon.projectiles = clamp(isNaN(existingWeapon.projectiles) || existingWeapon.projectiles === undefined ? 1 : existingWeapon.projectiles, 0, 16);
    existingWeapon.pierce = clamp(isNaN(existingWeapon.pierce) || existingWeapon.pierce === undefined ? 0 : existingWeapon.pierce, 0, 12);
    existingWeapon.bounces = clamp(isNaN(existingWeapon.bounces) || existingWeapon.bounces === undefined ? 0 : existingWeapon.bounces, 0, 8);
    
    // Validate multiplicative stats
    if (isNaN(existingWeapon.bulletSpeedMult) || existingWeapon.bulletSpeedMult === undefined) {
      existingWeapon.bulletSpeedMult = 1;
    }
    if (isNaN(existingWeapon.bulletSizeMult) || existingWeapon.bulletSizeMult === undefined) {
      existingWeapon.bulletSizeMult = 1;
    }

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
          // Reduced floor damage scaling from +3% to +1.5% per floor
      const baseDmg = weapon.weaponDamage || 1;
      const floorMult = 0.84 + 0.015 * (s.floor || 0);
      const dmgBase = (isNaN(baseDmg) ? 1 : baseDmg) * (isNaN(floorMult) ? 1 : floorMult);
          
          // Apply berserker damage multiplier (based on missing HP)
          let berserkerBonus = 1.0;
          if (p.berserkerMult > 0 && !isNaN(p.berserkerMult)) {
            const hpPercent = (p.hp || 0) / Math.max(1, p.maxHp || 1);
            const missingHpPercent = 1 - hpPercent;
            berserkerBonus = 1 + (p.berserkerMult * missingHpPercent);
            if (isNaN(berserkerBonus)) berserkerBonus = 1.0;
          }
          
          // Apply speed demon damage multiplier (based on movement speed)
          let speedBonus = 1.0;
          if (p.speedDamageMult > 0 && !isNaN(p.speedDamageMult)) {
            const currentSpeed = (p.speedBase || 0) + (p.speedBonus || 0);
            speedBonus = 1 + (p.speedDamageMult * (currentSpeed / 100));
            if (isNaN(speedBonus)) speedBonus = 1.0;
          }
          
          const dmgWithBonuses = dmgBase * berserkerBonus * speedBonus;
          if (isNaN(dmgWithBonuses) || dmgWithBonuses <= 0) {
            continue; // Skip this weapon if damage is invalid
          }
          const crit = Math.random() < clamp(p.critChance || 0, 0, 0.8);
          const dmg = crit ? dmgWithBonuses * 1.6 : dmgWithBonuses;
          if (isNaN(dmg) || dmg <= 0) continue;
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

        // Orbiting Blades - auto-attack nearby enemies (continuous, not on cooldown)
        if (weapon.id === "orbiting_blades" && weapon.weaponMode === "orbit") {
          // Initialize orbit angle if not set
          if (weapon.orbitAngle === undefined) weapon.orbitAngle = 0;
          
          // Orbit angle is updated in the main game loop, not here
          // This weapon doesn't use attackT cooldown - it attacks continuously
          weapon.attackT = 0; // Keep cooldown at 0 so it doesn't block other weapons
          continue; // Skip normal firing logic
        }

        if (weapon.weaponMode === "melee") {
        const r = Math.max(34, (weapon.weaponMeleeR || 60) * p.sizeMult);
        // Reduced floor damage scaling from +3% to +1.5% per floor
      const baseDmg = weapon.weaponDamage || 1;
      const floorMult = 0.84 + 0.015 * (s.floor || 0);
      const dmgBase = (isNaN(baseDmg) ? 1 : baseDmg) * (isNaN(floorMult) ? 1 : floorMult);
        
        // Apply berserker damage multiplier (based on missing HP)
        let berserkerBonus = 1.0;
        if (p.berserkerMult > 0 && !isNaN(p.berserkerMult)) {
          const hpPercent = (p.hp || 0) / Math.max(1, p.maxHp || 1);
          const missingHpPercent = 1 - hpPercent;
          berserkerBonus = 1 + (p.berserkerMult * missingHpPercent);
          if (isNaN(berserkerBonus)) berserkerBonus = 1.0;
        }
        
        // Apply speed demon damage multiplier (based on movement speed)
        let speedBonus = 1.0;
        if (p.speedDamageMult > 0 && !isNaN(p.speedDamageMult)) {
          const currentSpeed = (p.speedBase || 0) + (p.speedBonus || 0);
          speedBonus = 1 + (p.speedDamageMult * (currentSpeed / 100));
          if (isNaN(speedBonus)) speedBonus = 1.0;
        }
        
        const dmgWithBonuses = dmgBase * berserkerBonus * speedBonus;
        if (isNaN(dmgWithBonuses)) {
          console.warn("NaN damage detected in melee, using fallback");
          continue;
        }
      const crit = Math.random() < clamp(p.critChance || 0, 0, 0.8);
      const dmg = crit ? dmgWithBonuses * 1.6 : dmgWithBonuses;
      if (isNaN(dmg) || dmg <= 0) continue;

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

      // Reduced floor damage scaling from +3% to +1.5% per floor
      const baseDmg = weapon.weaponDamage || 1;
      const floorMult = 0.84 + 0.015 * (s.floor || 0);
      const dmgBase = (isNaN(baseDmg) ? 1 : baseDmg) * (isNaN(floorMult) ? 1 : floorMult);
      
      // Apply berserker damage multiplier (based on missing HP)
      let berserkerBonus = 1.0;
      if (p.berserkerMult > 0 && !isNaN(p.berserkerMult)) {
        const hpPercent = (p.hp || 0) / Math.max(1, p.maxHp || 1);
        const missingHpPercent = 1 - hpPercent;
        berserkerBonus = 1 + (p.berserkerMult * missingHpPercent); // More damage the lower your HP
        if (isNaN(berserkerBonus)) berserkerBonus = 1.0;
      }
      
      // Apply speed demon damage multiplier (based on movement speed)
      let speedBonus = 1.0;
      if (p.speedDamageMult > 0 && !isNaN(p.speedDamageMult)) {
        const currentSpeed = (p.speedBase || 0) + (p.speedBonus || 0);
        speedBonus = 1 + (p.speedDamageMult * (currentSpeed / 100)); // Damage per 100 speed
        if (isNaN(speedBonus)) speedBonus = 1.0;
      }
      
      const dmgWithBonuses = dmgBase * berserkerBonus * speedBonus;
      if (isNaN(dmgWithBonuses) || dmgWithBonuses <= 0) {
        console.warn("NaN or invalid damage detected in ranged weapon, skipping");
        continue;
      }
    const crit = Math.random() < clamp(p.critChance || 0, 0, 0.8);
    const dmg = crit ? dmgWithBonuses * 1.6 : dmgWithBonuses;
    if (isNaN(dmg) || dmg <= 0) continue;

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
      } else if (weapon.id === "crossbow") {
        color = "#8b4513";
        soundVariant = 0;
        bulletSpeed *= 1.4;
      } else if (weapon.id === "chain_lightning") {
        color = "#ffff00";
        soundVariant = 2;
        bulletSpeed *= 1.5;
        hasGlow = true;
      } else if (weapon.id === "throwing_knives") {
        color = "#c0c0c0";
        soundVariant = 0;
        bulletSpeed *= 1.3;
      } else if (weapon.id === "grenade_launcher") {
        color = "#ff4500";
        soundVariant = 3;
        bulletSpeed *= 0.7;
        bulletSize *= 1.5;
        hasGlow = true;
      }

      // Splash radius for splash, thrown, and explosive modes
      const splashR = (weapon.weaponMode === "splash" || weapon.weaponMode === "thrown" || weapon.weaponMode === "explosive") 
        ? Math.max(26, (weapon.weaponSplashR || weapon.weaponSplashR || 80) * p.sizeMult) 
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
          explosive: weapon.weaponMode === "explosive", // Mark explosive mode bullets
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
            explosive: weapon.weaponMode === "explosive", // Mark explosive mode bullets
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
    if (kind === INTERACT.BOSS_TP) {
      // Boss portal cost: 20% of current gold, minimum 100 (calculated dynamically)
      // Set to -1 as a flag to calculate dynamically
      cost = -1;
    }

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

        // Pass weapon ID and upgrade type for weapon-specific previews
        const previewWeaponId = bucket === TYPE.WEAPON ? entry.id : null;
        // Don't generate preview for tomes/items that will have detailedDesc (to avoid duplication)
        const itemsWithDetailedDesc = ["t_xp", "t_crit_master", "t_elemental", "t_speed_demon", "t_hp", "t_berserker", "moldy_cheese", "ice_crystal", "speed_boots", "slurp_gloves"];
        const shouldGeneratePreview = bucket === TYPE.WEAPON || !itemsWithDetailedDesc.includes(entry.id);
        let preview = shouldGeneratePreview ? buildPreviewUtil(s.player, (pp) => {
          if (bucket === TYPE.WEAPON) applyWeapon(pp, entry, rarity, true, selectedUpgradeType);
          else if (bucket === TYPE.TOME) entry.apply(pp, rarity);
        }, computeSpeed, previewWeaponId, selectedUpgradeType) : "";

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
            const amount = Math.round(8 * m);
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
            const percent = Math.round(6 * m * 10) / 10;
            detailedDesc = `+${percent}% XP Gain (${rarity})`;
          } else if (entry.id === "t_crit_master") {
            const critChance = Math.round(2.5 * m * 100) / 100;
            const critDamage = Math.round(0.3 * m * 100) / 100;
            detailedDesc = `+${critChance}% Crit Chance\n+${critDamage}x Crit Damage (${rarity})`;
          } else if (entry.id === "t_elemental") {
            const percent = Math.round(12 * m);
            detailedDesc = `+${percent}% Chance for random elemental effect (${rarity})\n(Burn, Shock, Poison, or Freeze)`;
          } else if (entry.id === "t_speed_demon") {
            const speedMult = Math.round(0.05 * m * 100) / 100;
            detailedDesc = `+${speedMult}x Damage per unit of Speed (${rarity})`;
          } else if (entry.id === "t_bounce") {
            const bounceAdd = m < 1.2 ? 1 : m < 1.4 ? 2 : 3;
            detailedDesc = `+${bounceAdd} Bounce to all weapons (${rarity})`;
          } else if (entry.id === "t_agility") {
            const amount = Math.round(14 * m);
            detailedDesc = `+${amount} Movement Speed (${rarity})`;
          } else if (entry.id === "t_berserker") {
            const hpReduction = Math.round(15 * m);
            const damageMult = Math.round(0.10 * m * 100) / 100;
            detailedDesc = `-${hpReduction}% Max HP (${rarity})\n+${damageMult}x Damage per % missing HP\n(Up to ${Math.round(100 * damageMult)}% bonus at 0% HP)`;
          }
        } else if (bucket === TYPE.ITEM && entry.apply) {
          const m = rarityMult(rarity);
          // Calculate exact amounts for items
          if (entry.id === "moldy_cheese") {
            const percent = Math.round(6 * m * 100) / 100;
            detailedDesc = `+${percent}% Poison Chance on Hit (${rarity})\nPoison: 30% of damage as DPS for 2.4s`;
          } else if (entry.id === "ice_crystal") {
            const chance = Math.round((0.2 + 0.15 * m) * 100);
            const radius = Math.round(35 + 15 * m);
            const duration = Math.round((1.4 + 0.4 * m) * 10) / 10;
            detailedDesc = `${chance}% Chance to Freeze (${rarity})\nRange: ${radius}px\nDuration: ${duration}s`;
          } else if (entry.id === "speed_boots") {
            const amount = Math.round(12 * m);
            detailedDesc = `+${amount} Movement Speed (${rarity})`;
          } else if (entry.id === "slurp_gloves") {
            const percent = Math.round(6 * m * 100) / 100;
            detailedDesc = `+${percent}% Lifesteal (${rarity})`;
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
        
        // Don't show preview if we have a detailedDesc (and it's different from base desc) to avoid duplication
        const hasDetailedDesc = detailedDesc && detailedDesc !== entry.desc && detailedDesc !== (bucket === TYPE.WEAPON ? "Equip or upgrade your weapon" : "");
        const finalPreview = hasDetailedDesc ? "" : preview;
        
        choices.push({
          rarity,
          type: bucket,
          id: entry.id,
          name: entry.name,
          desc: detailedDesc,
          icon: entry.icon,
          preview: finalPreview,
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

  function triggerUpgradeSequence(s, content) {
    const rolled = rollChestChoices(s);
    const best = s.interact?.find(i => i.kind === INTERACT.CHEST && !i.used);
    const chestX = best?.x || s.player.x;
    const chestY = best?.y || s.player.y;
    
    // Find highest rarity for fanfare color (same as level up)
    const rarityOrder = { [RARITY.COMMON]: 0, [RARITY.UNCOMMON]: 1, [RARITY.RARE]: 2, [RARITY.LEGENDARY]: 3 };
    let highestRarity = RARITY.COMMON;
    for (const choice of rolled.choices) {
      if (rarityOrder[choice.rarity] > rarityOrder[highestRarity]) {
        highestRarity = choice.rarity;
      }
    }
    
    // Chest opening fanfare: particle burst and visual effects (same as level up)
    for (let i = 0; i < 80; i++) {
      const angle = (Math.PI * 2 * i) / 80;
      const speed = 80 + Math.random() * 120;
      s.particles.push({
        x: chestX,
        y: chestY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 3 + Math.random() * 4,
        t: 0,
        life: 0.6 + Math.random() * 0.4,
        hue: 200 + Math.random() * 40, // Blue-purple range (same as level up)
      });
    }
    
    sfxLevelUp(); // Use same sound as level up
    
    // CRITICAL: Set s.upgradeCards and ui.screen = 'levelup' immediately
    if (!s.upgradeCards) s.upgradeCards = [];
    s.upgradeCards = rolled.choices; // Store upgrade cards in state
    
    const nextUi = {
      ...uiRef.current,
      screen: "levelup", // MUST set screen to levelup
      level: s.level,
      xp: s.xp,
      xpNeed: s.xpNeed,
      score: s.score,
      coins: s.player.coins,
      timer: s.stageLeft,
      hint: `Chest reward: ${rolled.bucket}`,
      levelChoices: rolled.choices,
      selectedChoiceIndex: 0, // Reset selection
      levelUpFanfareT: 2.5, // Start fanfare animation (2.5 seconds) - same as level up
      highestRarity: highestRarity, // Store highest rarity for fanfare color
    };

    uiRef.current = nextUi;
    setUi(nextUi);
  }

  function startBoss(s, seconds, bossX = null, bossY = null) {
    const { w, padding } = s.arena;
    s.boss.active = true;
    s.boss.r = 38;
    // Boss HP scales with floor - F1 is easier
    // F1: 1000 HP, then +300 per floor (scaled down from previous)
    s.boss.maxHp = Math.round(1000 + (s.floor - 1) * 300);
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
    s.boss.angle = 0; // Initialize angle for rotation
    s.boss.enraged = false;

    // Initialize boss controller with abilities - scale by floor
    // F1 boss is easier (fewer abilities, longer cooldowns, less damage)
    // Higher floors get more abilities and harder difficulty
    try {
      const floor = s.floor;
      const abilities = [];
      
      // Base abilities (always available)
      const baseCooldown = 4.0 + (floor - 1) * 0.3; // Slightly faster on higher floors
      abilities.push(new ConeAttackAbility({ 
        cooldown: baseCooldown * 1.2, 
        range: 350 + floor * 10,
        phase2Effect: 'burning_ground' 
      }));
      
      // F1: Only basic abilities
      if (floor >= 1) {
        abilities.push(new LineDashAbility({ 
          cooldown: baseCooldown * 1.5,
          dashDistance: 250 + floor * 15
        }));
      }
      
      // F2+: Add Ring Pulse
      if (floor >= 2) {
        abilities.push(new RingPulseAbility({ 
          cooldown: baseCooldown * 1.8,
          maxRadius: 300 + floor * 15
        }));
      }
      
      // F3+: Add Charge
      if (floor >= 3) {
        abilities.push(new ChargeAbility({ 
          cooldown: baseCooldown * 2.0,
          chargeDistance: 350 + floor * 20
        }));
      }
      
      // F4+: Add Teleport
      if (floor >= 4) {
        abilities.push(new TeleportAbility({ 
          cooldown: baseCooldown * 2.5,
          teleportDistance: 200 + floor * 10
        }));
      }
      
      // F5+: Add Multi-Shot
      if (floor >= 5) {
        abilities.push(new MultiShotAbility({ 
          cooldown: baseCooldown * 2.2,
          shotCount: 5 + Math.floor((floor - 5) / 2), // More shots on higher floors
          range: 400 + floor * 10
        }));
      }
      
      s.boss.controller = new BossController(s.boss, abilities);
    } catch (error) {
      console.error('Error initializing boss controller:', error);
      // Fallback: set controller to null to prevent crashes
      s.boss.controller = null;
    }

    bumpShake(s, 8, 0.1);
    sfxBoss();
  }

  function makePlayer(charId, w, h) {
    const c = content.characters.find((x) => x.id === charId) || content.characters[0];

    const base = {
      x: w * 0.5,
      y: h * 0.55,
      r: 14,

      speedBase: 75, // Reduced for slower-paced gameplay and harder enemy encounters
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
    // Resume audio on user interaction (start game)
    const a = audioRef.current;
    if (a && a.resumeAudio) {
      a.resumeAudio();
    }

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

      boss: { active: false, hp: 0, maxHp: 0, r: 0, x: 0, y: 0, timeLeft: 0, angle: 0, enraged: false, controller: null },
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

      // Level up fanfare: enhanced visual effects
      pushCombatText(s, p.x, p.y - 18, `LEVEL ${s.level}`, "#2ea8ff", { size: 14, life: 0.95 });
      addExplosion(s, p.x, p.y, 1.5, 200);
      
      // Add particle burst for level up fanfare
      for (let i = 0; i < 80; i++) {
        const angle = (Math.PI * 2 * i) / 80;
        const speed = 80 + Math.random() * 120;
        s.particles.push({
          x: p.x,
          y: p.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: 3 + Math.random() * 4,
          t: 0,
          life: 0.6 + Math.random() * 0.4,
          hue: 200 + Math.random() * 40, // Blue-purple range
        });
      }

      sfxLevelUp();

      const choices = rollLevelChoices(s);
      
      // Find highest rarity for fanfare color
      const rarityOrder = { [RARITY.COMMON]: 0, [RARITY.UNCOMMON]: 1, [RARITY.RARE]: 2, [RARITY.LEGENDARY]: 3 };
      let highestRarity = RARITY.COMMON;
      for (const choice of choices) {
        if (rarityOrder[choice.rarity] > rarityOrder[highestRarity]) {
          highestRarity = choice.rarity;
        }
      }
      
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
        selectedChoiceIndex: 0, // Reset selection
        levelUpFanfareT: 2.5, // Start fanfare animation (2.5 seconds)
        highestRarity: highestRarity, // Store highest rarity for fanfare color
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

    // Calculate dynamic cost for boss portal (percentage of current gold)
    let actualCost = best.cost;
    if (best.kind === INTERACT.BOSS_TP && best.cost === -1) {
      const percentageCost = Math.round(p.coins * 0.2);
      actualCost = Math.max(100, percentageCost);
    }

    if (actualCost > 0 && p.coins < actualCost) {
      pushCombatText(s, p.x, p.y - 24, `Need ${actualCost}`, "#ffd44a", { size: 12, life: 0.7 });
      return;
    }
    if (actualCost > 0) p.coins -= actualCost;

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

      // DELETE random upgrade logic - use triggerUpgradeSequence instead
      triggerUpgradeSequence(s, content);
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
    
        // Ability cooldown is now enforced by abilityT > 0 check above
        // No need to check for active seeking bullets - cooldown prevents spamming
    

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
      // Start cooldown immediately to prevent spamming (8 second cooldown)
      p.abilityT = p.abilityCd * (p.abilityCdMult || 1);
      
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
        explosiveBullet.playerAbilityRef = null; // No longer needed since cooldown starts immediately
        
        // Visual effects
        addParticle(s, p.x, p.y, 20, 40);
        playBeep({ type: "square", f0: 200, f1: 120, dur: 0.12, gain: 0.18, pan: 0 }); // Deeper, more powerful sound
      } else {
        // No target found - still fire bullet (it will seek when enemies spawn)
        const totalDmg = (p.weapons ? p.weapons.reduce((sum, w) => sum + w.weaponDamage, 0) : 0) * 1.2;
        const dmg = totalDmg * 1.6;
        
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
        explosiveBullet.playerAbilityRef = null;
        
        // Visual effects
        addParticle(s, p.x, p.y, 20, 40);
        playBeep({ type: "square", f0: 200, f1: 120, dur: 0.12, gain: 0.18, pan: 0 });
      }
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
    
    // Update camera to follow player (but not during upgrade selection)
    const u = uiRef.current;
    const hasUpgradeCards = u && u.levelChoices && u.levelChoices.length > 0;
    // Also check s.upgradeCards if it exists
    const upgradeCardsLength = (s.upgradeCards && s.upgradeCards.length) || (hasUpgradeCards ? 1 : 0);
    if (upgradeCardsLength === 0) {
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
    }

    s.t += dt;

    const intensity = clamp(1 - s.stageLeft / s.stageDur, 0, 1);
    tickMusic(dt, intensity);
    updateMusic(dt); // CRITICAL: Call updateMusic to manage menu/battle music
    
    // Generate Flow Field once per frame (Dijkstra Map from player position)
    // RESET STATE: Ensure old pathfindingGrid is completely overwritten (already handled by level generation)
    if (s.levelData && s.levelData.pathfindingGrid) {
      try {
        s.flowFieldData = generateFlowField(
          p.x,
          p.y,
          s.levelData.pathfindingGrid,
          s.levelData.pathfindingGridSize || 10
        );
      } catch (error) {
        // Flow field generation failed - log error and set to null
        console.error('Flow field generation error:', error);
        s.flowFieldData = null;
      }
    } else {
      s.flowFieldData = null;
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
        p.jumpV -= 800 * dt; // Gravity acceleration (restored from original)
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
        
      // Ground check - CRITICAL: clamp z to 0 to prevent tiny decimals
      if (p.z < 0) {
        p.z = 0;
      }
      if (p.z <= 0) {
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
      p.jumpV = (p.jumpV || 0) - 800 * dt; // Gravity during fall (restored from original)
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
      
      // Check for jump input (Space key) - only trigger on keydown, not when holding
      // Player must be grounded (z <= 0) and not already jumping (jumpT <= 0)
      const keys = keysRef.current;
      if (jumpKeyJustPressedRef.current && p.jumpT <= 0 && (p.z === undefined || p.z <= 0)) {
        jumpKeyJustPressedRef.current = false; // Clear the flag so holding doesn't trigger again
        // Initiate jump
        const baseJumpV = 160 * (p.jumpHeight || 1.0);
        p.jumpV = baseJumpV;
        p.jumpT = 0.4; // Jump duration
        
        // Get movement direction for diagonal jump
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
        
        // Set horizontal jump velocity (diagonal jump)
        const jumpSpeed = baseJumpV * 0.6; // Horizontal jump speed multiplier
        p.jumpVx = dirX * jumpSpeed;
        p.jumpVy = dirY * jumpSpeed;
      }
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
        
        // Update orbiting blades (continuous attack, not on cooldown)
        if (weapon.id === "orbiting_blades" && weapon.weaponMode === "orbit") {
          // Initialize orbit angle if not set
          if (weapon.orbitAngle === undefined) weapon.orbitAngle = 0;
          
          // Update orbit angle (rotation speed)
          weapon.orbitAngle += dt * 3.5;
          if (weapon.orbitAngle > Math.PI * 2) weapon.orbitAngle -= Math.PI * 2;
          
          // Calculate blade positions and check for enemy hits
          const orbitRadius = Math.max(40, (weapon.weaponMeleeR || 60) * p.sizeMult);
          // Reduced floor damage scaling from +3% to +1.5% per floor
      const baseDmg = weapon.weaponDamage || 1;
      const floorMult = 0.84 + 0.015 * (s.floor || 0);
      const dmgBase = (isNaN(baseDmg) ? 1 : baseDmg) * (isNaN(floorMult) ? 1 : floorMult);
          
          // Apply berserker damage multiplier (based on missing HP)
          let berserkerBonus = 1.0;
          if (p.berserkerMult > 0 && !isNaN(p.berserkerMult)) {
            const hpPercent = (p.hp || 0) / Math.max(1, p.maxHp || 1);
            const missingHpPercent = 1 - hpPercent;
            berserkerBonus = 1 + (p.berserkerMult * missingHpPercent);
            if (isNaN(berserkerBonus)) berserkerBonus = 1.0;
          }
          
          // Apply speed demon damage multiplier (based on movement speed)
          let speedBonus = 1.0;
          if (p.speedDamageMult > 0 && !isNaN(p.speedDamageMult)) {
            const currentSpeed = (p.speedBase || 0) + (p.speedBonus || 0);
            speedBonus = 1 + (p.speedDamageMult * (currentSpeed / 100));
            if (isNaN(speedBonus)) speedBonus = 1.0;
          }
          
          const dmgWithBonuses = dmgBase * berserkerBonus * speedBonus;
          if (isNaN(dmgWithBonuses) || dmgWithBonuses <= 0) {
            continue; // Skip this weapon if damage is invalid
          }
          const crit = Math.random() < clamp(p.critChance || 0, 0, 0.8);
          const dmg = crit ? dmgWithBonuses * 1.6 : dmgWithBonuses;
          if (isNaN(dmg) || dmg <= 0) continue;
          
          const bladeCount = weapon.orbitBlades || 2;
          const angleStep = (Math.PI * 2) / bladeCount;
          
          for (let i = 0; i < bladeCount; i++) {
            const bladeAngle = weapon.orbitAngle + angleStep * i;
            const bladeX = p.x + Math.cos(bladeAngle) * orbitRadius;
            const bladeY = p.y + Math.sin(bladeAngle) * orbitRadius;
            
            // Check for enemies in range
            for (const e of s.enemies) {
              if (e.hp <= 0) continue;
              const dist2 = (bladeX - e.x) ** 2 + (bladeY - e.y) ** 2;
              const hitRadius = 20; // Blade hit radius
              if (dist2 <= (hitRadius + e.r) ** 2) {
                // Check cooldown per enemy (prevent spam) - use weapon-specific key
                // Longer cooldown (1.5s) ensures each enemy is only hit once per full rotation
                // Rotation speed is 3.5 rad/s, so full rotation takes ~1.8s
                const enemyKey = `orbitHit_${weapon.id}_${e.id || e.x}_${e.y}`;
                if (!e[enemyKey] || e[enemyKey] <= 0) {
                  e[enemyKey] = 1.5; // 1.5s cooldown per enemy - prevents multiple hits per rotation
                  
                  let finalDmg = dmg;
                  if (p.bigBonkChance > 0 && Math.random() < p.bigBonkChance) {
                    finalDmg = dmg * (p.bigBonkMult || 1);
                  }
                  
                  e.hp -= finalDmg;
                  e.hitT = 0.12;
                  const dealt = Math.max(1, Math.round(finalDmg));
                  pushCombatText(s, e.x, e.y - 14, String(dealt), crit ? "#ffd44a" : "#ffffff", { size: crit ? 14 : 12, life: 0.75, crit });
                  
                  // Apply effects
                  if (p.poisonChance > 0 && Math.random() < p.poisonChance) {
                    e.poisonT = Math.max(e.poisonT, 2.4);
                    e.poisonDps = Math.max(e.poisonDps, Math.max(3, finalDmg * 0.3));
                  }
                  if (p.lifesteal > 0) {
                    const healAmount = finalDmg * p.lifesteal;
                    p.hp = Math.min(p.maxHp, p.hp + healAmount);
                  }
                  if (p.iceCrystalFreezeChance && Math.random() < p.iceCrystalFreezeChance) {
                    e.freezeT = Math.max(e.freezeT, p.iceCrystalFreezeDuration || 1.2);
                  } else if (p.freezeChance > 0 && Math.random() < p.freezeChance) {
                    e.freezeT = Math.max(e.freezeT, 1.05);
                  }
                } else {
                  // Update cooldown
                  e[enemyKey] = Math.max(0, e[enemyKey] - dt);
                }
              }
            }
          }
        }
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
      // BUT: Validate direction is walkable to prevent corner cutting
      let moveDirX = 0;
      let moveDirY = 0;
      
      const enemyRadius = e.r || 14;
      
      // Calculate movement speed early (needed for validation)
      const slowMult = e.slowT > 0 ? (e.slowMult || 0.5) : 1.0;
      let moveSpeed = e.speed * dt * slowMult;
      
      if (e.tier === "spitter") {
        e.spitT = Math.max(0, e.spitT - dt);
        const desired = 240;
        const push = d < desired ? -1 : 1;
        moveSpeed *= 0.62 * push;
      }
      
      // Get movement direction from flow field
      if (s.flowFieldData) {
        const flowDir = getFlowDirection(e.x, e.y, s.flowFieldData);
        moveDirX = flowDir.x;
        moveDirY = flowDir.y;
      } else {
        // No flow field - fallback to direct movement
        moveDirX = dx / d;
        moveDirY = dy / d;
      }
      
      // If flow direction is zero (stuck or at target), use direct movement as fallback
      const flowDirMag = Math.hypot(moveDirX, moveDirY);
      if (flowDirMag < 0.01 && d > 5) {
        // Flow field returned zero, but we're not at target - use direct movement
        moveDirX = dx / d;
        moveDirY = dy / d;
      }
      
      const ux = moveDirX;
      const uy = moveDirY;
        
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
        
        // Move enemy with collision checks
        // Direction has already been validated, so try to move in that direction
        let movedX = false;
        let movedY = false;
        
        if (s.levelData) {
          // Try to move in desired direction
          const newEx = e.x + ux * moveSpeed;
          const newEy = e.y + uy * moveSpeed;
          
          // Try diagonal movement first (if direction is diagonal)
          const isDiagonal = Math.abs(ux) > 0.1 && Math.abs(uy) > 0.1;
          
          if (isDiagonal) {
            // For diagonal, check if the path is clear
            // We already validated the path, but double-check the endpoint
            if (isPointWalkable(newEx, newEy, s.levelData, enemyRadius)) {
              e.x = newEx;
              e.y = newEy;
              movedX = true;
              movedY = true;
            } else {
              // Diagonal blocked - try cardinals separately
              if (isPointWalkable(newEx, e.y, s.levelData, enemyRadius)) {
                e.x = newEx;
                movedX = true;
              }
              if (isPointWalkable(e.x, newEy, s.levelData, enemyRadius)) {
                e.y = newEy;
                movedY = true;
              }
            }
          } else {
            // Cardinal direction - try to move
            if (Math.abs(ux) > 0.1 && isPointWalkable(newEx, e.y, s.levelData, enemyRadius)) {
              e.x = newEx;
              movedX = true;
            }
            if (Math.abs(uy) > 0.1 && isPointWalkable(e.x, newEy, s.levelData, enemyRadius)) {
              e.y = newEy;
              movedY = true;
            }
          }
          
          // If we haven't moved yet, try fallback strategies
          if (!movedX && !movedY) {
            // Try moving perpendicular to desired direction (wall sliding)
            // Check both perpendicular directions
            const perp1X = e.x + uy * moveSpeed * 0.8;
            const perp1Y = e.y - ux * moveSpeed * 0.8;
            const perp2X = e.x - uy * moveSpeed * 0.8;
            const perp2Y = e.y + ux * moveSpeed * 0.8;
            
            // Try first perpendicular
            if (isPointWalkable(perp1X, perp1Y, s.levelData, enemyRadius)) {
              e.x = perp1X;
              e.y = perp1Y;
              movedX = true;
              movedY = true;
            } else if (isPointWalkable(perp2X, perp2Y, s.levelData, enemyRadius)) {
              // Try opposite perpendicular
              e.x = perp2X;
              e.y = perp2Y;
              movedX = true;
              movedY = true;
            } else if (e.stuckT > 0.05) {
              // If stuck for a bit, try moving in cardinal directions away from walls
              const cardinals = [
                [1, 0], [-1, 0], [0, 1], [0, -1]
              ];
              
              // Shuffle cardinals to avoid predictable movement
              for (let i = cardinals.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [cardinals[i], cardinals[j]] = [cardinals[j], cardinals[i]];
              }
              
              for (const [cdx, cdy] of cardinals) {
                const testX = e.x + cdx * moveSpeed * 0.6;
                const testY = e.y + cdy * moveSpeed * 0.6;
                if (isPointWalkable(testX, testY, s.levelData, enemyRadius)) {
                  e.x = testX;
                  e.y = testY;
                  movedX = true;
                  movedY = true;
                  break;
                }
              }
            }
          }
        } else {
          // Fallback: no level data, allow movement
          const newEx = e.x + ux * moveSpeed;
          const newEy = e.y + uy * moveSpeed;
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
        
        // Apply damage if overlapping, is melee enemy, and cooldown is ready
        // Note: overlapped is true when visual cubes are touching (from resolveKinematicCircleOverlap)
        // If enemy is pushing player, they should be able to deal damage
        // Check contactCd with undefined safety
        // If overlapped is true, that means visual cubes are touching, so damage should apply
        // No need for additional distance check - overlapped already confirms they're touching
        if (overlapped && isMeleeEnemy && (e.contactCd === undefined || e.contactCd <= 0)) {
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
          
          // Reset weapon cooldown when banana returns (allow immediate firing)
          if (b.weaponId === "bananarang") {
            const weapon = p.weapons?.find(w => w.id === "bananarang");
            if (weapon) {
              weapon.attackT = 0; // Reset cooldown - can fire again immediately
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
          // Special handling for explosive bullets - check if it's seeking (delayed) or immediate (explosive mode)
          if (b.explosive && !b.injected) {
            // Check if this is a seeking explosive (injected) or immediate explosive (explosive mode weapon)
            if (b.seeking) {
              // Seeking explosive - inject onto enemy for delayed explosion
              b.injected = true;
              b.injectedEnemy = e;
              b.vx = 0; // Stop movement
              b.vy = 0;
              b.x = e.x; // Snap to enemy position
              b.y = e.y;
              b.explodeAfter = 2.0; // Start 2 second countdown
              hitSomething = true;
            } else {
              // Immediate explosive (grenade launcher) - explode on impact
              const explosionR = b.splashR || 80;
              const explosionDmg = b.dmg;
              const r2 = explosionR * explosionR;
              const explosionX = b.x;
              const explosionY = b.y;
              
              // Damage all enemies in explosion radius
              for (const ee of s.enemies) {
                if (ee.hp <= 0) continue;
                const d2 = dist2(ee.x, ee.y, explosionX, explosionY);
                if (d2 <= r2) {
                  const dist = Math.sqrt(d2);
                  const falloff = dist > 0 ? Math.max(0.3, 1 - (dist / explosionR)) : 1;
                  const dmg = explosionDmg * falloff;
                  ee.hp -= dmg;
                  ee.hitT = 0.12;
                  const dealt = Math.max(1, Math.round(dmg));
                  pushCombatText(s, ee.x, ee.y - 14, String(dealt), "#ffaa00", { size: 12, life: 0.75 });
                  
                  // Knockback
                  if (p.knockback > 0) {
                    const dx = ee.x - explosionX;
                    const dy = ee.y - explosionY;
                    const dd = Math.hypot(dx, dy) || 1;
                    ee.x += (dx / dd) * p.knockback * 0.12;
                    ee.y += (dy / dd) * p.knockback * 0.12;
                  }
                }
              }
              
              // Damage boss if in range
              if (s.boss.active && s.boss.hp > 0) {
                const bossD2 = dist2(s.boss.x, s.boss.y, explosionX, explosionY);
                if (bossD2 <= r2) {
                  const dist = Math.sqrt(bossD2);
                  const falloff = dist > 0 ? Math.max(0.3, 1 - (dist / explosionR)) : 1;
                  s.boss.hp -= explosionDmg * falloff;
                  const dealt = Math.max(1, Math.round(explosionDmg * falloff));
                  pushCombatText(s, s.boss.x, s.boss.y - s.boss.r - 10, String(dealt), "#ffaa00", { size: 16, life: 0.9, crit: true });
                }
              }
              
              // Explosion effect
              addExplosion(s, explosionX, explosionY, 2.0, 30);
              addParticle(s, explosionX, explosionY, 30, 30, { size: 4, speed: 1.5, glow: true });
              bumpShake(s, 8, 0.15);
              s.hitStopT = Math.max(s.hitStopT, 0.04);
              
              // Destroy bullet
              b.t = b.life + 1;
              hitSomething = true;
              continue;
            }
          }
          
          if (b.explosive && b.injected) {
            // Already injected, skip normal hit logic
            continue;
          }
          
          hitSomething = true;
          
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
            
            // Cooldown is now started immediately when ability is used, not when bullet injects
            // Remove old cooldown logic
            
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
          // Seeking bullet - explode after 8 seconds if it hasn't found a target (matches ability cooldown)
          const maxSeekTime = 8.0; // Match ability cooldown (8 seconds)
          if (b.t > maxSeekTime) {
            // Bullet expired - explode it now
            const explosionR = b.explosionRadius || 120;
            const explosionDmg = b.explosionDmg || b.dmg * 0.8;
            const r2 = explosionR * explosionR;
            const explosionX = b.x;
            const explosionY = b.y;
            const p = s.player; // Get player reference for knockback
            
            // Damage all enemies in explosion radius
            for (const ee of s.enemies) {
              if (ee.hp <= 0) continue;
              const d2 = dist2(ee.x, ee.y, explosionX, explosionY);
              if (d2 <= r2) {
                const dist = Math.sqrt(d2);
                const falloff = dist > 0 ? Math.max(0.3, 1 - (dist / explosionR)) : 1;
                const dmg = explosionDmg * falloff;
                ee.hp -= dmg;
                ee.hitT = 0.12;
                const dealt = Math.max(1, Math.round(dmg));
                pushCombatText(s, ee.x, ee.y - 14, String(dealt), "#ffaa00", { size: 12, life: 0.75 });
                
                // Knockback
                if (p && p.knockback > 0) {
                  const dx = ee.x - explosionX;
                  const dy = ee.y - explosionY;
                  const dd = Math.hypot(dx, dy) || 1;
                  ee.x += (dx / dd) * p.knockback * 0.12;
                  ee.y += (dy / dd) * p.knockback * 0.12;
                }
              }
            }
            
            // Damage boss if in range
            if (s.boss.active && s.boss.hp > 0) {
              const bossD2 = dist2(s.boss.x, s.boss.y, explosionX, explosionY);
              if (bossD2 <= r2) {
                const dist = Math.sqrt(bossD2);
                const falloff = dist > 0 ? Math.max(0.3, 1 - (dist / explosionR)) : 1;
                s.boss.hp -= explosionDmg * falloff;
                const dealt = Math.max(1, Math.round(explosionDmg * falloff));
                pushCombatText(s, s.boss.x, s.boss.y - s.boss.r - 10, String(dealt), "#ffaa00", { size: 16, life: 0.9, crit: true });
              }
            }
            
            // Explosion effect
            addExplosion(s, explosionX, explosionY, 2.0, 30);
            addParticle(s, explosionX, explosionY, 30, 30, { size: 4, speed: 1.5, glow: true });
            bumpShake(s, 8, 0.15);
            s.hitStopT = Math.max(s.hitStopT, 0.04);
            
            return false; // Destroy the bullet after explosion
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

      // Check phase transition
      const wasPhase2 = s.boss.enraged;
      const isPhase2 = s.boss.hp / s.boss.maxHp <= 0.5;
      if (isPhase2 && !wasPhase2) {
        // Phase 2 transition effect
        s.boss.enraged = true;
        bumpShake(s, 12, 0.15);
        addExplosion(s, s.boss.x, s.boss.y, 3.0, 200);
        addParticle(s, s.boss.x, s.boss.y, 50, 100, { size: 6, speed: 2.0, glow: true });
        pushCombatText(s, s.boss.x, s.boss.y - s.boss.r - 20, "ENRAGED!", "#ff0000", { size: 20, life: 2.0, crit: true });
      }

      // Update boss controller (handles abilities and rotation)
      if (s.boss.controller) {
        try {
          s.boss.controller.update(p, dt, s.floor, s.levelData);
          
          // Check for ability hits
          const hitResult = s.boss.controller.checkHits(p, s.floor);
          if (hitResult) {
            const did = applyPlayerDamage(s, hitResult.damage, hitResult.ability.name, {
              shakeMag: 2.5,
              shakeTime: 0.08,
              hitStop: 0.02,
              fromX: s.boss.x,
              fromY: s.boss.y
            });
            if (did) {
              const xNorm = clamp((p.x / (s.arena.w || 1)) * 2 - 1, -1, 1);
              sfxHit(xNorm);
            }
          }
          
          // Handle burning ground from phase 2 abilities
          if (s.boss.controller.abilities) {
            for (const ability of s.boss.controller.abilities) {
              if (ability && ability.burningGround && ability.burningGround.life > 0) {
                ability.burningGround.t += dt;
                ability.burningGround.life -= dt;
                
                if (ability.burningGround.life > 0) {
                  // Check if player is in burning ground
                  const dx = p.x - ability.burningGround.x;
                  const dy = p.y - ability.burningGround.y;
                  const dist = Math.hypot(dx, dy);
                  const angle = Math.atan2(dy, dx);
                  let angleDiff = angle - ability.burningGround.angle;
                  // Normalize angle difference
                  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                  
                  if (dist <= ability.burningGround.range && Math.abs(angleDiff) <= ability.burningGround.angleWidth / 2) {
                    ability.burningGround.lastTick = (ability.burningGround.lastTick || 0) + dt;
                    if (ability.burningGround.lastTick >= ability.burningGround.tickRate) {
                      ability.burningGround.lastTick = 0;
                      const did = applyPlayerDamage(s, ability.burningGround.dmg, "burning ground", {
                        shakeMag: 0.5,
                        shakeTime: 0.02,
                        hitStop: 0,
                        fromX: ability.burningGround.x,
                        fromY: ability.burningGround.y
                      });
                    }
                  }
                } else {
                  // Remove expired burning ground
                  ability.burningGround = null;
                }
              }
            }
          }
        } catch (error) {
          console.error('Error in boss controller update:', error);
          // Reset controller on error to prevent freeze
          s.boss.controller = null;
        }
      }

      // Boss movement (only when not in active ability state that controls movement)
      // Line Dash ability handles its own movement, so skip normal movement during it
      const isDashing = s.boss.controller && s.boss.controller.currentAbility && 
                        s.boss.controller.currentAbility instanceof LineDashAbility &&
                        s.boss.controller.currentAbility.state === BOSS_ABILITY_STATE.ACTIVE;
      const currentState = s.boss.controller?.getCurrentState();
      if (currentState !== BOSS_ABILITY_STATE.ACTIVE || isDashing) {
        const dx = p.x - s.boss.x;
        const dy = p.y - s.boss.y;
        const d = Math.hypot(dx, dy) || 1;
        const ux = dx / d;
        const uy = dy / d;

        const enr = s.boss.hp / s.boss.maxHp < 0.5; // Phase 2 at 50%
        s.boss.enraged = enr;
        const bossSpeed = (84 + s.floor * 3.5) * (enr ? 1.2 : 1);

        let newX = s.boss.x + ux * bossSpeed * dt;
        let newY = s.boss.y + uy * bossSpeed * dt;
        
        // Clamp boss to walkable areas (rooms/corridors)
        if (s.levelData && s.boss.controller) {
          const clamped = s.boss.controller.clampToWalkable(newX, newY, s.levelData);
          newX = clamped.x;
          newY = clamped.y;
        } else {
          // Fallback to simple bounds
          if (s.levelData) {
            newX = clamp(newX, padding, s.levelData.w - padding);
            newY = clamp(newY, padding, s.levelData.h - padding);
          } else {
            newX = clamp(newX, padding, w - padding);
            newY = clamp(newY, padding, h - padding);
          }
        }
        
        s.boss.x = newX;
        s.boss.y = newY;
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

  // drawMinimap moved to src/rendering/HudRenderer.js

  // drawHud moved to src/rendering/HudRenderer.js

  // drawOverlay moved to src/rendering/HudRenderer.js

  // drawHud moved to src/rendering/HudRenderer.js

  // drawOverlay moved to src/rendering/HudRenderer.js

  // ADMIN PANEL: Click handler for pause menu admin section
  function handleAdminClick(x, y, w, h, u, content) {
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
        handleAdminAction(s, adminFunctions[i].action);
        return;
      }
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
            applyWeapon(p, w, RARITY.LEGENDARY, false);
            p.collectedWeapons.push({ ...w, rarity: RARITY.LEGENDARY });
          }
        }
        break;
      case "giveAllTomes":
        for (const t of content.tomes) {
          if (!p.collectedTomes.find(x => x.id === t.id)) {
            applyWeapon(p, t, RARITY.LEGENDARY, false);
            p.collectedTomes.push({ ...t, rarity: RARITY.LEGENDARY });
          }
        }
        break;
      case "giveAllItems":
        for (const it of content.items) {
          if (!p.collectedItems.find(x => x.id === it.id)) {
            applyWeapon(p, it, RARITY.LEGENDARY, false);
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
            applyWeapon(p, weapon, RARITY.LEGENDARY, false);
            p.collectedWeapons.push({ ...weapon, rarity: RARITY.LEGENDARY });
          }
        } else if (action.startsWith("giveTome:")) {
          const tomeId = action.split(":")[1];
          const tome = content.tomes.find((t) => t.id === tomeId);
          if (tome && !p.collectedTomes.find((x) => x.id === tomeId)) {
            applyWeapon(p, tome, RARITY.LEGENDARY, false);
            p.collectedTomes.push({ ...tome, rarity: RARITY.LEGENDARY });
          }
        } else if (action.startsWith("giveItem:")) {
          const itemId = action.split(":")[1];
          const item = content.items.find((it) => it.id === itemId);
          if (item && !p.collectedItems.find((x) => x.id === itemId)) {
            applyWeapon(p, item, RARITY.LEGENDARY, false);
            p.collectedItems.push({ ...item, rarity: RARITY.LEGENDARY });
          }
        } else if (action === "backToMain") {
          setUi((u) => ({ ...u, adminCategory: "main" }));
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

    // Show popup text for the upgrade with rarity color
    const p = s.player;
    const col = RARITY_COLOR[c.rarity] || RARITY_COLOR[RARITY.COMMON];
    pushCombatText(s, p.x, p.y - 30, c.name.toUpperCase(), col.bg, { size: 18, life: 1.5 });

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
      selectedChoiceIndex: 0,
      levelUpFanfareT: 0,
      chestOpenFanfareT: 0,
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
      const nextUi = { ...u, pauseMenu: true, showStats: false, hint: "" };
      uiRef.current = nextUi;
      setUi(nextUi);
      return;
    }

    if (u.pauseMenu || u.showStats) {
      s.running = true;
      s.freezeMode = null;
      const nextUi = { ...u, pauseMenu: false, showStats: false };
      uiRef.current = nextUi;
      setUi(nextUi);
    }
  }












  // Consolidated event handlers - ALL event listeners in ONE useEffect
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    // Resize handler
    const onResize = () => resizeCanvas();
    resizeCanvas();
    window.addEventListener("resize", onResize);
    document.addEventListener("fullscreenchange", onResize);

    // Keyboard down handler
    const down = (e) => {
      console.log("Key pressed:", e.key);
      const k = e.key;
      const u = uiRef.current;

      // Escape key - Toggle pauseMenu (ONLY key that toggles pause)
      if (k === "Escape") {
        e.preventDefault();
        if (u.screen === "running") {
          const s = stateRef.current;
          const nextPauseMenu = !u.pauseMenu;
          const nextUi = { ...u, pauseMenu: nextPauseMenu };
          uiRef.current = nextUi;
          setUi(nextUi);
          if (s) {
            s.running = !nextPauseMenu;
          }
          // Resume audio context
          const a = audioRef.current;
          if (a.ctx && a.ctx.state === 'suspended') {
            a.ctx.resume().catch(() => {});
          }
        } else if (u.screen === "dead" || u.screen === "levelup") {
          const nextUi = { ...u, screen: "menu" };
          uiRef.current = nextUi;
          setUi(nextUi);
        }
        return;
      }

      // MENU NAVIGATION: Flipped A/D keys to match visual rendering
      if (u.screen === "levelup") {
        if (k === "a" || k === "A" || k === "ArrowLeft") {
          e.preventDefault();
          const currentIndex = u.selectedChoiceIndex || 0;
          const count = 3;
          const newIndex = (currentIndex + 1) % count; // Flipped: A moves right
          const nextUi = { ...u, selectedChoiceIndex: newIndex };
          uiRef.current = nextUi;
          setUi(nextUi);
          return;
        }
        if (k === "d" || k === "D" || k === "ArrowRight") {
          e.preventDefault();
          const currentIndex = u.selectedChoiceIndex || 0;
          const count = 3;
          const newIndex = (currentIndex - 1 + count) % count; // Flipped: D moves left
          const nextUi = { ...u, selectedChoiceIndex: newIndex };
          uiRef.current = nextUi;
          setUi(nextUi);
          return;
        }
        // E or Enter or number keys to select
        if (k === "e" || k === "E" || k === "Enter" || k === "1" || k === "2" || k === "3") {
          e.preventDefault();
          const choiceIndex = k === "1" ? 0 : k === "2" ? 1 : k === "3" ? 2 : (u.selectedChoiceIndex || 0);
          pickChoice(choiceIndex);
          return;
        }
      }

      // Tab key - Toggle showStats (NOT pauseMenu)
      if (k === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        if (u.screen === "running") {
          const s = stateRef.current;
          const nextShowStats = !u.showStats;
          const nextUi = { ...u, showStats: nextShowStats };
          uiRef.current = nextUi;
          setUi(nextUi);
          if (s) {
            s.running = !nextShowStats;
          }
        }
        return;
      }

      // M key - toggle mute
      if (k === "m" || k === "M") {
        e.preventDefault();
        e.stopPropagation();
        ensureAudio();
        const nextMuted = !u.muted;
        const nextUi = { ...u, muted: nextMuted };
        uiRef.current = nextUi;
        setUi(nextUi);
        applyAudioToggles(nextUi);
        return;
      }

      // Volume controls: [ and ] keys
      const keyCode = e.keyCode || e.which;
      if (k === "[" || k === "{" || keyCode === 219) {
        e.preventDefault();
        e.stopPropagation();
        ensureAudio();
        const currentVol = u.musicVolume !== undefined ? u.musicVolume : 0.5;
        const newVol = Math.max(0, currentVol - 0.1);
        const nextUi = { ...u, musicVolume: newVol };
        uiRef.current = nextUi;
        setUi(nextUi);
        updateMusicVolume();
        return;
      }
      if (k === "]" || k === "}" || keyCode === 221) {
        e.preventDefault();
        e.stopPropagation();
        ensureAudio();
        const currentVol = u.musicVolume !== undefined ? u.musicVolume : 0.5;
        const newVol = Math.min(1, currentVol + 0.1);
        const nextUi = { ...u, musicVolume: newVol };
        uiRef.current = nextUi;
        setUi(nextUi);
        updateMusicVolume();
        return;
      }

      // F key - fullscreen
      if (k === "f" || k === "F") {
        e.preventDefault();
        ensureAudio();
        requestFullscreen();
        return;
      }

      // Menu screen controls
      if (u.screen === "menu") {
        // Number keys 1-3 to select character
        if (k === "1" || k === "2" || k === "3") {
          e.preventDefault();
          const charIndex = parseInt(k) - 1;
          const char = content.characters[charIndex];
          if (char) setMenuChar(char.id);
          return;
        }
        // A/D for character selection - FIXED: A moves RIGHT (++), D moves LEFT (--)
        if (k === "a" || k === "A" || k === "ArrowLeft") {
          e.preventDefault();
          const currentIndex = content.characters.findIndex(c => c.id === u.selectedChar);
          const charCount = content.characters.length;
          const newIndex = (currentIndex + 1) % charCount; // A moves to next character (right)
          const newCharId = content.characters[newIndex]?.id;
          if (newCharId) setMenuChar(newCharId);
          return;
        }
        if (k === "d" || k === "D" || k === "ArrowRight") {
          e.preventDefault();
          const currentIndex = content.characters.findIndex(c => c.id === u.selectedChar);
          const charCount = content.characters.length;
          const newIndex = (currentIndex - 1 + charCount) % charCount; // D moves to previous character (left)
          const newCharId = content.characters[newIndex]?.id;
          if (newCharId) setMenuChar(newCharId);
          return;
        }
        // E or Enter to start
        if (k === "e" || k === "E" || k === "Enter") {
          e.preventDefault();
          ensureAudio();
          const best = safeBest();
          newRun(best, u.selectedChar);
          return;
        }
      }

      // Dead screen - E to restart
      if (u.screen === "dead") {
        if (k === "e" || k === "E" || k === "Enter") {
          e.preventDefault();
          ensureAudio();
          const best = safeBest();
          newRun(best, u.selectedChar);
          return;
        }
      }

      // Pause menu keyboard navigation
      if (u.screen === "running" && u.pauseMenu) {
        // W/S for up/down navigation
        if (k === "w" || k === "W" || k === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (k === "s" || k === "S" || k === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        // E to select (Continue button)
        if (k === "e" || k === "E" || k === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          setPaused(false);
          return;
        }
        // A/D for music volume control
        if (k === "a" || k === "A") {
          e.preventDefault();
          e.stopPropagation();
          const currentVolume = u.musicVolume !== undefined ? u.musicVolume : 0.5;
          const newVolume = Math.max(0, currentVolume - 0.1);
          const nextUi = { ...u, musicVolume: newVolume };
          uiRef.current = nextUi;
          setUi(nextUi);
          updateMusicVolume();
          return;
        }
        if (k === "d" || k === "D") {
          e.preventDefault();
          e.stopPropagation();
          const currentVolume = u.musicVolume !== undefined ? u.musicVolume : 0.5;
          const newVolume = Math.min(1, currentVolume + 0.1);
          const nextUi = { ...u, musicVolume: newVolume };
          uiRef.current = nextUi;
          setUi(nextUi);
          updateMusicVolume();
          return;
        }
      }

      // Running game controls
      if (u.screen === "running" && stateRef.current?.running) {
        const s = stateRef.current;
        if (!s) return;
        
        if (k === "e" || k === "E") {
          e.preventDefault();
          tryUseInteractable(s);
          return;
        }
        // Shift key for dash/ability
        if (k === "Shift" || k === "ShiftLeft" || k === "ShiftRight") {
          e.preventDefault();
          useAbility(s);
          return;
        }
        // JUMP LOGIC: Diagonal jumping with direction capture
        if (e.key === " ") {
          e.preventDefault();
          const s = stateRef.current;
          // ONLY jump if: button was not already held AND player is on the ground AND screen is running
          if (!keysRef.current.has(" ") && s && s.player.z === 0 && u.screen === "running") {
            keysRef.current.add(" "); // Mark as held
            
            // Set vertical jump velocity
            const baseJumpV = 160.0 * (s.player.jumpHeight || 1.0);
            s.player.jumpV = baseJumpV;
            s.player.jumpT = 1.0;
            
            // Capture current movement direction for diagonal jump
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
              dirX = len ? mx / len : (mx !== 0 ? mx : 0);
              dirY = len ? my / len : (my !== 0 ? my : 0);
            }
            
            // Set horizontal jump velocity (diagonal jump)
            const jumpSpeed = baseJumpV * 0.6; // Horizontal jump speed multiplier
            s.player.jumpVx = dirX * jumpSpeed;
            s.player.jumpVy = dirY * jumpSpeed;
            
            console.log("Jump Triggered - Diagonal:", dirX, dirY);
          }
          return; // Stop further processing
        }
        // Track movement keys - use toLowerCase() for case-insensitive handling
        const keyLower = k?.toLowerCase();
        if (keyLower === "w" || k === "ArrowUp" ||
            keyLower === "s" || k === "ArrowDown" ||
            keyLower === "a" || k === "ArrowLeft" ||
            keyLower === "d" || k === "ArrowRight") {
          // Store lowercase version for letter keys, original for arrow keys
          if (k.startsWith("Arrow")) {
            keysRef.current.add(k);
          } else {
            keysRef.current.add(keyLower);
          }
        }
      }
    };

    // Keyboard up handler - ONLY delete keys (fixes movement bug)
    const up = (e) => {
      const k = e.key;
      const keyLower = k?.toLowerCase();
      
      // Delete both original and lowercase versions for letter keys
      keysRef.current.delete(k);
      if (keyLower && keyLower !== k) {
        keysRef.current.delete(keyLower);
      }
      
      // Handle Space key
      if (k === " " || k === "Space") {
        keysRef.current.delete(" ");
        keysRef.current.delete("Space");
        jumpKeyJustPressedRef.current = false;
      }
      // Handle Shift key variants
      if (k === "Shift" || k === "ShiftLeft" || k === "ShiftRight") {
        keysRef.current.delete("Shift");
        keysRef.current.delete("ShiftLeft");
        keysRef.current.delete("ShiftRight");
      }
    };

    // Blur handler
    const blur = () => {
      keysRef.current.clear();
      jumpKeyJustPressedRef.current = false;
    };

    // Pointer down handler - Force audio on click
    const onPointerDown = (e) => {
      // FORCE AUDIO ON CLICK: Wake up the audio engine at the very top
      const a = audioRef.current;
      if (a.ctx && a.ctx.state === 'suspended') {
        a.ctx.resume().then(() => console.log("AudioContext Resumed"));
      }
      // STABILIZE AUDIO: Only play if paused (don't spam play/pause)
      if (a.menuMusic && a.menuMusic.paused) {
        a.menuMusic.play().catch(() => {});
      }
      
      ensureAudio(); // Fix sound issue
      
      c.setPointerCapture?.(e.pointerId);

      const s = stateRef.current;
      const u = uiRef.current;
      
      // Pause menu click handling
      if (u.screen === "running" && u.pauseMenu) {
        const rect = c.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const w = rect.width;
        const h = rect.height;
        
        const buttonY = 180;
        const buttonH = 50;
        const buttonSpacing = 70;
        const buttonW = 240;
        const buttonX = w * 0.5 - 120;
        
        // Continue button
        if (x >= buttonX && x <= buttonX + buttonW &&
            y >= buttonY && y <= buttonY + buttonH) {
          setPaused(false);
          return;
        }
        
        // New Game button
        if (x >= buttonX && x <= buttonX + buttonW &&
            y >= buttonY + buttonSpacing && y <= buttonY + buttonSpacing + buttonH) {
          const best = safeBest();
          newRun(best, u.selectedChar);
          return;
        }
        
        // Admin button
        if (x >= buttonX && x <= buttonX + buttonW &&
            y >= buttonY + buttonSpacing * 2 && y <= buttonY + buttonSpacing * 2 + buttonH) {
          const nextUi = { ...u, showAdmin: !u.showAdmin };
          uiRef.current = nextUi;
          setUi(nextUi);
          return;
        }
        
        // Mute button
        if (x >= buttonX && x <= buttonX + buttonW &&
            y >= buttonY + buttonSpacing * 3 && y <= buttonY + buttonSpacing * 3 + buttonH) {
          const nextUi = { ...u, muted: !u.muted };
          uiRef.current = nextUi;
          setUi(nextUi);
          applyAudioToggles(nextUi);
          return;
        }
        
        // Volume buttons
        const volumeButtonY = buttonY + buttonSpacing * 4;
        const volumeBarW = 200;
        const volumeBarH = 8;
        const volumeBarX = w * 0.5 - volumeBarW / 2;
        const volumeBarY = volumeButtonY + 21;
        const volButtonSize = 24;
        const volMinusX = volumeBarX - volButtonSize - 8;
        const volPlusX = volumeBarX + volumeBarW + 8;
        const volButtonY = volumeButtonY + 10;
        
        // Volume minus button
        if (x >= volMinusX && x <= volMinusX + volButtonSize &&
            y >= volButtonY && y <= volButtonY + volButtonSize) {
          const currentVolume = u.musicVolume !== undefined ? u.musicVolume : 0.5;
          const newVolume = Math.max(0, currentVolume - 0.1);
          const nextUi = { ...u, musicVolume: newVolume };
          uiRef.current = nextUi;
          setUi(nextUi);
          updateMusicVolume();
          return;
        }
        
        // Volume plus button
        if (x >= volPlusX && x <= volPlusX + volButtonSize &&
            y >= volButtonY && y <= volButtonY + volButtonSize) {
          const currentVolume = u.musicVolume !== undefined ? u.musicVolume : 0.5;
          const newVolume = Math.min(1, currentVolume + 0.1);
          const nextUi = { ...u, musicVolume: newVolume };
          uiRef.current = nextUi;
          setUi(nextUi);
          updateMusicVolume();
          return;
        }
        
        // Admin panel click handling
        if (u.showAdmin) {
          handleAdminClick(x, y, w, h, u, content);
        }
        
        return;
      }
      
      // Stats screen click handling
      if (u.screen === "running" && u.showStats) {
        setPaused(false);
        return;
      }

      // Menu screen click handling
      if (u.screen === "menu") {
        const rect = c.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const w = rect.width;
        const h = rect.height;
        
        // Character selection buttons
        const charButtonY = h * 0.5 + 40;
        const charButtonW = 200;
        const charButtonH = 50;
        const charSpacing = 220;
        const startX = w * 0.5 - (content.characters.length * charSpacing) / 2 + charSpacing / 2;
        
        for (let i = 0; i < content.characters.length; i++) {
          const charX = startX + i * charSpacing;
          if (x >= charX - charButtonW / 2 && x <= charX + charButtonW / 2 &&
              y >= charButtonY && y <= charButtonY + charButtonH) {
            setMenuChar(content.characters[i].id);
            return;
          }
        }
        
        // Start button
        const startButtonY = charButtonY + charButtonH + 40;
        const startButtonW = 200;
        const startButtonH = 50;
        if (x >= w * 0.5 - startButtonW / 2 && x <= w * 0.5 + startButtonW / 2 &&
            y >= startButtonY && y <= startButtonY + startButtonH) {
          ensureAudio();
          const best = safeBest();
          newRun(best, u.selectedChar);
          return;
        }
        
        // Settings button
        const settingsButtonY = startButtonY + startButtonH + 20;
        const settingsButtonW = 150;
        const settingsButtonH = 40;
        if (x >= w * 0.5 - settingsButtonW / 2 && x <= w * 0.5 + settingsButtonW / 2 &&
            y >= settingsButtonY && y <= settingsButtonY + settingsButtonH) {
          const nextUi = { ...u, showSettings: !u.showSettings };
          uiRef.current = nextUi;
          setUi(nextUi);
          return;
        }
        
        // Admin toggle (hidden - click top-left corner)
        if (x < 50 && y < 50) {
          const nextUi = { ...u, showAdmin: !u.showAdmin };
          uiRef.current = nextUi;
          setUi(nextUi);
          return;
        }
        
        return;
      }

      // Dead screen click handling
      if (u.screen === "dead") {
        ensureAudio();
        const best = safeBest();
        newRun(best, u.selectedChar);
        return;
      }

      // Levelup screen click handling
      if (u.screen === "levelup") {
        const rect = c.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const w = rect.width;
        const h = rect.height;
        
        const choices = u.levelChoices || [];
        if (choices.length === 0) return;
        
        const selectedIndex = u.selectedChoiceIndex || 0;
        const choiceY = h * 0.5 + 40;
        const choiceW = 400;
        const choiceH = 80;
        const choiceSpacing = 100;
        const startX = w * 0.5;
        
        for (let i = 0; i < choices.length; i++) {
          const choiceX = startX;
          const choiceYPos = choiceY + (i - selectedIndex) * choiceSpacing;
          
          if (x >= choiceX - choiceW / 2 && x <= choiceX + choiceW / 2 &&
              y >= choiceYPos - choiceH / 2 && y <= choiceYPos + choiceH / 2) {
            pickChoice(i);
            return;
          }
        }
        
        return;
      }

      // Running screen - handle interactable clicks
      if (u.screen === "running" && s) {
        tryUseInteractable(s);
      }
    };

    // Wheel handler for isometric zoom
    const onWheel = (e) => {
      if (!ISO_MODE) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.001 : 0.001;
      setIsoScale(Math.max(0.005, Math.min(0.05, isoScaleRef.current + delta)));
    };

    // Register all event listeners
    window.addEventListener("keydown", down, true);
    document.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up);
    document.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    c.addEventListener("pointerdown", onPointerDown);
    c.addEventListener("wheel", onWheel, { passive: false });

    // Cleanup function
    return () => {
      window.removeEventListener("keydown", down, true);
      document.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up);
      document.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("fullscreenchange", onResize);
      c.removeEventListener("pointerdown", onPointerDown);
      c.removeEventListener("wheel", onWheel);
    };
  }, [content]);

  // Game loop useEffect
  useEffect(() => {
    const step = () => {
      const c = canvasRef.current;
      const s = stateRef.current;
      if (!c) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      const ctx = c.getContext("2d");
      const { w, h } = sizeRef.current;
      
      // HARD FREEZE ON MENUS: Prevent camera and game logic from running when menus are open
      const u = uiRef.current;
      
      // Render-only path for non-running screens (menu, levelup, dead, pause)
      if (u.screen !== 'running' || u.pauseMenu) {
        // Clear and setup canvas
        ctx.clearRect(0, 0, w, h);
        
        // Render world and HUD if state exists
        if (s && u.screen === 'running' && u.pauseMenu) {
          // Pause menu - draw world behind pause overlay
          drawWorld(s, ctx, isoScaleRef.current);
          drawHud(s, ctx, isoScaleRef.current, content);
        } else if (s && u.screen === 'levelup') {
          // Level up screen - draw world behind levelup overlay
          drawWorld(s, ctx, isoScaleRef.current);
          drawHud(s, ctx, isoScaleRef.current, content);
        } else if (!s || u.screen === 'menu' || u.screen === 'dead') {
          // Menu/dead screen - just dark background
          ctx.fillStyle = "#06070c";
          ctx.fillRect(0, 0, w, h);
        }
        
        // Always draw overlay (for menu, pause, levelup, dead screens)
        const overlayState = s || { arena: { w, h }, player: { coins: 0 } };
        drawOverlay(overlayState, ctx, u, content, isoScaleRef.current, overlayState);
        
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      
      // Calculate delta time with proper handling
      const now = performance.now();
      let dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;
      if (dt > 0.1) dt = 0.1; // Prevent huge jumps after lag

      if (s) {
        // FIX CHEST FREEZE: Safety check - if levelup screen but no upgradeCards, trigger upgrade sequence
        if (u.screen === "levelup") {
          const hasUpgradeCards = (s.upgradeCards && s.upgradeCards.length > 0) || (u.levelChoices && u.levelChoices.length > 0);
          if (!hasUpgradeCards) {
            console.warn("Levelup screen with no upgradeCards - triggering upgrade sequence");
            triggerUpgradeSequence(s, content);
          }
        }
        
        // Only update game logic when actually running (not paused, not on levelup/dead/menu screens, not frozen)
        // This freezes the game world and camera when upgrade menu is open or fanfare is playing
        const hasUpgradeCards = u.levelChoices && u.levelChoices.length > 0;
        const fanfareActive = (u.levelUpFanfareT && u.levelUpFanfareT > 0) || (u.chestOpenFanfareT && u.chestOpenFanfareT > 0);
        if (u.screen === "running" && s.running && !u.pauseMenu && s.freezeMode === null && !hasUpgradeCards && !fanfareActive) {
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

        drawWorld(s, ctx, isoScaleRef.current);
        drawHud(s, ctx, isoScaleRef.current, content);

        const u2 = uiRef.current;
        if (u2.screen === "running" && !u2.pauseMenu) {
          u2.score = s.score;
          u2.level = s.level;
          u2.xp = s.xp;
          u2.xpNeed = s.xpNeed;
          u2.coins = s.player.coins;
          u2.timer = s.stageLeft;
        }
        
        // Update UI timers (fanfare animations) - must happen every frame
        if (u2.levelUpFanfareT > 0) {
          u2.levelUpFanfareT = Math.max(0, u2.levelUpFanfareT - dt);
        }
        if (u2.chestOpenFanfareT > 0) {
          u2.chestOpenFanfareT = Math.max(0, u2.chestOpenFanfareT - dt);
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

        drawOverlay(s, ctx, uiRef.current, content, isoScaleRef.current, s);
      } else {
        const fakeS = {
          arena: { w, h },
          player: { coins: 0 },
        };
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#06070c";
        ctx.fillRect(0, 0, w, h);
        drawOverlay(fakeS, ctx, uiRef.current, content, isoScaleRef.current, fakeS);
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafRef.current);
      // Cleanup audio
      const a = audioRef.current;
      if (a.menuMusic) {
        a.menuMusic.pause();
        a.menuMusic = null;
      }
      if (a.battleMusic) {
        a.battleMusic.pause();
        a.battleMusic = null;
      }
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
          height: "min(620px, 100%)",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          boxShadow: "0 0 40px rgba(0,0,0,0.5)",
          border: "1px solid rgba(46,168,255,0.2)",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            imageRendering: "pixelated",
          }}
        />
      </div>
    </div>
  );
}
