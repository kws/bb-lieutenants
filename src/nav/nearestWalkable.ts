import { NavGrid } from "./NavGrid";
import type { Cell } from "./NavTypes";

export function nearestWalkable(grid: NavGrid, target: Cell, maxRadiusCells = 16): Cell | undefined {
  if (grid.isWalkable(target.cx, target.cz)) return target;

  for (let radius = 1; radius <= maxRadiusCells; radius += 1) {
    let best: Cell | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
        const cx = target.cx + dx;
        const cz = target.cz + dz;
        if (!grid.isWalkable(cx, cz)) continue;
        const distance = dx * dx + dz * dz;
        if (distance < bestDistance) {
          best = { cx, cz };
          bestDistance = distance;
        }
      }
    }

    if (best) return best;
  }

  return undefined;
}

