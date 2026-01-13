import { clamp } from "../utils/math.js";

/**
 * Check if the document is in fullscreen mode
 */
export function isFullscreen() {
  return !!document.fullscreenElement;
}

/**
 * Toggle fullscreen mode
 */
export function requestFullscreen(wrapRef, canvasRef, setUi, uiRef) {
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

/**
 * Resize canvas to fit container
 */
export function resizeCanvas(canvasHolderRef, canvasRef, sizeRef, stateRef) {
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

/**
 * Safely retrieve best score from localStorage
 */
export function safeBest() {
  try {
    const v = Number(localStorage.getItem("neon_pit_best") || "0");
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}
