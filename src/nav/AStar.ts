import { cellToWorldCenter, NavGrid } from "./NavGrid";
import { nearestWalkable } from "./nearestWalkable";
import type { Cell, PathResult } from "./NavTypes";

type NodeRecord = {
  cell: Cell;
  g: number;
  f: number;
  parent?: NodeRecord;
};

type FindPathOptions = {
  allowNearestTarget?: boolean;
  maxSearchCells?: number;
};

const DIRECTIONS = [
  { dx: 1, dz: 0, cost: 1 },
  { dx: -1, dz: 0, cost: 1 },
  { dx: 0, dz: 1, cost: 1 },
  { dx: 0, dz: -1, cost: 1 },
  { dx: 1, dz: 1, cost: Math.SQRT2 },
  { dx: 1, dz: -1, cost: Math.SQRT2 },
  { dx: -1, dz: 1, cost: Math.SQRT2 },
  { dx: -1, dz: -1, cost: Math.SQRT2 },
] as const;

export function findPath(
  grid: NavGrid,
  start: Cell,
  requestedTarget: Cell,
  options: FindPathOptions = {},
): PathResult {
  if (!grid.isWalkable(start.cx, start.cz)) {
    return { ok: false, reason: "start-blocked" };
  }

  let target = requestedTarget;
  if (!grid.isWalkable(target.cx, target.cz)) {
    const nearest = options.allowNearestTarget ? nearestWalkable(grid, target) : undefined;
    if (!nearest) {
      return { ok: false, reason: "target-blocked" };
    }
    target = nearest;
  }

  const maxSearchCells = options.maxSearchCells ?? grid.widthCells * grid.depthCells;
  const open: NodeRecord[] = [
    {
      cell: start,
      g: 0,
      f: octile(Math.abs(target.cx - start.cx), Math.abs(target.cz - start.cz)),
    },
  ];
  const bestByIndex = new Map<number, NodeRecord>();
  bestByIndex.set(grid.index(start.cx, start.cz), open[0]);
  const closed = new Set<number>();
  let searched = 0;

  while (open.length > 0 && searched < maxSearchCells) {
    searched += 1;
    open.sort((a, b) => b.f - a.f);
    const current = open.pop();
    if (!current) break;

    const currentIndex = grid.index(current.cell.cx, current.cell.cz);
    if (closed.has(currentIndex)) continue;
    closed.add(currentIndex);

    if (current.cell.cx === target.cx && current.cell.cz === target.cz) {
      const cells = reconstruct(current);
      const worldPoints = cells.map((cell) => cellToWorldCenter(cell.cx, cell.cz, grid));
      return {
        ok: true,
        cells,
        worldPoints,
        cost: current.g,
      };
    }

    for (const direction of DIRECTIONS) {
      const next: Cell = {
        cx: current.cell.cx + direction.dx,
        cz: current.cell.cz + direction.dz,
      };
      if (!grid.isWalkable(next.cx, next.cz)) continue;
      if (direction.dx !== 0 && direction.dz !== 0 && cutsCorner(grid, current.cell, direction.dx, direction.dz)) {
        continue;
      }

      const nextIndex = grid.index(next.cx, next.cz);
      if (closed.has(nextIndex)) continue;

      const terrainCost = grid.get(next.cx, next.cz).terrainCost;
      const g = current.g + direction.cost * terrainCost;
      const existing = bestByIndex.get(nextIndex);
      if (existing && existing.g <= g) continue;

      const h = octile(Math.abs(target.cx - next.cx), Math.abs(target.cz - next.cz));
      const record: NodeRecord = {
        cell: next,
        g,
        f: g + h,
        parent: current,
      };
      bestByIndex.set(nextIndex, record);
      open.push(record);
    }
  }

  return {
    ok: false,
    reason: "no-path",
    nearestTarget: target,
  };
}

export function octile(dx: number, dz: number): number {
  const f = Math.SQRT2 - 1;
  return dx < dz ? f * dx + dz : f * dz + dx;
}

function cutsCorner(grid: NavGrid, from: Cell, dx: number, dz: number): boolean {
  return !grid.isWalkable(from.cx + dx, from.cz) || !grid.isWalkable(from.cx, from.cz + dz);
}

function reconstruct(node: NodeRecord): Cell[] {
  const result: Cell[] = [];
  let current: NodeRecord | undefined = node;
  while (current) {
    result.push(current.cell);
    current = current.parent;
  }
  result.reverse();
  return removeCollinear(result);
}

function removeCollinear(cells: Cell[]): Cell[] {
  if (cells.length <= 2) return cells;
  const result = [cells[0]];

  for (let i = 1; i < cells.length - 1; i += 1) {
    const previous = result[result.length - 1];
    const current = cells[i];
    const next = cells[i + 1];
    const dx1 = Math.sign(current.cx - previous.cx);
    const dz1 = Math.sign(current.cz - previous.cz);
    const dx2 = Math.sign(next.cx - current.cx);
    const dz2 = Math.sign(next.cz - current.cz);
    if (dx1 !== dx2 || dz1 !== dz2) {
      result.push(current);
    }
  }

  result.push(cells[cells.length - 1]);
  return result;
}

