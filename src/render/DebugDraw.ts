import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import type { Scene } from "@babylonjs/core/scene";
import type { WorldPoint } from "../nav/NavTypes";

export class DebugDraw {
  private pathMesh?: LinesMesh;

  constructor(private readonly scene: Scene) {}

  drawPath(points: WorldPoint[]): void {
    this.pathMesh?.dispose();
    if (points.length < 2) return;

    this.pathMesh = MeshBuilder.CreateLines(
      "debug.path",
      {
        points: points.map((point) => new Vector3(point.x, 0.18, point.z)),
      },
      this.scene,
    );
    this.pathMesh.color = new Color3(0.95, 0.92, 0.24);
    this.pathMesh.isPickable = false;
  }

  setPathVisible(visible: boolean): void {
    if (this.pathMesh) this.pathMesh.setEnabled(visible);
  }
}

