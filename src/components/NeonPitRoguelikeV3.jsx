import React, { useEffect, useMemo, useRef, useState } from "react";
import { clamp, lerp, rand, dist2, format } from "../utils/math.js";
import { hexToRgb, lerpColor, adjustBrightness } from "../utils/color.js";
import { deepClone, pickWeighted } from "../utils/data.js";
import { xpToNext, computeSpeed, statLine, buildPreview as buildPreviewUtil, chestCost, mitigateDamage, rollEvasion } from "../utils/gameMath.js";
import { RARITY, RARITY_COLOR } from "../data/constants.js";
import { LATEST_UPDATES } from "../rendering/HudRenderer.js";
import { getVisualRadius, resolveKinematicOverlap, resolveDynamicOverlap } from "../game/systems/CollisionSystem.js";
import { isPointWalkable, findNearestWalkable, hasLineOfSight, circleOverlapsRect } from "../game/world/WalkabilitySystem.js";
import { generateFlowField, getFlowDirection } from "../game/systems/PathfindingSystem.js";
// System function stubs defined inline
import { BSPNode, generateBSPDungeon, convertBSPToGrid, generateWallInfluenceMap } from "../game/world/BSPDungeonGenerator.js";
import { generateProceduralLevel } from "../game/world/LevelGenerator.js";
import { ENEMY_BASE_STATS, getEnemyTierWeights, ELITE_CONFIG, getRandomEliteAbility, getRandomEliteWeakness } from "../data/enemyData.js";
import { createPlayerWithCharacter } from "../data/characterData.js";
import menuMusicUrl from "../audio/music/Menu.mp3";
import battleMusicUrl from "../audio/music/Battle.mp3";
// Audio and effect stubs defined inline
// System function stubs defined inline

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

// Temporarily disable isometric mode for debugging
const ISO_MODE = false;
// import { worldToIso, isoToWorld, getIsoDepth, transformInputForIsometric, drawIsometricCube, drawEntityAsCube, drawIsometricRectangle } from "../rendering/IsometricRenderer.js";
// import { drawWorld } from "../rendering/WorldRenderer.js";
import { drawHud, drawOverlay } from "../rendering/HudRenderer.js";
import { BossController, ConeAttackAbility, LineDashAbility, RingPulseAbility, TeleportAbility, ChargeAbility, MultiShotAbility, BOSS_ABILITY_STATE, DANGER_ZONE_TYPE } from "../game/systems/BossAbilitySystem.js";



// RARITY already imported above
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

  // Audio system stubs - placeholder implementations
  function ensureAudio() {
    // Stub: Audio system not implemented
  }

  function applyAudioToggles(nextUi) {
    // Stub: Audio toggles not implemented
  }

  function updateMusicVolume() {
    // Stub: Music volume not implemented
  }

  function updateMusic(dt) {
    // Stub: Music update not implemented
  }

  function playBeep(params) {
    // Stub: Beep sound not implemented
  }

  function sfxShoot(xNorm = 0, variant = 0) {
    // Stub: Shoot sound not implemented
  }

  function sfxHit(xNorm = 0, variant = 0) {
    // Stub: Hit sound not implemented
  }

  function sfxKill(xNorm = 0) {
    // Stub: Kill sound not implemented
  }

  function sfxCoin(xNorm = 0) {
    // Stub: Coin sound not implemented
  }

  function sfxCrit(xNorm = 0) {
    // Stub: Crit sound not implemented
  }

  function sfxLevelUp() {
    // Stub: Level up sound not implemented
  }

  function sfxLevel() {
    // Stub: Level sound not implemented
  }

  function sfxBoss() {
    // Stub: Boss sound not implemented
  }

  function sfxGameOver() {
    // Stub: Game over sound not implemented
  }

  function sfxInteract() {
    // Stub: Interact sound not implemented
  }

  function tickMusic(dt, waveIntensity) {
    // Stub: Music tick not implemented
  }

  // System function stubs
  const makePlayerFn = (characterId) => {
    // Stub: Player creation not implemented
    return { x: 400, y: 300, weapons: [], hp: 100, maxHp: 100 };
  };

  const shootBulletFn = (s, x, y, angle, dmg, speed, opts, sfxFn) => {
    // Stub: Bullet shooting not implemented
  };

  const spawnInteractableFn = (s, type) => {
    // Stub: Interactable spawning not implemented
  };

  const startBossFn = (s, seconds, bossX, bossY, shakeFn, sfxFn) => {
    // Stub: Boss spawning not implemented
  };

  const spawnEnemyFn = (s, type, x, y) => {
    // Stub: Enemy spawning not implemented
  };

  const applyWeaponFn = (player, weapon, rarity, previewOnly, forcedUpgradeType) => {
    // Stub: Weapon application not implemented
  };

  const fireWeaponFn = (s, acquireTargetFn, shootBulletFn, pushCombatTextFn, bumpShakeFn, sfxShootFn) => {
    // Stub: Weapon firing not implemented
  };

  const nearestInteractableFn = (s, playerX, playerY) => {
    // Stub: Nearest interactable not implemented
    return null;
  };

  const tryUseInteractableFn = (s, INTERACT, triggerUpgradeFn, startBossFn, sfxFn, content, uiRef) => {
    // Stub: Interactable usage not implemented
  };

  const useAbilityFn = (s, acquireTargetFn, shootBulletFn, playBeepFn, keysRef) => {
    // Stub: Ability usage not implemented
  };

  const isFullscreenFn = () => false; // Stub: Always return false
  const requestFullscreenFn = () => {}; // Stub: Do nothing
  const resizeCanvasFn = () => {}; // Stub: Do nothing
  const safeBestFn = () => 0; // Stub: Return 0

  const updateEnemySpawning = (s, dt, intensity, spawnEnemyFn) => {
    // Stub: Enemy spawning not implemented
  };

  const recordDamageFn = (p, src, amt) => {
    // Stub: Damage recording not implemented
  };

  const applyPlayerDamageFn = (s, amount, src, opts) => {
    // Stub: Player damage not implemented
  };

  const handleAdminClickFn = (x, y, w, h, stateRef, uiRef, content, handleAdminAction, setUi) => {
    // Stub: Admin click not implemented
  };

  const handleAdminActionFn = (s, action, INTERACT, startBossFn, spawnInteractableFn, applyWeaponFn, setUi, content, RARITY) => {
    // Stub: Admin action not implemented
  };

  const awardXPFn = (s, amount, x, y, rollChoicesFn, sfxFn, uiRef, setUi) => {
    // Stub: XP awarding not implemented
  };

  const createKeydownHandler = (context) => (e) => {};
  const createKeyupHandler = (context) => (e) => {};
  const createBlurHandler = (context) => (e) => {};
  const createPointerDownHandler = (context) => (e) => {};
  const createWheelHandler = (context) => (e) => {};

  const newRunFn = (prevBest, charId, sizeRef, makePlayerFn, generateLevelFn, spawnInteractableFn, INTERACT, stateRef, setUi, ensureAudioFn, audioRef) => {
    // Stub: New run not implemented
  };

  const processEnemyDeaths = (s, sfxFn) => {
    // Stub: Enemy death processing not implemented
  };

  const updateBossPortalSpawning = (s, dt) => {};
  const updateDifficultyScaling = (s, dt) => {};
  const updateChestSpawning = (s, dt) => {};

  const updateHealthRegeneration = (s, dt) => {};
  const updateShieldRegeneration = (s, dt) => {};

  const updateFrameState = (s, dt, uiRef, tickMusicFn, updateMusicFn) => 0;

  const initializeCamera = () => {};
  const updateCamera = () => {};

  const updateJumpPhysics = (s, dt, keysRef, jumpKeyPressedRef) => {};
  const updateBuffTimers = (p, dt) => {};

  const updatePlayerMovement = (s, dt, keysRef) => {};
  const updateWeaponCooldowns = (s, dt, pushCombatTextFn) => {};

  const updateEnemyStatusEffects = (s, dt, pushCombatTextFn) => {};
  const updateEnemyHitCooldowns = (s, dt) => {};
  const updateEnemyAI = (s, dt, shootBulletFn, applyPlayerDamageFn, sfxHitFn, levelBounds) => {};

  const updateBullets = (s, dt, levelW, levelH, padding, applyPlayerDamageFn, audioRef) => {};
  const updateBoss = (s, dt, applyPlayerDamageFn, sfxHitFn) => {};

  const updateParticles = (s, dt) => {};
  const updateLoot = (s, dt, awardXPFn, sfxCoinFn, audioRef) => {};

  const handleFloorTransition = (s, generateLevelFn, spawnInteractableFn, INTERACT) => {};
  const checkBossTimer = (s, applyPlayerDamageFn) => {};

  const pushCombatTextFn = (s, x, y, text, col, opts) => {};
  const acquireTargetFn = (s, fromX, fromY) => null;

  // These are created via useMemo hooks below, don't stub them here

  // Rendering stubs
  const worldToIso = (x, y) => ({ x, y });
  const isoToWorld = (x, y) => ({ x, y });
  const getIsoDepth = (x, y) => 0;
  const transformInputForIsometric = (input) => input;
  const drawIsometricCube = () => {};
  const drawEntityAsCube = () => {};
  const drawIsometricRectangle = () => {};
  const drawWorld = () => {};

  const bumpShake = (s, intensity, duration) => {};
  const addParticle = (s, x, y, count, life, opts) => {};
  const addExplosion = (s, x, y, intensity, shakeIntensity) => {};
  const addHitFlash = (s, x, y, r, col, life) => {};

  // Rarity multiplier function stub
  const rarityMult = (rarity) => {
    switch (rarity) {
      case RARITY.COMMON: return 1.0;
      case RARITY.UNCOMMON: return 1.2;
      case RARITY.RARE: return 1.5;
      case RARITY.LEGENDARY: return 2.0;
      default: return 1.0;
    }
  };

  // Icon drawing function stub
  const makeIconDraw = (iconName) => {
    return (ctx, x, y, size, rarity) => {
      // Stub: Simple colored rectangle as icon
      ctx.fillStyle = RARITY_COLOR[rarity]?.bg || "#666";
      ctx.fillRect(x - size/2, y - size/2, size, size);
    };
  };

  const content = useMemo(() => {
    try {
      console.log('Creating game content...');
      // Simplified content creation for debugging
      return {
        weapons: [],
        tomes: [],
        items: [],
        characters: [
          {
            id: "cowboy",
            name: "Cowboy",
            subtitle: "Test Character",
            startWeapon: "revolver",
            stats: { hp: 100, speedBase: 75 },
            space: { name: "Test Ability" },
            perk: "Test Perk"
          }
        ]
      };
    } catch (error) {
      console.error('Failed to create game content:', error);
      return {
        weapons: [],
        tomes: [],
        items: [],
        characters: []
      };
    }
  }, []);

  // Create choice rolling functions - stub implementations
  const rollChoicesOfType = (type, rarity) => [];
  const rollLevelChoices = () => [];
  const rollChestChoices = () => [];

  // Create upgrade sequence function - stub implementation
  const triggerUpgradeSequence = (s, content) => {};

  // Create choice handler function - stub implementation
  const pickChoice = (index) => {};

  function isFullscreen() {
    return isFullscreenFn();
  }

  function requestFullscreen() {
    return requestFullscreenFn(wrapRef, canvasRef, setUi, uiRef);
  }

  function safeBest() {
    return safeBestFn();
  }

  function resizeCanvas() {
    return resizeCanvasFn(canvasHolderRef, canvasRef, sizeRef, stateRef);
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
    return newRunFn(prevBest, charId, sizeRef, makePlayer, generateProceduralLevel, spawnInteractable, INTERACT, stateRef, setUi, ensureAudio, audioRef);
  }

  function awardXP(s, amount, x, y) {
    return awardXPFn(s, amount, x, y, rollLevelChoices, sfxLevelUp, uiRef, setUi);
  }

  function nearestInteractable(s) {
    return nearestInteractableFn(s);
  }

  function recordDamage(p, src, amt) {
    return recordDamageFn(p, src, amt);
  }

  function applyPlayerDamage(s, amount, src, opts = {}) {
    return applyPlayerDamageFn(s, amount, src, opts);
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
    
    // Update per-frame state (camera, time, music, flow field)
    const intensity = updateFrameState(s, dt, uiRef, tickMusic, updateMusic);

    // Update player physics and buff timers
    updateBuffTimers(p, dt);
    updateJumpPhysics(s, dt, keysRef, jumpKeyJustPressedRef);

    if (s.stageLeft > 0) s.stageLeft = Math.max(0, s.stageLeft - dt);

    // Game progression: boss portal, difficulty scaling, chest spawning
    updateBossPortalSpawning(s, spawnInteractable, INTERACT);
    updateDifficultyScaling(s);
    updateChestSpawning(s, dt, spawnInteractable, INTERACT);

    // Update player movement and weapon cooldowns
    updatePlayerMovement(s, dt, keysRef);
    updateWeaponCooldowns(s, dt, pushCombatText);
    
    // Fire weapons that are ready
    fireWeapon(s);

    // Enemy spawning scheduler
    updateEnemySpawning(s, dt, intensity, spawnEnemy);

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

    // Process enemy deaths and loot drops
    processEnemyDeaths(s, sfxKill);

    // Player regeneration
    updateHealthRegeneration(p, dt);
    updateShieldRegeneration(s);

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
    return handleAdminClickFn(x, y, w, h, stateRef, content, handleAdminAction);
  }

  function handleAdminAction(s, action) {
    return handleAdminActionFn(s, action, INTERACT, startBoss, spawnInteractable, applyWeapon, setUi, content, RARITY);
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
    console.log('Setting up canvas and event handlers');
    const c = canvasRef.current;
    if (!c) {
      console.error('Canvas not found');
      return;
    }
    console.log('Canvas found, setting up...');

    // Resize handler
    const onResize = () => resizeCanvas();
    resizeCanvas();
    window.addEventListener("resize", onResize);
    document.addEventListener("fullscreenchange", onResize);

    // Create event handler context
    const handlerContext = {
      canvasRef, audioRef, uiRef, setUi, stateRef, keysRef, jumpKeyJustPressedRef, content,
      ensureAudio, updateMusicVolume, applyAudioToggles, requestFullscreen,
      setMenuChar, safeBest, newRun, pickChoice, setPaused, tryUseInteractable,
      useAbility, setIsoScale, isoScaleRef, ISO_MODE, handleAdminClick
    };

    // Create handlers using extracted functions
    const down = createKeydownHandler(handlerContext);
    const up = createKeyupHandler(keysRef, jumpKeyJustPressedRef);
    const blur = createBlurHandler(keysRef, jumpKeyJustPressedRef);
    const onPointerDown = createPointerDownHandler(handlerContext);
    const onWheel = createWheelHandler(ISO_MODE, setIsoScale, isoScaleRef);

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
    console.log('Starting game loop');
    const step = () => {
      const c = canvasRef.current;
      const s = stateRef.current;
      if (!c) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      const ctx = c.getContext("2d");
      if (!ctx) {
        console.error('Failed to get canvas context');
        rafRef.current = requestAnimationFrame(step);
        return;
      }
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
          console.log('Rendering menu/dead screen, content:', !!content, 'characters:', content?.characters?.length);
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

