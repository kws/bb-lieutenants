export type Cell = {
  cx: number;
  cz: number;
};

export type WorldPoint = {
  x: number;
  z: number;
};

export type PathResult =
  | {
      ok: true;
      cells: Cell[];
      worldPoints: WorldPoint[];
      cost: number;
    }
  | {
      ok: false;
      reason: "start-blocked" | "target-blocked" | "no-path";
      nearestTarget?: Cell;
    };

