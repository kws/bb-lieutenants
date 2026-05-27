import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import { createMovementLayer, applyFootprintToMovementLayer, type MovementLayer } from "../nav/MovementLayer";
import { getMovementProfile } from "../nav/MovementProfiles";
import { AssetManager } from "../render/AssetManager";
import { createTerrainMeshes } from "../render/TerrainRenderer";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { TerrainWorld, waterSurfaceId } from "../terrain/TerrainWorld";
import type { Actor } from "../sim/Actor";
import type {
  AssetDefinition,
  BuiltPlacement,
  FoundationMode,
  MapDefinition,
  NavFootprint,
  PlacementAnchor,
  Vector3Data,
} from "./MapTypes";

export type BuiltMap = {
  map: MapDefinition;
  terrain: TerrainWorld;
  movementLayer: MovementLayer;
  terrainMeshes: Mesh[];
  footprintRoot: TransformNode;
  placements: BuiltPlacement[];
  actors: Actor[];
};

type ResolvedAnchor = {
  position: Vector3Data;
  surfaceId: string;
};

export class MapBuilder {
  constructor(
    private readonly scene: Scene,
    private readonly assetManager: AssetManager,
    private readonly physicsWorld: PhysicsWorld,
  ) {}

  async build(map: MapDefinition): Promise<BuiltMap> {
    const terrain = new TerrainWorld(map, map.version === 1 ? map.terrain.defaultCost ?? 1 : 1);
    const terrainMeshes = createTerrainMeshes(this.scene, terrain);
    const worldWidth = map.size.cellsX * map.size.cellSize;
    const worldDepth = map.size.cellsZ * map.size.cellSize;
    this.physicsWorld.createGround(worldWidth, worldDepth, -10);

    const primaryProfile = getMovementProfile(map, map.actors[0]?.movement.profileId);
    const movementLayer = createMovementLayer(terrain, primaryProfile);
    const actorRadius = map.actors[0]?.movement.radius ?? primaryProfile.radius;
    const assetIds = [...map.placements.map((placement) => placement.assetId), ...map.actors.map((actor) => actor.assetId)];
    await this.assetManager.preloadAssets(assetIds);

    const footprintRoot = new TransformNode("debug.footprints", this.scene);
    footprintRoot.setEnabled(false);
    const placements: BuiltPlacement[] = [];

    for (const placement of map.placements) {
      const resolved = resolveAnchor(terrain, placement.anchor, placement.position);
      const definition = this.assetManager.getDefinition(placement.assetId);
      const root = this.assetManager.instantiate(placement.assetId, placement.id);
      const scale = (definition.defaultScale ?? 1) * (placement.scale ?? 1);
      const placementRotationY = placement.rotationY ?? 0;
      const visualRotationY = (definition.defaultRotationY ?? 0) + placementRotationY;
      root.position.set(resolved.position.x, resolved.position.y, resolved.position.z);
      applyPlacementRotation(root, terrain, resolved, visualRotationY, placement.foundation, definition.category);
      root.scaling.setAll(scale);

      const nav = placement.nav ?? definition.defaultNav;
      if (nav) {
        applyFootprintToMovementLayer(
          movementLayer,
          resolved.surfaceId,
          placement.id,
          resolved.position,
          nav,
          actorRadius,
          placementRotationY,
        );
        if (nav.blocks) {
          this.addFootprintDebug(footprintRoot, placement.id, resolved.position, nav, placementRotationY);
        }
      }

      const physics = placement.physics ?? physicsFromFootprint(nav, resolved.position);
      if (physics) this.physicsWorld.createStaticFromSpec(resolved.position, physics, placementRotationY);

      placements.push({
        id: placement.id,
        assetId: placement.assetId,
        position: { x: resolved.position.x, z: resolved.position.z },
        surfaceId: resolved.surfaceId,
        nav,
      });
    }

    const actors: Actor[] = [];
    for (const actorDefinition of map.actors) {
      const resolved = resolveAnchor(terrain, actorDefinition.anchor, actorDefinition.position);
      const profile = getMovementProfile(map, actorDefinition.movement.profileId);
      const definition = this.assetManager.getDefinition(actorDefinition.assetId);
      const root = this.assetManager.instantiate(actorDefinition.assetId, actorDefinition.id);
      const scale = definition.defaultScale ?? 1;
      root.position.set(resolved.position.x, resolved.position.y, resolved.position.z);
      root.rotation.y = actorDefinition.rotationY ?? 0;
      root.scaling.setAll(scale);

      const physics = this.physicsWorld.createKinematicActor(
        resolved.position,
        actorDefinition.physics.radius,
        actorDefinition.physics.height,
      );
      actors.push({
        id: actorDefinition.id,
        assetId: actorDefinition.assetId,
        root,
        physics,
        spawn: new Vector3(resolved.position.x, resolved.position.y, resolved.position.z),
        spawnSurfaceId: resolved.surfaceId,
        surfaceId: resolved.surfaceId,
        position: new Vector3(resolved.position.x, resolved.position.y, resolved.position.z),
        rotationY: actorDefinition.rotationY ?? 0,
        movement: {
          profileId: profile.id,
          radius: actorDefinition.movement.radius,
          speed: actorDefinition.movement.speed,
          turnRate: actorDefinition.movement.turnRate,
          path: [],
          currentWaypointIndex: 0,
          state: "idle",
          stuckTime: 0,
          lastCollision: false,
        },
      });
    }

    return {
      map,
      terrain,
      movementLayer,
      terrainMeshes,
      footprintRoot,
      placements,
      actors,
    };
  }

  private addFootprintDebug(
    parent: TransformNode,
    id: string,
    position: Vector3Data,
    footprint: Extract<NavFootprint, { blocks: true }>,
    rotationY: number,
  ): void {
    const material = getFootprintMaterial(this.scene);

    if (footprint.shape === "rect") {
      const mesh = MeshBuilder.CreateGround(
        `debug.footprint.${id}`,
        { width: footprint.width + (footprint.padding ?? 0) * 2, height: footprint.depth + (footprint.padding ?? 0) * 2 },
        this.scene,
      );
      mesh.position.set(position.x, position.y + 0.12, position.z);
      mesh.rotation.y = rotationY;
      mesh.material = material;
      mesh.isPickable = false;
      mesh.parent = parent;
      return;
    }

    const mesh = MeshBuilder.CreateCylinder(
      `debug.footprint.${id}`,
      { diameter: (footprint.radius + (footprint.padding ?? 0)) * 2, height: 0.05, tessellation: 32 },
      this.scene,
    );
    mesh.position.set(position.x, position.y + 0.12, position.z);
    mesh.material = material;
    mesh.isPickable = false;
    mesh.parent = parent;
  }
}

function resolveAnchor(terrain: TerrainWorld, anchor: PlacementAnchor | undefined, position: Vector3Data | undefined): ResolvedAnchor {
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

function applyPlacementRotation(
  root: TransformNode,
  terrain: TerrainWorld,
  resolved: ResolvedAnchor,
  visualRotationY: number,
  foundation: FoundationMode | undefined,
  category: AssetDefinition["category"],
): void {
  if (!shouldConformToSurface(foundation, category)) {
    root.rotationQuaternion = null;
    root.rotation.y = visualRotationY;
    return;
  }

  const sample = terrain.sampleSurface(resolved.surfaceId, resolved.position.x, resolved.position.z);
  if (!sample) {
    root.rotationQuaternion = null;
    root.rotation.y = visualRotationY;
    return;
  }

  const up = new Vector3(sample.normal.x, sample.normal.y, sample.normal.z).normalize();
  const maxConformSlopeDeg = 32;
  if (up.y < Math.cos((maxConformSlopeDeg * Math.PI) / 180)) {
    root.rotationQuaternion = null;
    root.rotation.y = visualRotationY;
    return;
  }

  const flatForward = new Vector3(Math.sin(visualRotationY), 0, Math.cos(visualRotationY));
  const forward = flatForward.subtract(up.scale(Vector3.Dot(flatForward, up)));
  if (forward.lengthSquared() <= 0.0001) {
    root.rotationQuaternion = null;
    root.rotation.y = visualRotationY;
    return;
  }

  root.rotationQuaternion = Quaternion.FromLookDirectionLH(forward.normalize(), up);
}

function shouldConformToSurface(foundation: FoundationMode | undefined, category: AssetDefinition["category"]): boolean {
  if (foundation === "conform") return true;
  if (foundation !== undefined) return false;
  return category === "terrain";
}

function getFootprintMaterial(scene: Scene): StandardMaterial {
  const existing = scene.getMaterialByName("debug.footprint.material");
  if (existing instanceof StandardMaterial) return existing;

  const material = new StandardMaterial("debug.footprint.material", scene);
  material.diffuseColor = new Color3(1, 0.55, 0.1);
  material.alpha = 0.28;
  material.specularColor = Color3.Black();
  return material;
}

function physicsFromFootprint(nav: NavFootprint | undefined, _position: Vector3Data) {
  if (!nav?.blocks) return undefined;
  if (nav.shape === "rect") {
    return {
      solid: true as const,
      shape: "box" as const,
      size: { x: nav.width + (nav.padding ?? 0) * 2, y: 3, z: nav.depth + (nav.padding ?? 0) * 2 },
    };
  }
  return {
    solid: true as const,
    shape: "cylinder" as const,
    radius: nav.radius + (nav.padding ?? 0),
    height: 3,
  };
}
