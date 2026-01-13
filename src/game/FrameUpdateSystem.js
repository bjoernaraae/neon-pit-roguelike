import { clamp } from "../utils/math.js";
import { generateFlowField } from "./systems/PathfindingSystem.js";
import { initializeCamera, updateCamera } from "./systems/CameraSystem.js";

/**
 * Initialize and update per-frame state (camera, time, music, flow field)
 */
export function updateFrameState(s, dt, uiRef, tickMusicFn, updateMusicFn) {
  const p = s.player;
  const { w, h } = s.arena;
  
  // Initialize and update camera
  initializeCamera(s, w, h);
  updateCamera(s, dt, w, h, uiRef);

  s.t += dt;

  // Update music intensity based on stage progression
  const intensity = clamp(1 - s.stageLeft / s.stageDur, 0, 1);
  tickMusicFn(dt, intensity);
  updateMusicFn(dt);
  
  // Generate Flow Field once per frame (Dijkstra Map from player position)
  if (s.levelData && s.levelData.pathfindingGrid) {
    try {
      s.flowFieldData = generateFlowField(
        p.x,
        p.y,
        s.levelData.pathfindingGrid,
        s.levelData.pathfindingGridSize || 10
      );
    } catch (error) {
      // Flow field generation failed - log error and set to null
      console.error('Flow field generation error:', error);
      s.flowFieldData = null;
    }
  } else {
    s.flowFieldData = null;
  }

  // Update screen shake
  if (s.shakeT > 0) s.shakeT = Math.max(0, s.shakeT - dt);
  
  return intensity;
}
