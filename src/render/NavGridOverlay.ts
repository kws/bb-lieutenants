import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { movementIndex, type MovementLayer } from "../nav/MovementLayer";

export class NavGridOverlay {
  root: TransformNode;

  constructor(
    private readonly scene: Scene,
    layer: MovementLayer,
  ) {
    this.root = this.createRoot(layer, false);
  }

  setLayer(layer: MovementLayer): void {
    const enabled = this.root.isEnabled();
    for (const mesh of this.root.getChildMeshes(false)) mesh.dispose();
    this.root.dispose();
    this.root = this.createRoot(layer, enabled);
  }

  toggle(): void {
    this.root.setEnabled(!this.root.isEnabled());
  }

  private createRoot(layer: MovementLayer, enabled: boolean): TransformNode {
    const root = new TransformNode("debug.navGrid", this.scene);
    const blockedMaterial = getMaterial(this.scene, "debug.navGrid.blocked", new Color3(0.95, 0.16, 0.12), 0.34);
    const roadMaterial = getMaterial(this.scene, "debug.navGrid.road", new Color3(0.1, 0.58, 0.95), 0.18);
    const waterMaterial = getMaterial(this.scene, "debug.navGrid.water", new Color3(0.05, 0.65, 0.85), 0.2);

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
            this.scene,
          );
          tile.position.set(center.x, node.sampleY + 0.09, center.z);
          tile.material = node.walkable ? (grid.surfaceId.startsWith("water.") ? waterMaterial : roadMaterial) : blockedMaterial;
          tile.isPickable = false;
          tile.parent = root;
        }
      }
    }

    root.setEnabled(enabled);
    return root;
  }
}

function getMaterial(scene: Scene, name: string, color: Color3, alpha: number): StandardMaterial {
  const existing = scene.getMaterialByName(name);
  if (existing instanceof StandardMaterial) return existing;

  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.alpha = alpha;
  material.specularColor = Color3.Black();
  return material;
}
