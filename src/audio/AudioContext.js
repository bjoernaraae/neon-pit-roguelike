import { ensureAudio as ensureAudioFn, applyAudioToggles as applyAudioTogglesFn, updateMusicVolume as updateMusicVolumeFn } from "./AudioManager.js";
import { updateMusic as updateMusicFn, tickMusic as tickMusicFn } from "./MusicController.js";
import { playBeep as playBeepFn, sfxShoot as sfxShootFn, sfxHit as sfxHitFn, sfxKill as sfxKillFn, sfxCoin as sfxCoinFn, sfxCrit as sfxCritFn, sfxLevelUp as sfxLevelUpFn, sfxLevel as sfxLevelFn, sfxBoss as sfxBossFn, sfxGameOver as sfxGameOverFn, sfxInteract as sfxInteractFn } from "./SoundEffects.js";

/**
 * Create audio context with all audio functions bound to refs
 * This eliminates the need for wrapper functions in the main component
 */
export function createAudioContext(audioRef, uiRef, stateRef, menuMusicUrl, battleMusicUrl, clamp) {
  return {
    // Core audio management
    ensureAudio: () => {
      ensureAudioFn(audioRef, uiRef, menuMusicUrl, battleMusicUrl, (nextUi) => {
        applyAudioTogglesFn(audioRef, nextUi, () => updateMusicVolumeFn(audioRef, uiRef));
      });
    },
    
    applyAudioToggles: (nextUi) => {
      applyAudioTogglesFn(audioRef, nextUi, () => updateMusicVolumeFn(audioRef, uiRef));
    },
    
    updateMusicVolume: () => {
      updateMusicVolumeFn(audioRef, uiRef);
    },
    
    updateMusic: (dt) => {
      const ensureAudioCallback = () => ensureAudioFn(audioRef, uiRef, menuMusicUrl, battleMusicUrl, (nextUi) => {
        applyAudioTogglesFn(audioRef, nextUi, () => updateMusicVolumeFn(audioRef, uiRef));
      });
      const updateVolCallback = () => updateMusicVolumeFn(audioRef, uiRef);
      updateMusicFn(audioRef, uiRef, stateRef, dt, ensureAudioCallback, updateVolCallback);
    },
    
    // Music control
    tickMusic: (dt, waveIntensity) => {
      const playBeepCallback = (params) => playBeepFn(audioRef, params);
      tickMusicFn(audioRef, dt, waveIntensity, playBeepCallback, clamp);
    },
    
    // Generic sound effect
    playBeep: (params) => playBeepFn(audioRef, params),
    
    // Specific sound effects
    sfxShoot: (xNorm = 0, variant = 0) => sfxShootFn(audioRef, xNorm, variant),
    sfxHit: (xNorm = 0, variant = 0) => sfxHitFn(audioRef, xNorm, variant),
    sfxKill: (xNorm = 0) => sfxKillFn(audioRef, xNorm),
    sfxCoin: (xNorm = 0) => sfxCoinFn(audioRef, xNorm),
    sfxCrit: (xNorm = 0) => sfxCritFn(audioRef, xNorm),
    sfxLevelUp: () => sfxLevelUpFn(audioRef),
    sfxLevel: () => sfxLevelFn(audioRef),
    sfxBoss: () => sfxBossFn(audioRef),
    sfxGameOver: () => sfxGameOverFn(audioRef),
    sfxInteract: () => sfxInteractFn(audioRef),
  };
}
