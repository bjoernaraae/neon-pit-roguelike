import { describe, it, expect } from 'vitest';
import { clamp, lerp, rand, dist2, format } from '../../src/utils/math.js';

describe('Math Utilities', () => {
  describe('clamp', () => {
    it('should clamp value to range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
    });
  });
  
  describe('lerp', () => {
    it('should interpolate between values', () => {
      expect(lerp(0, 10, 0.5)).toBe(5);
      expect(lerp(0, 10, 0)).toBe(0);
      expect(lerp(0, 10, 1)).toBe(10);
      expect(lerp(10, 20, 0.5)).toBe(15);
      expect(lerp(-10, 10, 0.5)).toBe(0);
    });
  });
  
  describe('rand', () => {
    it('should generate random number in range', () => {
      for (let i = 0; i < 10; i++) {
        const r = rand(0, 10);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThan(10);
      }
    });
  });
  
  describe('dist2', () => {
    it('should calculate squared distance', () => {
      expect(dist2(0, 0, 3, 4)).toBe(25); // 3^2 + 4^2 = 25
      expect(dist2(0, 0, 0, 0)).toBe(0);
      expect(dist2(1, 1, 4, 5)).toBe(25); // 3^2 + 4^2 = 25
    });
  });
  
  describe('format', () => {
    it('should format numbers with locale string', () => {
      expect(format(1000)).toBe('1,000');
      expect(format(1234567)).toBe('1,234,567');
      expect(format(0)).toBe('0');
      expect(format(999)).toBe('999');
    });
  });
});
