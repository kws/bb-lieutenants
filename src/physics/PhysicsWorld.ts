import RAPIER, {
  type Collider,
  type KinematicCharacterController,
  type RigidBody,
  type World,
} from "@dimforge/rapier3d-compat";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { PhysicsSpec, Vector3Data } from "../map/MapTypes";

export type PhysicsActorHandle = {
  rigidBody: RigidBody;
  collider: Collider;
  visualGroundY: number;
  centerOffsetY: number;
};

export type PhysicsHandle = {
  collider: Collider;
};

export class PhysicsWorld {
  readonly world: World;
  readonly characterController: KinematicCharacterController;

  private constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.characterController = this.world.createCharacterController(0.03);
  }

  static async create(): Promise<PhysicsWorld> {
    await RAPIER.init();
    return new PhysicsWorld();
  }

  step(dt: number): void {
    this.world.timestep = Math.min(1 / 30, Math.max(1 / 120, dt));
    this.world.step();
  }

  createGround(width: number, depth: number, y = -0.08): PhysicsHandle {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, y, 0));
    const collider = this.world.createCollider(RAPIER.ColliderDesc.cuboid(width * 0.5, 0.08, depth * 0.5), body);
    return { collider };
  }

  createStaticBox(position: Vector3Data, size: Vector3Data, rotationY = 0): PhysicsHandle {
    const halfAngle = rotationY * 0.5;
    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(position.x, position.y + size.y * 0.5, position.z)
      .setRotation({ x: 0, y: Math.sin(halfAngle), z: 0, w: Math.cos(halfAngle) });
    const body = this.world.createRigidBody(bodyDesc);
    const collider = this.world.createCollider(RAPIER.ColliderDesc.cuboid(size.x * 0.5, size.y * 0.5, size.z * 0.5), body);
    return { collider };
  }

  createStaticCylinder(position: Vector3Data, radius: number, height: number): PhysicsHandle {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y + height * 0.5, position.z),
    );
    const collider = this.world.createCollider(RAPIER.ColliderDesc.cylinder(height * 0.5, radius), body);
    return { collider };
  }

  createStaticFromSpec(position: Vector3Data, physics: PhysicsSpec, rotationY = 0): PhysicsHandle | undefined {
    if (!physics.solid) return undefined;
    if (physics.shape === "box") return this.createStaticBox(position, physics.size, rotationY);
    return this.createStaticCylinder(position, physics.radius, physics.height);
  }

  createKinematicActor(position: Vector3Data, radius: number, height: number): PhysicsActorHandle {
    const centerOffsetY = height * 0.5 + radius;
    const centerY = position.y + centerOffsetY;
    const rigidBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(position.x, centerY, position.z),
    );
    const collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(height * 0.5, radius), rigidBody);
    return {
      rigidBody,
      collider,
      visualGroundY: position.y,
      centerOffsetY,
    };
  }

  moveActor(actor: PhysicsActorHandle, desired: Vector3): Vector3 {
    this.characterController.computeColliderMovement(actor.collider, {
      x: desired.x,
      y: desired.y,
      z: desired.z,
    });
    const corrected = this.characterController.computedMovement();
    const current = actor.rigidBody.translation();
    actor.rigidBody.setNextKinematicTranslation({
      x: current.x + corrected.x,
      y: current.y + corrected.y,
      z: current.z + corrected.z,
    });
    actor.visualGroundY = current.y + corrected.y - actor.centerOffsetY;
    return new Vector3(corrected.x, corrected.y, corrected.z);
  }

  setActorGroundPosition(actor: PhysicsActorHandle, position: Vector3Data): void {
    const bodyPosition = {
      x: position.x,
      y: position.y + actor.centerOffsetY,
      z: position.z,
    };
    actor.rigidBody.setNextKinematicTranslation(bodyPosition);
    actor.rigidBody.setTranslation(bodyPosition, true);
    actor.visualGroundY = position.y;
  }
}
