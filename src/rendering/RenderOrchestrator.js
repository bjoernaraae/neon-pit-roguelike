import { drawWorld } from "./WorldRenderer.js";
import { drawHud, drawOverlay } from "./HudRenderer.js";

/**
 * Render a specific screen state (menu, pause, levelup, etc.)
 */
function renderScreenState(s, ctx, u, content, isoScale, w, h) {
  if (s && u.screen === 'running' && u.pauseMenu) {
    // Pause menu: game world + dark overlay + pause UI
    drawWorld(s, ctx, isoScale);
    drawHud(s, ctx, isoScale, content);
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(0, 0, w, h);
    drawOverlay(s, ctx, u, content, isoScale, s);
  } else if (s && u.screen === 'levelup') {
    // Levelup screen: game world + dark overlay + upgrade cards
    drawWorld(s, ctx, isoScale);
    drawHud(s, ctx, isoScale, content);
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(0, 0, w, h);
    drawOverlay(s, ctx, u, content, isoScale, s);
  } else if (!s || u.screen === 'menu' || u.screen === 'dead') {
    // Menu/dead screen: dark background + overlay
    ctx.fillStyle = "#06070c";
    ctx.fillRect(0, 0, w, h);
    const overlayState = s || { arena: { w, h }, player: { coins: 0 } };
    drawOverlay(overlayState, ctx, u, content, isoScale, overlayState);
  }
}

/**
 * Render the running game
 */
function renderRunningGame(s, ctx, u, content, isoScale) {
  drawWorld(s, ctx, isoScale);
  drawHud(s, ctx, isoScale, content);
  drawOverlay(s, ctx, u, content, isoScale, s);
}

/**
 * Render fallback (no state)
 */
function renderFallback(ctx, u, content, isoScale, w, h) {
  const fakeS = {
    arena: { w, h },
    player: { coins: 0 },
  };
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#06070c";
  ctx.fillRect(0, 0, w, h);
  drawOverlay(fakeS, ctx, u, content, isoScale, fakeS);
}

/**
 * Update UI state from game state
 */
export function syncUIState(s, uiRef) {
  const u = uiRef.current;
  if (u.screen === "running" && !u.pauseMenu) {
    u.score = s.score;
    u.level = s.level;
    u.xp = s.xp;
    u.xpNeed = s.xpNeed;
    u.coins = s.player.coins;
    u.timer = s.stageLeft;
  }
}

/**
 * Update UI animation timers
 */
export function updateUITimers(uiRef, dt) {
  const u = uiRef.current;
  if (u.levelUpFanfareT > 0) {
    u.levelUpFanfareT = Math.max(0, u.levelUpFanfareT - dt);
  }
  if (u.chestOpenFanfareT > 0) {
    u.chestOpenFanfareT = Math.max(0, u.chestOpenFanfareT - dt);
  }
}

/**
 * Handle player death and transition to death screen
 */
export function handlePlayerDeath(s, uiRef, setUi, sfxGameOverFn, safeBestFn) {
  if (s.player.hp <= 0 && uiRef.current.screen !== "dead") {
    sfxGameOverFn();
    const best = safeBestFn();
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
}

/**
 * Main render orchestration - handles all rendering paths
 */
export function renderFrame(s, ctx, u, content, isoScale, w, h) {
  if (!s) {
    renderFallback(ctx, u, content, isoScale, w, h);
    return;
  }

  // Check if we're in a special screen state (pause, levelup, menu, dead)
  if ((u.screen === 'running' && u.pauseMenu) || u.screen === 'levelup' || u.screen === 'menu' || u.screen === 'dead') {
    renderScreenState(s, ctx, u, content, isoScale, w, h);
  } else {
    // Normal running game
    renderRunningGame(s, ctx, u, content, isoScale);
  }
}

/**
 * Check if game should update (not paused, not frozen, etc.)
 */
export function shouldUpdateGame(s, u) {
  const hasUpgradeCards = u.levelChoices && u.levelChoices.length > 0;
  const fanfareActive = (u.levelUpFanfareT && u.levelUpFanfareT > 0) || (u.chestOpenFanfareT && u.chestOpenFanfareT > 0);
  return u.screen === "running" && s.running && !u.pauseMenu && s.freezeMode === null && !hasUpgradeCards && !fanfareActive;
}

/**
 * Safety check for levelup screen (prevent freeze)
 */
export function checkLevelupState(s, u, triggerUpgradeSequence, content) {
  if (u.screen === "levelup") {
    const hasUpgradeCards = (s.upgradeCards && s.upgradeCards.length > 0) || (u.levelChoices && u.levelChoices.length > 0);
    if (!hasUpgradeCards) {
      console.warn("Levelup screen with no upgradeCards - triggering upgrade sequence");
      triggerUpgradeSequence(s, content);
    }
  }
}
