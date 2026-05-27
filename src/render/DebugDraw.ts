import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";
import type { WorldPoint } from "../nav/NavTypes";
import { DEBUG_LAYER_MASK } from "./RenderLayers";

export class DebugDraw {
  private pathMesh?: Mesh;

  constructor(private readonly scene: Scene) {}

  drawPath(points: WorldPoint[]): void {
    this.pathMesh?.dispose();
    if (points.length < 2) return;

    this.pathMesh = MeshBuilder.CreateTube(
      "debug.path",
      {
        path: points.map((point) => new Vector3(point.x, 0.35, point.z)),
        radius: 0.16,
        tessellation: 8,
        cap: Mesh.CAP_ALL,
      },
      this.scene,
    );
    this.pathMesh.layerMask = DEBUG_LAYER_MASK;
    this.pathMesh.material = getPathMaterial(this.scene);
    this.pathMesh.isPickable = false;
  }

  setPathVisible(visible: boolean): void {
    if (this.pathMesh) this.pathMesh.setEnabled(visible);
  }
}

function getPathMaterial(scene: Scene): StandardMaterial {
  const existing = scene.getMaterialByName("debug.path.material");
  if (existing instanceof StandardMaterial) return existing;

  const material = new StandardMaterial("debug.path.material", scene);
  material.diffuseColor = new Color3(0.98, 0.92, 0.18);
  material.emissiveColor = new Color3(0.98, 0.86, 0.08);
  material.specularColor = Color3.Black();
  return material;
}
