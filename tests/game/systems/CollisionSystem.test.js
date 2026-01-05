import { describe, it, expect, vi } from 'vitest';
import { getVisualRadius, resolveKinematicOverlap, resolveDynamicOverlap } from '../../../src/game/systems/CollisionSystem.js';

// Mock walkability functions
vi.mock('../../../src/game/world/WalkabilitySystem.js', () => ({
  isPointWalkable: vi.fn((x, y, levelData, radius) => true),
  findNearestWalkable: vi.fn((x, y, levelData, radius) => ({ x, y }))
}));

describe('CollisionSystem', () => {
  describe('getVisualRadius', () => {
    it('should calculate visual radius as 40% of entity radius', () => {
      expect(getVisualRadius(10)).toBe(4);
      expect(getVisualRadius(20)).toBe(8);
      expect(getVisualRadius(14)).toBe(5.6);
    });
  });
  
  describe('resolveKinematicOverlap', () => {
    it('should return false if no overlap', () => {
      const kin = { x: 0, y: 0, r: 10, z: 0 };
      const dyn = { x: 100, y: 100, r: 10 };
      expect(resolveKinematicOverlap(kin, dyn, null, null)).toBe(false);
    });
    
    it('should return false during grace period', () => {
      const kin = { x: 0, y: 0, r: 10, jumpLandingGrace: 1 };
      const dyn = { x: 5, y: 5, r: 10 };
      expect(resolveKinematicOverlap(kin, dyn, null, null)).toBe(false);
    });
    
    it('should return false if player is high enough', () => {
      const kin = { x: 0, y: 0, r: 10, z: 10 };
      const dyn = { x: 5, y: 5, r: 10 };
      expect(resolveKinematicOverlap(kin, dyn, null, null)).toBe(false);
    });
  });
  
  describe('resolveDynamicOverlap', () => {
    it('should return false if no overlap', () => {
      const a = { x: 0, y: 0, r: 10 };
      const b = { x: 100, y: 100, r: 10 };
      expect(resolveDynamicOverlap(a, b, null)).toBe(false);
    });
    
    it('should resolve overlap between two entities', () => {
      const a = { x: 0, y: 0, r: 10 };
      const b = { x: 5, y: 0, r: 10 };
      const result = resolveDynamicOverlap(a, b, null);
      expect(result).toBe(true);
      // Entities should be pushed apart
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      expect(dist).toBeGreaterThanOrEqual(20 - 0.001); // Allow small floating point error
    });
  });
});
