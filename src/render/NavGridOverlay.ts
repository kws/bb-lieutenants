import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { cellToWorldCenter, NavGrid } from "../nav/NavGrid";

export class NavGridOverlay {
  readonly root: TransformNode;

  constructor(scene: Scene, grid: NavGrid) {
    this.root = new TransformNode("debug.navGrid", scene);
    const blockedMaterial = new StandardMaterial("debug.navGrid.blocked", scene);
    blockedMaterial.diffuseColor = new Color3(0.95, 0.16, 0.12);
    blockedMaterial.alpha = 0.34;
    blockedMaterial.specularColor = Color3.Black();

    const roadMaterial = new StandardMaterial("debug.navGrid.road", scene);
    roadMaterial.diffuseColor = new Color3(0.1, 0.58, 0.95);
    roadMaterial.alpha = 0.18;
    roadMaterial.specularColor = Color3.Black();

    for (let cz = 0; cz < grid.depthCells; cz += 1) {
      for (let cx = 0; cx < grid.widthCells; cx += 1) {
        const cell = grid.get(cx, cz);
        if (cell.walkable && cell.terrainCost > 1.05) continue;
        const center = cellToWorldCenter(cx, cz, grid);
        const tile = MeshBuilder.CreateGround(
          `debug.navGrid.${cx}.${cz}`,
          { width: grid.cellSize * 0.92, height: grid.cellSize * 0.92 },
          scene,
        );
        tile.position.set(center.x, 0.09, center.z);
        tile.material = cell.walkable ? roadMaterial : blockedMaterial;
        tile.isPickable = false;
        tile.parent = this.root;
      }
    }

    this.root.setEnabled(false);
  }

  toggle(): void {
    this.root.setEnabled(!this.root.isEnabled());
  }
}

