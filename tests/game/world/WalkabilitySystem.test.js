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

    it('should use grid-based quick rejection when pathfindingGrid is available', () => {
      const levelData = {
        rooms: [{ x: 10, y: 10, w: 10, h: 10 }],
        corridors: [],
        pathfindingGrid: [
          [0, 0, 0],
          [0, 1, 0],
          [0, 0, 0]
        ],
        pathfindingGridSize: 10
      };
      // Point at walkable cell (1,1) - grid says walkable, and also in room
      expect(isPointWalkable(15, 15, levelData, 10)).toBe(true);
      // Point at wall cell (0,0) - grid says not walkable
      expect(isPointWalkable(5, 5, levelData, 10)).toBe(false);
    });

    it('should check nearby cells within radius for grid-based rejection', () => {
      const levelData = {
        rooms: [{ x: 20, y: 20, w: 10, h: 10 }],
        corridors: [],
        pathfindingGrid: [
          [0, 0, 0, 0],
          [0, 0, 1, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0]
        ],
        pathfindingGridSize: 10
      };
      // Point at walkable cell (2,1) which is at (20, 10) - but room is at (20, 20)
      // So grid finds walkable but precise check fails - should return false
      expect(isPointWalkable(25, 15, levelData, 5)).toBe(false);
      // Point actually in room at (25, 25) - should be walkable
      expect(isPointWalkable(25, 25, levelData, 5)).toBe(true);
    });

    it('should handle out of bounds grid cells', () => {
      const levelData = {
        rooms: [],
        corridors: [],
        pathfindingGrid: [
          [1, 1],
          [1, 1]
        ],
        pathfindingGridSize: 10
      };
      // Point way outside grid
      expect(isPointWalkable(1000, 1000, levelData, 10)).toBe(false);
    });

    it('should handle grid with missing rows', () => {
      const levelData = {
        rooms: [],
        corridors: [],
        pathfindingGrid: [
          [1, 1],
          null,
          [1, 1]
        ],
        pathfindingGridSize: 10
      };
      // Should not crash, should fall through to precise check
      expect(typeof isPointWalkable(15, 15, levelData, 10)).toBe('boolean');
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

    it('should return false when line of sight hits a wall', () => {
      const levelData = {
        rooms: [{ x: 0, y: 0, w: 50, h: 100 }],
        corridors: []
      };
      // Line from inside room to outside (hits wall)
      expect(hasLineOfSight(25, 50, 100, 50, levelData, 10)).toBe(false);
    });

    it('should return true when line of sight is clear', () => {
      const levelData = {
        rooms: [{ x: 0, y: 0, w: 100, h: 100 }],
        corridors: []
      };
      // Line entirely within room
      expect(hasLineOfSight(10, 10, 80, 80, levelData, 10)).toBe(true);
    });
  });
});
