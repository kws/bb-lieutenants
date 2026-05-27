import "@babylonjs/loaders/glTF";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Scene } from "@babylonjs/core/scene";
import type { AssetDefinition, AssetRegistry } from "../map/MapTypes";
import { assetUrl } from "../utils/basePath";

export class AssetManager {
  private registry: AssetRegistry = {};
  private containers = new Map<string, AssetContainer>();

  constructor(private readonly scene: Scene) {}

  async loadRegistry(url: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load asset registry ${url}: ${response.status} ${response.statusText}`);
    }
    this.registry = (await response.json()) as AssetRegistry;
  }

  getDefinition(assetId: string): AssetDefinition {
    const definition = this.registry[assetId];
    if (!definition) {
      throw new Error(`Unknown asset id: ${assetId}`);
    }
    return definition;
  }

  async preloadAsset(assetId: string): Promise<void> {
    if (this.containers.has(assetId)) return;
    const definition = this.getDefinition(assetId);
    const url = assetUrl(definition.url);

    try {
      const container = await SceneLoader.LoadAssetContainerAsync("", url, this.scene);
      for (const mesh of container.meshes) {
        mesh.isPickable = false;
      }
      this.containers.set(assetId, container);
    } catch (error) {
      console.error(`Failed to load asset "${assetId}" from ${url}`, error);
    }
  }

  async preloadAssets(assetIds: Iterable<string>): Promise<void> {
    await Promise.all([...new Set(assetIds)].map((assetId) => this.preloadAsset(assetId)));
  }

  instantiate(assetId: string, name: string): TransformNode {
    const container = this.containers.get(assetId);
    if (!container) {
      return this.createPlaceholder(assetId, name);
    }

    const root = new TransformNode(name, this.scene);
    const entries = container.instantiateModelsToScene((sourceName) => `${name}.${sourceName}`, false);
    for (const node of entries.rootNodes) {
      node.parent = root;
    }
    for (const mesh of root.getChildMeshes(false)) {
      mesh.isPickable = false;
    }
    return root;
  }

  private createPlaceholder(assetId: string, name: string): TransformNode {
    const definition = this.registry[assetId];
    const root = new TransformNode(name, this.scene);
    const mesh = this.createPlaceholderMesh(definition?.category ?? "prop", name);
    mesh.parent = root;
    mesh.isPickable = false;
    return root;
  }

  private createPlaceholderMesh(category: AssetDefinition["category"], name: string): AbstractMesh {
    const color = category === "vehicle" ? new Color3(0.85, 0.25, 0.18) : new Color3(0.8, 0.72, 0.45);
    const material = new StandardMaterial(`${name}.placeholder.material`, this.scene);
    material.diffuseColor = color;
    material.specularColor = new Color3(0.05, 0.05, 0.05);

    const mesh =
      category === "vegetation" || category === "rock"
        ? MeshBuilder.CreateCylinder(`${name}.placeholder`, { diameter: 1.4, height: 2.2 }, this.scene)
        : MeshBuilder.CreateBox(`${name}.placeholder`, { size: 1.5 }, this.scene);
    mesh.material = material;
    return mesh;
  }
}
