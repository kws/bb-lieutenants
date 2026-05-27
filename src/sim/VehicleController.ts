import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Actor } from "./Actor";
import type { PhysicsWorld } from "../physics/PhysicsWorld";
import type { WorldPoint } from "../nav/NavTypes";

const WAYPOINT_REACHED_DISTANCE = 0.45;
const STUCK_SPEED_EPSILON = 0.05;
const STUCK_TIME_SECONDS = 0.75;

export class VehicleController {
  constructor(
    readonly actor: Actor,
    private readonly physicsWorld: PhysicsWorld,
  ) {}

  setPath(points: WorldPoint[]): void {
    this.actor.movement.path = points.map((point) => new Vector3(point.x, 0, point.z));
    this.actor.movement.currentWaypointIndex = this.actor.movement.path.length > 1 ? 1 : 0;
    this.actor.movement.state = this.actor.movement.path.length > 0 ? "moving" : "idle";
    this.actor.movement.stuckTime = 0;
    this.actor.movement.lastCollision = false;
  }

  setDirectTarget(point: WorldPoint): void {
    this.actor.movement.path = [new Vector3(point.x, 0, point.z)];
    this.actor.movement.currentWaypointIndex = 0;
    this.actor.movement.state = "moving";
    this.actor.movement.stuckTime = 0;
    this.actor.movement.lastCollision = false;
  }

  reset(): void {
    const y = this.actor.physics.rigidBody.translation().y;
    this.actor.physics.rigidBody.setNextKinematicTranslation({
      x: this.actor.spawn.x,
      y,
      z: this.actor.spawn.z,
    });
    this.actor.physics.rigidBody.setTranslation({ x: this.actor.spawn.x, y, z: this.actor.spawn.z }, true);
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
    const current = new Vector3(bodyTranslation.x, 0, bodyTranslation.z);
    const toTarget = target.subtract(current);
    const distance = toTarget.length();

    if (distance <= WAYPOINT_REACHED_DISTANCE) {
      movement.currentWaypointIndex += 1;
      if (movement.currentWaypointIndex >= movement.path.length) {
        movement.state = "idle";
      }
      return;
    }

    const direction = toTarget.normalize();
    const stepDistance = Math.min(distance, movement.speed * dt);
    const desired = direction.scale(stepDistance);
    const corrected = this.physicsWorld.moveActor(this.actor.physics, desired);
    movement.lastCollision = corrected.length() + 0.001 < desired.length();

    const desiredYaw = Math.atan2(direction.x, direction.z);
    this.actor.rotationY = dampAngle(this.actor.rotationY, desiredYaw, movement.turnRate * dt);

    if (desired.length() > 0 && corrected.length() / Math.max(dt, 0.0001) < STUCK_SPEED_EPSILON) {
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
}

function dampAngle(current: number, target: number, maxStep: number): number {
  const delta = normalizeAngle(target - current);
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
