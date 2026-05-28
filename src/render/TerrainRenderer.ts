import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { Scene } from "@babylonjs/core/scene";
import { TerrainWorld, waterSurfaceId, type RuntimeSurface } from "../terrain/TerrainWorld";

export function createTerrainMeshes(scene: Scene, terrain: TerrainWorld): Mesh[] {
  const meshes: Mesh[] = [];

  for (const surfaceId of terrain.getSurfaceIds()) {
    const surface = terrain.getSurface(surfaceId);
    if (!surface || surface.kind === "waterSurface") continue;
    const mesh = surface.kind === "heightfield" ? createHeightfieldMesh(scene, terrain, surface) : createFlatSurfaceMesh(scene, surface);
    mesh.metadata = {
      ...(mesh.metadata ?? {}),
      terrainSurfaceId: surface.id,
      terrainUnderground: isUndergroundSurface(surface),
    };
    mesh.isPickable = true;
    meshes.push(mesh);
  }

  for (const water of terrain.waterBodies) {
    const mesh = createPolygonSurfaceMesh(
      scene,
      `terrain.water.${water.id}`,
      water.polygon,
      water.surface.y + 0.03,
    );
    mesh.metadata = { terrainSurfaceId: waterSurfaceId(water.id), terrainWaterBodyId: water.id };
    mesh.isPickable = true;
    mesh.material = getWaterMaterial(scene, water.waterType);
    meshes.push(mesh);
  }

  for (const surfaceId of terrain.getSurfaceIds()) {
    const surface = terrain.getSurface(surfaceId);
    if (!surface || !isUndergroundSurface(surface)) continue;
    meshes.push(...createUndergroundVisibilityMeshes(scene, terrain, surface));
  }

  return meshes;
}

export function setUndergroundTerrainVisible(meshes: Mesh[], visible: boolean): void {
  for (const mesh of meshes) {
    if (mesh.metadata?.terrainUnderground !== true) continue;
    mesh.setEnabled(visible);
    mesh.isPickable = visible && typeof mesh.metadata?.terrainSurfaceId === "string";
  }
}

function isUndergroundSurface(surface: RuntimeSurface): boolean {
  return surface.kind === "tunnel" || surface.kind === "cave";
}

function createHeightfieldMesh(scene: Scene, terrain: TerrainWorld, surface: RuntimeSurface): Mesh {
  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  for (let cz = 0; cz <= surface.cellsZ; cz += 1) {
    for (let cx = 0; cx <= surface.cellsX; cx += 1) {
      const x = surface.origin.x + cx * surface.cellSize;
      const z = surface.origin.z + cz * surface.cellSize;
      const y = terrain.sampleSurface(surface.id, x, z)?.position.y ?? 0;
      positions.push(x, y, z);
      uvs.push(cx / surface.cellsX, cz / surface.cellsZ);
    }
  }

  for (let cz = 0; cz < surface.cellsZ; cz += 1) {
    for (let cx = 0; cx < surface.cellsX; cx += 1) {
      const a = cz * (surface.cellsX + 1) + cx;
      const b = a + 1;
      const c = a + surface.cellsX + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  VertexData.ComputeNormals(positions, indices, normals);
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;

  const mesh = new Mesh(`terrain.surface.${surface.id}`, scene);
  vertexData.applyToMesh(mesh);
  mesh.material = getSurfaceMaterial(scene, surface.kind, surface.id);
  mesh.alwaysSelectAsActiveMesh = true;
  return mesh;
}

function createFlatSurfaceMesh(scene: Scene, surface: RuntimeSurface): Mesh {
  const mesh = MeshBuilder.CreateGround(
    `terrain.surface.${surface.id}`,
    { width: surface.cellsX * surface.cellSize, height: surface.cellsZ * surface.cellSize, subdivisions: 1 },
    scene,
  );
  mesh.position.set(
    surface.origin.x + surface.cellsX * surface.cellSize * 0.5,
    surface.y ?? 0,
    surface.origin.z + surface.cellsZ * surface.cellSize * 0.5,
  );
  mesh.material = getSurfaceMaterial(scene, surface.kind, surface.id);
  mesh.alwaysSelectAsActiveMesh = true;
  return mesh;
}

function createUndergroundVisibilityMeshes(scene: Scene, terrain: TerrainWorld, surface: RuntimeSurface): Mesh[] {
  const meshes: Mesh[] = [];
  const cutaway = createUndergroundCutawayMesh(scene, terrain, surface);
  meshes.push(cutaway);

  const portals = terrain.portals.filter((portal) => portal.to.surfaceId === surface.id || portal.from.surfaceId === surface.id);
  for (const portal of portals) {
    const outside = portal.to.surfaceId === surface.id ? portal.from : portal.to;
    const inside = portal.to.surfaceId === surface.id ? portal.to : portal.from;
    meshes.push(...createUndergroundPortalMeshes(scene, terrain, outside.x, outside.z, inside.x, inside.z, portal.id));
  }

  return meshes;
}

function createUndergroundCutawayMesh(scene: Scene, terrain: TerrainWorld, surface: RuntimeSurface): Mesh {
  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const yOffset = 0.12;

  for (let cz = 0; cz <= surface.cellsZ; cz += 1) {
    for (let cx = 0; cx <= surface.cellsX; cx += 1) {
      const x = surface.origin.x + cx * surface.cellSize;
      const z = surface.origin.z + cz * surface.cellSize;
      const ground = terrain.sampleBestSurface(x, z, { includeLand: true, includeWaterSurface: false });
      const y = (ground?.position.y ?? 0) + yOffset;
      positions.push(x, y, z);
      uvs.push(cx / surface.cellsX, cz / surface.cellsZ);
    }
  }

  for (let cz = 0; cz < surface.cellsZ; cz += 1) {
    for (let cx = 0; cx < surface.cellsX; cx += 1) {
      const a = cz * (surface.cellsX + 1) + cx;
      const b = a + 1;
      const c = a + surface.cellsX + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  VertexData.ComputeNormals(positions, indices, normals);
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;

  const mesh = new Mesh(`terrain.underground.cutaway.${surface.id}`, scene);
  vertexData.applyToMesh(mesh);
  mesh.material = getUndergroundCutawayMaterial(scene);
  mesh.isPickable = false;
  mesh.metadata = { terrainUnderground: true };
  mesh.alwaysSelectAsActiveMesh = true;
  return mesh;
}

function createUndergroundPortalMeshes(
  scene: Scene,
  terrain: TerrainWorld,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  id: string,
): Mesh[] {
  const base = terrain.sampleBestSurface(fromX, fromZ, { includeLand: true, includeWaterSurface: false })?.position.y ?? 0;
  const axisX = Math.abs(toX - fromX) >= Math.abs(toZ - fromZ);
  const frameMaterial = getUndergroundPortalMaterial(scene);
  const openingMaterial = getUndergroundOpeningMaterial(scene);
  const meshes: Mesh[] = [];

  const makeBox = (name: string, size: { width: number; height: number; depth: number }, position: { x: number; y: number; z: number }, material: StandardMaterial): Mesh => {
    const mesh = MeshBuilder.CreateBox(name, size, scene);
    mesh.position.set(position.x, position.y, position.z);
    mesh.material = material;
    mesh.isPickable = false;
    mesh.metadata = { terrainUnderground: true };
    meshes.push(mesh);
    return mesh;
  };

  if (axisX) {
    makeBox(
      `terrain.underground.portal.${id}.left`,
      { width: 0.7, height: 2.6, depth: 0.5 },
      { x: fromX, y: base + 1.3, z: fromZ - 2.45 },
      frameMaterial,
    );
    makeBox(
      `terrain.underground.portal.${id}.right`,
      { width: 0.7, height: 2.6, depth: 0.5 },
      { x: fromX, y: base + 1.3, z: fromZ + 2.45 },
      frameMaterial,
    );
    makeBox(
      `terrain.underground.portal.${id}.top`,
      { width: 0.8, height: 0.55, depth: 5.4 },
      { x: fromX, y: base + 2.85, z: fromZ },
      frameMaterial,
    );
    makeBox(
      `terrain.underground.portal.${id}.opening`,
      { width: 0.16, height: 2.1, depth: 4.1 },
      { x: fromX + Math.sign(toX - fromX || 1) * 0.08, y: base + 1.05, z: fromZ },
      openingMaterial,
    );
  } else {
    makeBox(
      `terrain.underground.portal.${id}.left`,
      { width: 0.5, height: 2.6, depth: 0.7 },
      { x: fromX - 2.45, y: base + 1.3, z: fromZ },
      frameMaterial,
    );
    makeBox(
      `terrain.underground.portal.${id}.right`,
      { width: 0.5, height: 2.6, depth: 0.7 },
      { x: fromX + 2.45, y: base + 1.3, z: fromZ },
      frameMaterial,
    );
    makeBox(
      `terrain.underground.portal.${id}.top`,
      { width: 5.4, height: 0.55, depth: 0.8 },
      { x: fromX, y: base + 2.85, z: fromZ },
      frameMaterial,
    );
    makeBox(
      `terrain.underground.portal.${id}.opening`,
      { width: 4.1, height: 2.1, depth: 0.16 },
      { x: fromX, y: base + 1.05, z: fromZ + Math.sign(toZ - fromZ || 1) * 0.08 },
      openingMaterial,
    );
  }

  return meshes;
}

function getSurfaceMaterial(scene: Scene, kind: RuntimeSurface["kind"], id: string): StandardMaterial {
  const name = `terrain.material.${id}`;
  const existing = scene.getMaterialByName(name);
  if (existing instanceof StandardMaterial) return existing;

  const material = new StandardMaterial(name, scene);
  material.specularColor = new Color3(0.04, 0.04, 0.04);
  material.backFaceCulling = false;
  if (kind === "deck") {
    material.diffuseColor = new Color3(1, 1, 1);
    material.ambientColor = new Color3(0.28, 0.28, 0.24);
    material.emissiveColor = new Color3(0.08, 0.08, 0.07);
    material.diffuseTexture = createPatternTexture(scene, `${name}.texture`, {
      base: "#8a897f",
      line: "#66645c",
      fleck: "#aaa899",
      grid: 32,
      repeat: 12,
    });
  } else if (kind === "tunnel") {
    material.diffuseColor = new Color3(1, 1, 1);
    material.ambientColor = new Color3(0.18, 0.17, 0.15);
    material.emissiveColor = new Color3(0.05, 0.045, 0.04);
    material.diffuseTexture = createPatternTexture(scene, `${name}.texture`, {
      base: "#655f55",
      line: "#453f37",
      fleck: "#83796a",
      grid: 28,
      repeat: 8,
    });
  } else if (kind === "cave") {
    material.diffuseColor = new Color3(1, 1, 1);
    material.ambientColor = new Color3(0.12, 0.12, 0.13);
    material.emissiveColor = new Color3(0.035, 0.032, 0.038);
    material.diffuseTexture = createPatternTexture(scene, `${name}.texture`, {
      base: "#4e514d",
      line: "#343733",
      fleck: "#74786f",
      grid: 20,
      repeat: 8,
    });
  } else {
    material.diffuseColor = new Color3(1, 1, 1);
    material.ambientColor = new Color3(0.2, 0.28, 0.16);
    material.emissiveColor = new Color3(0.08, 0.12, 0.05);
    material.diffuseTexture = createPatternTexture(scene, `${name}.texture`, {
      base: "#78a85a",
      line: "#558044",
      fleck: "#9fc978",
      grid: 24,
      repeat: 28,
    });
  }
  return material;
}

function getUndergroundCutawayMaterial(scene: Scene): StandardMaterial {
  const name = "terrain.material.underground.cutaway";
  const existing = scene.getMaterialByName(name);
  if (existing instanceof StandardMaterial) return existing;

  const material = new StandardMaterial(name, scene);
  material.diffuseColor = new Color3(0.85, 0.52, 0.14);
  material.emissiveColor = new Color3(0.18, 0.09, 0.02);
  material.specularColor = new Color3(0.03, 0.025, 0.02);
  material.alpha = 0.38;
  material.backFaceCulling = false;
  return material;
}

function getUndergroundPortalMaterial(scene: Scene): StandardMaterial {
  const name = "terrain.material.underground.portal";
  const existing = scene.getMaterialByName(name);
  if (existing instanceof StandardMaterial) return existing;

  const material = new StandardMaterial(name, scene);
  material.diffuseColor = new Color3(0.5, 0.48, 0.42);
  material.ambientColor = new Color3(0.18, 0.17, 0.15);
  material.emissiveColor = new Color3(0.04, 0.035, 0.03);
  material.specularColor = new Color3(0.04, 0.04, 0.04);
  return material;
}

function getUndergroundOpeningMaterial(scene: Scene): StandardMaterial {
  const name = "terrain.material.underground.opening";
  const existing = scene.getMaterialByName(name);
  if (existing instanceof StandardMaterial) return existing;

  const material = new StandardMaterial(name, scene);
  material.diffuseColor = new Color3(0.03, 0.03, 0.035);
  material.emissiveColor = new Color3(0.01, 0.01, 0.012);
  material.specularColor = new Color3(0, 0, 0);
  return material;
}

function getWaterMaterial(scene: Scene, waterType: string): StandardMaterial {
  const name = `terrain.material.water.${waterType}`;
  const existing = scene.getMaterialByName(name);
  if (existing instanceof StandardMaterial) return existing;

  const material = new StandardMaterial(name, scene);
  material.diffuseColor = waterType === "muddy" ? new Color3(0.85, 0.95, 0.86) : new Color3(0.82, 0.94, 1);
  material.ambientColor = waterType === "toxic" ? new Color3(0.05, 0.22, 0.06) : new Color3(0.06, 0.14, 0.22);
  material.emissiveColor = waterType === "toxic" ? new Color3(0.05, 0.22, 0.06) : new Color3(0.02, 0.07, 0.11);
  material.specularColor = new Color3(0.28, 0.42, 0.5);
  material.alpha = 0.86;
  material.backFaceCulling = false;
  material.diffuseTexture = createPatternTexture(scene, `${name}.texture`, {
    base: waterType === "muddy" ? "#3e5a50" : "#286f9d",
    line: waterType === "muddy" ? "#29443d" : "#1d5478",
    fleck: waterType === "muddy" ? "#587568" : "#5ba9cc",
    grid: 36,
    repeat: 10,
  });
  return material;
}

function createPolygonSurfaceMesh(scene: Scene, name: string, points: Array<{ x: number; z: number }>, y: number): Mesh {
  const bounds = polygonBounds(points);
  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  for (const point of points) {
    positions.push(point.x, y, point.z);
    uvs.push(
      bounds.width > 0 ? (point.x - bounds.minX) / bounds.width : 0,
      bounds.depth > 0 ? (point.z - bounds.minZ) / bounds.depth : 0,
    );
  }

  for (let i = 1; i < points.length - 1; i += 1) {
    indices.push(0, i, i + 1);
  }

  VertexData.ComputeNormals(positions, indices, normals);
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;

  const mesh = new Mesh(name, scene);
  vertexData.applyToMesh(mesh);
  mesh.alwaysSelectAsActiveMesh = true;
  return mesh;
}

function createPatternTexture(
  scene: Scene,
  name: string,
  options: { base: string; line: string; fleck: string; grid: number; repeat: number },
): DynamicTexture {
  const texture = new DynamicTexture(name, { width: 256, height: 256 }, scene, true, Texture.TRILINEAR_SAMPLINGMODE);
  const context = texture.getContext();
  context.fillStyle = options.base;
  context.fillRect(0, 0, 256, 256);

  context.strokeStyle = options.line;
  context.lineWidth = 2;
  for (let p = 0; p <= 256; p += options.grid) {
    context.globalAlpha = 0.38;
    context.beginPath();
    context.moveTo(p, 0);
    context.lineTo(p, 256);
    context.stroke();
    context.beginPath();
    context.moveTo(0, p);
    context.lineTo(256, p);
    context.stroke();
  }

  context.globalAlpha = 0.42;
  context.fillStyle = options.fleck;
  for (let i = 0; i < 180; i += 1) {
    const x = (i * 53) % 256;
    const y = (i * 97) % 256;
    const size = 1 + ((i * 17) % 4);
    context.fillRect(x, y, size, size);
  }

  context.globalAlpha = 1;
  texture.update(false);
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.uScale = options.repeat;
  texture.vScale = options.repeat;
  return texture;
}

function polygonBounds(points: Array<{ x: number; z: number }>): {
  minX: number;
  minZ: number;
  width: number;
  depth: number;
} {
  const xs = points.map((point) => point.x);
  const zs = points.map((point) => point.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  return {
    minX,
    minZ,
    width: maxX - minX,
    depth: maxZ - minZ,
  };
}
