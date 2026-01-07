/**
 * Boss Ability System - Telegraphed Danger Zones
 * 
 * Implements a modular system for boss abilities with:
 * - Area-of-Effect telegraphing
 * - State machine (WINDUP, ACTIVE, RECOVERY)
 * - Phase-based mechanics
 * - Isometric rendering support
 */

// Boss Ability States
export const BOSS_ABILITY_STATE = {
  IDLE: 'idle',
  WINDUP: 'windup',    // Telegraph phase - boss rotates toward player
  ACTIVE: 'active',    // Hitbox active - rotation locked
  RECOVERY: 'recovery' // Vulnerability window
};

// Danger Zone Types
export const DANGER_ZONE_TYPE = {
  CONE: 'cone',
  LINE_DASH: 'line_dash',
  RING_PULSE: 'ring_pulse',
  CHARGE: 'charge',
  MULTI_SHOT: 'multi_shot',
  TELEPORT: 'teleport'
};

/**
 * Base class for boss abilities
 */
class BaseAbility {
  constructor(options = {}) {
    this.cooldown = options.cooldown || 5.0;
    this.cooldownTimer = 0;
    this.state = BOSS_ABILITY_STATE.IDLE;
    this.stateTimer = 0;
    this.phase2Effect = options.phase2Effect || null;
  }

  update(dt) {
    if (this.cooldownTimer > 0) {
      this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);
    }
    
    if (this.stateTimer > 0) {
      this.stateTimer = Math.max(0, this.stateTimer - dt);
    }
  }

  canUse() {
    return this.cooldownTimer <= 0 && this.state === BOSS_ABILITY_STATE.IDLE;
  }

  start(boss, player) {
    if (!this.canUse()) return false;
    this.state = BOSS_ABILITY_STATE.WINDUP;
    this.stateTimer = this.getWindupTime();
    return true;
  }

  getWindupTime() {
    return 1.0; // Default windup
  }

  getActiveTime() {
    return 0.5; // Default active time
  }

  getRecoveryTime() {
    return 0.3; // Default recovery
  }

  getDangerZones(boss, player) {
    return [];
  }

  checkHits(boss, player, floor) {
    return null;
  }
}

/**
 * Cone Attack Ability - Fires a cone-shaped attack toward the player
 */
export class ConeAttackAbility extends BaseAbility {
  constructor(options = {}) {
    super(options);
    this.angle = 0;
    this.range = options.range || 400;
    this.arcAngle = options.arcAngle || Math.PI / 3; // 60 degrees
  }

  getWindupTime() {
    return 1.5;
  }

  getActiveTime() {
    return 0.4;
  }

  getDangerZones(boss, player) {
    if (this.state === BOSS_ABILITY_STATE.WINDUP || this.state === BOSS_ABILITY_STATE.ACTIVE) {
      const dx = player.x - boss.x;
      const dy = player.y - boss.y;
      this.angle = Math.atan2(dy, dx);
      
      return [{
        type: DANGER_ZONE_TYPE.CONE,
        x: boss.x,
        y: boss.y,
        angle: this.angle,
        angleWidth: this.arcAngle,
        range: this.range,
        state: this.state,
        // Much brighter colors for better visibility
        color: this.state === BOSS_ABILITY_STATE.WINDUP ? 'rgba(255,220,0,0.7)' : 'rgba(255,50,50,0.8)',
        alpha: this.state === BOSS_ABILITY_STATE.WINDUP ? 0.7 : 0.8,
        pulse: true
      }];
    }
    return [];
  }

  checkHits(boss, player, floor) {
    if (this.state !== BOSS_ABILITY_STATE.ACTIVE) return null;
    
    const dx = player.x - boss.x;
    const dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy);
    
    if (dist > this.range) return null;
    
    const angleToPlayer = Math.atan2(dy, dx);
    const angleDiff = Math.abs(angleToPlayer - this.angle);
    const normalizedAngle = Math.min(angleDiff, Math.PI * 2 - angleDiff);
    
    if (normalizedAngle <= this.arcAngle / 2) {
      const damage = 25 + floor * 5;
      return {
        damage,
        ability: { name: 'Cone Attack' }
      };
    }
    
    return null;
  }
}

/**
 * Line Dash Ability - Boss dashes in a straight line
 */
export class LineDashAbility extends BaseAbility {
  constructor(options = {}) {
    super(options);
    this.dashDistance = options.dashDistance || 300;
    this.dashSpeed = options.dashSpeed || 500; // Slightly slower (was 600) to give more reaction time
    this.startX = 0;
    this.startY = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.dashProgress = 0;
  }

  getWindupTime() {
    return 1.8; // Increased from 1.0 to give more time to dodge
  }

  getActiveTime() {
    return this.dashDistance / this.dashSpeed;
  }

  getDangerZones(boss, player) {
    if (this.state === BOSS_ABILITY_STATE.WINDUP || this.state === BOSS_ABILITY_STATE.ACTIVE) {
      if (this.state === BOSS_ABILITY_STATE.WINDUP) {
        const dx = player.x - boss.x;
        const dy = player.y - boss.y;
        const dist = Math.hypot(dx, dy) || 1;
        this.startX = boss.x;
        this.startY = boss.y;
        this.targetX = boss.x + (dx / dist) * this.dashDistance;
        this.targetY = boss.y + (dy / dist) * this.dashDistance;
      }
      
      // During active state, update start position to boss current position (boss is moving)
      let startX = this.startX;
      let startY = this.startY;
      if (this.state === BOSS_ABILITY_STATE.ACTIVE) {
        // Boss is dashing, update danger zone to follow boss
        startX = boss.x;
        startY = boss.y;
      }
      
      return [{
        type: DANGER_ZONE_TYPE.LINE_DASH,
        x: startX,
        y: startY,
        targetX: this.targetX,
        targetY: this.targetY,
        width: 80, // Increased width for better visibility
        state: this.state,
        // Much brighter colors for better visibility
        color: this.state === BOSS_ABILITY_STATE.WINDUP ? 'rgba(255,220,0,0.7)' : 'rgba(255,50,50,0.8)',
        alpha: this.state === BOSS_ABILITY_STATE.WINDUP ? 0.7 : 0.8,
        pulse: true
      }];
    }
    return [];
  }

  checkHits(boss, player, floor) {
    if (this.state !== BOSS_ABILITY_STATE.ACTIVE) return null;
    
    // Check if player is on the dash line
    const lineDist = this.distanceToLineSegment(
      player.x, player.y,
      this.startX, this.startY,
      this.targetX, this.targetY
    );
    
    if (lineDist < 40) {
      const damage = 30 + floor * 6;
      return {
        damage,
        ability: { name: 'Line Dash' }
      };
    }
    
    return null;
  }

  distanceToLineSegment(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = lenSq !== 0 ? dot / lenSq : -1;
    
    if (param < 0) {
      param = 0;
    } else if (param > 1) {
      param = 1;
    }
    
    const xx = x1 + param * C;
    const yy = y1 + param * D;
    
    const dx = px - xx;
    const dy = py - yy;
    return Math.hypot(dx, dy);
  }
}

/**
 * Ring Pulse Ability - Expanding ring attack from boss position
 */
export class RingPulseAbility extends BaseAbility {
  constructor(options = {}) {
    super(options);
    this.maxRadius = options.maxRadius || 350;
    this.currentRadius = 0;
    this.expandSpeed = options.expandSpeed || 400;
  }

  getWindupTime() {
    return 1.2;
  }

  getActiveTime() {
    return this.maxRadius / this.expandSpeed;
  }

  update(dt) {
    super.update(dt);
    
    // Update ring radius during active state
    if (this.state === BOSS_ABILITY_STATE.ACTIVE && this.stateTimer > 0) {
      const elapsed = this.getActiveTime() - this.stateTimer;
      this.currentRadius = Math.min(this.maxRadius, elapsed * this.expandSpeed);
    } else if (this.state === BOSS_ABILITY_STATE.IDLE) {
      this.currentRadius = 0;
    }
  }

  getDangerZones(boss, player) {
    if (this.state === BOSS_ABILITY_STATE.WINDUP || this.state === BOSS_ABILITY_STATE.ACTIVE) {
      const ringThickness = 30; // Increased thickness for better visibility
      
      let innerRadius, outerRadius;
      
      if (this.state === BOSS_ABILITY_STATE.WINDUP) {
        // During windup, show animated preview of expanding ring
        // Animate from 0 to maxRadius over windup time
        const windupProgress = 1.0 - (this.stateTimer / this.getWindupTime());
        const previewRadius = this.maxRadius * windupProgress;
        
        // Show expanding ring preview with pulsing effect
        innerRadius = Math.max(0, previewRadius - ringThickness);
        outerRadius = previewRadius;
      } else {
        // During active, show actual expanding ring
        innerRadius = Math.max(0, this.currentRadius - ringThickness);
        outerRadius = this.currentRadius;
      }
      
      // Ensure minimum visibility
      if (outerRadius <= innerRadius) {
        outerRadius = innerRadius + 20;
      }
      
      return [{
        type: DANGER_ZONE_TYPE.RING_PULSE,
        x: boss.x,
        y: boss.y,
        innerRadius: innerRadius,
        outerRadius: outerRadius,
        radius: this.currentRadius,
        maxRadius: this.maxRadius,
        state: this.state,
        // Much brighter colors for better visibility
        color: this.state === BOSS_ABILITY_STATE.WINDUP ? 'rgba(255,220,0,0.7)' : 'rgba(255,50,50,0.8)',
        alpha: this.state === BOSS_ABILITY_STATE.WINDUP ? 0.7 : 0.8,
        pulse: true,
        showSafeZone: true // Flag to show safe center zone
      }];
    }
    return [];
  }

  checkHits(boss, player, floor) {
    if (this.state !== BOSS_ABILITY_STATE.ACTIVE) return null;
    
    const dx = player.x - boss.x;
    const dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy);
    
    // Check if player is in the ring (with some tolerance)
    const ringThickness = 20;
    const innerRadius = Math.max(0, this.currentRadius - ringThickness);
    const outerRadius = this.currentRadius;
    
    if (dist >= innerRadius && dist <= outerRadius) {
      const damage = 20 + floor * 4;
      return {
        damage,
        ability: { name: 'Ring Pulse' }
      };
    }
    
    return null;
  }
}

/**
 * Teleport Ability - Boss teleports to a new position
 */
export class TeleportAbility extends BaseAbility {
  constructor(options = {}) {
    super(options);
    this.teleportDistance = options.teleportDistance || 250;
    this.targetX = 0;
    this.targetY = 0;
  }

  getWindupTime() {
    return 0.8;
  }

  getActiveTime() {
    return 0.1; // Instant teleport
  }

  getRecoveryTime() {
    return 0.5;
  }

  getDangerZones(boss, player, levelData = null) {
    if (this.state === BOSS_ABILITY_STATE.WINDUP) {
      // Show teleport destination during windup
      // Try to teleport toward player but with some randomness
      const dx = player.x - boss.x;
      const dy = player.y - boss.y;
      const dist = Math.hypot(dx, dy) || 1;
      const angleToPlayer = Math.atan2(dy, dx);
      
      // Add some randomness to angle
      const randomAngle = (Math.random() - 0.5) * Math.PI * 0.6; // ±54 degrees
      const angle = angleToPlayer + randomAngle;
      
      this.targetX = boss.x + Math.cos(angle) * this.teleportDistance;
      this.targetY = boss.y + Math.sin(angle) * this.teleportDistance;
      
      // If levelData is provided, clamp to walkable area
      if (levelData) {
        const clamped = this.clampToWalkable(this.targetX, this.targetY, levelData, boss.r);
        this.targetX = clamped.x;
        this.targetY = clamped.y;
      }
      
      return [{
        type: DANGER_ZONE_TYPE.TELEPORT,
        x: this.targetX,
        y: this.targetY,
        radius: boss.r * 1.5,
        state: this.state,
        color: 'rgba(150,50,255,0.6)',
        alpha: 0.6,
        pulse: true
      }];
    }
    return [];
  }

  clampToWalkable(x, y, levelData, bossRadius) {
    if (!levelData) return { x, y };
    
    const margin = bossRadius * 0.5;
    const areas = [...(levelData.rooms || []), ...(levelData.corridors || [])];
    
    // Find nearest walkable position
    let bestX = x;
    let bestY = y;
    let minDist = Infinity;
    
    for (const area of areas) {
      const clampedX = Math.max(area.x + margin, Math.min(x, area.x + area.w - margin));
      const clampedY = Math.max(area.y + margin, Math.min(y, area.y + area.h - margin));
      const dist = Math.hypot(x - clampedX, y - clampedY);
      
      if (dist < minDist) {
        minDist = dist;
        bestX = clampedX;
        bestY = clampedY;
      }
    }
    
    return { x: bestX, y: bestY };
  }

  checkHits(boss, player, floor) {
    // Teleport doesn't damage, just moves boss
    return null;
  }
}

/**
 * Charge Ability - Boss charges forward with a wide hitbox
 */
export class ChargeAbility extends BaseAbility {
  constructor(options = {}) {
    super(options);
    this.chargeDistance = options.chargeDistance || 400;
    this.chargeSpeed = options.chargeSpeed || 450; // Slightly slower (was 500) to give more reaction time
    this.startX = 0;
    this.startY = 0;
    this.targetX = 0;
    this.targetY = 0;
  }

  getWindupTime() {
    return 2.0; // Increased from 1.2 to give more time to dodge
  }

  getActiveTime() {
    return this.chargeDistance / this.chargeSpeed;
  }

  getDangerZones(boss, player) {
    if (this.state === BOSS_ABILITY_STATE.WINDUP || this.state === BOSS_ABILITY_STATE.ACTIVE) {
      if (this.state === BOSS_ABILITY_STATE.WINDUP) {
        const dx = player.x - boss.x;
        const dy = player.y - boss.y;
        const dist = Math.hypot(dx, dy) || 1;
        this.startX = boss.x;
        this.startY = boss.y;
        this.targetX = boss.x + (dx / dist) * this.chargeDistance;
        this.targetY = boss.y + (dy / dist) * this.chargeDistance;
      }
      
      let startX = this.startX;
      let startY = this.startY;
      if (this.state === BOSS_ABILITY_STATE.ACTIVE) {
        startX = boss.x;
        startY = boss.y;
      }
      
      return [{
        type: DANGER_ZONE_TYPE.CHARGE,
        x: startX,
        y: startY,
        targetX: this.targetX,
        targetY: this.targetY,
        width: 100, // Wider than dash
        state: this.state,
        color: this.state === BOSS_ABILITY_STATE.WINDUP ? 'rgba(255,150,0,0.7)' : 'rgba(255,50,50,0.8)',
        alpha: this.state === BOSS_ABILITY_STATE.WINDUP ? 0.7 : 0.8,
        pulse: true
      }];
    }
    return [];
  }

  checkHits(boss, player, floor) {
    if (this.state !== BOSS_ABILITY_STATE.ACTIVE) return null;
    
    const lineDist = this.distanceToLineSegment(
      player.x, player.y,
      this.startX, this.startY,
      this.targetX, this.targetY
    );
    
    if (lineDist < 50) {
      const damage = 35 + floor * 7;
      return {
        damage,
        ability: { name: 'Charge' }
      };
    }
    
    return null;
  }

  distanceToLineSegment(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = lenSq !== 0 ? dot / lenSq : -1;
    
    if (param < 0) {
      param = 0;
    } else if (param > 1) {
      param = 1;
    }
    
    const xx = x1 + param * C;
    const yy = y1 + param * D;
    
    const dx = px - xx;
    const dy = py - yy;
    return Math.hypot(dx, dy);
  }
}

/**
 * Multi-Shot Ability - Boss fires multiple projectiles in a spread
 */
export class MultiShotAbility extends BaseAbility {
  constructor(options = {}) {
    super(options);
    this.shotCount = options.shotCount || 5;
    this.arcAngle = options.arcAngle || Math.PI * 0.8; // 144 degrees
    this.range = options.range || 450;
  }

  getWindupTime() {
    return 1.0;
  }

  getActiveTime() {
    return 0.3;
  }

  getDangerZones(boss, player) {
    if (this.state === BOSS_ABILITY_STATE.WINDUP || this.state === BOSS_ABILITY_STATE.ACTIVE) {
      const dx = player.x - boss.x;
      const dy = player.y - boss.y;
      const angle = Math.atan2(dy, dx);
      
      const zones = [];
      const angleStep = this.arcAngle / (this.shotCount - 1);
      const startAngle = angle - this.arcAngle / 2;
      
      for (let i = 0; i < this.shotCount; i++) {
        const shotAngle = startAngle + angleStep * i;
        zones.push({
          type: DANGER_ZONE_TYPE.MULTI_SHOT,
          x: boss.x,
          y: boss.y,
          angle: shotAngle,
          range: this.range,
          width: 40, // Narrow beam
          state: this.state,
          color: this.state === BOSS_ABILITY_STATE.WINDUP ? 'rgba(255,200,100,0.6)' : 'rgba(255,100,100,0.7)',
          alpha: this.state === BOSS_ABILITY_STATE.WINDUP ? 0.6 : 0.7,
          pulse: true
        });
      }
      
      return zones;
    }
    return [];
  }

  checkHits(boss, player, floor) {
    if (this.state !== BOSS_ABILITY_STATE.ACTIVE) return null;
    
    const dx = player.x - boss.x;
    const dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy);
    
    if (dist > this.range) return null;
    
    const angleToPlayer = Math.atan2(dy, dx);
    const angleStep = this.arcAngle / (this.shotCount - 1);
    const startAngle = angleToPlayer - this.arcAngle / 2;
    
    // Check if player is hit by any shot
    for (let i = 0; i < this.shotCount; i++) {
      const shotAngle = startAngle + angleStep * i;
      const angleDiff = Math.abs(angleToPlayer - shotAngle);
      const normalizedAngle = Math.min(angleDiff, Math.PI * 2 - angleDiff);
      
      if (normalizedAngle <= 0.1) { // Narrow hitbox
        const damage = 15 + floor * 3;
        return {
          damage,
          ability: { name: 'Multi-Shot' }
        };
      }
    }
    
    return null;
  }
}

/**
 * Boss Controller - Manages boss abilities and state
 */
export class BossController {
  constructor(boss, abilities = []) {
    this.boss = boss;
    this.abilities = abilities;
    this.currentAbility = null;
    this.currentState = BOSS_ABILITY_STATE.IDLE;
  }

  update(player, dt, floor, levelData = null) {
    // Update all abilities
    for (const ability of this.abilities) {
      ability.update(dt);
    }

    // Update current ability state
    if (this.currentAbility) {
      this.currentAbility.stateTimer = Math.max(0, this.currentAbility.stateTimer - dt);
      
      // Handle ability-specific updates (e.g., boss movement during dash/charge/teleport)
      if (this.currentAbility instanceof LineDashAbility && this.currentAbility.state === BOSS_ABILITY_STATE.ACTIVE) {
        // Move boss during dash
        const dx = this.currentAbility.targetX - this.currentAbility.startX;
        const dy = this.currentAbility.targetY - this.currentAbility.startY;
        const dist = Math.hypot(dx, dy) || 1;
        const progress = 1.0 - (this.currentAbility.stateTimer / this.currentAbility.getActiveTime());
        const currentDist = progress * this.currentAbility.dashDistance;
        
        let newX = this.currentAbility.startX + (dx / dist) * currentDist;
        let newY = this.currentAbility.startY + (dy / dist) * currentDist;
        
        // Clamp to walkable bounds
        if (levelData) {
          const clamped = this.clampToWalkable(newX, newY, levelData);
          newX = clamped.x;
          newY = clamped.y;
        }
        
        this.boss.x = newX;
        this.boss.y = newY;
      } else if (this.currentAbility instanceof ChargeAbility && this.currentAbility.state === BOSS_ABILITY_STATE.ACTIVE) {
        // Move boss during charge
        const dx = this.currentAbility.targetX - this.currentAbility.startX;
        const dy = this.currentAbility.targetY - this.currentAbility.startY;
        const dist = Math.hypot(dx, dy) || 1;
        const progress = 1.0 - (this.currentAbility.stateTimer / this.currentAbility.getActiveTime());
        const currentDist = progress * this.currentAbility.chargeDistance;
        
        let newX = this.currentAbility.startX + (dx / dist) * currentDist;
        let newY = this.currentAbility.startY + (dy / dist) * currentDist;
        
        // Clamp to walkable bounds
        if (levelData) {
          const clamped = this.clampToWalkable(newX, newY, levelData);
          newX = clamped.x;
          newY = clamped.y;
        }
        
        this.boss.x = newX;
        this.boss.y = newY;
      } else if (this.currentAbility instanceof TeleportAbility && this.currentAbility.state === BOSS_ABILITY_STATE.ACTIVE) {
        // Teleport boss
        let newX = this.currentAbility.targetX;
        let newY = this.currentAbility.targetY;
        
        // Clamp to walkable bounds
        if (levelData) {
          const clamped = this.clampToWalkable(newX, newY, levelData);
          newX = clamped.x;
          newY = clamped.y;
        }
        
        this.boss.x = newX;
        this.boss.y = newY;
      }
      
      if (this.currentAbility.stateTimer <= 0) {
        this.advanceAbilityState(this.currentAbility);
      }
    } else {
      // Try to use an ability
      this.tryUseAbility(player, floor);
    }
  }

  clampToWalkable(x, y, levelData) {
    // Import findNearestWalkable dynamically to avoid circular dependencies
    // For now, use a simple bounds check
    if (!levelData) return { x, y };
    
    const bossRadius = this.boss.r || 38;
    const margin = bossRadius * 0.5;
    
    // Check all rooms and corridors
    const areas = [...(levelData.rooms || []), ...(levelData.corridors || [])];
    for (const area of areas) {
      if (x >= area.x + margin && x <= area.x + area.w - margin &&
          y >= area.y + margin && y <= area.y + area.h - margin) {
        // Clamp to area bounds
        return {
          x: Math.max(area.x + margin, Math.min(x, area.x + area.w - margin)),
          y: Math.max(area.y + margin, Math.min(y, area.y + area.h - margin))
        };
      }
    }
    
    // If not in any area, find nearest walkable
    let bestX = x;
    let bestY = y;
    let minDist = Infinity;
    
    for (const area of areas) {
      const clampedX = Math.max(area.x + margin, Math.min(x, area.x + area.w - margin));
      const clampedY = Math.max(area.y + margin, Math.min(y, area.y + area.h - margin));
      const dist = Math.hypot(x - clampedX, y - clampedY);
      
      if (dist < minDist) {
        minDist = dist;
        bestX = clampedX;
        bestY = clampedY;
      }
    }
    
    return { x: bestX, y: bestY };
  }

  tryUseAbility(player, floor) {
    // Find available abilities
    const available = this.abilities.filter(a => a.canUse());
    if (available.length === 0) return;

    // Choose ability (simple priority: use first available)
    const ability = available[0];
    if (ability.start(this.boss, player)) {
      this.currentAbility = ability;
      this.currentState = ability.state;
    }
  }

  advanceAbilityState(ability) {
    if (ability.state === BOSS_ABILITY_STATE.WINDUP) {
      ability.state = BOSS_ABILITY_STATE.ACTIVE;
      ability.stateTimer = ability.getActiveTime();
      this.currentState = BOSS_ABILITY_STATE.ACTIVE;
    } else if (ability.state === BOSS_ABILITY_STATE.ACTIVE) {
      ability.state = BOSS_ABILITY_STATE.RECOVERY;
      ability.stateTimer = ability.getRecoveryTime();
      this.currentState = BOSS_ABILITY_STATE.RECOVERY;
    } else if (ability.state === BOSS_ABILITY_STATE.RECOVERY) {
      ability.state = BOSS_ABILITY_STATE.IDLE;
      ability.cooldownTimer = ability.cooldown;
      this.currentAbility = null;
      this.currentState = BOSS_ABILITY_STATE.IDLE;
    }
  }

  getDangerZones(player, levelData = null) {
    if (this.currentAbility) {
      return this.currentAbility.getDangerZones(this.boss, player, levelData);
    }
    return [];
  }

  getAllDangerZones(player, levelData = null) {
    // Alias for getDangerZones to match usage in component
    return this.getDangerZones(player, levelData);
  }

  checkHits(player, floor) {
    if (this.currentAbility) {
      return this.currentAbility.checkHits(this.boss, player, floor);
    }
    return null;
  }

  getCurrentState() {
    return this.currentState;
  }
}
