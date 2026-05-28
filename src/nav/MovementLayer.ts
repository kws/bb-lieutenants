import type { MovementProfile, NavFootprint, SurfaceMaterialId, Vector3Data } from "../map/MapTypes";
import type { NavNode, NavPoint } from "./NavTypes";
import { cellLayerAt, type RuntimeSurface, type SurfaceSample, type TerrainWorld } from "../terrain/TerrainWorld";

export type MovementNode = {
  walkable: boolean;
  sampleY: number;
  material: SurfaceMaterialId;
  waterDepth: number;
  overlays: string[];
  blockedBy?: string;
  rejection?: string;
};

export type SurfaceMovementGrid = {
  surfaceId: string;
  widthCells: number;
  depthCells: number;
  cellSize: number;
  nodes: MovementNode[];
};

export type PortalMovementEdge = {
  id: string;
  from: NavNode;
  to: NavNode;
  cost: number;
};

export type MovementLayer = {
  profile: MovementProfile;
  terrainRevision: number;
  terrain: TerrainWorld;
  surfaces: Record<string, SurfaceMovementGrid>;
  portals: PortalMovementEdge[];
};

export type EdgeEval =
  | { allowed: true; cost: number }
  | { allowed: false; reason: string };

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

export function createMovementLayer(terrain: TerrainWorld, profile: MovementProfile): MovementLayer {
  const surfaces: Record<string, SurfaceMovementGrid> = {};

  for (const surfaceId of terrain.getSurfaceIds()) {
    const surface = terrain.getSurface(surfaceId);
    if (!surface || !profileSupportsSurface(profile, surface)) continue;
    surfaces[surfaceId] = createSurfaceGrid(terrain, profile, surface);
  }

  const layer: MovementLayer = {
    profile,
    terrainRevision: terrain.revision,
    terrain,
    surfaces,
    portals: [],
  };

  addPortalEdges(layer);
  return layer;
}

export function getMovementGrid(layer: MovementLayer, surfaceId: string): SurfaceMovementGrid | undefined {
  return layer.surfaces[surfaceId];
}

export function movementIndex(grid: SurfaceMovementGrid, cx: number, cz: number): number {
  return cz * grid.widthCells + cx;
}

export function isMovementInside(grid: SurfaceMovementGrid, cx: number, cz: number): boolean {
  return cx >= 0 && cz >= 0 && cx < grid.widthCells && cz < grid.depthCells;
}

export function getMovementNode(layer: MovementLayer, node: NavNode): MovementNode | undefined {
  const grid = getMovementGrid(layer, node.surfaceId);
  if (!grid || !isMovementInside(grid, node.cx, node.cz)) return undefined;
  return grid.nodes[movementIndex(grid, node.cx, node.cz)];
}

export function isMovementWalkable(layer: MovementLayer, node: NavNode): boolean {
  return getMovementNode(layer, node)?.walkable ?? false;
}

export function movementNodeToPoint(layer: MovementLayer, node: NavNode): NavPoint | undefined {
  const grid = getMovementGrid(layer, node.surfaceId);
  const movementNode = getMovementNode(layer, node);
  const center = layer.terrain.surfaceCellToWorld(node.surfaceId, node.cx, node.cz);
  if (!grid || !movementNode || !center) return undefined;
  return {
    surfaceId: node.surfaceId,
    x: center.x,
    y: movementNode.sampleY,
    z: center.z,
  };
}

export function nearestMovementWalkable(
  layer: MovementLayer,
  target: NavNode,
  maxRadiusCells = 16,
): NavNode | undefined {
  if (isMovementWalkable(layer, target)) return target;
  const grid = getMovementGrid(layer, target.surfaceId);
  if (!grid) return undefined;

  for (let radius = 1; radius <= maxRadiusCells; radius += 1) {
    let best: NavNode | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
        const candidate = { surfaceId: target.surfaceId, cx: target.cx + dx, cz: target.cz + dz };
        if (!isMovementWalkable(layer, candidate)) continue;
        const distance = dx * dx + dz * dz;
        if (distance < bestDistance) {
          best = candidate;
          bestDistance = distance;
        }
      }
    }

    if (best) return best;
  }

  return undefined;
}

export function getMovementNeighbors(layer: MovementLayer, node: NavNode): Array<{ node: NavNode; cost: number }> {
  const grid = getMovementGrid(layer, node.surfaceId);
  if (!grid) return [];

  const neighbors: Array<{ node: NavNode; cost: number }> = [];
  for (const direction of DIRECTIONS) {
    const next = {
      surfaceId: node.surfaceId,
      cx: node.cx + direction.dx,
      cz: node.cz + direction.dz,
    };
    if (!isMovementInside(grid, next.cx, next.cz)) continue;
    if (direction.dx !== 0 && direction.dz !== 0 && cutsCorner(layer, node, direction.dx, direction.dz)) continue;
    const edge = evaluateEdge(layer, node, next);
    if (edge.allowed) neighbors.push({ node: next, cost: edge.cost });
  }

  for (const portal of layer.portals) {
    if (sameNode(portal.from, node) && isMovementWalkable(layer, portal.to)) {
      neighbors.push({ node: portal.to, cost: portal.cost });
    }
  }

  return neighbors;
}

export function evaluateEdge(layer: MovementLayer, from: NavNode, to: NavNode): EdgeEval {
  if (from.surfaceId !== to.surfaceId) {
    const portal = layer.portals.find((edge) => sameNode(edge.from, from) && sameNode(edge.to, to));
    return portal ? { allowed: true, cost: portal.cost } : { allowed: false, reason: "missing-portal" };
  }

  const fromNode = getMovementNode(layer, from);
  const toNode = getMovementNode(layer, to);
  if (!fromNode?.walkable) return { allowed: false, reason: fromNode?.rejection ?? "from-blocked" };
  if (!toNode?.walkable) return { allowed: false, reason: toNode?.rejection ?? "to-blocked" };

  const grid = getMovementGrid(layer, from.surfaceId);
  if (!grid) return { allowed: false, reason: "missing-surface" };

  const dx = to.cx - from.cx;
  const dz = to.cz - from.cz;
  const horizontal = Math.hypot(dx, dz) * grid.cellSize;
  const dy = toNode.sampleY - fromNode.sampleY;
  const slope = horizontal > 0 ? dy / horizontal : 0;
  const slopeDeg = Math.abs(Math.atan(slope) * (180 / Math.PI));
  const roadLike = toNode.overlays.some((overlayId) => overlayId.includes("road") || overlayId.includes("bridge"));
  const maxSlope = roadLike
    ? layer.profile.slope.maxRoadSlopeDeg ?? layer.profile.slope.maxNormalSlopeDeg
    : layer.profile.slope.maxNormalSlopeDeg;

  if (Math.abs(dy) > layer.profile.steps.maxCliffDelta) return { allowed: false, reason: "cliff" };
  if (dy > layer.profile.steps.maxStepUp) return { allowed: false, reason: "step-up" };
  if (-dy > layer.profile.steps.maxDropDown) return { allowed: false, reason: "drop" };
  if (slopeDeg > maxSlope) return { allowed: false, reason: "slope" };

  const materialCost = layer.profile.surfaceCosts[toNode.material] ?? layer.profile.surfaceCosts.default ?? 1;
  const uphillPenalty = layer.profile.slope.uphillPenalty * Math.max(0, slope);
  const downhillPenalty = layer.profile.slope.downhillPenalty * Math.max(0, -slope);
  const overlayMultiplier = getOverlayMultiplier(layer, toNode.overlays);
  const cost = horizontal * Math.max(1, materialCost) * (1 + uphillPenalty + downhillPenalty) * overlayMultiplier;
  return { allowed: true, cost: Math.max(horizontal, cost) };
}

export function applyFootprintToMovementLayer(
  layer: MovementLayer,
  surfaceId: string,
  id: string,
  position: Vector3Data,
  footprint: NavFootprint,
  actorRadius = 0,
  rotationY = 0,
): void {
  const grid = getMovementGrid(layer, surfaceId);
  if (!grid) return;

  if (footprint.blocks) {
    if (footprint.shape === "rect") {
      rasterizeRect(layer, grid, id, position.x, position.z, footprint.width, footprint.depth, (footprint.padding ?? 0) + actorRadius, rotationY);
      return;
    }
    rasterizeCircle(layer, grid, id, position.x, position.z, footprint.radius, (footprint.padding ?? 0) + actorRadius);
    return;
  }

  const material = footprint.terrainCost !== undefined && footprint.terrainCost <= 1.05 ? "road" : undefined;
  if (!material) return;
  if (footprint.shape === "rect" && footprint.width !== undefined && footprint.depth !== undefined) {
    rasterizeRect(layer, grid, id, position.x, position.z, footprint.width, footprint.depth, 0, rotationY, material);
  }
  if (footprint.shape === "circle" && footprint.radius !== undefined) {
    rasterizeCircle(layer, grid, id, position.x, position.z, footprint.radius, 0, material);
  }
}

function createSurfaceGrid(terrain: TerrainWorld, profile: MovementProfile, surface: RuntimeSurface): SurfaceMovementGrid {
  const nodes: MovementNode[] = [];
  for (let cz = 0; cz < surface.cellsZ; cz += 1) {
    for (let cx = 0; cx < surface.cellsX; cx += 1) {
      const center = terrain.surfaceCellToWorld(surface.id, cx, cz);
      const sample = center ? terrain.sampleSurface(surface.id, center.x, center.z) : undefined;
      nodes.push(sample ? createMovementNode(terrain, profile, surface, sample) : blockedNode("outside-surface"));
    }
  }

  return {
    surfaceId: surface.id,
    widthCells: surface.cellsX,
    depthCells: surface.cellsZ,
    cellSize: surface.cellSize,
    nodes,
  };
}

function createMovementNode(
  terrain: TerrainWorld,
  profile: MovementProfile,
  surface: RuntimeSurface,
  sample: SurfaceSample,
): MovementNode {
  const rejection = getSampleRejection(terrain, profile, surface, sample);
  return {
    walkable: rejection === undefined,
    sampleY: sample.position.y,
    material: sample.material,
    waterDepth: sample.waterDepth,
    overlays: sample.overlays,
    rejection,
  };
}

function getSampleRejection(
  terrain: TerrainWorld,
  profile: MovementProfile,
  surface: RuntimeSurface,
  sample: SurfaceSample,
): string | undefined {
  if (surface.kind === "waterSurface") {
    const water = terrain.waterBodies.find((candidate) => candidate.id === surface.waterBodyId);
    if (water?.navigation?.surfaceAllowed === false) return "surface-navigation-disabled";
    if (!profile.mediums.waterSurface) return "unsupported-medium";
    if (sample.waterDepth < (profile.water?.minBoatDepth ?? 0)) return "shallow-water";
    const overheadClearance = profile.clearance
      ? terrain.getOverheadClearance(surface.id, sample.position.x, sample.position.z)
      : undefined;
    if (overheadClearance !== undefined && profile.clearance && overheadClearance < profile.clearance.minCeiling) {
      return "low-clearance";
    }
    return undefined;
  }

  if (!profile.mediums.land) return "unsupported-medium";
  if (surface.kind === "tunnel" && profile.clearance && surface.approximateClearance !== undefined) {
    if (surface.approximateClearance < profile.clearance.minCeiling) return "low-clearance";
  }
  if (sample.waterDepth > (profile.water?.maxWadeDepth ?? 0)) return "deep-water";
  return undefined;
}

function profileSupportsSurface(profile: MovementProfile, surface: RuntimeSurface): boolean {
  if (surface.kind === "waterSurface") return profile.mediums.waterSurface === true;
  return profile.mediums.land === true;
}

function addPortalEdges(layer: MovementLayer): void {
  for (const portal of layer.terrain.portals) {
    if (portal.constraints?.allowedProfiles && !portal.constraints.allowedProfiles.includes(layer.profile.id)) continue;
    if (portal.constraints?.maxVehicleHeight !== undefined && layer.profile.height > portal.constraints.maxVehicleHeight) continue;
    if (portal.constraints?.maxVehicleWidth !== undefined && layer.profile.radius * 2 > portal.constraints.maxVehicleWidth) continue;

    const from = layer.terrain.worldToSurfaceCell(portal.from.surfaceId, portal.from.x, portal.from.z);
    const to = layer.terrain.worldToSurfaceCell(portal.to.surfaceId, portal.to.x, portal.to.z);
    if (!from || !to) continue;
    const fromNode = { surfaceId: portal.from.surfaceId, ...from };
    const toNode = { surfaceId: portal.to.surfaceId, ...to };
    if (!isMovementWalkable(layer, fromNode) || !isMovementWalkable(layer, toNode)) continue;

    const cost = Math.max(1, portal.cost ?? 1);
    layer.portals.push({ id: `${portal.id}.forward`, from: fromNode, to: toNode, cost });
    layer.portals.push({ id: `${portal.id}.back`, from: toNode, to: fromNode, cost });
  }
}

function cutsCorner(layer: MovementLayer, from: NavNode, dx: number, dz: number): boolean {
  return (
    !isMovementWalkable(layer, { surfaceId: from.surfaceId, cx: from.cx + dx, cz: from.cz }) ||
    !isMovementWalkable(layer, { surfaceId: from.surfaceId, cx: from.cx, cz: from.cz + dz })
  );
}

function getOverlayMultiplier(layer: MovementLayer, overlayIds: string[]): number {
  let multiplier = 1;
  for (const overlayId of overlayIds) {
    const overlay = layer.terrain.overlays.find((candidate) => candidate.id === overlayId);
    const mapMultiplier = overlay?.movement.costMultiplier ?? 1;
    const profileMultiplier =
      layer.profile.overlayPreferences?.[overlayId] ?? layer.profile.overlayPreferences?.default ?? 1;
    multiplier *= Math.max(1, mapMultiplier * profileMultiplier);
  }
  return Math.max(1, multiplier);
}

function rasterizeRect(
  layer: MovementLayer,
  grid: SurfaceMovementGrid,
  id: string,
  x: number,
  z: number,
  width: number,
  depth: number,
  padding: number,
  rotationY: number,
  material?: SurfaceMaterialId,
): void {
  const halfW = width * 0.5 + padding;
  const halfD = depth * 0.5 + padding;
  const searchRadius = Math.sqrt(halfW * halfW + halfD * halfD);
  const min = layer.terrain.worldToSurfaceCell(grid.surfaceId, x - searchRadius, z - searchRadius) ?? { cx: 0, cz: 0 };
  const max = layer.terrain.worldToSurfaceCell(grid.surfaceId, x + searchRadius, z + searchRadius) ?? {
    cx: grid.widthCells - 1,
    cz: grid.depthCells - 1,
  };
  const cos = Math.cos(-rotationY);
  const sin = Math.sin(-rotationY);

  for (let cz = min.cz; cz <= max.cz; cz += 1) {
    for (let cx = min.cx; cx <= max.cx; cx += 1) {
      const center = layer.terrain.surfaceCellToWorld(grid.surfaceId, cx, cz);
      if (!center) continue;
      const dx = center.x - x;
      const dz = center.z - z;
      const localX = dx * cos - dz * sin;
      const localZ = dx * sin + dz * cos;
      if (Math.abs(localX) > halfW || Math.abs(localZ) > halfD) continue;
      applyRasterizedCell(grid, cx, cz, id, material);
    }
  }
}

function rasterizeCircle(
  layer: MovementLayer,
  grid: SurfaceMovementGrid,
  id: string,
  x: number,
  z: number,
  radius: number,
  padding: number,
  material?: SurfaceMaterialId,
): void {
  const effectiveRadius = radius + padding;
  const min = layer.terrain.worldToSurfaceCell(grid.surfaceId, x - effectiveRadius, z - effectiveRadius) ?? { cx: 0, cz: 0 };
  const max = layer.terrain.worldToSurfaceCell(grid.surfaceId, x + effectiveRadius, z + effectiveRadius) ?? {
    cx: grid.widthCells - 1,
    cz: grid.depthCells - 1,
  };
  const radiusSq = effectiveRadius * effectiveRadius;

  for (let cz = min.cz; cz <= max.cz; cz += 1) {
    for (let cx = min.cx; cx <= max.cx; cx += 1) {
      const center = layer.terrain.surfaceCellToWorld(grid.surfaceId, cx, cz);
      if (!center) continue;
      const dx = center.x - x;
      const dz = center.z - z;
      if (dx * dx + dz * dz > radiusSq) continue;
      applyRasterizedCell(grid, cx, cz, id, material);
    }
  }
}

function applyRasterizedCell(
  grid: SurfaceMovementGrid,
  cx: number,
  cz: number,
  blockedBy: string,
  material?: SurfaceMaterialId,
): void {
  if (!isMovementInside(grid, cx, cz)) return;
  const node = grid.nodes[movementIndex(grid, cx, cz)];
  if (material) {
    node.material = material;
    if (!node.overlays.includes(blockedBy)) node.overlays.push(blockedBy);
    return;
  }
  node.walkable = false;
  node.blockedBy = blockedBy;
  node.rejection = "blocked";
}

function blockedNode(rejection: string): MovementNode {
  return {
    walkable: false,
    sampleY: 0,
    material: "void",
    waterDepth: 0,
    overlays: [],
    rejection,
  };
}

function sameNode(a: NavNode, b: NavNode): boolean {
  return a.surfaceId === b.surfaceId && a.cx === b.cx && a.cz === b.cz;
}

export function surfaceCellMaterial(surface: RuntimeSurface, cx: number, cz: number): SurfaceMaterialId {
  return cellLayerAt(surface.material, surface, cx, cz);
}
