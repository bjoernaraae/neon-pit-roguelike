/**
 * Sound Effects System
 * 
 * Synthesizes sound effects using the Web Audio API.
 * All sounds are generated procedurally using oscillators.
 */

import { clamp } from "../utils/math.js";

/**
 * Play a synthesized beep sound
 * @param {Object} audioRef - React ref containing audio state
 * @param {Object} params - Sound parameters
 * @param {string} params.type - Oscillator type ("sine", "square", "triangle", "sawtooth")
 * @param {number} params.f0 - Starting frequency in Hz
 * @param {number} params.f1 - Ending frequency in Hz
 * @param {number} params.dur - Duration in seconds
 * @param {number} params.gain - Volume (0-1)
 * @param {number} params.pan - Stereo pan (-1 to 1)
 * @param {string} params.to - Audio bus ("sfx" or "music")
 */
export function playBeep(audioRef, { type = "sine", f0 = 440, f1 = 440, dur = 0.08, gain = 0.2, pan = 0, to = "sfx" }) {
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

/**
 * Play weapon shoot sound with variants
 * @param {Object} audioRef - React ref containing audio state
 * @param {number} xNorm - Normalized X position for panning (-1 to 1)
 * @param {number} variant - Sound variant (0=default, 1=poison, 2=freeze, 3=fire, 4=bone)
 */
export function sfxShoot(audioRef, xNorm = 0, variant = 0) {
  const variants = [
    { type: "triangle", f0: 900, f1: 520, dur: 0.045 }, // Default/revolver
    { type: "square", f0: 750, f1: 400, dur: 0.05 }, // Poison (lower, wetter)
    { type: "sawtooth", f0: 1100, f1: 600, dur: 0.04 }, // Freeze (higher, sharper)
    { type: "sawtooth", f0: 600, f1: 300, dur: 0.08 }, // Fire (lower, longer, whoosh)
    { type: "square", f0: 850, f1: 480, dur: 0.04 }, // Bone
  ];
  const v = variants[variant % variants.length];
  playBeep(audioRef, { ...v, gain: variant === 3 ? 0.12 : 0.1, pan: xNorm });
}

/**
 * Play hit sound with variants
 * @param {Object} audioRef - React ref containing audio state
 * @param {number} xNorm - Normalized X position for panning (-1 to 1)
 * @param {number} variant - Sound variant (0-2)
 */
export function sfxHit(audioRef, xNorm = 0, variant = 0) {
  const variants = [
    { type: "square", f0: 240, f1: 120, dur: 0.06 },
    { type: "sawtooth", f0: 220, f1: 100, dur: 0.055 },
    { type: "square", f0: 260, f1: 140, dur: 0.065 },
  ];
  const v = variants[variant % variants.length];
  playBeep(audioRef, { ...v, gain: 0.13, pan: xNorm });
}

/**
 * Play enemy kill sound
 * @param {Object} audioRef - React ref containing audio state
 * @param {number} xNorm - Normalized X position for panning (-1 to 1)
 */
export function sfxKill(audioRef, xNorm = 0) {
  playBeep(audioRef, { type: "sawtooth", f0: 520, f1: 160, dur: 0.07, gain: 0.13, pan: xNorm });
  // Add a satisfying pop
  playBeep(audioRef, { type: "sine", f0: 200, f1: 80, dur: 0.08, gain: 0.08, pan: xNorm });
}

/**
 * Play coin collection sound
 * @param {Object} audioRef - React ref containing audio state
 * @param {number} xNorm - Normalized X position for panning (-1 to 1)
 */
export function sfxCoin(audioRef, xNorm = 0) {
  playBeep(audioRef, { type: "sine", f0: 860, f1: 1200, dur: 0.06, gain: 0.11, pan: xNorm });
  // Add sparkle
  playBeep(audioRef, { type: "triangle", f0: 1200, f1: 1400, dur: 0.04, gain: 0.06, pan: xNorm });
}

/**
 * Play critical hit sound
 * @param {Object} audioRef - React ref containing audio state
 * @param {number} xNorm - Normalized X position for panning (-1 to 1)
 */
export function sfxCrit(audioRef, xNorm = 0) {
  playBeep(audioRef, { type: "sine", f0: 600, f1: 800, dur: 0.1, gain: 0.15, pan: xNorm });
  playBeep(audioRef, { type: "triangle", f0: 1000, f1: 1200, dur: 0.08, gain: 0.1, pan: xNorm });
}

/**
 * Play level up sound
 * @param {Object} audioRef - React ref containing audio state
 */
export function sfxLevelUp(audioRef) {
  playBeep(audioRef, { type: "sine", f0: 400, f1: 800, dur: 0.2, gain: 0.18, pan: 0 });
  playBeep(audioRef, { type: "sine", f0: 600, f1: 1000, dur: 0.18, gain: 0.15, pan: 0 });
}

/**
 * Play level transition sound
 * @param {Object} audioRef - React ref containing audio state
 */
export function sfxLevel(audioRef) {
  playBeep(audioRef, { type: "triangle", f0: 520, f1: 1040, dur: 0.18, gain: 0.16, pan: 0 });
}

/**
 * Play boss appear sound
 * @param {Object} audioRef - React ref containing audio state
 */
export function sfxBoss(audioRef) {
  playBeep(audioRef, { type: "square", f0: 140, f1: 90, dur: 0.22, gain: 0.2, pan: 0 });
}

/**
 * Play game over sound
 * @param {Object} audioRef - React ref containing audio state
 */
export function sfxGameOver(audioRef) {
  playBeep(audioRef, { type: "sawtooth", f0: 220, f1: 80, dur: 0.35, gain: 0.22, pan: 0 });
}

/**
 * Play interact sound
 * @param {Object} audioRef - React ref containing audio state
 */
export function sfxInteract(audioRef) {
  playBeep(audioRef, { type: "sine", f0: 740, f1: 980, dur: 0.08, gain: 0.12, pan: 0 });
}
