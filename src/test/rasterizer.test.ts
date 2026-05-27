import { describe, expect, it } from "vitest";
import { NavGrid } from "../nav/NavGrid";
import { rasterizeFootprint } from "../map/FootprintRasterizer";

describe("FootprintRasterizer", () => {
  it("blocks expected cells for a rectangle", () => {
    const grid = new NavGrid(8, 8, 2);
    rasterizeFootprint(
      grid,
      "factory",
      { x: 0, y: 0, z: 0 },
      { blocks: true, shape: "rect", width: 4, depth: 4 },
    );

    expect(grid.isWalkable(3, 3)).toBe(false);
    expect(grid.isWalkable(4, 4)).toBe(false);
    expect(grid.get(3, 3).blockedBy).toBe("factory");
  });

  it("blocks expected cells for a circle", () => {
    const grid = new NavGrid(8, 8, 2);
    rasterizeFootprint(
      grid,
      "tree",
      { x: 0, y: 0, z: 0 },
      { blocks: true, shape: "circle", radius: 1.5 },
    );

    expect(grid.isWalkable(4, 4)).toBe(false);
    expect(grid.isWalkable(0, 0)).toBe(true);
  });

  it("padding and actor radius expand blockers", () => {
    const grid = new NavGrid(8, 8, 2);
    rasterizeFootprint(
      grid,
      "rock",
      { x: 0, y: 0, z: 0 },
      { blocks: true, shape: "circle", radius: 1, padding: 1 },
      1,
    );

    expect(grid.isWalkable(3, 4)).toBe(false);
    expect(grid.isWalkable(4, 3)).toBe(false);
  });

  it("applies non-blocking terrain cost without unblocking blockers", () => {
    const grid = new NavGrid(8, 8, 2, 1.2);
    grid.setBlocked(4, 4, "crate");
    rasterizeFootprint(
      grid,
      "road",
      { x: 0, y: 0, z: 0 },
      { blocks: false, shape: "rect", width: 6, depth: 6, terrainCost: 1 },
    );

    expect(grid.get(3, 3).terrainCost).toBe(1);
    expect(grid.isWalkable(4, 4)).toBe(false);
  });
});
