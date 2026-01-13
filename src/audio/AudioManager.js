/**
 * Audio Manager
 * 
 * Handles Web Audio API context initialization, audio nodes,
 * and HTML5 Audio elements for music playback.
 */

/**
 * Initialize audio system
 * Creates audio context, gain nodes, and music audio elements
 * @param {Object} audioRef - React ref containing audio state
 * @param {Object} uiRef - React ref containing UI state
 * @param {string} menuMusicUrl - URL to menu music file
 * @param {string} battleMusicUrl - URL to battle music file
 * @param {Function} applyAudioTogglesCallback - Callback to apply audio toggles after init
 */
export function ensureAudio(audioRef, uiRef, menuMusicUrl, battleMusicUrl, applyAudioTogglesCallback) {
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

  applyAudioTogglesCallback(uiRef.current);
}

/**
 * Apply audio toggle settings (mute, music on/off, sfx on/off)
 * @param {Object} audioRef - React ref containing audio state
 * @param {Object} nextUi - Next UI state with audio settings
 * @param {Function} updateMusicVolumeCallback - Callback to update music volume
 */
export function applyAudioToggles(audioRef, nextUi, updateMusicVolumeCallback) {
  const a = audioRef.current;
  if (!a.started) return;

  a.muted = !!nextUi.muted;
  a.musicOn = !!nextUi.musicOn;
  a.sfxOn = !!nextUi.sfxOn;

  if (a.master) a.master.gain.value = a.muted ? 0 : 0.85;
  if (a.musicGain) a.musicGain.gain.value = a.musicOn && !a.muted ? 0.55 : 0;
  if (a.sfxGain) a.sfxGain.gain.value = a.sfxOn && !a.muted ? 0.95 : 0;

  // Update music volume based on settings
  updateMusicVolumeCallback();
}

/**
 * Update music volume based on UI settings
 * @param {Object} audioRef - React ref containing audio state
 * @param {Object} uiRef - React ref containing UI state
 */
export function updateMusicVolume(audioRef, uiRef) {
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
