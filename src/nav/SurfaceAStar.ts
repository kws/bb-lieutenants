import type { NavNode, NavPoint } from "./NavTypes";
import {
  getMovementNeighbors,
  isMovementWalkable,
  movementNodeToPoint,
  nearestMovementWalkable,
  type MovementLayer,
} from "./MovementLayer";

type NodeRecord = {
  node: NavNode;
  g: number;
  f: number;
  parent?: NodeRecord;
};

export type SurfacePathResult =
  | {
      ok: true;
      nodes: NavNode[];
      points: NavPoint[];
      cost: number;
    }
  | {
      ok: false;
      reason: "start-blocked" | "target-blocked" | "no-path";
      nearestTarget?: NavNode;
    };

export type SurfaceFindPathOptions = {
  allowNearestTarget?: boolean;
  maxSearchCells?: number;
};

export function findSurfacePath(
  layer: MovementLayer,
  start: NavNode,
  requestedTarget: NavNode,
  options: SurfaceFindPathOptions = {},
): SurfacePathResult {
  if (!isMovementWalkable(layer, start)) {
    return { ok: false, reason: "start-blocked" };
  }

  let target = requestedTarget;
  if (!isMovementWalkable(layer, target)) {
    const nearest = options.allowNearestTarget ? nearestMovementWalkable(layer, target) : undefined;
    if (!nearest) return { ok: false, reason: "target-blocked" };
    target = nearest;
  }

  const maxSearchCells = options.maxSearchCells ?? Object.values(layer.surfaces).reduce((sum, grid) => sum + grid.nodes.length, 0);
  const open: NodeRecord[] = [
    {
      node: start,
      g: 0,
      f: heuristic(start, target),
    },
  ];
  const bestByKey = new Map<string, NodeRecord>();
  bestByKey.set(nodeKey(start), open[0]);
  const closed = new Set<string>();
  let searched = 0;

  while (open.length > 0 && searched < maxSearchCells) {
    searched += 1;
    open.sort((a, b) => b.f - a.f);
    const current = open.pop();
    if (!current) break;

    const currentKey = nodeKey(current.node);
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);

    if (sameNode(current.node, target)) {
      const nodes = reconstruct(current);
      const points = nodes.flatMap((node) => {
        const point = movementNodeToPoint(layer, node);
        return point ? [point] : [];
      });
      return { ok: true, nodes, points, cost: current.g };
    }

    for (const neighbor of getMovementNeighbors(layer, current.node)) {
      const nextKey = nodeKey(neighbor.node);
      if (closed.has(nextKey)) continue;
      const g = current.g + neighbor.cost;
      const existing = bestByKey.get(nextKey);
      if (existing && existing.g <= g) continue;

      const record: NodeRecord = {
        node: neighbor.node,
        g,
        f: g + heuristic(neighbor.node, target),
        parent: current,
      };
      bestByKey.set(nextKey, record);
      open.push(record);
    }
  }

  return { ok: false, reason: "no-path", nearestTarget: target };
}

function heuristic(from: NavNode, to: NavNode): number {
  if (from.surfaceId !== to.surfaceId) return 0;
  const dx = Math.abs(to.cx - from.cx);
  const dz = Math.abs(to.cz - from.cz);
  const f = Math.SQRT2 - 1;
  return dx < dz ? f * dx + dz : f * dz + dx;
}

function reconstruct(node: NodeRecord): NavNode[] {
  const result: NavNode[] = [];
  let current: NodeRecord | undefined = node;
  while (current) {
    result.push(current.node);
    current = current.parent;
  }
  result.reverse();
  return result;
}

function sameNode(a: NavNode, b: NavNode): boolean {
  return a.surfaceId === b.surfaceId && a.cx === b.cx && a.cz === b.cz;
}

function nodeKey(node: NavNode): string {
  return `${node.surfaceId}:${node.cx}:${node.cz}`;
}
