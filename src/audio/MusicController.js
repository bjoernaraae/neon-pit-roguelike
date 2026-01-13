/**
 * Music Controller
 * 
 * Handles music track switching, fading, and state-based music selection.
 */

/**
 * Update music track based on game state
 * Handles track transitions with crossfading
 * @param {Object} audioRef - React ref containing audio state
 * @param {Object} uiRef - React ref containing UI state
 * @param {Object} stateRef - React ref containing game state
 * @param {number} dt - Delta time in seconds
 * @param {Function} ensureAudioCallback - Callback to ensure audio is initialized
 * @param {Function} updateMusicVolumeCallback - Callback to update music volume
 */
export function updateMusic(audioRef, uiRef, stateRef, dt, ensureAudioCallback, updateMusicVolumeCallback) {
  const a = audioRef.current;
  // Ensure audio is initialized
  if (!a.started) {
    ensureAudioCallback();
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
    // Don't start music immediately - let the fade transition system handle it below
    // This prevents duplicate music tracks from playing simultaneously
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
      // Don't start music immediately - let the fade transition system handle it below
      // This prevents duplicate music tracks from playing simultaneously
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
      updateMusicVolumeCallback();
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
    updateMusicVolumeCallback();
  }
}

/**
 * Tick procedural music generation (legacy system - may be deprecated)
 * @param {Object} audioRef - React ref containing audio state
 * @param {number} dt - Delta time in seconds
 * @param {number} waveIntensity - Wave intensity (0-1) for dynamic music
 * @param {Function} playBeepCallback - Callback to play beep sounds
 * @param {Function} clampFn - Clamp utility function
 */
export function tickMusic(audioRef, dt, waveIntensity, playBeepCallback, clampFn) {
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

  const density = clampFn(0.45 + waveIntensity * 0.22, 0.45, 0.82);

  playBeepCallback({ type: "triangle", f0: f, f1: f * 0.998, dur: 0.11, gain: 0.08 * density, pan: -0.15, to: "music" });
  if (step % 4 === 2) {
    playBeepCallback({ type: "sine", f0: f * 2, f1: f * 2, dur: 0.06, gain: 0.045 * density, pan: 0.12, to: "music" });
  }

  a.noteStep += 1;
  a.nextNoteT = 0.14;
}
