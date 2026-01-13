import { transformInputForIsometric } from "../../rendering/IsometricRenderer.js";

/**
 * Create keyboard down handler
 */
export function createKeydownHandler(context) {
  const {
    uiRef, setUi, stateRef, keysRef, jumpKeyJustPressedRef, content,
    ensureAudio, updateMusicVolume, applyAudioToggles, requestFullscreen,
    setMenuChar, safeBest, newRun, pickChoice, setPaused, tryUseInteractable,
    useAbility, setIsoScale, isoScaleRef, ISO_MODE
  } = context;

  return (e) => {
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
          const a = context.audioRef.current;
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
}

/**
 * Create keyboard up handler
 */
export function createKeyupHandler(keysRef, jumpKeyJustPressedRef) {
  return (e) => {
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
}

/**
 * Create blur handler
 */
export function createBlurHandler(keysRef, jumpKeyJustPressedRef) {
  return () => {
    keysRef.current.clear();
    jumpKeyJustPressedRef.current = false;
  };
}

/**
 * Create pointer down handler
 */
export function createPointerDownHandler(context) {
  const {
    canvasRef, audioRef, uiRef, stateRef, ensureAudio, setPaused, safeBest, newRun,
    setUi, applyAudioToggles, updateMusicVolume, handleAdminClick, tryUseInteractable,
    pickChoice, setMenuChar, content
  } = context;

  return (e) => {
    const c = canvasRef.current;
    
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
}

/**
 * Create wheel handler for isometric zoom
 */
export function createWheelHandler(ISO_MODE, setIsoScale, isoScaleRef) {
  return (e) => {
    if (!ISO_MODE) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.001 : 0.001;
    setIsoScale(Math.max(0.005, Math.min(0.05, isoScaleRef.current + delta)));
  };
}
