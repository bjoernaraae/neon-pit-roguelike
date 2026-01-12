import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BOSS_ABILITY_STATE,
  DANGER_ZONE_TYPE,
  ConeAttackAbility,
  LineDashAbility,
  RingPulseAbility,
  TeleportAbility,
  ChargeAbility,
  MultiShotAbility,
  BossController
} from '../../../src/game/systems/BossAbilitySystem.js';

describe('BossAbilitySystem', () => {
  describe('BOSS_ABILITY_STATE', () => {
    it('should have all required states', () => {
      expect(BOSS_ABILITY_STATE.IDLE).toBe('idle');
      expect(BOSS_ABILITY_STATE.WINDUP).toBe('windup');
      expect(BOSS_ABILITY_STATE.ACTIVE).toBe('active');
      expect(BOSS_ABILITY_STATE.RECOVERY).toBe('recovery');
    });
  });

  describe('DANGER_ZONE_TYPE', () => {
    it('should have all required zone types', () => {
      expect(DANGER_ZONE_TYPE.CONE).toBe('cone');
      expect(DANGER_ZONE_TYPE.LINE_DASH).toBe('line_dash');
      expect(DANGER_ZONE_TYPE.RING_PULSE).toBe('ring_pulse');
      expect(DANGER_ZONE_TYPE.CHARGE).toBe('charge');
      expect(DANGER_ZONE_TYPE.MULTI_SHOT).toBe('multi_shot');
      expect(DANGER_ZONE_TYPE.TELEPORT).toBe('teleport');
    });
  });

  describe('ConeAttackAbility', () => {
    let ability;
    let boss;
    let player;

    beforeEach(() => {
      ability = new ConeAttackAbility();
      boss = { x: 0, y: 0 };
      player = { x: 100, y: 0 };
    });

    it('should initialize with default values', () => {
      expect(ability.state).toBe(BOSS_ABILITY_STATE.IDLE);
      expect(ability.cooldownTimer).toBe(0);
      expect(ability.range).toBe(400);
      expect(ability.arcAngle).toBeCloseTo(Math.PI / 3);
    });

    it('should update cooldown and state timers', () => {
      ability.cooldownTimer = 5;
      ability.stateTimer = 2;
      ability.update(1);
      expect(ability.cooldownTimer).toBe(4);
      expect(ability.stateTimer).toBe(1);
    });

    it('should return false from canUse when on cooldown', () => {
      ability.cooldownTimer = 1;
      expect(ability.canUse()).toBe(false);
    });

    it('should return false from canUse when not idle', () => {
      ability.state = BOSS_ABILITY_STATE.WINDUP;
      expect(ability.canUse()).toBe(false);
    });

    it('should return true from canUse when ready', () => {
      ability.cooldownTimer = 0;
      ability.state = BOSS_ABILITY_STATE.IDLE;
      expect(ability.canUse()).toBe(true);
    });

    it('should start ability and enter windup state', () => {
      const result = ability.start(boss, player);
      expect(result).toBe(true);
      expect(ability.state).toBe(BOSS_ABILITY_STATE.WINDUP);
      expect(ability.stateTimer).toBe(1.5);
    });

    it('should return false from start if cannot use', () => {
      ability.cooldownTimer = 1;
      const result = ability.start(boss, player);
      expect(result).toBe(false);
    });

    it('should return danger zones during windup and active', () => {
      ability.start(boss, player);
      const zones = ability.getDangerZones(boss, player);
      expect(zones.length).toBe(1);
      expect(zones[0].type).toBe(DANGER_ZONE_TYPE.CONE);
      expect(zones[0].state).toBe(BOSS_ABILITY_STATE.WINDUP);
    });

    it('should return empty array when idle', () => {
      const zones = ability.getDangerZones(boss, player);
      expect(zones).toEqual([]);
    });

    it('should check hits during active state', () => {
      ability.start(boss, player);
      ability.state = BOSS_ABILITY_STATE.ACTIVE;
      ability.angle = Math.atan2(0, 100);
      
      const hit = ability.checkHits(boss, player, 1);
      expect(hit).not.toBeNull();
      expect(hit.damage).toBe(30);
      expect(hit.ability.name).toBe('Cone Attack');
    });

    it('should return null if player out of range', () => {
      ability.start(boss, player);
      ability.state = BOSS_ABILITY_STATE.ACTIVE;
      player.x = 1000;
      const hit = ability.checkHits(boss, player, 1);
      expect(hit).toBeNull();
    });

    it('should return null if player outside arc', () => {
      ability.start(boss, player);
      ability.state = BOSS_ABILITY_STATE.ACTIVE;
      ability.angle = 0;
      player.x = 100;
      player.y = 1000; // Far from arc
      const hit = ability.checkHits(boss, player, 1);
      expect(hit).toBeNull();
    });
  });

  describe('LineDashAbility', () => {
    let ability;
    let boss;
    let player;

    beforeEach(() => {
      ability = new LineDashAbility();
      boss = { x: 0, y: 0 };
      player = { x: 100, y: 0 };
    });

    it('should initialize with default values', () => {
      expect(ability.dashDistance).toBe(300);
      expect(ability.dashSpeed).toBe(500);
    });

    it('should calculate active time based on distance and speed', () => {
      expect(ability.getActiveTime()).toBe(300 / 500);
    });

    it('should set target during windup', () => {
      ability.start(boss, player);
      ability.state = BOSS_ABILITY_STATE.WINDUP;
      const zones = ability.getDangerZones(boss, player);
      expect(zones.length).toBe(1);
      expect(zones[0].type).toBe(DANGER_ZONE_TYPE.LINE_DASH);
    });

    it('should check hits during active state', () => {
      ability.start(boss, player);
      ability.state = BOSS_ABILITY_STATE.ACTIVE;
      ability.startX = 0;
      ability.startY = 0;
      ability.targetX = 300;
      ability.targetY = 0;
      
      player.x = 150;
      player.y = 0;
      const hit = ability.checkHits(boss, player, 1);
      expect(hit).not.toBeNull();
      expect(hit.damage).toBe(36);
    });

    it('should calculate distance to line segment correctly', () => {
      const dist = ability.distanceToLineSegment(0, 0, 0, 0, 100, 0);
      expect(dist).toBe(0);
      
      const dist2 = ability.distanceToLineSegment(50, 10, 0, 0, 100, 0);
      expect(dist2).toBe(10);
    });
  });

  describe('RingPulseAbility', () => {
    let ability;
    let boss;
    let player;

    beforeEach(() => {
      ability = new RingPulseAbility();
      boss = { x: 0, y: 0 };
      player = { x: 100, y: 0 };
    });

    it('should initialize with default values', () => {
      expect(ability.maxRadius).toBe(350);
      expect(ability.currentRadius).toBe(0);
      expect(ability.expandSpeed).toBe(400);
    });

    it('should update radius during active state', () => {
      ability.state = BOSS_ABILITY_STATE.ACTIVE;
      ability.stateTimer = 0.5;
      ability.update(0.1);
      expect(ability.currentRadius).toBeGreaterThan(0);
    });

    it('should reset radius when idle', () => {
      ability.currentRadius = 100;
      ability.state = BOSS_ABILITY_STATE.IDLE;
      ability.update(0.1);
      expect(ability.currentRadius).toBe(0);
    });

    it('should return danger zones with ring properties', () => {
      ability.start(boss, player);
      const zones = ability.getDangerZones(boss, player);
      expect(zones.length).toBe(1);
      expect(zones[0].type).toBe(DANGER_ZONE_TYPE.RING_PULSE);
      expect(zones[0]).toHaveProperty('innerRadius');
      expect(zones[0]).toHaveProperty('outerRadius');
    });

    it('should check hits when player is in ring', () => {
      ability.state = BOSS_ABILITY_STATE.ACTIVE;
      ability.currentRadius = 200;
      player.x = 190;
      player.y = 0;
      const hit = ability.checkHits(boss, player, 1);
      expect(hit).not.toBeNull();
      expect(hit.damage).toBe(24);
    });

    it('should return null if player outside ring', () => {
      ability.state = BOSS_ABILITY_STATE.ACTIVE;
      ability.currentRadius = 200;
      player.x = 250;
      player.y = 0;
      const hit = ability.checkHits(boss, player, 1);
      expect(hit).toBeNull();
    });
  });

  describe('TeleportAbility', () => {
    let ability;
    let boss;
    let player;

    beforeEach(() => {
      ability = new TeleportAbility();
      boss = { x: 0, y: 0, r: 20 };
      player = { x: 100, y: 0 };
    });

    it('should initialize with default values', () => {
      expect(ability.teleportDistance).toBe(250);
    });

    it('should return danger zones during windup', () => {
      ability.start(boss, player);
      ability.state = BOSS_ABILITY_STATE.WINDUP;
      const zones = ability.getDangerZones(boss, player);
      expect(zones.length).toBe(1);
      expect(zones[0].type).toBe(DANGER_ZONE_TYPE.TELEPORT);
    });

    it('should clamp to walkable area when levelData provided', () => {
      const levelData = {
        rooms: [{ x: 0, y: 0, w: 500, h: 500 }],
        corridors: []
      };
      ability.start(boss, player);
      ability.state = BOSS_ABILITY_STATE.WINDUP;
      const zones = ability.getDangerZones(boss, player, levelData);
      expect(zones.length).toBe(1);
      expect(zones[0].x).toBeGreaterThanOrEqual(0);
    });

    it('should return null from checkHits (teleport does not damage)', () => {
      ability.state = BOSS_ABILITY_STATE.ACTIVE;
      const hit = ability.checkHits(boss, player, 1);
      expect(hit).toBeNull();
    });

    it('should clamp to walkable area correctly', () => {
      const levelData = {
        rooms: [{ x: 0, y: 0, w: 100, h: 100 }],
        corridors: []
      };
      const result = ability.clampToWalkable(200, 200, levelData, 20);
      expect(result.x).toBeLessThanOrEqual(100);
      expect(result.y).toBeLessThanOrEqual(100);
    });
  });

  describe('ChargeAbility', () => {
    let ability;
    let boss;
    let player;

    beforeEach(() => {
      ability = new ChargeAbility();
      boss = { x: 0, y: 0 };
      player = { x: 100, y: 0 };
    });

    it('should initialize with default values', () => {
      expect(ability.chargeDistance).toBe(400);
      expect(ability.chargeSpeed).toBe(450);
    });

    it('should return danger zones during windup and active', () => {
      ability.start(boss, player);
      const zones = ability.getDangerZones(boss, player);
      expect(zones.length).toBe(1);
      expect(zones[0].type).toBe(DANGER_ZONE_TYPE.CHARGE);
    });

    it('should check hits during active state', () => {
      ability.start(boss, player);
      ability.state = BOSS_ABILITY_STATE.ACTIVE;
      ability.startX = 0;
      ability.startY = 0;
      ability.targetX = 400;
      ability.targetY = 0;
      
      player.x = 200;
      player.y = 0;
      const hit = ability.checkHits(boss, player, 1);
      expect(hit).not.toBeNull();
      expect(hit.damage).toBe(42);
    });
  });

  describe('MultiShotAbility', () => {
    let ability;
    let boss;
    let player;

    beforeEach(() => {
      ability = new MultiShotAbility();
      boss = { x: 0, y: 0 };
      player = { x: 100, y: 0 };
    });

    it('should initialize with default values', () => {
      expect(ability.shotCount).toBe(5);
      expect(ability.arcAngle).toBeCloseTo(Math.PI * 0.8);
      expect(ability.range).toBe(450);
    });

    it('should return multiple danger zones', () => {
      ability.start(boss, player);
      const zones = ability.getDangerZones(boss, player);
      expect(zones.length).toBe(5);
      zones.forEach(zone => {
        expect(zone.type).toBe(DANGER_ZONE_TYPE.MULTI_SHOT);
      });
    });

    it('should check hits when player is in shot path', () => {
      ability.start(boss, player);
      ability.state = BOSS_ABILITY_STATE.ACTIVE;
      const hit = ability.checkHits(boss, player, 1);
      expect(hit).not.toBeNull();
      expect(hit.damage).toBe(18);
    });

    it('should return null if player out of range', () => {
      ability.start(boss, player);
      ability.state = BOSS_ABILITY_STATE.ACTIVE;
      player.x = 1000;
      const hit = ability.checkHits(boss, player, 1);
      expect(hit).toBeNull();
    });
  });

  describe('BossController', () => {
    let controller;
    let boss;
    let ability1;
    let ability2;
    let player;

    beforeEach(() => {
      boss = { x: 0, y: 0, r: 20 };
      ability1 = new ConeAttackAbility();
      ability2 = new LineDashAbility();
      controller = new BossController(boss, [ability1, ability2]);
      player = { x: 100, y: 0 };
    });

    it('should initialize with boss and abilities', () => {
      expect(controller.boss).toBe(boss);
      expect(controller.abilities).toHaveLength(2);
      expect(controller.currentAbility).toBeNull();
      expect(controller.currentState).toBe(BOSS_ABILITY_STATE.IDLE);
    });

    it('should update all abilities', () => {
      ability1.cooldownTimer = 5;
      controller.update(player, 1, 1);
      expect(ability1.cooldownTimer).toBe(4);
    });

    it('should try to use ability when no current ability', () => {
      controller.update(player, 1, 1);
      // Should attempt to start an ability
      expect(controller.currentAbility).not.toBeNull();
    });

    it('should advance ability state from windup to active', () => {
      ability1.start(boss, player);
      controller.currentAbility = ability1;
      controller.currentState = BOSS_ABILITY_STATE.WINDUP;
      ability1.stateTimer = 0.1;
      controller.update(player, 0.2, 1);
      expect(ability1.state).toBe(BOSS_ABILITY_STATE.ACTIVE);
    });

    it('should advance ability state from active to recovery', () => {
      ability1.start(boss, player);
      ability1.state = BOSS_ABILITY_STATE.ACTIVE;
      controller.currentAbility = ability1;
      controller.currentState = BOSS_ABILITY_STATE.ACTIVE;
      ability1.stateTimer = 0.1;
      controller.update(player, 0.2, 1);
      expect(ability1.state).toBe(BOSS_ABILITY_STATE.RECOVERY);
    });

    it('should advance ability state from recovery to idle', () => {
      ability1.start(boss, player);
      ability1.state = BOSS_ABILITY_STATE.RECOVERY;
      controller.currentAbility = ability1;
      controller.currentState = BOSS_ABILITY_STATE.RECOVERY;
      ability1.stateTimer = 0.1;
      controller.update(player, 0.2, 1);
      expect(ability1.state).toBe(BOSS_ABILITY_STATE.IDLE);
      expect(controller.currentAbility).toBeNull();
    });

    it('should move boss during line dash', () => {
      const dashAbility = new LineDashAbility();
      dashAbility.start(boss, player);
      dashAbility.state = BOSS_ABILITY_STATE.ACTIVE;
      dashAbility.startX = 0;
      dashAbility.startY = 0;
      dashAbility.targetX = 300;
      dashAbility.targetY = 0;
      dashAbility.stateTimer = dashAbility.getActiveTime() * 0.5;
      controller.currentAbility = dashAbility;
      controller.update(player, 0.1, 1);
      expect(boss.x).toBeGreaterThan(0);
    });

    it('should move boss during charge', () => {
      const chargeAbility = new ChargeAbility();
      chargeAbility.start(boss, player);
      chargeAbility.state = BOSS_ABILITY_STATE.ACTIVE;
      chargeAbility.startX = 0;
      chargeAbility.startY = 0;
      chargeAbility.targetX = 400;
      chargeAbility.targetY = 0;
      chargeAbility.stateTimer = chargeAbility.getActiveTime() * 0.5;
      controller.currentAbility = chargeAbility;
      controller.update(player, 0.1, 1);
      expect(boss.x).toBeGreaterThan(0);
    });

    it('should teleport boss during teleport ability', () => {
      const teleportAbility = new TeleportAbility();
      teleportAbility.start(boss, player);
      teleportAbility.state = BOSS_ABILITY_STATE.ACTIVE;
      teleportAbility.targetX = 250;
      teleportAbility.targetY = 0;
      controller.currentAbility = teleportAbility;
      controller.update(player, 0.1, 1);
      expect(boss.x).toBe(250);
      expect(boss.y).toBe(0);
    });

    it('should get danger zones from current ability', () => {
      ability1.start(boss, player);
      controller.currentAbility = ability1;
      const zones = controller.getDangerZones(player);
      expect(zones.length).toBeGreaterThan(0);
    });

    it('should return empty array when no current ability', () => {
      const zones = controller.getDangerZones(player);
      expect(zones).toEqual([]);
    });

    it('should check hits from current ability', () => {
      ability1.start(boss, player);
      ability1.state = BOSS_ABILITY_STATE.ACTIVE;
      ability1.angle = Math.atan2(0, 100);
      controller.currentAbility = ability1;
      const hit = controller.checkHits(player, 1);
      expect(hit).not.toBeNull();
    });

    it('should return null from checkHits when no current ability', () => {
      const hit = controller.checkHits(player, 1);
      expect(hit).toBeNull();
    });

    it('should return current state', () => {
      expect(controller.getCurrentState()).toBe(BOSS_ABILITY_STATE.IDLE);
      ability1.start(boss, player);
      controller.currentAbility = ability1;
      controller.currentState = BOSS_ABILITY_STATE.WINDUP;
      expect(controller.getCurrentState()).toBe(BOSS_ABILITY_STATE.WINDUP);
    });

    it('should clamp boss to walkable area during movement', () => {
      const levelData = {
        rooms: [{ x: 0, y: 0, w: 200, h: 200 }],
        corridors: []
      };
      const dashAbility = new LineDashAbility();
      dashAbility.start(boss, player);
      dashAbility.state = BOSS_ABILITY_STATE.ACTIVE;
      dashAbility.startX = 0;
      dashAbility.startY = 0;
      dashAbility.targetX = 1000; // Outside bounds
      dashAbility.targetY = 0;
      dashAbility.stateTimer = dashAbility.getActiveTime() * 0.5;
      controller.currentAbility = dashAbility;
      controller.update(player, 0.1, 1, levelData);
      expect(boss.x).toBeLessThanOrEqual(200);
    });

    it('should handle getAllDangerZones alias', () => {
      ability1.start(boss, player);
      controller.currentAbility = ability1;
      const zones = controller.getAllDangerZones(player);
      expect(zones.length).toBeGreaterThan(0);
    });

    it('should handle getAllDangerZones with levelData', () => {
      const teleportAbility = new TeleportAbility();
      teleportAbility.start(boss, player);
      teleportAbility.state = BOSS_ABILITY_STATE.WINDUP;
      controller.currentAbility = teleportAbility;
      const levelData = {
        rooms: [{ x: 0, y: 0, w: 500, h: 500 }],
        corridors: []
      };
      const zones = controller.getAllDangerZones(player, levelData);
      expect(zones.length).toBeGreaterThan(0);
    });

    it('should handle clampToWalkable when position is in area', () => {
      const levelData = {
        rooms: [{ x: 0, y: 0, w: 500, h: 500 }],
        corridors: []
      };
      const result = controller.clampToWalkable(100, 100, levelData);
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
    });

    it('should handle clampToWalkable when position is outside all areas', () => {
      const levelData = {
        rooms: [{ x: 0, y: 0, w: 100, h: 100 }],
        corridors: []
      };
      const result = controller.clampToWalkable(1000, 1000, levelData);
      expect(result.x).toBeLessThan(1000);
      expect(result.y).toBeLessThan(1000);
    });

    it('should handle clampToWalkable with corridors', () => {
      const levelData = {
        rooms: [{ x: 0, y: 0, w: 100, h: 100 }],
        corridors: [{ x: 100, y: 0, w: 50, h: 50 }]
      };
      const result = controller.clampToWalkable(125, 25, levelData);
      expect(result.x).toBeGreaterThanOrEqual(100);
      expect(result.x).toBeLessThanOrEqual(150);
    });

    it('should handle clampToWalkable without levelData', () => {
      const result = controller.clampToWalkable(100, 100, null);
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
    });

    it('should handle BaseAbility constructor with options', () => {
      const ability = new ConeAttackAbility({
        cooldown: 10,
        phase2Effect: { multiplier: 2 }
      });
      expect(ability.cooldown).toBe(10);
      expect(ability.phase2Effect).toEqual({ multiplier: 2 });
    });

    it('should handle clampToWalkable when position is exactly at area boundary', () => {
      const levelData = {
        rooms: [{ x: 0, y: 0, w: 100, h: 100 }],
        corridors: []
      };
      boss.r = 20;
      const margin = boss.r * 0.5; // 10
      const result = controller.clampToWalkable(10, 10, levelData);
      expect(result.x).toBeGreaterThanOrEqual(10);
      expect(result.x).toBeLessThanOrEqual(90);
    });

    it('should handle clampToWalkable edge case with empty arrays', () => {
      const levelData = {
        rooms: [],
        corridors: []
      };
      const result = controller.clampToWalkable(1000, 1000, levelData);
      expect(result.x).toBe(1000);
      expect(result.y).toBe(1000);
    });

    it('should handle update when currentAbility stateTimer is exactly 0', () => {
      ability1.start(boss, player);
      controller.currentAbility = ability1;
      ability1.stateTimer = 0.1;
      controller.update(player, 0.1, 1);
      // Should advance state
      expect(ability1.state).toBe(BOSS_ABILITY_STATE.ACTIVE);
    });
  });
});
