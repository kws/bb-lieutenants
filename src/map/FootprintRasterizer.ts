import { NavGrid, worldToCell } from "../nav/NavGrid";
import type { NavFootprint, Vector3Data } from "./MapTypes";

export function rasterizeFootprint(
  grid: NavGrid,
  id: string,
  position: Vector3Data,
  footprint: NavFootprint,
  actorRadius = 0,
  rotationY = 0,
): void {
  if (footprint.blocks) {
    if (footprint.shape === "rect") {
      rasterizeRect(
        grid,
        id,
        position.x,
        position.z,
        footprint.width,
        footprint.depth,
        (footprint.padding ?? 0) + actorRadius,
        undefined,
        rotationY,
      );
      return;
    }

    rasterizeCircle(grid, id, position.x, position.z, footprint.radius, (footprint.padding ?? 0) + actorRadius);
    return;
  }

  const cost = footprint.terrainCost;
  if (cost === undefined) return;

  if (footprint.shape === "rect" && footprint.width !== undefined && footprint.depth !== undefined) {
    rasterizeRect(grid, id, position.x, position.z, footprint.width, footprint.depth, 0, Math.max(1, cost), rotationY);
    return;
  }

  if (footprint.shape === "circle" && footprint.radius !== undefined) {
    rasterizeCircle(grid, id, position.x, position.z, footprint.radius, 0, Math.max(1, cost));
  }
}

function rasterizeRect(
  grid: NavGrid,
  id: string,
  x: number,
  z: number,
  width: number,
  depth: number,
  padding: number,
  terrainCost?: number,
  rotationY = 0,
): void {
  const halfW = width * 0.5 + padding;
  const halfD = depth * 0.5 + padding;
  const searchRadius = Math.sqrt(halfW * halfW + halfD * halfD);
  const min = worldToCell(x - searchRadius, z - searchRadius, grid);
  const max = worldToCell(x + searchRadius, z + searchRadius, grid);
  const cos = Math.cos(-rotationY);
  const sin = Math.sin(-rotationY);

  for (let cz = min.cz; cz <= max.cz; cz += 1) {
    for (let cx = min.cx; cx <= max.cx; cx += 1) {
      if (!grid.isInside(cx, cz)) continue;
      const centerX = cx * grid.cellSize - grid.widthCells * grid.cellSize * 0.5 + grid.cellSize * 0.5;
      const centerZ = cz * grid.cellSize - grid.depthCells * grid.cellSize * 0.5 + grid.cellSize * 0.5;
      const dx = centerX - x;
      const dz = centerZ - z;
      const localX = dx * cos - dz * sin;
      const localZ = dx * sin + dz * cos;
      if (Math.abs(localX) > halfW || Math.abs(localZ) > halfD) continue;

      if (terrainCost !== undefined) {
        grid.setTerrainCost(cx, cz, terrainCost);
      } else {
        grid.setBlocked(cx, cz, id);
      }
    }
  }
}

function rasterizeCircle(
  grid: NavGrid,
  id: string,
  x: number,
  z: number,
  radius: number,
  padding: number,
  terrainCost?: number,
): void {
  const effectiveRadius = radius + padding;
  const min = worldToCell(x - effectiveRadius, z - effectiveRadius, grid);
  const max = worldToCell(x + effectiveRadius, z + effectiveRadius, grid);
  const r2 = effectiveRadius * effectiveRadius;

  for (let cz = min.cz; cz <= max.cz; cz += 1) {
    for (let cx = min.cx; cx <= max.cx; cx += 1) {
      if (!grid.isInside(cx, cz)) continue;
      const centerX = cx * grid.cellSize - grid.widthCells * grid.cellSize * 0.5 + grid.cellSize * 0.5;
      const centerZ = cz * grid.cellSize - grid.depthCells * grid.cellSize * 0.5 + grid.cellSize * 0.5;
      const dx = centerX - x;
      const dz = centerZ - z;
      if (dx * dx + dz * dz > r2) continue;

      if (terrainCost !== undefined) {
        grid.setTerrainCost(cx, cz, terrainCost);
      } else {
        grid.setBlocked(cx, cz, id);
      }
    }
  }
}
