import type {
  CellLayer,
  HeightRecipe,
  HeightRecipeFeature,
  MapDefinition,
  SurfacePortal,
  SurfaceMaterialId,
  TerrainSurfaceDefinition,
  TerrainVolume,
  TransportOverlay,
  Vector2Data,
  WaterBody,
} from "../map/MapTypes";

export type SurfaceKind = "heightfield" | "deck" | "tunnel" | "cave" | "waterSurface";

export type RuntimeSurface = {
  id: string;
  kind: SurfaceKind;
  cellSize: number;
  cellsX: number;
  cellsZ: number;
  origin: Vector2Data;
  material: CellLayer<SurfaceMaterialId>;
  roughness: CellLayer<number>;
  y?: number;
  cornerHeights?: number[];
  waterBodyId?: string;
  bottomSurfaceId?: string;
  approximateClearance?: number;
};

export type SurfaceSample = {
  surfaceId: string;
  position: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
  material: SurfaceMaterialId;
  roughness: number;
  waterDepth: number;
  overlays: string[];
};

export type TerrainVolumeSample = {
  id: string;
  kind: "water" | "air";
  depth?: number;
  clearance?: number;
};

export type SurfaceFilter = {
  includeWaterSurface?: boolean;
  includeLand?: boolean;
};

export const DEFAULT_SURFACE_ID = "ground.overworld";

export function waterSurfaceId(waterBodyId: string): string {
  return `water.${waterBodyId}.surface`;
}

export class TerrainWorld {
  readonly revision: number;
  readonly defaultSurfaceId: string;
  readonly overlays: TransportOverlay[];
  readonly portals: SurfacePortal[];
  readonly waterBodies: WaterBody[];
  readonly volumes: TerrainVolume[];
  readonly surfaces = new Map<string, RuntimeSurface>();

  constructor(
    map: MapDefinition,
    private readonly defaultMaterialCost = 1,
  ) {
    this.revision = map.version === 2 ? map.terrain.revision : 1;
    this.defaultSurfaceId = map.version === 2 ? map.terrain.defaultSurfaceId : DEFAULT_SURFACE_ID;
    this.overlays = map.version === 2 ? map.terrain.overlays : [];
    this.portals = map.version === 2 ? map.terrain.portals : [];
    this.waterBodies = map.version === 2 ? map.terrain.waterBodies : [];
    this.volumes = map.version === 2 ? map.terrain.volumes : [];

    const surfaceDefinitions =
      map.version === 2 ? map.terrain.surfaces : [createFlatSurfaceDefinition(map.size, map.terrain.base)];
    for (const definition of surfaceDefinitions) {
      const surface = createRuntimeSurface(definition);
      this.surfaces.set(surface.id, surface);
    }

    for (const water of this.waterBodies) {
      const bottom = this.surfaces.get(water.bottomSurfaceId);
      if (!bottom) continue;
      this.surfaces.set(waterSurfaceId(water.id), {
        id: waterSurfaceId(water.id),
        kind: "waterSurface",
        cellSize: bottom.cellSize,
        cellsX: bottom.cellsX,
        cellsZ: bottom.cellsZ,
        origin: bottom.origin,
        material: "water",
        roughness: 0,
        y: water.surface.y,
        waterBodyId: water.id,
        bottomSurfaceId: water.bottomSurfaceId,
      });
    }
  }

  get materialCostFloor(): number {
    return Math.max(1, this.defaultMaterialCost);
  }

  getSurface(surfaceId: string): RuntimeSurface | undefined {
    return this.surfaces.get(surfaceId);
  }

  getSurfaceIds(): string[] {
    return [...this.surfaces.keys()];
  }

  sampleSurface(surfaceId: string, x: number, z: number): SurfaceSample | undefined {
    const surface = this.surfaces.get(surfaceId);
    if (!surface) return undefined;
    if (surface.kind === "waterSurface") return this.sampleWaterSurface(surface, x, z);

    const y = this.heightAt(surface, x, z);
    if (y === undefined) return undefined;
    const cell = surfaceCellAtOrClamp(surface, x, z);
    if (!cell) return undefined;

    const waterDepth = this.getWaterDepth(surface.id, x, z);
    return {
      surfaceId,
      position: { x, y, z },
      normal: surface.kind === "heightfield" ? this.normalAt(surface, x, z) : { x: 0, y: 1, z: 0 },
      material: cellLayerAt(surface.material, surface, cell.cx, cell.cz),
      roughness: cellLayerAt(surface.roughness, surface, cell.cx, cell.cz),
      waterDepth,
      overlays: this.getOverlaysAt(surfaceId, x, z).map((overlay) => overlay.id),
    };
  }

  sampleBestSurface(x: number, z: number, filter: SurfaceFilter = {}): SurfaceSample | undefined {
    const includeLand = filter.includeLand ?? true;
    const includeWaterSurface = filter.includeWaterSurface ?? true;
    let best: SurfaceSample | undefined;

    for (const surface of this.surfaces.values()) {
      if (surface.kind === "waterSurface" && !includeWaterSurface) continue;
      if (surface.kind !== "waterSurface" && !includeLand) continue;
      const sample = this.sampleSurface(surface.id, x, z);
      if (!sample) continue;
      if (!best || sample.position.y > best.position.y) best = sample;
    }

    return best;
  }

  sampleVolumes(x: number, y: number, z: number): TerrainVolumeSample[] {
    const samples: TerrainVolumeSample[] = [];
    for (const water of this.waterBodies) {
      if (!pointInPolygon({ x, z }, water.polygon)) continue;
      const bottom = this.sampleSurface(water.bottomSurfaceId, x, z);
      if (!bottom) continue;
      const depth = water.surface.y - bottom.position.y;
      if (depth > 0 && y >= bottom.position.y && y <= water.surface.y) {
        samples.push({ id: water.id, kind: "water", depth });
      }
    }

    for (const volume of this.volumes) {
      if (volume.kind !== "air") continue;
      if (volume.polygon && !pointInPolygon({ x, z }, volume.polygon)) continue;
      samples.push({ id: volume.id, kind: "air", clearance: volume.approximateClearance });
    }

    return samples;
  }

  getWaterDepth(bottomSurfaceId: string, x: number, z: number): number {
    let deepest = 0;
    for (const water of this.waterBodies) {
      if (water.bottomSurfaceId !== bottomSurfaceId) continue;
      if (!pointInPolygon({ x, z }, water.polygon)) continue;
      const bottom = this.surfaces.get(bottomSurfaceId);
      const bottomY = bottom ? this.heightAt(bottom, x, z) : undefined;
      if (bottomY === undefined) continue;
      deepest = Math.max(deepest, water.surface.y - bottomY);
    }
    return Math.max(0, deepest);
  }

  getOverlaysAt(surfaceId: string, x: number, z: number): TransportOverlay[] {
    return this.overlays.filter((overlay) => overlay.surfaceId === surfaceId && corridorContains(overlay.corridor, x, z));
  }

  getOverheadClearance(surfaceId: string, x: number, z: number): number | undefined {
    const base = this.sampleSurface(surfaceId, x, z);
    if (!base) return undefined;

    let clearance: number | undefined;
    for (const surface of this.surfaces.values()) {
      if (surface.id === surfaceId || surface.kind === "waterSurface") continue;
      const overhead = this.sampleSurface(surface.id, x, z);
      if (!overhead || overhead.position.y <= base.position.y + 0.05) continue;
      const candidate = overhead.position.y - base.position.y;
      clearance = clearance === undefined ? candidate : Math.min(clearance, candidate);
    }
    return clearance;
  }

  worldToSurfaceCell(surfaceId: string, x: number, z: number): { cx: number; cz: number } | undefined {
    const surface = this.surfaces.get(surfaceId);
    if (!surface) return undefined;
    const cx = Math.floor((x - surface.origin.x) / surface.cellSize);
    const cz = Math.floor((z - surface.origin.z) / surface.cellSize);
    if (cx < 0 || cz < 0 || cx >= surface.cellsX || cz >= surface.cellsZ) return undefined;
    return { cx, cz };
  }

  surfaceCellToWorld(surfaceId: string, cx: number, cz: number): { x: number; z: number } | undefined {
    const surface = this.surfaces.get(surfaceId);
    if (!surface) return undefined;
    if (cx < 0 || cz < 0 || cx >= surface.cellsX || cz >= surface.cellsZ) return undefined;
    return {
      x: surface.origin.x + cx * surface.cellSize + surface.cellSize * 0.5,
      z: surface.origin.z + cz * surface.cellSize + surface.cellSize * 0.5,
    };
  }

  private sampleWaterSurface(surface: RuntimeSurface, x: number, z: number): SurfaceSample | undefined {
    const water = this.waterBodies.find((candidate) => candidate.id === surface.waterBodyId);
    if (!water || !pointInPolygon({ x, z }, water.polygon)) return undefined;
    const bottom = this.sampleSurface(water.bottomSurfaceId, x, z);
    if (!bottom) return undefined;
    const waterDepth = water.surface.y - bottom.position.y;
    if (waterDepth <= 0) return undefined;
    return {
      surfaceId: surface.id,
      position: { x, y: water.surface.y, z },
      normal: { x: 0, y: 1, z: 0 },
      material: "water",
      roughness: 0,
      waterDepth,
      overlays: [],
    };
  }

  private heightAt(surface: RuntimeSurface, x: number, z: number): number | undefined {
    if (surface.kind === "deck" || surface.kind === "tunnel" || surface.kind === "cave") return surface.y;
    if (surface.kind !== "heightfield" || !surface.cornerHeights) return undefined;

    const localX = (x - surface.origin.x) / surface.cellSize;
    const localZ = (z - surface.origin.z) / surface.cellSize;
    if (localX < 0 || localZ < 0 || localX > surface.cellsX || localZ > surface.cellsZ) return undefined;

    const cx = Math.min(surface.cellsX - 1, Math.max(0, Math.floor(localX)));
    const cz = Math.min(surface.cellsZ - 1, Math.max(0, Math.floor(localZ)));
    const tx = localX >= surface.cellsX ? 1 : localX - cx;
    const tz = localZ >= surface.cellsZ ? 1 : localZ - cz;
    const h00 = cornerHeight(surface, cx, cz);
    const h10 = cornerHeight(surface, cx + 1, cz);
    const h01 = cornerHeight(surface, cx, cz + 1);
    const h11 = cornerHeight(surface, cx + 1, cz + 1);
    const h0 = lerp(h00, h10, tx);
    const h1 = lerp(h01, h11, tx);
    return lerp(h0, h1, tz);
  }

  private normalAt(surface: RuntimeSurface, x: number, z: number): { x: number; y: number; z: number } {
    const eps = surface.cellSize * 0.5;
    const center = this.heightAt(surface, x, z) ?? 0;
    const left = this.heightAt(surface, x - eps, z) ?? center;
    const right = this.heightAt(surface, x + eps, z) ?? center;
    const back = this.heightAt(surface, x, z - eps) ?? center;
    const front = this.heightAt(surface, x, z + eps) ?? center;
    const nx = left - right;
    const nz = back - front;
    const ny = eps * 2;
    const length = Math.hypot(nx, ny, nz) || 1;
    return { x: nx / length, y: ny / length, z: nz / length };
  }
}

function createFlatSurfaceDefinition(
  size: { cellsX: number; cellsZ: number; cellSize: number },
  material: SurfaceMaterialId,
): TerrainSurfaceDefinition {
  return {
    id: DEFAULT_SURFACE_ID,
    kind: "heightfield",
    cellSize: size.cellSize,
    cellsX: size.cellsX,
    cellsZ: size.cellsZ,
    material,
    cornerHeights: Array.from({ length: (size.cellsX + 1) * (size.cellsZ + 1) }, () => 0),
  };
}

function createRuntimeSurface(definition: TerrainSurfaceDefinition): RuntimeSurface {
  const origin =
    definition.origin ??
    ({
      x: -definition.cellsX * definition.cellSize * 0.5,
      z: -definition.cellsZ * definition.cellSize * 0.5,
    } satisfies Vector2Data);
  const material = definition.material ?? "grass";
  const roughness = definition.roughness ?? 1;

  if (definition.kind === "heightfield") {
    const cornerHeights =
      definition.cornerHeights ??
      createHeightsFromRecipe(definition.cellsX, definition.cellsZ, definition.cellSize, origin, definition.heightRecipe);
    const expected = (definition.cellsX + 1) * (definition.cellsZ + 1);
    if (cornerHeights.length !== expected) {
      throw new Error(`Heightfield ${definition.id} has ${cornerHeights.length} heights, expected ${expected}.`);
    }
    return {
      id: definition.id,
      kind: definition.kind,
      cellSize: definition.cellSize,
      cellsX: definition.cellsX,
      cellsZ: definition.cellsZ,
      origin,
      material,
      roughness,
      cornerHeights,
    };
  }

  return {
    id: definition.id,
    kind: definition.kind,
    cellSize: definition.cellSize,
    cellsX: definition.cellsX,
    cellsZ: definition.cellsZ,
    origin,
    material,
    roughness,
    y: definition.y,
    approximateClearance: definition.approximateClearance,
  };
}

function createHeightsFromRecipe(
  cellsX: number,
  cellsZ: number,
  cellSize: number,
  origin: Vector2Data,
  recipe?: HeightRecipe,
): number[] {
  const heights: number[] = [];
  for (let cz = 0; cz <= cellsZ; cz += 1) {
    for (let cx = 0; cx <= cellsX; cx += 1) {
      const x = origin.x + cx * cellSize;
      const z = origin.z + cz * cellSize;
      let y = recipe?.baseY ?? 0;
      for (const feature of recipe?.features ?? []) {
        y += featureHeight(feature, x, z);
      }
      heights.push(y);
    }
  }
  return heights;
}

function featureHeight(feature: HeightRecipeFeature, x: number, z: number): number {
  if (feature.kind === "hill" || feature.kind === "basin") {
    const distance = Math.hypot(x - feature.center.x, z - feature.center.z);
    if (distance >= feature.radius) return 0;
    const falloff = smoothstep(1 - distance / feature.radius);
    return feature.kind === "hill" ? feature.height * falloff : -feature.depth * falloff;
  }

  if (feature.kind === "ramp") {
    if (x < feature.area.xMin || x > feature.area.xMax || z < feature.area.zMin || z > feature.area.zMax) return 0;
    const t =
      feature.axis === "x"
        ? inverseLerp(feature.area.xMin, feature.area.xMax, x)
        : inverseLerp(feature.area.zMin, feature.area.zMax, z);
    return lerp(feature.startY, feature.endY, t);
  }

  if (feature.kind === "ridge") {
    if (feature.area && (x < feature.area.xMin || x > feature.area.xMax || z < feature.area.zMin || z > feature.area.zMax)) {
      return 0;
    }
    const coordinate = feature.axis === "x" ? x : z;
    const distance = Math.abs(coordinate - feature.center);
    if (distance >= feature.width) return 0;
    return feature.height * smoothstep(1 - distance / feature.width);
  }

  const coordinate = feature.axis === "x" ? x : z;
  const ranged = feature.axis === "x" ? z : x;
  if (feature.range && (ranged < feature.range.min || ranged > feature.range.max)) return 0;
  const matchesDirection =
    feature.direction === "positive" ? coordinate >= feature.at : coordinate <= feature.at;
  return matchesDirection ? feature.delta : 0;
}

export function cellLayerAt<T>(layer: CellLayer<T>, surface: RuntimeSurface, cx: number, cz: number): T {
  if (!isCellLayerObject(layer)) return layer;
  const value = layer.cells?.[cz * surface.cellsX + cx];
  return value ?? layer.default;
}

export function pointInPolygon(point: Vector2Data, polygon: Vector2Data[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const pi = polygon[i];
    const pj = polygon[j];
    const crossesZ =
      (pi.z > point.z) !== (pj.z > point.z);
    const intersects =
      crossesZ &&
      point.x < ((pj.x - pi.x) * (point.z - pi.z)) / (pj.z - pi.z || Number.EPSILON) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function corridorContains(corridor: TransportOverlay["corridor"], x: number, z: number): boolean {
  if (corridor.kind === "polygon") return pointInPolygon({ x, z }, corridor.points);

  const radius = corridor.width * 0.5;
  for (let i = 0; i < corridor.points.length - 1; i += 1) {
    if (distanceToSegment({ x, z }, corridor.points[i], corridor.points[i + 1]) <= radius) return true;
  }
  return false;
}

function distanceToSegment(point: Vector2Data, a: Vector2Data, b: Vector2Data): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq <= Number.EPSILON) return Math.hypot(point.x - a.x, point.z - a.z);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSq));
  return Math.hypot(point.x - (a.x + dx * t), point.z - (a.z + dz * t));
}

function cornerHeight(surface: RuntimeSurface, cx: number, cz: number): number {
  return surface.cornerHeights?.[cz * (surface.cellsX + 1) + cx] ?? 0;
}

function surfaceCellAtOrClamp(surface: RuntimeSurface, x: number, z: number): { cx: number; cz: number } | undefined {
  const localX = (x - surface.origin.x) / surface.cellSize;
  const localZ = (z - surface.origin.z) / surface.cellSize;
  if (localX < 0 || localZ < 0 || localX > surface.cellsX || localZ > surface.cellsZ) return undefined;
  return {
    cx: Math.min(surface.cellsX - 1, Math.max(0, Math.floor(localX))),
    cz: Math.min(surface.cellsZ - 1, Math.max(0, Math.floor(localZ))),
  };
}

function isCellLayerObject<T>(layer: CellLayer<T>): layer is { default: T; cells?: T[] } {
  return typeof layer === "object" && layer !== null && "default" in layer;
}

function smoothstep(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function inverseLerp(min: number, max: number, value: number): number {
  if (Math.abs(max - min) <= Number.EPSILON) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
