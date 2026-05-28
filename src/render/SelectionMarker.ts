import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Scene } from "@babylonjs/core/scene";
import type { Actor } from "../sim/Actor";
import { DEBUG_LAYER_MASK } from "./RenderLayers";

export class SelectionMarker {
  private readonly mesh: Mesh;

  constructor(scene: Scene) {
    const material = new StandardMaterial("selection.marker.material", scene);
    material.diffuseColor = new Color3(0.98, 0.9, 0.18);
    material.emissiveColor = new Color3(0.8, 0.62, 0.06);
    material.specularColor = Color3.Black();
    material.alpha = 0.28;

    this.mesh = MeshBuilder.CreateCylinder("selection.marker", { diameter: 1, height: 0.04, tessellation: 48 }, scene);
    this.mesh.material = material;
    this.mesh.isPickable = false;
    this.mesh.layerMask = DEBUG_LAYER_MASK;
  }

  update(actor: Actor): void {
    const diameter = Math.max(2.4, actor.movement.radius * 3.2);
    this.mesh.position.set(actor.position.x, actor.position.y + 0.08, actor.position.z);
    this.mesh.scaling.set(diameter, 1, diameter);
  }
}
