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
  RING_PULSE: 'ring_pulse'
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
        color: this.state === BOSS_ABILITY_STATE.WINDUP ? 'rgba(255,200,0,0.4)' : 'rgba(255,50,50,0.5)',
        alpha: this.state === BOSS_ABILITY_STATE.WINDUP ? 0.4 : 0.5,
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
    this.dashSpeed = options.dashSpeed || 600;
    this.startX = 0;
    this.startY = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.dashProgress = 0;
  }

  getWindupTime() {
    return 1.0;
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
      
      return [{
        type: DANGER_ZONE_TYPE.LINE_DASH,
        x: this.startX,
        y: this.startY,
        targetX: this.targetX,
        targetY: this.targetY,
        width: 60,
        state: this.state,
        color: this.state === BOSS_ABILITY_STATE.WINDUP ? 'rgba(255,200,0,0.4)' : 'rgba(255,50,50,0.5)',
        alpha: this.state === BOSS_ABILITY_STATE.WINDUP ? 0.4 : 0.5,
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

  getDangerZones(boss, player) {
    if (this.state === BOSS_ABILITY_STATE.WINDUP || this.state === BOSS_ABILITY_STATE.ACTIVE) {
      if (this.state === BOSS_ABILITY_STATE.ACTIVE) {
        this.currentRadius = Math.min(
          this.maxRadius,
          this.currentRadius + this.expandSpeed * (this.getActiveTime() - this.stateTimer)
        );
      } else {
        this.currentRadius = 0;
      }
      
      return [{
        type: DANGER_ZONE_TYPE.RING_PULSE,
        x: boss.x,
        y: boss.y,
        radius: this.currentRadius,
        maxRadius: this.maxRadius,
        state: this.state
      }];
    }
    return [];
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
      const ringThickness = 20;
      const innerRadius = Math.max(0, this.currentRadius - ringThickness);
      const outerRadius = this.currentRadius;
      
      return [{
        type: DANGER_ZONE_TYPE.RING_PULSE,
        x: boss.x,
        y: boss.y,
        innerRadius: innerRadius,
        outerRadius: outerRadius,
        radius: this.currentRadius,
        maxRadius: this.maxRadius,
        state: this.state,
        color: this.state === BOSS_ABILITY_STATE.WINDUP ? 'rgba(255,200,0,0.4)' : 'rgba(255,50,50,0.5)',
        alpha: this.state === BOSS_ABILITY_STATE.WINDUP ? 0.4 : 0.5,
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
 * Boss Controller - Manages boss abilities and state
 */
export class BossController {
  constructor(boss, abilities = []) {
    this.boss = boss;
    this.abilities = abilities;
    this.currentAbility = null;
    this.currentState = BOSS_ABILITY_STATE.IDLE;
  }

  update(player, dt, floor) {
    // Update all abilities
    for (const ability of this.abilities) {
      ability.update(dt);
    }

    // Update current ability state
    if (this.currentAbility) {
      this.currentAbility.stateTimer = Math.max(0, this.currentAbility.stateTimer - dt);
      
      if (this.currentAbility.stateTimer <= 0) {
        this.advanceAbilityState(this.currentAbility);
      }
    } else {
      // Try to use an ability
      this.tryUseAbility(player, floor);
    }
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

  getDangerZones(player) {
    if (this.currentAbility) {
      return this.currentAbility.getDangerZones(this.boss, player);
    }
    return [];
  }

  getAllDangerZones(player) {
    // Alias for getDangerZones to match usage in component
    return this.getDangerZones(player);
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
