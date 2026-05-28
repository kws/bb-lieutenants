import type { MovementProfile, NavFootprint, Vector3Data } from "../map/MapTypes";
import type { TerrainWorld } from "../terrain/TerrainWorld";
import { applyFootprintToMovementLayer, createMovementLayer, type MovementLayer } from "./MovementLayer";

export type MovementFootprint = {
  id: string;
  surfaceId: string;
  position: Vector3Data;
  footprint: NavFootprint;
  rotationY: number;
};

export class MovementLayerCache {
  private readonly layers = new Map<string, MovementLayer>();

  constructor(
    private readonly terrain: TerrainWorld,
    private readonly footprints: MovementFootprint[],
  ) {}

  get(profile: MovementProfile, actorRadius = profile.radius): MovementLayer {
    const key = `${this.terrain.revision}:${profile.id}:${actorRadius}`;
    const existing = this.layers.get(key);
    if (existing) return existing;

    const layer = createMovementLayer(this.terrain, profile);
    for (const footprint of this.footprints) {
      applyFootprintToMovementLayer(
        layer,
        footprint.surfaceId,
        footprint.id,
        footprint.position,
        footprint.footprint,
        actorRadius,
        footprint.rotationY,
      );
    }
    this.layers.set(key, layer);
    return layer;
  }
}
