import React, { useEffect, useMemo, useRef, useState } from "react";
import { clamp, lerp, rand, dist2, format } from "../utils/math.js";
import { hexToRgb, lerpColor, adjustBrightness } from "../utils/color.js";
import { deepClone, pickWeighted } from "../utils/data.js";
import { xpToNext, computeSpeed, statLine, buildPreview as buildPreviewUtil, chestCost, mitigateDamage, rollEvasion } from "../utils/gameMath.js";
import { getRarityWeights, rollRarity, rarityMult } from "../data/raritySystem.js";
import { LATEST_UPDATES } from "../data/gameConstants.js";
import { bumpShake, addParticle, addExplosion, addHitFlash } from "../game/effects/VisualEffects.js";
import { makeIconDraw } from "../rendering/IconRenderer.js";
import { getVisualRadius, resolveKinematicOverlap, resolveDynamicOverlap } from "../game/systems/CollisionSystem.js";
import { isPointWalkable, findNearestWalkable, hasLineOfSight, circleOverlapsRect } from "../game/world/WalkabilitySystem.js";
import { generateFlowField, getFlowDirection } from "../game/systems/PathfindingSystem.js";
import { initializeCamera, updateCamera } from "../game/systems/CameraSystem.js";
import { updateJumpPhysics, updateBuffTimers } from "../game/systems/PhysicsSystem.js";
import { updatePlayerMovement, updateWeaponCooldowns } from "../game/systems/PlayerUpdateSystem.js";
import { updateEnemyStatusEffects, updateEnemyHitCooldowns } from "../game/systems/StatusEffectSystem.js";
import { updateEnemyAI } from "../game/systems/EnemyAISystem.js";
import { updateBullets } from "../game/projectiles/BulletUpdateSystem.js";
import { updateBoss } from "../game/systems/BossUpdateSystem.js";
import { updateParticles } from "../game/effects/ParticleSystem.js";
import { updateLoot } from "../game/systems/LootSystem.js";
import { handleFloorTransition, checkBossTimer } from "../game/progression/FloorTransition.js";
import { BSPNode, generateBSPDungeon, convertBSPToGrid, generateWallInfluenceMap } from "../game/world/BSPDungeonGenerator.js";
import { generateProceduralLevel } from "../game/world/LevelGenerator.js";
import { ENEMY_BASE_STATS, getEnemyTierWeights, ELITE_CONFIG, getRandomEliteAbility, getRandomEliteWeakness } from "../data/enemyData.js";
import { createPlayerWithCharacter } from "../data/characterData.js";
import menuMusicUrl from "../audio/music/Menu.mp3";
import battleMusicUrl from "../audio/music/Battle.mp3";
import { ensureAudio as ensureAudioFn, applyAudioToggles as applyAudioTogglesFn, updateMusicVolume as updateMusicVolumeFn } from "../audio/AudioManager.js";
import { updateMusic as updateMusicFn, tickMusic as tickMusicFn } from "../audio/MusicController.js";
import { playBeep as playBeepFn, sfxShoot as sfxShootFn, sfxHit as sfxHitFn, sfxKill as sfxKillFn, sfxCoin as sfxCoinFn, sfxCrit as sfxCritFn, sfxLevelUp as sfxLevelUpFn, sfxLevel as sfxLevelFn, sfxBoss as sfxBossFn, sfxGameOver as sfxGameOverFn, sfxInteract as sfxInteractFn } from "../audio/SoundEffects.js";
import { pushCombatText as pushCombatTextFn } from "../game/effects/CombatText.js";
import { acquireTarget as acquireTargetFn } from "../game/systems/TargetingSystem.js";
import { makePlayer as makePlayerFn } from "../game/player/PlayerFactory.js";
import { shootBullet as shootBulletFn } from "../game/projectiles/BulletFactory.js";
import { spawnInteractable as spawnInteractableFn } from "../game/interactables/InteractableSpawner.js";
import { startBoss as startBossFn } from "../game/enemies/BossSpawner.js";
import { spawnEnemy as spawnEnemyFn } from "../game/enemies/EnemySpawner.js";
import { applyWeapon as applyWeaponFn } from "../game/progression/UpgradeSystem.js";
import { fireWeapon as fireWeaponFn } from "../game/weapons/WeaponSystem.js";
import { createChoiceRoller } from "../game/progression/ChoiceRoller.js";
import { createUpgradeSequence } from "../game/progression/UpgradeSequence.js";
import { createChoiceHandler } from "../game/progression/ChoiceHandler.js";
import { nearestInteractable as nearestInteractableFn, tryUseInteractable as tryUseInteractableFn } from "../game/interactables/InteractionHandler.js";
import { useAbility as useAbilityFn } from "../game/player/PlayerAbilities.js";

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

  // Audio system wrappers - delegate to audio modules
  function ensureAudio() {
    ensureAudioFn(audioRef, uiRef, menuMusicUrl, battleMusicUrl, applyAudioToggles);
  }

  function applyAudioToggles(nextUi) {
    applyAudioTogglesFn(audioRef, nextUi, updateMusicVolume);
  }

  function updateMusicVolume() {
    updateMusicVolumeFn(audioRef, uiRef);
  }

  function updateMusic(dt) {
    updateMusicFn(audioRef, uiRef, stateRef, dt, ensureAudio, updateMusicVolume);
  }

  function playBeep(params) {
    playBeepFn(audioRef, params);
  }

  function sfxShoot(xNorm = 0, variant = 0) {
    sfxShootFn(audioRef, xNorm, variant);
  }

  function sfxHit(xNorm = 0, variant = 0) {
    sfxHitFn(audioRef, xNorm, variant);
  }

  function sfxKill(xNorm = 0) {
    sfxKillFn(audioRef, xNorm);
  }

  function sfxCoin(xNorm = 0) {
    sfxCoinFn(audioRef, xNorm);
  }

  function sfxCrit(xNorm = 0) {
    sfxCritFn(audioRef, xNorm);
  }

  function sfxLevelUp() {
    sfxLevelUpFn(audioRef);
  }

  function sfxLevel() {
    sfxLevelFn(audioRef);
  }

  function sfxBoss() {
    sfxBossFn(audioRef);
  }

  function sfxGameOver() {
    sfxGameOverFn(audioRef);
  }

  function sfxInteract() {
    sfxInteractFn(audioRef);
  }

  function tickMusic(dt, waveIntensity) {
    tickMusicFn(audioRef, dt, waveIntensity, playBeep, clamp);
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

  // Create choice rolling functions with dependencies
  const { rollChoicesOfType, rollLevelChoices, rollChestChoices } = useMemo(() => {
    return createChoiceRoller({
      stateRef,
      content,
      applyWeapon,
      pushCombatText,
      sfxInteract,
    });
  }, [content]);

  // Create upgrade sequence function
  const triggerUpgradeSequence = useMemo(() => {
    return createUpgradeSequence({
      uiRef,
      setUi,
      sfxLevelUp,
      rollChestChoices,
    });
  }, [rollChestChoices]);

  // Create choice handler function
  const pickChoice = useMemo(() => {
    return createChoiceHandler({
      stateRef,
      uiRef,
      setUi,
      pushCombatText,
    });
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

  // Spawning & Factory wrappers - delegate to extracted modules
  function spawnEnemy(s) {
    spawnEnemyFn(s);
  }

  function acquireTarget(s, fromX, fromY) {
    return acquireTargetFn(s, fromX, fromY);
  }

  function pushCombatText(s, x, y, text, col, opts = {}) {
    pushCombatTextFn(s, x, y, text, col, opts);
  }

  function shootBullet(s, x, y, angle, dmg, speed, opts) {
    return shootBulletFn(s, x, y, angle, dmg, speed, opts, sfxShoot);
  }

  function applyWeapon(p, weaponDef, rarity, previewOnly, forcedUpgradeType = null) {
    applyWeaponFn(p, weaponDef, rarity, previewOnly, forcedUpgradeType);
  }

  function fireWeapon(s) {
    fireWeaponFn(s, acquireTarget, shootBullet, pushCombatText, bumpShake, sfxShoot);
  }

  function spawnInteractable(s, kind) {
    spawnInteractableFn(s, kind);
  }

  // rollChoicesOfType, rollLevelChoices, rollChestChoices created via factory above


  // rollLevelChoices, rollChestChoices, triggerUpgradeSequence created via factory above

  // Old implementations removed - using factory functions


  function startBoss(s, seconds, bossX = null, bossY = null) {
    startBossFn(s, seconds, bossX, bossY, bumpShake, sfxBoss);
  }

  function makePlayer(charId, w, h) {
    return makePlayerFn(charId, w, h, content, applyWeapon);
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
      _debugCameraUntil: -1, // For debug logging camera movement after levelup
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
      
      // FIX CAMERA: Center camera on player BEFORE entering levelup screen
      // This prevents the off-center camera issue when the levelup overlay appears
      const { w, h } = s.arena;
      if (ISO_MODE) {
        s.camera.x = p.x;
        s.camera.y = p.y;
      } else {
        const targetX = p.x - w / 2;
        const targetY = p.y - h / 2;
        s.camera.x = targetX;
        s.camera.y = targetY;
        
        // Clamp to level bounds
        if (s.levelData) {
          s.camera.x = clamp(s.camera.x, 0, Math.max(0, s.levelData.w - w));
          s.camera.y = clamp(s.camera.y, 0, Math.max(0, s.levelData.h - h));
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
    return nearestInteractableFn(s);
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
    return tryUseInteractableFn(s, INTERACT, triggerUpgradeSequence, startBoss, sfxInteract, content, uiRef);
  }

  function useAbility(s) {
    return useAbilityFn(s, acquireTarget, shootBullet, playBeep, keysRef);
  }

  function update(s, dt) {
    const p = s.player;
    const { w, h, padding } = s.arena;
    
    // Initialize and update camera
    initializeCamera(s, w, h);
    updateCamera(s, dt, w, h, uiRef);

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

    // Update player physics and buff timers
    updateBuffTimers(p, dt);
    updateJumpPhysics(s, dt, keysRef, jumpKeyJustPressedRef);

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

    // Update player movement and weapon cooldowns
    updatePlayerMovement(s, dt, keysRef);
    updateWeaponCooldowns(s, dt, pushCombatText);
    
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

    // Update enemy status effects (poison, burn, slow, elite abilities)
    updateEnemyStatusEffects(s, dt, pushCombatText);
    
    // Update per-enemy hit cooldowns (for orbiting blades, etc.)
    updateEnemyHitCooldowns(s, dt);

    // Update enemy AI, pathfinding, movement, and collision
    updateEnemyAI(s, dt, shootBullet, applyPlayerDamage, sfxHit, levelBounds);

    // Update all bullets (movement, collision, effects)
    const levelW = s.levelData ? s.levelData.w : w;
    const levelH = s.levelData ? s.levelData.h : h;
    updateBullets(s, dt, levelW, levelH, padding, applyPlayerDamage, audioRef);

    // Update boss (abilities, movement, collision, phase transitions)
    updateBoss(s, dt, applyPlayerDamage, sfxHit);

    // Handle boss death and floor transition
    handleFloorTransition(s, generateProceduralLevel, spawnInteractable, INTERACT);
    
    // Check boss timer (instant kill if time runs out)
    checkBossTimer(s, applyPlayerDamage);

    // Update and collect loot (XP gems, coins, consumables with magnet pickup)
    updateLoot(s, dt, awardXP, sfxCoin, audioRef);

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

    // Floor transition happens when boss is defeated, not on timer
    // (Boss must be defeated to progress)

    // Update all particle effects (particles, flashes, floaters, burning areas, auras)
    updateParticles(s, dt);

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

  // pickChoice created via factory above

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
      // CRITICAL: ESCAPE KEY MUST BE FIRST - Handle BEFORE anything else
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        
        const currentUi = uiRef.current;
        
        if (currentUi.screen === "running") {
          // Toggle pause menu - use functional setState for proper React update
          setUi(prev => {
            const nextPauseMenu = !prev.pauseMenu;
            const nextUi = { ...prev, pauseMenu: nextPauseMenu };
            uiRef.current = nextUi;
            
            // Update game running state
            const s = stateRef.current;
            if (s) {
              s.running = !nextPauseMenu;
            }
            
            // Resume audio context
            const a = audioRef.current;
            if (a.ctx && a.ctx.state === 'suspended') {
              a.ctx.resume().catch(() => {});
            }
            
            console.log("ESC: Pause menu toggled to", nextPauseMenu);
            return nextUi;
          });
        } else if (currentUi.screen === "dead" || currentUi.screen === "levelup") {
          // Exit to menu
          setUi(prev => {
            const nextUi = { ...prev, screen: "menu" };
            uiRef.current = nextUi;
            console.log("ESC: Returning to menu");
            return nextUi;
          });
        }
        return; // ONLY return for ESC key
      }
      
      // Log all other keys for debugging
      console.log("Key pressed:", e.key, "Screen:", uiRef.current.screen);
      const k = e.key;
      const u = uiRef.current;

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
        // E or Enter to start game with selected character
        if (k === "e" || k === "E" || k === "Enter") {
          e.preventDefault();
          console.log("E pressed on menu - Starting game with character:", u.selectedChar);
          ensureAudio();
          const best = safeBest();
          newRun(best, u.selectedChar);
          return;
        }
        return; // Consume all other keys on menu screen
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
      // AUDIO BOOTSTRAP: Force audio resume and play menu music if on menu screen
      const a = audioRef.current;
      const currentUi = uiRef.current;
      
      if (a.ctx && a.ctx.state === 'suspended') {
        a.ctx.resume().then(() => console.log("AudioContext Resumed"));
      }
      
      // Play menu music if on menu screen and music is paused
      if (currentUi.screen === 'menu' && a.menuMusic && a.menuMusic.paused) {
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
          console.log("Admin panel click:", x, y);
          handleAdminClick(x, y, w, h, u, content);
          return; // CRITICAL: Return after handling admin click
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
        
        // Mute button (top right)
        const muteButtonX = w - 140;
        const muteButtonY = 20;
        const muteButtonW = 120;
        const muteButtonH = 35;
        if (x >= muteButtonX && x <= muteButtonX + muteButtonW &&
            y >= muteButtonY && y <= muteButtonY + muteButtonH) {
          ensureAudio();
          const nextMuted = !u.muted;
          const nextUi = { ...u, muted: nextMuted };
          uiRef.current = nextUi;
          setUi(nextUi);
          applyAudioToggles(nextUi);
          console.log("Menu: Mute toggled to", nextMuted);
          return;
        }
        
        // Volume buttons (below mute button)
        const volumeY = muteButtonY + muteButtonH + 10;
        const volumeBarW = 100;
        const volumeBarX = muteButtonX + (muteButtonW - volumeBarW) / 2;
        const volButtonSize = 18;
        const volMinusX = volumeBarX - volButtonSize - 3;
        const volPlusX = volumeBarX + volumeBarW + 3;
        const volButtonY = volumeY + 1;
        
        // Minus button
        if (x >= volMinusX && x <= volMinusX + volButtonSize &&
            y >= volButtonY && y <= volButtonY + volButtonSize) {
          ensureAudio();
          const currentVolume = u.musicVolume !== undefined ? u.musicVolume : 0.5;
          const newVolume = Math.max(0, currentVolume - 0.1);
          const nextUi = { ...u, musicVolume: newVolume };
          uiRef.current = nextUi;
          setUi(nextUi);
          updateMusicVolume();
          console.log("Menu: Volume decreased to", newVolume);
          return;
        }
        
        // Plus button
        if (x >= volPlusX && x <= volPlusX + volButtonSize &&
            y >= volButtonY && y <= volButtonY + volButtonSize) {
          ensureAudio();
          const currentVolume = u.musicVolume !== undefined ? u.musicVolume : 0.5;
          const newVolume = Math.min(1, currentVolume + 0.1);
          const nextUi = { ...u, musicVolume: newVolume };
          uiRef.current = nextUi;
          setUi(nextUi);
          updateMusicVolume();
          console.log("Menu: Volume increased to", newVolume);
          return;
        }
        
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
      const { w, h, dpr } = sizeRef.current;
      
      // CRITICAL: Scale context to match DPR (device pixel ratio)
      // Without this, rendering coordinates don't match canvas size
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      
      // HARD FREEZE ON MENUS: Prevent camera and game logic from running when menus are open
      const u = uiRef.current;
      
      // Render-only path for non-running screens (menu, levelup, dead, pause)
      if (u.screen !== 'running' || u.pauseMenu) {
        // CRITICAL: Update music AND fanfare timers even in render-only path
        const dt = 0.016; // ~60fps frame time
        updateMusic(dt);
        
        // CRITICAL FIX: Update fanfare timers on levelup screen
        if (u.screen === 'levelup') {
          const u2 = { ...u };
          if (u2.levelUpFanfareT > 0) {
            u2.levelUpFanfareT = Math.max(0, u2.levelUpFanfareT - dt);
          }
          if (u2.chestOpenFanfareT > 0) {
            u2.chestOpenFanfareT = Math.max(0, u2.chestOpenFanfareT - dt);
          }
          // Only update if timers actually changed
          if (u2.levelUpFanfareT !== u.levelUpFanfareT || u2.chestOpenFanfareT !== u.chestOpenFanfareT) {
            uiRef.current = u2;
            setUi(u2);
          }
        }
        
        // Clear and setup canvas
        ctx.clearRect(0, 0, w, h);
        
        // CRITICAL RENDERING STACK FIX: Draw in exact order
        if (s && u.screen === 'running' && u.pauseMenu) {
          // 1. Draw game world (background)
          drawWorld(s, ctx, isoScaleRef.current);
          drawHud(s, ctx, isoScaleRef.current, content);
          
          // 2. Draw semi-transparent overlay
          ctx.fillStyle = "rgba(0,0,0,0.85)";
          ctx.fillRect(0, 0, w, h);
          
          // 3. Draw pause menu cards/UI in SCREEN COORDINATES
          drawOverlay(s, ctx, u, content, isoScaleRef.current, s);
        } else if (s && u.screen === 'levelup') {
          // LEVELUP SCREEN FIX: Draw world, overlay, then cards
          // 1. Draw game world (background)
          drawWorld(s, ctx, isoScaleRef.current);
          drawHud(s, ctx, isoScaleRef.current, content);
          
          // 2. Draw semi-transparent overlay
          ctx.fillStyle = "rgba(0,0,0,0.85)";
          ctx.fillRect(0, 0, w, h);
          
          // 3. IMMEDIATELY draw upgrade cards in SCREEN COORDINATES (w/2, h/2)
          drawOverlay(s, ctx, u, content, isoScaleRef.current, s);
        } else if (!s || u.screen === 'menu' || u.screen === 'dead') {
          // Menu/dead screen - dark background then overlay
          ctx.fillStyle = "#06070c";
          ctx.fillRect(0, 0, w, h);
          
          const overlayState = s || { arena: { w, h }, player: { coins: 0 } };
          drawOverlay(overlayState, ctx, u, content, isoScaleRef.current, overlayState);
        }
        
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

