import type { Cell, WorldPoint } from "./NavTypes";

export type NavCell = {
  walkable: boolean;
  terrainCost: number;
  blockedBy?: string;
};

export class NavGrid {
  readonly widthCells: number;
  readonly depthCells: number;
  readonly cellSize: number;
  readonly cells: NavCell[];

  constructor(widthCells: number, depthCells: number, cellSize: number, defaultCost = 1) {
    if (widthCells <= 0 || depthCells <= 0 || cellSize <= 0) {
      throw new Error("NavGrid dimensions and cellSize must be positive.");
    }

    this.widthCells = widthCells;
    this.depthCells = depthCells;
    this.cellSize = cellSize;
    this.cells = Array.from({ length: widthCells * depthCells }, () => ({
      walkable: true,
      terrainCost: defaultCost,
    }));
  }

  isInside(cx: number, cz: number): boolean {
    return cx >= 0 && cz >= 0 && cx < this.widthCells && cz < this.depthCells;
  }

  isWalkable(cx: number, cz: number): boolean {
    return this.isInside(cx, cz) && this.get(cx, cz).walkable;
  }

  setBlocked(cx: number, cz: number, blockedBy: string): void {
    if (!this.isInside(cx, cz)) return;
    const cell = this.get(cx, cz);
    cell.walkable = false;
    cell.blockedBy = blockedBy;
  }

  setWalkable(cx: number, cz: number, terrainCost = 1): void {
    if (!this.isInside(cx, cz)) return;
    const cell = this.get(cx, cz);
    cell.walkable = true;
    cell.terrainCost = terrainCost;
    delete cell.blockedBy;
  }

  setTerrainCost(cx: number, cz: number, cost: number): void {
    if (!this.isInside(cx, cz)) return;
    this.get(cx, cz).terrainCost = Math.max(1, cost);
  }

  get(cx: number, cz: number): NavCell {
    if (!this.isInside(cx, cz)) {
      throw new Error(`Nav cell out of bounds: ${cx},${cz}`);
    }

    return this.cells[this.index(cx, cz)];
  }

  index(cx: number, cz: number): number {
    return cz * this.widthCells + cx;
  }
}

export function worldToCell(x: number, z: number, grid: NavGrid): Cell {
  const halfW = grid.widthCells * grid.cellSize * 0.5;
  const halfD = grid.depthCells * grid.cellSize * 0.5;

  return {
    cx: Math.floor((x + halfW) / grid.cellSize),
    cz: Math.floor((z + halfD) / grid.cellSize),
  };
}

export function cellToWorldCenter(cx: number, cz: number, grid: NavGrid): WorldPoint {
  const halfW = grid.widthCells * grid.cellSize * 0.5;
  const halfD = grid.depthCells * grid.cellSize * 0.5;

  return {
    x: cx * grid.cellSize - halfW + grid.cellSize * 0.5,
    z: cz * grid.cellSize - halfD + grid.cellSize * 0.5,
  };
}

