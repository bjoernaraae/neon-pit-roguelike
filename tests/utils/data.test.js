import { describe, it, expect } from 'vitest';
import { deepClone, pickWeighted } from '../../src/utils/data.js';

describe('Data Utilities', () => {
  describe('deepClone', () => {
    it('should deep clone objects', () => {
      const original = { a: 1, b: { c: 2 } };
      const cloned = deepClone(original);
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.b).not.toBe(original.b);
    });
    
    it('should clone arrays', () => {
      const original = [1, 2, { a: 3 }];
      const cloned = deepClone(original);
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned[2]).not.toBe(original[2]);
    });
  });
  
  describe('pickWeighted', () => {
    it('should pick item based on weight', () => {
      const items = [
        { w: 10, name: 'common' },
        { w: 5, name: 'uncommon' },
        { w: 1, name: 'rare' }
      ];
      
      // Run multiple times to ensure it works
      for (let i = 0; i < 10; i++) {
        const picked = pickWeighted(items);
        expect(items).toContain(picked);
        expect(picked).toHaveProperty('name');
      }
    });
    
    it('should return last item if weights are zero', () => {
      const items = [
        { w: 0, name: 'first' },
        { w: 0, name: 'last' }
      ];
      const picked = pickWeighted(items);
      expect(picked.name).toBe('last');
    });
  });
});
