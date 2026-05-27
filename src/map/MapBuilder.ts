import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import { NavGrid } from "../nav/NavGrid";
import { createGround } from "../render/Ground";
import { AssetManager } from "../render/AssetManager";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import type { Actor } from "../sim/Actor";
import { rasterizeFootprint } from "./FootprintRasterizer";
import type { BuiltPlacement, MapDefinition, NavFootprint, PlacementDefinition, Vector3Data } from "./MapTypes";

export type BuiltMap = {
  map: MapDefinition;
  navGrid: NavGrid;
  ground: Mesh;
  footprintRoot: TransformNode;
  placements: BuiltPlacement[];
  actors: Actor[];
};

export class MapBuilder {
  constructor(
    private readonly scene: Scene,
    private readonly assetManager: AssetManager,
    private readonly physicsWorld: PhysicsWorld,
  ) {}

  async build(map: MapDefinition): Promise<BuiltMap> {
    const worldWidth = map.size.cellsX * map.size.cellSize;
    const worldDepth = map.size.cellsZ * map.size.cellSize;
    const ground = createGround(this.scene, worldWidth, worldDepth);
    this.physicsWorld.createGround(worldWidth, worldDepth);

    const navGrid = new NavGrid(map.size.cellsX, map.size.cellsZ, map.size.cellSize, map.terrain.defaultCost ?? 1.2);
    const actorRadius = map.actors[0]?.movement.radius ?? 0;
    const assetIds = [...map.placements.map((placement) => placement.assetId), ...map.actors.map((actor) => actor.assetId)];
    await this.assetManager.preloadAssets(assetIds);

    const footprintRoot = new TransformNode("debug.footprints", this.scene);
    footprintRoot.setEnabled(false);
    const placements: BuiltPlacement[] = [];

    for (const placement of map.placements) {
      const definition = this.assetManager.getDefinition(placement.assetId);
      const root = this.assetManager.instantiate(placement.assetId, placement.id);
      const scale = (definition.defaultScale ?? 1) * (placement.scale ?? 1);
      const placementRotationY = placement.rotationY ?? 0;
      const visualRotationY = (definition.defaultRotationY ?? 0) + placementRotationY;
      root.position.set(placement.position.x, placement.position.y, placement.position.z);
      root.rotation.y = visualRotationY;
      root.scaling.setAll(scale);

      const nav = placement.nav ?? definition.defaultNav;
      if (nav) {
        rasterizeFootprint(navGrid, placement.id, placement.position, nav, actorRadius, placementRotationY);
        if (nav.blocks) {
          this.addFootprintDebug(footprintRoot, placement, nav, placementRotationY);
        }
      }

      const physics = placement.physics ?? physicsFromFootprint(nav, placement.position);
      if (physics) this.physicsWorld.createStaticFromSpec(placement.position, physics, placementRotationY);

      placements.push({
        id: placement.id,
        assetId: placement.assetId,
        position: { x: placement.position.x, z: placement.position.z },
        nav,
      });
    }

    const actors: Actor[] = [];
    for (const actorDefinition of map.actors) {
      const definition = this.assetManager.getDefinition(actorDefinition.assetId);
      const root = this.assetManager.instantiate(actorDefinition.assetId, actorDefinition.id);
      const scale = definition.defaultScale ?? 1;
      root.position.set(actorDefinition.position.x, actorDefinition.position.y, actorDefinition.position.z);
      root.rotation.y = actorDefinition.rotationY ?? 0;
      root.scaling.setAll(scale);

      const physics = this.physicsWorld.createKinematicActor(
        actorDefinition.position,
        actorDefinition.physics.radius,
        actorDefinition.physics.height,
      );
      actors.push({
        id: actorDefinition.id,
        assetId: actorDefinition.assetId,
        root,
        physics,
        spawn: new Vector3(actorDefinition.position.x, actorDefinition.position.y, actorDefinition.position.z),
        position: new Vector3(actorDefinition.position.x, actorDefinition.position.y, actorDefinition.position.z),
        rotationY: actorDefinition.rotationY ?? 0,
        movement: {
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
      navGrid,
      ground,
      footprintRoot,
      placements,
      actors,
    };
  }

  private addFootprintDebug(
    parent: TransformNode,
    placement: PlacementDefinition,
    footprint: Extract<NavFootprint, { blocks: true }>,
    rotationY: number,
  ): void {
    const material = getFootprintMaterial(this.scene);

    if (footprint.shape === "rect") {
      const mesh = MeshBuilder.CreateGround(
        `debug.footprint.${placement.id}`,
        { width: footprint.width + (footprint.padding ?? 0) * 2, height: footprint.depth + (footprint.padding ?? 0) * 2 },
        this.scene,
      );
      mesh.position.set(placement.position.x, 0.12, placement.position.z);
      mesh.rotation.y = rotationY;
      mesh.material = material;
      mesh.isPickable = false;
      mesh.parent = parent;
      return;
    }

    const mesh = MeshBuilder.CreateCylinder(
      `debug.footprint.${placement.id}`,
      { diameter: (footprint.radius + (footprint.padding ?? 0)) * 2, height: 0.05, tessellation: 32 },
      this.scene,
    );
    mesh.position.set(placement.position.x, 0.12, placement.position.z);
    mesh.material = material;
    mesh.isPickable = false;
    mesh.parent = parent;
  }
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

function physicsFromFootprint(nav: NavFootprint | undefined, position: Vector3Data) {
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
    height: position.y + 3,
  };
}
