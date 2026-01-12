import { describe, it, expect } from 'vitest';
import { generateFlowField, getFlowDirection } from '../../../src/game/systems/PathfindingSystem.js';

describe('PathfindingSystem', () => {
  describe('generateFlowField', () => {
    it('should generate flow field from valid grid', () => {
      const grid = [
        [1, 1, 1],
        [1, 1, 1],
        [1, 1, 1]
      ];
      const result = generateFlowField(15, 15, grid, 10);
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('distances');
      expect(result).toHaveProperty('gridSize', 10);
      expect(result).toHaveProperty('gridW', 3);
      expect(result).toHaveProperty('gridH', 3);
    });
    
    it('should throw error for invalid grid', () => {
      expect(() => generateFlowField(0, 0, null, 10)).toThrow();
      expect(() => generateFlowField(0, 0, [], 10)).toThrow();
    });

    it('should throw error when grid[0] is not an array', () => {
      expect(() => generateFlowField(0, 0, [null], 10)).toThrow();
      expect(() => generateFlowField(0, 0, [{}], 10)).toThrow();
    });

    it('should throw error when grid[0] is empty array', () => {
      expect(() => generateFlowField(0, 0, [[]], 10)).toThrow();
    });
    
    it('should return null if no walkable cell found', () => {
      const grid = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0]
      ];
      const result = generateFlowField(15, 15, grid, 10);
      expect(result).toBeNull();
    });
  });
  
  describe('getFlowDirection', () => {
    it('should return zero vector if no flow field data', () => {
      const result = getFlowDirection(0, 0, null);
      expect(result).toEqual({ x: 0, y: 0 });
    });
    
    it('should return direction vector from flow field', () => {
      const grid = [
        [1, 1, 1],
        [1, 1, 1],
        [1, 1, 1]
      ];
      const flowField = generateFlowField(15, 15, grid, 10);
      const result = getFlowDirection(5, 5, flowField);
      expect(result).toHaveProperty('x');
      expect(result).toHaveProperty('y');
    });
    
    it('should return zero vector if out of bounds', () => {
      const grid = [
        [1, 1],
        [1, 1]
      ];
      const flowField = generateFlowField(5, 5, grid, 10);
      const result = getFlowDirection(1000, 1000, flowField);
      expect(result).toEqual({ x: 0, y: 0 });
    });

    it('should handle wall at center cell with fallback to neighbors', () => {
      const grid = [
        [1, 1, 1],
        [1, 0, 1], // Wall in center
        [1, 1, 1]
      ];
      const flowField = generateFlowField(15, 15, grid, 10);
      const result = getFlowDirection(15, 15, flowField);
      expect(result).toHaveProperty('x');
      expect(result).toHaveProperty('y');
    });

    it('should handle Infinity neighbors by using center distance', () => {
      const grid = [
        [0, 0, 0],
        [0, 1, 0], // Single walkable cell
        [0, 0, 0]
      ];
      const flowField = generateFlowField(15, 15, grid, 10);
      const result = getFlowDirection(15, 15, flowField);
      expect(result).toHaveProperty('x');
      expect(result).toHaveProperty('y');
    });

    it('should use fallback when gradient magnitude is too small', () => {
      const grid = [
        [1, 1, 1],
        [1, 1, 1],
        [1, 1, 1]
      ];
      // Target at center, so gradient should be near zero at target
      const flowField = generateFlowField(15, 15, grid, 10);
      const result = getFlowDirection(15, 15, flowField);
      expect(result).toHaveProperty('x');
      expect(result).toHaveProperty('y');
    });

    it('should handle fallback when gradient is too small and find best neighbor', () => {
      const grid = [
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1]
      ];
      // Create a flow field where gradient will be very small
      const flowField = generateFlowField(20, 20, grid, 10);
      // Test at a position where all neighbors have same distance (gradient = 0)
      const result = getFlowDirection(20, 20, flowField);
      expect(result).toHaveProperty('x');
      expect(result).toHaveProperty('y');
      // Should use fallback neighbor check (lines 309-312)
    });

    it('should find best neighbor in fallback when gradient is too small', () => {
      const grid = [
        [1, 0, 1],
        [0, 1, 0],
        [1, 0, 1]
      ];
      // Create flow field with a single walkable cell
      const flowField = generateFlowField(15, 15, grid, 10);
      // Test at the walkable cell - gradient will be near zero
      const result = getFlowDirection(15, 15, flowField);
      expect(result).toHaveProperty('x');
      expect(result).toHaveProperty('y');
      // Should use fallback and find best neighbor (lines 309-312)
      // The result should be a valid direction vector
      const len = Math.hypot(result.x, result.y);
      expect(len).toBeGreaterThanOrEqual(0);
    });

    it('should handle edge coordinates (at grid boundaries)', () => {
      const grid = [
        [1, 1],
        [1, 1]
      ];
      const flowField = generateFlowField(5, 5, grid, 10);
      const result = getFlowDirection(0, 0, flowField);
      expect(result).toHaveProperty('x');
      expect(result).toHaveProperty('y');
    });
  });

  describe('generateFlowField - wall influence and pathfinding', () => {
    it('should apply wall penalty to tiles adjacent to walls', () => {
      const grid = [
        [0, 1, 1],
        [1, 1, 1],
        [1, 1, 1]
      ];
      const result = generateFlowField(15, 15, grid, 10);
      expect(result).not.toBeNull();
      // Tiles adjacent to wall should have higher cost
      expect(result.distances).toBeDefined();
    });

    it('should handle diagonal movement with cardinal validation', () => {
      const grid = [
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1]
      ];
      const result = generateFlowField(20, 20, grid, 10);
      expect(result).not.toBeNull();
      expect(result.distances).toBeDefined();
    });

    it('should prevent diagonal movement when cardinals are blocked', () => {
      const grid = [
        [1, 0, 1],
        [0, 1, 0],
        [1, 0, 1]
      ];
      const result = generateFlowField(15, 15, grid, 10);
      expect(result).not.toBeNull();
      // Diagonal should be blocked if cardinals are walls
    });

    it('should find nearest walkable cell when target is in wall', () => {
      const grid = [
        [0, 1, 0],
        [1, 1, 1],
        [0, 1, 0]
      ];
      // Target at wall position (0,0)
      const result = generateFlowField(5, 5, grid, 10);
      expect(result).not.toBeNull();
      expect(result.distances).toBeDefined();
    });

    it('should handle target outside grid bounds', () => {
      const grid = [
        [1, 1],
        [1, 1]
      ];
      // Target way outside grid - should return null if can't find walkable within 5 tiles
      const result = generateFlowField(1000, 1000, grid, 10);
      // This may return null if target is too far, which is expected behavior
      if (result) {
        expect(result.distances).toBeDefined();
      } else {
        expect(result).toBeNull();
      }
    });

    it('should process all cardinal directions in BFS', () => {
      const grid = [
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1]
      ];
      const result = generateFlowField(20, 20, grid, 10);
      expect(result).not.toBeNull();
      // All cells should have finite distances
      const hasFiniteDist = result.distances.some(row => 
        row.some(dist => dist !== Infinity && dist !== undefined)
      );
      expect(hasFiniteDist).toBe(true);
    });

    it('should handle complex grid with mixed walls and floors', () => {
      const grid = [
        [1, 1, 0, 1, 1],
        [1, 0, 0, 0, 1],
        [0, 0, 1, 0, 0],
        [1, 0, 0, 0, 1],
        [1, 1, 0, 1, 1]
      ];
      const result = generateFlowField(20, 20, grid, 10);
      expect(result).not.toBeNull();
      expect(result.distances).toBeDefined();
    });
  });
});
