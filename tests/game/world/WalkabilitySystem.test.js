import { describe, it, expect } from 'vitest';
import { isPointWalkable, findNearestWalkable, hasLineOfSight, circleOverlapsRect } from '../../../src/game/world/WalkabilitySystem.js';

describe('WalkabilitySystem', () => {
  describe('circleOverlapsRect', () => {
    it('should detect circle-rectangle overlap', () => {
      expect(circleOverlapsRect(5, 5, 3, 0, 0, 10, 10)).toBe(true);
      expect(circleOverlapsRect(50, 50, 5, 0, 0, 10, 10)).toBe(false);
    });
  });
  
  describe('isPointWalkable', () => {
    it('should return true if no level data', () => {
      expect(isPointWalkable(0, 0, null, 10)).toBe(true);
    });
    
    it('should check if point is in room', () => {
      const levelData = {
        rooms: [{ x: 0, y: 0, w: 100, h: 100 }],
        corridors: []
      };
      expect(isPointWalkable(50, 50, levelData, 10)).toBe(true);
      expect(isPointWalkable(200, 200, levelData, 10)).toBe(false);
    });
    
    it('should check if point is in corridor', () => {
      const levelData = {
        rooms: [],
        corridors: [{ x: 0, y: 0, w: 100, h: 20 }]
      };
      expect(isPointWalkable(50, 10, levelData, 10)).toBe(true);
    });
  });
  
  describe('findNearestWalkable', () => {
    it('should return original position if no level data', () => {
      expect(findNearestWalkable(100, 100, null, 10)).toEqual({ x: 100, y: 100 });
    });
    
    it('should find nearest walkable position', () => {
      const levelData = {
        rooms: [{ x: 0, y: 0, w: 100, h: 100 }],
        corridors: []
      };
      const result = findNearestWalkable(200, 200, levelData, 10);
      expect(result).toHaveProperty('x');
      expect(result).toHaveProperty('y');
    });
  });
  
  describe('hasLineOfSight', () => {
    it('should return true for zero distance', () => {
      const levelData = { rooms: [{ x: 0, y: 0, w: 100, h: 100 }], corridors: [] };
      expect(hasLineOfSight(0, 0, 0, 0, levelData, 10)).toBe(true);
    });
    
    it('should check line of sight through walkable area', () => {
      const levelData = {
        rooms: [{ x: 0, y: 0, w: 100, h: 100 }],
        corridors: []
      };
      expect(hasLineOfSight(10, 10, 90, 90, levelData, 10)).toBe(true);
    });
  });
});
