import { describe, it, expect } from 'vitest';
import { hexToRgb, lerpColor, adjustBrightness } from '../../src/utils/color.js';

describe('Color Utilities', () => {
  describe('hexToRgb', () => {
    it('should convert hex to RGB', () => {
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('000000')).toEqual({ r: 0, g: 0, b: 0 }); // Without #
    });
    
    it('should return null for invalid hex', () => {
      expect(hexToRgb('invalid')).toBeNull();
      expect(hexToRgb('#gggggg')).toBeNull();
    });
  });
  
  describe('lerpColor', () => {
    it('should interpolate between colors', () => {
      const result = lerpColor('#000000', '#ffffff', 0.5);
      expect(result).toContain('rgb');
      expect(result).toContain('127'); // Approximate middle value
    });
    
    it('should return first color if invalid', () => {
      expect(lerpColor('invalid', '#ffffff', 0.5)).toBe('invalid');
    });
  });
  
  describe('adjustBrightness', () => {
    it('should adjust brightness of hex color', () => {
      const result = adjustBrightness('#808080', 0.2);
      expect(result).toContain('rgb');
    });
    
    it('should handle brightness adjustment', () => {
      const darker = adjustBrightness('#ffffff', -0.5);
      expect(darker).toContain('rgb');
      const lighter = adjustBrightness('#000000', 0.5);
      expect(lighter).toContain('rgb');
    });
  });
});
