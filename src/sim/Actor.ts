import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { PhysicsActorHandle } from "../physics/PhysicsWorld";
import type { NavPoint } from "../nav/NavTypes";

export type ActorMovementState = "idle" | "moving" | "blocked";

export type Actor = {
  id: string;
  assetId: string;
  root: TransformNode;
  physics: PhysicsActorHandle;
  spawn: Vector3;
  spawnSurfaceId: string;
  surfaceId: string;
  position: Vector3;
  rotationY: number;
  movement: {
    profileId: string;
    radius: number;
    speed: number;
    turnRate: number;
    path: NavPoint[];
    currentWaypointIndex: number;
    state: ActorMovementState;
    stuckTime: number;
    lastCollision: boolean;
  };
};
