import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Viewport } from "@babylonjs/core/Maths/math.viewport";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Scene } from "@babylonjs/core/scene";
import type { Actor } from "../sim/Actor";
import { VEHICLE_SKY_LAYER_MASK, WORLD_LAYER_MASK } from "./RenderLayers";

const CAMERA_FORWARD_OFFSET = 3.8;
const CAMERA_HEIGHT = 3.4;
const TARGET_HEIGHT = 1.7;
const LOOK_AHEAD = 24;

export class VehicleCameraInset {
  readonly camera: FreeCamera;

  constructor(scene: Scene) {
    this.camera = new FreeCamera("camera.vehicle-inset", Vector3.Zero(), scene);
    this.camera.viewport = new Viewport(0.68, 0.04, 0.28, 0.24);
    this.camera.layerMask = WORLD_LAYER_MASK | VEHICLE_SKY_LAYER_MASK;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 220;
    this.camera.fov = 1.05;

    createVehicleSky(scene);
  }

  update(actor: Actor): void {
    const forward = new Vector3(Math.sin(actor.rotationY), 0, Math.cos(actor.rotationY));
    const position = actor.position
      .add(forward.scale(CAMERA_FORWARD_OFFSET))
      .add(new Vector3(0, CAMERA_HEIGHT, 0));
    const target = actor.position
      .add(forward.scale(LOOK_AHEAD))
      .add(new Vector3(0, TARGET_HEIGHT, 0));

    this.camera.position.copyFrom(position);
    this.camera.setTarget(target);
  }
}

function createVehicleSky(scene: Scene): void {
  if (scene.getMeshByName("vehicle.inset.sky")) return;

  const material = new StandardMaterial("vehicle.inset.sky.material", scene);
  material.disableLighting = true;
  material.diffuseColor = new Color3(0.56, 0.73, 0.92);
  material.emissiveColor = new Color3(0.56, 0.73, 0.92);
  material.specularColor = Color3.Black();
  material.backFaceCulling = false;

  const sky = MeshBuilder.CreateSphere(
    "vehicle.inset.sky",
    { diameter: 420, segments: 24, sideOrientation: Mesh.BACKSIDE },
    scene,
  );
  sky.layerMask = VEHICLE_SKY_LAYER_MASK;
  sky.infiniteDistance = true;
  sky.isPickable = false;
  sky.material = material;
}
