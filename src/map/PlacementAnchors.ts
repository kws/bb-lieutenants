import type { TerrainWorld } from "../terrain/TerrainWorld";
import { waterSurfaceId } from "../terrain/TerrainWorld";
import type { PlacementAnchor, Vector3Data } from "./MapTypes";

export type ResolvedPlacementAnchor = {
  position: Vector3Data;
  surfaceId: string;
};

export function resolvePlacementAnchor(
  terrain: TerrainWorld,
  anchor: PlacementAnchor | undefined,
  position: Vector3Data | undefined,
): ResolvedPlacementAnchor {
  if (anchor?.kind === "absolute") {
    const sample = terrain.sampleBestSurface(anchor.position.x, anchor.position.z);
    return { position: anchor.position, surfaceId: sample?.surfaceId ?? terrain.defaultSurfaceId };
  }

  if (anchor?.kind === "surface") {
    const sample = terrain.sampleSurface(anchor.surfaceId, anchor.x, anchor.z);
    if (!sample) throw new Error(`Surface anchor is outside surface ${anchor.surfaceId}: ${anchor.x},${anchor.z}`);
    return {
      position: { x: anchor.x, y: sample.position.y + (anchor.offsetY ?? 0), z: anchor.z },
      surfaceId: anchor.surfaceId,
    };
  }

  if (anchor?.kind === "waterSurface") {
    const surfaceId = waterSurfaceId(anchor.waterBodyId);
    const sample = terrain.sampleSurface(surfaceId, anchor.x, anchor.z);
    if (!sample) throw new Error(`Water anchor is outside water body ${anchor.waterBodyId}: ${anchor.x},${anchor.z}`);
    return {
      position: { x: anchor.x, y: sample.position.y + (anchor.offsetY ?? 0), z: anchor.z },
      surfaceId,
    };
  }

  if (!position) throw new Error("Map item must define either position or anchor.");
  const sample = terrain.sampleBestSurface(position.x, position.z);
  return { position, surfaceId: sample?.surfaceId ?? terrain.defaultSurfaceId };
}
