import { describe, expect, it } from "vitest";
import { findPath } from "../nav/AStar";
import { NavGrid } from "../nav/NavGrid";

describe("AStar", () => {
  it("finds a straight path in an empty grid", () => {
    const grid = new NavGrid(8, 8, 2);
    const result = findPath(grid, { cx: 1, cz: 1 }, { cx: 5, cz: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cells[0]).toEqual({ cx: 1, cz: 1 });
      expect(result.cells[result.cells.length - 1]).toEqual({ cx: 5, cz: 1 });
    }
  });

  it("avoids blocked cells", () => {
    const grid = new NavGrid(8, 8, 2);
    grid.setBlocked(3, 1, "wall");
    const result = findPath(grid, { cx: 1, cz: 1 }, { cx: 5, cz: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cells).not.toContainEqual({ cx: 3, cz: 1 });
    }
  });

  it("rejects blocked targets unless nearest target is allowed", () => {
    const grid = new NavGrid(8, 8, 2);
    grid.setBlocked(5, 5, "rock");
    expect(findPath(grid, { cx: 1, cz: 1 }, { cx: 5, cz: 5 }).ok).toBe(false);
    const nearest = findPath(grid, { cx: 1, cz: 1 }, { cx: 5, cz: 5 }, { allowNearestTarget: true });
    expect(nearest.ok).toBe(true);
  });

  it("prevents diagonal corner cutting", () => {
    const grid = new NavGrid(3, 3, 2);
    grid.setBlocked(1, 0, "wall-a");
    grid.setBlocked(0, 1, "wall-b");
    const result = findPath(grid, { cx: 0, cz: 0 }, { cx: 2, cz: 2 });
    expect(result.ok).toBe(false);
  });

  it("returns no-path for separated regions", () => {
    const grid = new NavGrid(5, 5, 2);
    for (let cz = 0; cz < 5; cz += 1) {
      grid.setBlocked(2, cz, "wall");
    }
    const result = findPath(grid, { cx: 0, cz: 2 }, { cx: 4, cz: 2 });
    expect(result).toMatchObject({ ok: false, reason: "no-path" });
  });
});

