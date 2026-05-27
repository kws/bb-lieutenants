import type { Scene } from "@babylonjs/core/scene";
import type { PickingInfo } from "@babylonjs/core/Collisions/pickingInfo";
import { findPath } from "../nav/AStar";
import { NavGrid, worldToCell } from "../nav/NavGrid";
import type { Cell, WorldPoint } from "../nav/NavTypes";
import type { DebugDraw } from "../render/DebugDraw";
import type { VehicleController } from "../sim/VehicleController";

export type PointerNavState = {
  world?: WorldPoint;
  cell?: Cell;
};

export class InputController {
  readonly pointer: PointerNavState = {};

  constructor(
    private readonly scene: Scene,
    private readonly navGrid: NavGrid,
    private readonly vehicleController: VehicleController,
    private readonly debugDraw: DebugDraw,
  ) {
    this.scene.onPointerMove = () => {
      this.updatePointerState();
    };

    this.scene.onPointerDown = (_event, pickInfo) => {
      if (_event.button !== 0) return;
      this.updatePointerState(pickInfo);
      if (_event.shiftKey) {
        this.issueDirectCollisionTest();
      } else {
        this.issueMoveCommand();
      }
    };
  }

  private issueDirectCollisionTest(): void {
    if (!this.pointer.world) return;

    this.vehicleController.setDirectTarget(this.pointer.world);
    this.debugDraw.drawPath([
      { x: this.vehicleController.actor.position.x, z: this.vehicleController.actor.position.z },
      this.pointer.world,
    ]);
  }

  private issueMoveCommand(): void {
    if (!this.pointer.cell || !this.pointer.world) return;

    const actor = this.vehicleController.actor;
    const start = worldToCell(actor.position.x, actor.position.z, this.navGrid);
    if (!this.navGrid.isInside(start.cx, start.cz)) return;

    const path = findPath(this.navGrid, start, this.pointer.cell, {
      allowNearestTarget: true,
      maxSearchCells: 4096,
    });

    if (!path.ok) {
      console.warn(`No path: ${path.reason}`, path);
      this.vehicleController.actor.movement.state = "blocked";
      return;
    }

    this.vehicleController.setPath(path.worldPoints);
    this.debugDraw.drawPath(path.worldPoints);
  }

  private updatePointerState(existingPick?: PickingInfo): void {
    const pick =
      existingPick && existingPick.pickedMesh?.name === "ground.pickable"
        ? existingPick
        : this.scene.pick(this.scene.pointerX, this.scene.pointerY, (mesh) => mesh.name === "ground.pickable");

    if (!pick?.hit || !pick.pickedPoint) {
      this.pointer.world = undefined;
      this.pointer.cell = undefined;
      return;
    }

    this.pointer.world = { x: pick.pickedPoint.x, z: pick.pickedPoint.z };
    this.pointer.cell = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z, this.navGrid);
  }
}
