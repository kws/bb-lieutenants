import type { MapDefinition } from "./MapTypes";

export async function loadMap(url: string): Promise<MapDefinition> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load map ${url}: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as unknown;
  assertMapDefinition(data);
  return data;
}

function assertMapDefinition(data: unknown): asserts data is MapDefinition {
  if (!isRecord(data)) throw new Error("Map JSON must be an object.");
  if (data.version !== 1) throw new Error("Map version must be 1.");
  if (typeof data.name !== "string") throw new Error("Map name must be a string.");
  if (!isRecord(data.size)) throw new Error("Map size is required.");
  if (!Number.isFinite(data.size.cellsX) || !Number.isFinite(data.size.cellsZ) || !Number.isFinite(data.size.cellSize)) {
    throw new Error("Map size must include numeric cellsX, cellsZ, and cellSize.");
  }
  if (!Array.isArray(data.placements)) throw new Error("Map placements must be an array.");
  if (!Array.isArray(data.actors) || data.actors.length < 1) throw new Error("Map must include at least one actor.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

