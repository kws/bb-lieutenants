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
    if (!definition.url || definition.procedural) return;

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
    const meshes = this.createPlaceholderMeshes(definition, name);
    for (const mesh of meshes) {
      mesh.parent = root;
      mesh.isPickable = false;
    }
    return root;
  }

  private createPlaceholderMeshes(definition: AssetDefinition | undefined, name: string): AbstractMesh[] {
    if (definition?.procedural === "boat") return this.createBoatPlaceholderMeshes(name);
    if (definition?.procedural === "infantry") return this.createInfantryPlaceholderMeshes(name);
    return [this.createPlaceholderMesh(definition?.category ?? "prop", name)];
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

  private createBoatPlaceholderMeshes(name: string): AbstractMesh[] {
    const hullMaterial = new StandardMaterial(`${name}.boat.hull.material`, this.scene);
    hullMaterial.diffuseColor = new Color3(0.12, 0.34, 0.48);
    hullMaterial.specularColor = new Color3(0.06, 0.12, 0.16);

    const deckMaterial = new StandardMaterial(`${name}.boat.deck.material`, this.scene);
    deckMaterial.diffuseColor = new Color3(0.88, 0.9, 0.84);
    deckMaterial.specularColor = new Color3(0.06, 0.06, 0.05);

    const hull = MeshBuilder.CreateBox(`${name}.boat.hull`, { width: 1.35, height: 0.32, depth: 2.9 }, this.scene);
    hull.position.y = 0.16;
    hull.material = hullMaterial;

    const bow = MeshBuilder.CreateCylinder(
      `${name}.boat.bow`,
      { height: 0.36, diameterTop: 0, diameterBottom: 1.35, tessellation: 4 },
      this.scene,
    );
    bow.position.set(0, 0.18, 1.62);
    bow.rotation.z = Math.PI * 0.25;
    bow.scaling.z = 0.65;
    bow.material = hullMaterial;

    const cabin = MeshBuilder.CreateBox(`${name}.boat.cabin`, { width: 0.78, height: 0.48, depth: 0.82 }, this.scene);
    cabin.position.set(0, 0.56, -0.28);
    cabin.material = deckMaterial;

    return [hull, bow, cabin];
  }

  private createInfantryPlaceholderMeshes(name: string): AbstractMesh[] {
    const bodyMaterial = new StandardMaterial(`${name}.infantry.body.material`, this.scene);
    bodyMaterial.diffuseColor = new Color3(0.08, 0.28, 0.95);
    bodyMaterial.emissiveColor = new Color3(0.02, 0.06, 0.18);
    bodyMaterial.specularColor = new Color3(0.08, 0.08, 0.12);

    const headMaterial = new StandardMaterial(`${name}.infantry.head.material`, this.scene);
    headMaterial.diffuseColor = new Color3(0.95, 0.78, 0.48);
    headMaterial.specularColor = new Color3(0.08, 0.06, 0.04);

    const markerMaterial = new StandardMaterial(`${name}.infantry.marker.material`, this.scene);
    markerMaterial.diffuseColor = new Color3(0.95, 0.9, 0.18);
    markerMaterial.emissiveColor = new Color3(0.28, 0.22, 0.02);
    markerMaterial.specularColor = Color3.Black();

    const body = MeshBuilder.CreateCylinder(`${name}.infantry.body`, { diameter: 0.62, height: 1.05, tessellation: 12 }, this.scene);
    body.position.y = 0.58;
    body.material = bodyMaterial;

    const head = MeshBuilder.CreateSphere(`${name}.infantry.head`, { diameter: 0.44, segments: 12 }, this.scene);
    head.position.y = 1.28;
    head.material = headMaterial;

    const base = MeshBuilder.CreateCylinder(`${name}.infantry.base`, { diameter: 0.9, height: 0.08, tessellation: 24 }, this.scene);
    base.position.y = 0.04;
    base.material = markerMaterial;

    return [base, body, head];
  }
}
