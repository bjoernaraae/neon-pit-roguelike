import { hasLineOfSight, isPointWalkable, findNearestWalkable } from "../world/WalkabilitySystem.js";
import { getFlowDirection } from "./PathfindingSystem.js";
import { clamp } from "../../utils/math.js";
import { resolveKinematicOverlap } from "./CollisionSystem.js";

/**
 * Update enemy AI, pathfinding, and movement
 */
export function updateEnemyAI(s, dt, shootBulletFn, applyPlayerDamageFn, sfxHitFn, levelBounds) {
  const p = s.player;
  const { w, h, padding } = s.arena;

  for (const e of s.enemies) {
    // Skip frozen/slowed enemies for AI updates
    if (e.slowT > 0) {
      continue;
    }

    // Initialize enemy state if needed
    if (!e.state) e.state = "idle"; // idle, alert, lost
    if (!e.lostSightT) e.lostSightT = 0;

    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    
    // Line of sight check (only check if within reasonable distance)
    const hasLOS = d < 800 && hasLineOfSight(e.x, e.y, p.x, p.y, s.levelData, 10);
    
    // FLOW FIELD PATHFINDING - Use flow field direction (no direct player reference)
    // BUT: Validate direction is walkable to prevent corner cutting
    let moveDirX = 0;
    let moveDirY = 0;
    
    const enemyRadius = e.r || 14;
    
    // Calculate movement speed early (needed for validation)
    const slowMult = e.slowT > 0 ? (e.slowMult || 0.5) : 1.0;
    let moveSpeed = e.speed * dt * slowMult;
    
    if (e.tier === "spitter") {
      e.spitT = Math.max(0, e.spitT - dt);
      const desired = 240;
      const push = d < desired ? -1 : 1;
      moveSpeed *= 0.62 * push;
    }
    
    // Get movement direction from flow field
    if (s.flowFieldData) {
      const flowDir = getFlowDirection(e.x, e.y, s.flowFieldData);
      moveDirX = flowDir.x;
      moveDirY = flowDir.y;
    } else {
      // No flow field - fallback to direct movement
      moveDirX = dx / d;
      moveDirY = dy / d;
    }
    
    // If flow direction is zero (stuck or at target), use direct movement as fallback
    const flowDirMag = Math.hypot(moveDirX, moveDirY);
    if (flowDirMag < 0.01 && d > 5) {
      // Flow field returned zero, but we're not at target - use direct movement
      moveDirX = dx / d;
      moveDirY = dy / d;
    }
    
    const ux = moveDirX;
    const uy = moveDirY;
      
    // Track enemy position for stuck detection
      if (!e.lastX) e.lastX = e.x;
      if (!e.lastY) e.lastY = e.y;
      if (!e.stuckT) e.stuckT = 0;
      
      // Check if enemy is stuck (hasn't moved much - more sensitive detection)
      const movedDist = Math.hypot(e.x - e.lastX, e.y - e.lastY);
      if (movedDist < 2) { // More sensitive - detect stuck faster
        e.stuckT += dt;
      } else {
        e.stuckT = 0; // Reset stuck timer if moving
      }
      
      // Move enemy with collision checks
      // Direction has already been validated, so try to move in that direction
      let movedX = false;
      let movedY = false;
      
      if (s.levelData) {
        // Try to move in desired direction
        const newEx = e.x + ux * moveSpeed;
        const newEy = e.y + uy * moveSpeed;
        
        // Try diagonal movement first (if direction is diagonal)
        const isDiagonal = Math.abs(ux) > 0.1 && Math.abs(uy) > 0.1;
        
        if (isDiagonal) {
          // For diagonal, check if the path is clear
          // We already validated the path, but double-check the endpoint
          if (isPointWalkable(newEx, newEy, s.levelData, enemyRadius)) {
            e.x = newEx;
            e.y = newEy;
            movedX = true;
            movedY = true;
          } else {
            // Diagonal blocked - try cardinals separately
            if (isPointWalkable(newEx, e.y, s.levelData, enemyRadius)) {
              e.x = newEx;
              movedX = true;
            }
            if (isPointWalkable(e.x, newEy, s.levelData, enemyRadius)) {
              e.y = newEy;
              movedY = true;
            }
          }
        } else {
          // Cardinal direction - try to move
          if (Math.abs(ux) > 0.1 && isPointWalkable(newEx, e.y, s.levelData, enemyRadius)) {
            e.x = newEx;
            movedX = true;
          }
          if (Math.abs(uy) > 0.1 && isPointWalkable(e.x, newEy, s.levelData, enemyRadius)) {
            e.y = newEy;
            movedY = true;
          }
        }
        
        // If we haven't moved yet, try fallback strategies
        if (!movedX && !movedY) {
          // Try moving perpendicular to desired direction (wall sliding)
          // Check both perpendicular directions
          const perp1X = e.x + uy * moveSpeed * 0.8;
          const perp1Y = e.y - ux * moveSpeed * 0.8;
          const perp2X = e.x - uy * moveSpeed * 0.8;
          const perp2Y = e.y + ux * moveSpeed * 0.8;
          
          // Try first perpendicular
          if (isPointWalkable(perp1X, perp1Y, s.levelData, enemyRadius)) {
            e.x = perp1X;
            e.y = perp1Y;
            movedX = true;
            movedY = true;
          } else if (isPointWalkable(perp2X, perp2Y, s.levelData, enemyRadius)) {
            // Try opposite perpendicular
            e.x = perp2X;
            e.y = perp2Y;
            movedX = true;
            movedY = true;
          } else if (e.stuckT > 0.05) {
            // If stuck for a bit, try moving in cardinal directions away from walls
            const cardinals = [
              [1, 0], [-1, 0], [0, 1], [0, -1]
            ];
            
            // Shuffle cardinals to avoid predictable movement
            for (let i = cardinals.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [cardinals[i], cardinals[j]] = [cardinals[j], cardinals[i]];
            }
            
            for (const [cdx, cdy] of cardinals) {
              const testX = e.x + cdx * moveSpeed * 0.6;
              const testY = e.y + cdy * moveSpeed * 0.6;
              if (isPointWalkable(testX, testY, s.levelData, enemyRadius)) {
                e.x = testX;
                e.y = testY;
                movedX = true;
                movedY = true;
                break;
              }
            }
          }
        }
      } else {
        // Fallback: no level data, allow movement
        const newEx = e.x + ux * moveSpeed;
        const newEy = e.y + uy * moveSpeed;
        e.x = newEx;
        e.y = newEy;
        movedX = true;
        movedY = true;
      }
      
      // Final safety check: if enemy ended up in a wall, find nearest walkable position
      if (s.levelData && !isPointWalkable(e.x, e.y, s.levelData, enemyRadius)) {
        const walkable = findNearestWalkable(e.x, e.y, s.levelData, enemyRadius);
        e.x = walkable.x;
        e.y = walkable.y;
      }
      
      e.lastX = e.x;
      e.lastY = e.y;

      // Spitter shooting (only if we have line of sight)
      if (e.tier === "spitter" && d < 460 && e.spitT <= 0 && hasLOS) {
        const a = Math.atan2(dy, dx);
        shootBulletFn(s, e.x, e.y, a, 14 + s.floor * 0.95, 470, { enemy: true, r: 7.2, life: 2.2, color: "#ff5d5d" });
        e.spitT = 1.05;
    }

    // Clamp enemies to level bounds
    if (s.levelData) {
      e.x = clamp(e.x, padding, s.levelData.w - padding);
      e.y = clamp(e.y, padding, s.levelData.h - padding);
    } else {
      e.x = clamp(e.x, padding, w - padding);
      e.y = clamp(e.y, padding, h - padding);
    }

    // Always check collision - resolveKinematicCircleOverlap handles jump safety
    // Only skip if in landing grace period
    if (p.jumpLandingGrace !== undefined && p.jumpLandingGrace > 0) {
      // Just landed, skip collision during grace period
    } else {
      const overlapped = resolveKinematicOverlap(p, e, levelBounds, s.levelData);
      
      // Melee damage: Only apply to melee enemies (brute, runner, tank, and default/grunt) when actually overlapping
      // Ranged enemies (spitter, shocker) should not deal contact damage
      // Default enemy type (grunt) is melee - all enemies except spitter and shocker can melee
      const checkBrute = e.tier === "brute";
      const checkRunner = e.tier === "runner";
      const checkTank = e.tier === "tank";
      const checkNotRanged = (e.tier !== "spitter" && e.tier !== "shocker");
      const isMeleeEnemy = checkBrute || checkRunner || checkTank || checkNotRanged;
      
      // Apply damage if overlapping, is melee enemy, and cooldown is ready
      // Note: overlapped is true when visual cubes are touching (from resolveKinematicCircleOverlap)
      // If enemy is pushing player, they should be able to deal damage
      // Check contactCd with undefined safety
      // If overlapped is true, that means visual cubes are touching, so damage should apply
      // No need for additional distance check - overlapped already confirms they're touching
      if (overlapped && isMeleeEnemy && (e.contactCd === undefined || e.contactCd <= 0)) {
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const dist = Math.hypot(dx, dy) || 1;
        // Enemy is overlapping and close enough - apply damage and knockback
        
        const xNorm = clamp((p.x / (s.arena.w || 1)) * 2 - 1, -1, 1);
        // Elite enemies deal more contact damage (but half damage for contact)
        const baseDmg = 18 + s.floor * 0.9;
        const eliteDmgMult = e.isElite ? (e.eliteAbility === "rage" ? 1 + (1 - e.hp / e.maxHp) * 0.5 : 1.3) : 1;
        const contactDmg = (baseDmg * eliteDmgMult) * 0.5; // Half damage for contact
        const did = applyPlayerDamageFn(s, contactDmg, `${e.tier} contact`, { shakeMag: 1.6, shakeTime: 0.06, hitStop: 0, fromX: e.x, fromY: e.y });
        if (did) sfxHitFn(xNorm);
        e.contactCd = 0.6; // Reduced from 0.95 to allow more frequent hits when in contact
        
        // Apply knockback to player (away from enemy)
        const knockbackForce = 90; // Reduced from 180 for less aggressive knockback
        if (!p.knockbackVx) p.knockbackVx = 0;
        if (!p.knockbackVy) p.knockbackVy = 0;
        p.knockbackVx += ((p.x - e.x) / dist) * knockbackForce;
        p.knockbackVy += ((p.y - e.y) / dist) * knockbackForce;
        
        // Push enemy back slightly
        e.x += ((e.x - p.x) / dist) * 22;
        e.y += ((e.y - p.y) / dist) * 22;
      }
    }
  }
}
