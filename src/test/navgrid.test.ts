import { describe, expect, it } from "vitest";
import { cellToWorldCenter, NavGrid, worldToCell } from "../nav/NavGrid";

describe("NavGrid", () => {
  it("creates dimensions and default cells", () => {
    const grid = new NavGrid(4, 3, 2, 1.2);
    expect(grid.widthCells).toBe(4);
    expect(grid.depthCells).toBe(3);
    expect(grid.cells).toHaveLength(12);
    expect(grid.get(0, 0).walkable).toBe(true);
    expect(grid.get(0, 0).terrainCost).toBe(1.2);
  });

  it("converts world coordinates to cells and back to centers", () => {
    const grid = new NavGrid(4, 4, 2);
    expect(worldToCell(-4, -4, grid)).toEqual({ cx: 0, cz: 0 });
    expect(worldToCell(3.99, 3.99, grid)).toEqual({ cx: 3, cz: 3 });
    expect(worldToCell(4, 4, grid)).toEqual({ cx: 4, cz: 4 });
    expect(cellToWorldCenter(0, 0, grid)).toEqual({ x: -3, z: -3 });
    expect(cellToWorldCenter(3, 3, grid)).toEqual({ x: 3, z: 3 });
  });

  it("rejects out-of-bounds cells", () => {
    const grid = new NavGrid(2, 2, 2);
    expect(grid.isInside(-1, 0)).toBe(false);
    expect(grid.isInside(2, 0)).toBe(false);
    expect(() => grid.get(2, 0)).toThrow(/out of bounds/);
  });

  it("blocks, unblocks, and updates terrain cost", () => {
    const grid = new NavGrid(3, 3, 2);
    grid.setBlocked(1, 1, "building");
    expect(grid.isWalkable(1, 1)).toBe(false);
    expect(grid.get(1, 1).blockedBy).toBe("building");
    grid.setWalkable(1, 1, 1.5);
    expect(grid.isWalkable(1, 1)).toBe(true);
    expect(grid.get(1, 1).terrainCost).toBe(1.5);
    expect(grid.get(1, 1).blockedBy).toBeUndefined();
  });
});

