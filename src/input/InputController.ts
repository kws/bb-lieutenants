import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { PickingInfo } from "@babylonjs/core/Collisions/pickingInfo";
import type { Scene } from "@babylonjs/core/scene";
import type { NavNode, NavPoint } from "../nav/NavTypes";
import { findSurfacePath } from "../nav/SurfaceAStar";
import { getMovementNode, type MovementLayer } from "../nav/MovementLayer";
import type { DebugDraw } from "../render/DebugDraw";
import type { TerrainWorld } from "../terrain/TerrainWorld";
import type { VehicleController } from "../sim/VehicleController";

type ControlContext = {
  vehicleController: VehicleController;
  movementLayer: MovementLayer;
};

export type PointerNavState = {
  world?: NavPoint;
  cell?: NavNode;
  medium?: "land" | "waterSurface" | "underwater" | "air";
  material?: string;
  waterDepth?: number;
  overlays?: string[];
};

export class InputController {
  readonly pointer: PointerNavState = {};

  constructor(
    private readonly scene: Scene,
    private readonly terrain: TerrainWorld,
    private readonly getControlContext: () => ControlContext,
    private readonly selectActor: (actorId: string) => void,
    private readonly debugDraw: DebugDraw,
    private readonly pickCamera?: Camera,
  ) {
    this.scene.onPointerMove = () => {
      this.updatePointerState();
    };

    this.scene.onPointerDown = (_event) => {
      if (_event.button !== 0) return;
      const actorId = this.pickActorId();
      if (actorId) {
        this.selectActor(actorId);
        return;
      }

      this.updatePointerState();
      if (_event.shiftKey) {
        this.issueDirectCollisionTest();
      } else {
        this.issueMoveCommand();
      }
    };
  }

  private issueDirectCollisionTest(): void {
    if (!this.pointer.world) return;

    const { vehicleController } = this.getControlContext();
    vehicleController.setDirectTarget(this.pointer.world);
    this.debugDraw.drawPath([
      {
        surfaceId: vehicleController.actor.surfaceId,
        x: vehicleController.actor.position.x,
        y: vehicleController.actor.position.y,
        z: vehicleController.actor.position.z,
      },
      this.pointer.world,
    ]);
  }

  private issueMoveCommand(): void {
    if (!this.pointer.cell || !this.pointer.world) return;

    const { vehicleController, movementLayer } = this.getControlContext();
    const actor = vehicleController.actor;
    const startCell = this.terrain.worldToSurfaceCell(actor.surfaceId, actor.position.x, actor.position.z);
    if (!startCell) return;

    const path = findSurfacePath(
      movementLayer,
      { surfaceId: actor.surfaceId, ...startCell },
      this.pointer.cell,
      {
        allowNearestTarget: true,
        maxSearchCells: 8192,
      },
    );

    if (!path.ok) {
      console.warn(`No path: ${path.reason}`, path);
      vehicleController.actor.movement.state = "blocked";
      return;
    }

    vehicleController.setPath(path.points);
    this.debugDraw.drawPath(path.points);
  }

  private pickActorId(): string | undefined {
    const pick = this.scene.pick(
      this.scene.pointerX,
      this.scene.pointerY,
      (mesh) => typeof mesh.metadata?.actorId === "string",
      false,
      this.pickCamera,
    );

    return pick?.hit && typeof pick.pickedMesh?.metadata?.actorId === "string"
      ? pick.pickedMesh.metadata.actorId
      : undefined;
  }

  private updatePointerState(): void {
    const pick = this.pickTerrain();
    if (!pick?.hit || !pick.pickedPoint || typeof pick.pickedMesh?.metadata?.terrainSurfaceId !== "string") {
      this.clearPointer();
      return;
    }

    const surfaceId = pick.pickedMesh.metadata.terrainSurfaceId as string;
    const sample = this.terrain.sampleSurface(surfaceId, pick.pickedPoint.x, pick.pickedPoint.z);
    const cell = this.terrain.worldToSurfaceCell(surfaceId, pick.pickedPoint.x, pick.pickedPoint.z);
    if (!sample || !cell) {
      this.clearPointer();
      return;
    }

    this.pointer.world = {
      surfaceId,
      x: sample.position.x,
      y: sample.position.y,
      z: sample.position.z,
    };
    this.pointer.cell = { surfaceId, ...cell };
    this.pointer.medium = surfaceId.startsWith("water.") ? "waterSurface" : "land";
    this.pointer.material = sample.material;
    this.pointer.waterDepth = sample.waterDepth;
    this.pointer.overlays = sample.overlays;
  }

  private pickTerrain(): PickingInfo | undefined {
    const picks =
      this.scene.multiPick(
        this.scene.pointerX,
        this.scene.pointerY,
        (mesh) => typeof mesh.metadata?.terrainSurfaceId === "string",
        this.pickCamera,
      ) ?? [];
    const terrainHits = picks.filter(
      (pick) => pick.hit && pick.pickedPoint && typeof pick.pickedMesh?.metadata?.terrainSurfaceId === "string",
    );
    return terrainHits.find((pick) => this.shouldPreferUndergroundPick(pick)) ?? terrainHits[0];
  }

  private shouldPreferUndergroundPick(pick: PickingInfo): boolean {
    if (pick.pickedMesh?.metadata?.terrainUnderground !== true || !pick.pickedPoint) return false;
    const surfaceId = pick.pickedMesh.metadata.terrainSurfaceId as string;
    const cell = this.terrain.worldToSurfaceCell(surfaceId, pick.pickedPoint.x, pick.pickedPoint.z);
    if (!cell) return false;
    return getMovementNode(this.getControlContext().movementLayer, { surfaceId, ...cell })?.walkable === true;
  }

  private clearPointer(): void {
    this.pointer.world = undefined;
    this.pointer.cell = undefined;
    this.pointer.medium = undefined;
    this.pointer.material = undefined;
    this.pointer.waterDepth = undefined;
    this.pointer.overlays = undefined;
  }

  getPointerNodeState(): { walkable: boolean; blockedBy?: string } | undefined {
    if (!this.pointer.cell) return undefined;
    const node = getMovementNode(this.getControlContext().movementLayer, this.pointer.cell);
    if (!node) return undefined;
    return {
      walkable: node.walkable,
      blockedBy: node.blockedBy ?? node.rejection,
    };
  }
}
