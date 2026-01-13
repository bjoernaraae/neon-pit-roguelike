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
import { createAudioContext } from "../audio/AudioContext.js";
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
import { isFullscreen as isFullscreenFn, requestFullscreen as requestFullscreenFn, resizeCanvas as resizeCanvasFn, safeBest as safeBestFn } from "../rendering/CanvasManager.js";
import { updateEnemySpawning } from "../game/enemies/EnemySpawnScheduler.js";
import { recordDamage as recordDamageFn, applyPlayerDamage as applyPlayerDamageFn } from "../game/player/PlayerDamageSystem.js";
import { handleAdminClick as handleAdminClickFn, handleAdminAction as handleAdminActionFn } from "../game/admin/AdminPanel.js";
import { awardXP as awardXPFn } from "../game/progression/LevelUpSystem.js";
import { createKeydownHandler, createKeyupHandler, createBlurHandler, createPointerDownHandler, createWheelHandler } from "../game/input/EventHandlers.js";
import { newRun as newRunFn } from "../game/GameInitializer.js";
import { processEnemyDeaths } from "../game/enemies/EnemyDeathSystem.js";
import { updateBossPortalSpawning, updateDifficultyScaling, updateChestSpawning } from "../game/progression/GameProgressionSystem.js";
import { updateHealthRegeneration, updateShieldRegeneration } from "../game/player/PlayerRegenerationSystem.js";
import { updateFrameState } from "../game/FrameUpdateSystem.js";

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
import { renderFrame, syncUIState, updateUITimers, handlePlayerDeath, shouldUpdateGame, checkLevelupState } from "../rendering/RenderOrchestrator.js";
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

  // Audio system - create context object with all audio functions
  const audio = useMemo(() => {
    return createAudioContext(audioRef, uiRef, stateRef, menuMusicUrl, battleMusicUrl, clamp);
  }, []);

  // Audio function aliases for backward compatibility
  const { ensureAudio, applyAudioToggles, updateMusicVolume, updateMusic, playBeep, tickMusic,
          sfxShoot, sfxHit, sfxKill, sfxCoin, sfxCrit, sfxLevelUp, sfxLevel, sfxBoss, sfxGameOver, sfxInteract } = audio;

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
    const c = canvasRef.current;
    if (!c) return;

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
        
        // Render non-running states (pause, levelup, menu, dead)
        renderFrame(s, ctx, u, content, isoScaleRef.current, w, h);
        
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      
      // Calculate delta time with proper handling
      const now = performance.now();
      let dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;
      if (dt > 0.1) dt = 0.1; // Prevent huge jumps after lag

      if (s) {
        // Safety check: fix levelup screen freeze
        checkLevelupState(s, u, triggerUpgradeSequence, content);
        
        // Only update game logic when actually running
        if (shouldUpdateGame(s, u)) {
          // Always update hitStopT, but only update game logic when hitStopT is 0
          if (s.hitStopT > 0) {
            s.hitStopT = Math.max(0, s.hitStopT - dt);
          }
          if (s.hitStopT <= 0) {
            try {
              update(s, dt);
            } catch (error) {
              console.error("Update error:", error);
              s.running = false;
            }
          }
        }

        // Sync UI state from game state
        syncUIState(s, uiRef);
        
        // Update UI animation timers
        updateUITimers(uiRef, dt);

        // Handle player death
        handlePlayerDeath(s, uiRef, setUi, sfxGameOver, safeBest);

        // Render game
        renderFrame(s, ctx, u, content, isoScaleRef.current, w, h);
      } else {
        renderFrame(null, ctx, u, content, isoScaleRef.current, w, h);
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

