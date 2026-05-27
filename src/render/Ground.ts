import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";

export function createGround(scene: Scene, width: number, depth: number): Mesh {
  const ground = MeshBuilder.CreateGround("ground.pickable", { width, height: depth, subdivisions: 4 }, scene);
  ground.isPickable = true;

  const material = new StandardMaterial("material.ground", scene);
  material.diffuseColor = new Color3(0.28, 0.48, 0.28);
  material.specularColor = new Color3(0.03, 0.04, 0.03);
  ground.material = material;

  return ground;
}

