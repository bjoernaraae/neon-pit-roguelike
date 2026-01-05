import { describe, it, expect } from 'vitest';
import { BSPNode, generateBSPDungeon, splitBSPNode, createRoomsInBSP, createCorridorsInBSP, collectBSPRoomsAndCorridors, convertBSPToGrid } from '../../../src/game/world/BSPDungeonGenerator.js';

describe('BSPDungeonGenerator', () => {
  describe('BSPNode', () => {
    it('should create node with correct properties', () => {
      const node = new BSPNode(0, 0, 100, 100);
      expect(node.x).toBe(0);
      expect(node.y).toBe(0);
      expect(node.width).toBe(100);
      expect(node.height).toBe(100);
      expect(node.isLeaf()).toBe(true);
    });
    
    it('should detect leaf nodes', () => {
      const node = new BSPNode(0, 0, 100, 100);
      expect(node.isLeaf()).toBe(true);
      node.left = new BSPNode(0, 0, 50, 100);
      expect(node.isLeaf()).toBe(false);
    });
  });
  
  describe('splitBSPNode', () => {
    it('should split node into children', () => {
      const node = new BSPNode(0, 0, 200, 200);
      splitBSPNode(node, 50, 75, 0, 2);
      expect(node.left).not.toBeNull();
      expect(node.right).not.toBeNull();
    });
    
    it('should not split if too small', () => {
      const node = new BSPNode(0, 0, 50, 50);
      splitBSPNode(node, 50, 75, 0, 2);
      expect(node.left).toBeNull();
      expect(node.right).toBeNull();
    });
  });
  
  describe('createRoomsInBSP', () => {
    it('should create room in leaf node', () => {
      const node = new BSPNode(0, 0, 200, 200);
      createRoomsInBSP(node, 50, 20);
      expect(node.room).not.toBeNull();
      expect(node.room).toHaveProperty('x');
      expect(node.room).toHaveProperty('y');
      expect(node.room).toHaveProperty('w');
      expect(node.room).toHaveProperty('h');
    });
  });
  
  describe('generateBSPDungeon', () => {
    it('should generate dungeon with rooms and corridors', () => {
      const result = generateBSPDungeon(1000, 1000, 100, 3);
      expect(result).toHaveProperty('rooms');
      expect(result).toHaveProperty('corridors');
      expect(result).toHaveProperty('grid');
      expect(result.rooms.length).toBeGreaterThan(0);
    });
  });
  
  describe('convertBSPToGrid', () => {
    it('should convert rooms and corridors to grid', () => {
      const rooms = [{ x: 0, y: 0, w: 100, h: 100 }];
      const corridors = [{ x: 100, y: 50, w: 50, h: 20 }];
      const result = convertBSPToGrid(rooms, corridors, 200, 200, 10);
      expect(result).toHaveProperty('grid');
      expect(result).toHaveProperty('wallInfluence');
      expect(Array.isArray(result.grid)).toBe(true);
    });
  });
});
