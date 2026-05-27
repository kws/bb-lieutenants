import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { PhysicsActorHandle } from "../physics/PhysicsWorld";

export type ActorMovementState = "idle" | "moving" | "blocked";

export type Actor = {
  id: string;
  assetId: string;
  root: TransformNode;
  physics: PhysicsActorHandle;
  spawn: Vector3;
  position: Vector3;
  rotationY: number;
  movement: {
    radius: number;
    speed: number;
    turnRate: number;
    path: Vector3[];
    currentWaypointIndex: number;
    state: ActorMovementState;
    stuckTime: number;
    lastCollision: boolean;
  };
};
