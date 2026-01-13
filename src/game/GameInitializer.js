import { clamp, rand } from "../utils/math.js";
import { xpToNext } from "../utils/gameMath.js";

/**
 * Initialize a new game run
 */
export function newRun(
  prevBest,
  charId,
  sizeRef,
  makePlayerFn,
  generateProceduralLevel,
  spawnInteractableFn,
  INTERACT,
  stateRef,
  setUi,
  ensureAudioFn,
  audioRef
) {
  ensureAudioFn();
  // Resume audio on user interaction (start game)
  const a = audioRef.current;
  if (a && a.resumeAudio) {
    a.resumeAudio();
  }

  const { w, h } = sizeRef.current;

  const player = makePlayerFn(charId, w, h);

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

  spawnInteractableFn(s, INTERACT.CHEST);

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
