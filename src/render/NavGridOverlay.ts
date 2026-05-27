import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { movementIndex, type MovementLayer } from "../nav/MovementLayer";

export class NavGridOverlay {
  readonly root: TransformNode;

  constructor(scene: Scene, layer: MovementLayer) {
    this.root = new TransformNode("debug.navGrid", scene);
    const blockedMaterial = new StandardMaterial("debug.navGrid.blocked", scene);
    blockedMaterial.diffuseColor = new Color3(0.95, 0.16, 0.12);
    blockedMaterial.alpha = 0.34;
    blockedMaterial.specularColor = Color3.Black();

    const roadMaterial = new StandardMaterial("debug.navGrid.road", scene);
    roadMaterial.diffuseColor = new Color3(0.1, 0.58, 0.95);
    roadMaterial.alpha = 0.18;
    roadMaterial.specularColor = Color3.Black();

    const waterMaterial = new StandardMaterial("debug.navGrid.water", scene);
    waterMaterial.diffuseColor = new Color3(0.05, 0.65, 0.85);
    waterMaterial.alpha = 0.2;
    waterMaterial.specularColor = Color3.Black();

    for (const grid of Object.values(layer.surfaces)) {
      for (let cz = 0; cz < grid.depthCells; cz += 1) {
        for (let cx = 0; cx < grid.widthCells; cx += 1) {
          const node = grid.nodes[movementIndex(grid, cx, cz)];
          const isPreferred = node.walkable && (node.material === "road" || node.overlays.length > 0 || grid.surfaceId.startsWith("water."));
          if (node.walkable && !isPreferred) continue;
          const center = layer.terrain.surfaceCellToWorld(grid.surfaceId, cx, cz);
          if (!center) continue;
          const tile = MeshBuilder.CreateGround(
            `debug.navGrid.${grid.surfaceId}.${cx}.${cz}`,
            { width: grid.cellSize * 0.92, height: grid.cellSize * 0.92 },
            scene,
          );
          tile.position.set(center.x, node.sampleY + 0.09, center.z);
          tile.material = node.walkable ? (grid.surfaceId.startsWith("water.") ? waterMaterial : roadMaterial) : blockedMaterial;
          tile.isPickable = false;
          tile.parent = this.root;
        }
      }
    }

    this.root.setEnabled(false);
  }

  toggle(): void {
    this.root.setEnabled(!this.root.isEnabled());
  }
}
