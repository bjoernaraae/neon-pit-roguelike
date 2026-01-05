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
  });
});
