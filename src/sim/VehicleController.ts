import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { NavPoint } from "../nav/NavTypes";
import type { PhysicsWorld } from "../physics/PhysicsWorld";
import type { TerrainWorld } from "../terrain/TerrainWorld";
import type { Actor } from "./Actor";

const WAYPOINT_REACHED_DISTANCE = 0.45;
const STUCK_SPEED_EPSILON = 0.05;
const STUCK_TIME_SECONDS = 0.75;

export class VehicleController {
  constructor(
    readonly actor: Actor,
    private readonly physicsWorld: PhysicsWorld,
    private readonly terrain: TerrainWorld,
  ) {}

  setPath(points: NavPoint[]): void {
    this.actor.movement.path = points;
    this.actor.movement.currentWaypointIndex = this.actor.movement.path.length > 1 ? 1 : 0;
    this.actor.movement.state = this.actor.movement.path.length > 0 ? "moving" : "idle";
    this.actor.movement.stuckTime = 0;
    this.actor.movement.lastCollision = false;
  }

  setDirectTarget(point: NavPoint): void {
    this.actor.movement.path = [point];
    this.actor.movement.currentWaypointIndex = 0;
    this.actor.movement.state = "moving";
    this.actor.movement.stuckTime = 0;
    this.actor.movement.lastCollision = false;
  }

  reset(): void {
    this.actor.surfaceId = this.actor.spawnSurfaceId;
    this.physicsWorld.setActorGroundPosition(this.actor.physics, {
      x: this.actor.spawn.x,
      y: this.actor.spawn.y,
      z: this.actor.spawn.z,
    });
    this.actor.position.copyFrom(this.actor.spawn);
    this.actor.root.position.copyFrom(this.actor.spawn);
    this.actor.movement.path = [];
    this.actor.movement.currentWaypointIndex = 0;
    this.actor.movement.state = "idle";
    this.actor.movement.stuckTime = 0;
    this.actor.movement.lastCollision = false;
  }

  update(dt: number): void {
    const movement = this.actor.movement;
    if (movement.state !== "moving" || movement.path.length === 0) return;

    const target = movement.path[movement.currentWaypointIndex];
    if (!target) {
      movement.state = "idle";
      return;
    }

    const bodyTranslation = this.actor.physics.rigidBody.translation();
    const current = new Vector3(bodyTranslation.x, this.actor.physics.visualGroundY, bodyTranslation.z);
    const toTarget = new Vector3(target.x - current.x, 0, target.z - current.z);
    const distance = toTarget.length();

    if (distance <= WAYPOINT_REACHED_DISTANCE) {
      this.actor.surfaceId = target.surfaceId;
      this.snapToTerrain(target.surfaceId, target.x, target.z);
      movement.currentWaypointIndex += 1;
      if (movement.currentWaypointIndex >= movement.path.length) {
        movement.state = "idle";
      }
      return;
    }

    const direction = toTarget.normalize();
    const stepDistance = Math.min(distance, movement.speed * dt);
    const nextX = current.x + direction.x * stepDistance;
    const nextZ = current.z + direction.z * stepDistance;
    const sample = this.terrain.sampleSurface(target.surfaceId, nextX, nextZ);
    const nextGroundY = sample?.position.y ?? target.y;
    const desired = new Vector3(direction.x * stepDistance, nextGroundY - current.y, direction.z * stepDistance);
    const corrected = this.physicsWorld.moveActor(this.actor.physics, desired);
    movement.lastCollision = corrected.length() + 0.001 < desired.length();

    const desiredYaw = Math.atan2(direction.x, direction.z);
    this.actor.rotationY = dampAngle(this.actor.rotationY, desiredYaw, movement.turnRate * dt);
    this.actor.surfaceId = target.surfaceId;

    const horizontalSpeed = Math.hypot(corrected.x, corrected.z) / Math.max(dt, 0.0001);
    if (stepDistance > 0 && horizontalSpeed < STUCK_SPEED_EPSILON) {
      movement.stuckTime += dt;
      if (movement.stuckTime > STUCK_TIME_SECONDS) {
        movement.state = "blocked";
        movement.path = [];
        movement.currentWaypointIndex = 0;
      }
    } else {
      movement.stuckTime = 0;
    }
  }

  syncFromPhysics(): void {
    const bodyTranslation = this.actor.physics.rigidBody.translation();
    this.actor.position.set(bodyTranslation.x, this.actor.physics.visualGroundY, bodyTranslation.z);
    this.actor.root.position.copyFrom(this.actor.position);
    this.actor.root.rotationQuaternion = null;
    this.actor.root.rotation.y = this.actor.rotationY;
  }

  private snapToTerrain(surfaceId: string, x: number, z: number): void {
    const sample = this.terrain.sampleSurface(surfaceId, x, z);
    if (!sample) return;
    this.physicsWorld.setActorGroundPosition(this.actor.physics, {
      x,
      y: sample.position.y,
      z,
    });
  }
}

function dampAngle(current: number, target: number, maxStep: number): number {
  const delta = normalizeAngle(target - current);
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
