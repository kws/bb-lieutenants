import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import type { Scene } from "@babylonjs/core/scene";

export function createLighting(scene: Scene): void {
  const hemi = new HemisphericLight("light.hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.82;
  hemi.groundColor = new Color3(0.34, 0.39, 0.34);

  const sun = new DirectionalLight("light.sun", new Vector3(-0.45, -1, 0.55), scene);
  sun.position = new Vector3(40, 70, -30);
  sun.intensity = 0.78;
}

