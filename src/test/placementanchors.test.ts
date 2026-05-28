import { describe, expect, it } from "vitest";
import type { MapDefinition } from "../map/MapTypes";
import { resolvePlacementAnchor } from "../map/PlacementAnchors";
import { TerrainWorld, waterSurfaceId } from "../terrain/TerrainWorld";

describe("resolvePlacementAnchor", () => {
  it("resolves surface anchors from interpolated terrain height plus offset", () => {
    const terrain = new TerrainWorld(createHeightfieldMap());
    const resolved = resolvePlacementAnchor(
      terrain,
      { kind: "surface", surfaceId: "ground.overworld", x: 1, z: 1, offsetY: 0.25 },
      undefined,
    );

    expect(resolved.surfaceId).toBe("ground.overworld");
    expect(resolved.position.x).toBe(1);
    expect(resolved.position.y).toBeCloseTo(1.25);
    expect(resolved.position.z).toBe(1);
  });

  it("uses the named stacked surface instead of the highest surface at the same x/z", () => {
    const terrain = new TerrainWorld(createStackedMap());
    const deck = resolvePlacementAnchor(terrain, { kind: "surface", surfaceId: "bridge.deck.test", x: 1, z: 1 }, undefined);
    const tunnel = resolvePlacementAnchor(terrain, { kind: "surface", surfaceId: "tunnel.floor.test", x: 1, z: 1 }, undefined);

    expect(deck).toEqual({
      surfaceId: "bridge.deck.test",
      position: { x: 1, y: 2, z: 1 },
    });
    expect(tunnel).toEqual({
      surfaceId: "tunnel.floor.test",
      position: { x: 1, y: -1, z: 1 },
    });
  });

  it("resolves water-surface anchors to the runtime water surface plus offset", () => {
    const terrain = new TerrainWorld(createWaterMap({ bottomY: -2, waterY: 0.5 }));
    const resolved = resolvePlacementAnchor(
      terrain,
      { kind: "waterSurface", waterBodyId: "lake.test", x: 1, z: 1, offsetY: 0.2 },
      undefined,
    );

    expect(resolved).toEqual({
      surfaceId: waterSurfaceId("lake.test"),
      position: { x: 1, y: 0.7, z: 1 },
    });
  });

  it("rejects water-surface anchors outside water or over dry bottom terrain", () => {
    const wetTerrain = new TerrainWorld(createWaterMap({ bottomY: -2, waterY: 0.5 }));
    const dryTerrain = new TerrainWorld(createWaterMap({ bottomY: 1, waterY: 0.5 }));

    expect(() =>
      resolvePlacementAnchor(wetTerrain, { kind: "waterSurface", waterBodyId: "lake.test", x: 3, z: 3 }, undefined),
    ).toThrow("Water anchor is outside water body lake.test: 3,3");
    expect(() =>
      resolvePlacementAnchor(dryTerrain, { kind: "waterSurface", waterBodyId: "lake.test", x: 1, z: 1 }, undefined),
    ).toThrow("Water anchor is outside water body lake.test: 1,1");
  });

  it("preserves authored y for absolute anchors while inferring the best surface", () => {
    const terrain = new TerrainWorld(createStackedMap());
    const resolved = resolvePlacementAnchor(
      terrain,
      { kind: "absolute", position: { x: 1, y: 42, z: 1 } },
      undefined,
    );

    expect(resolved).toEqual({
      surfaceId: "bridge.deck.test",
      position: { x: 1, y: 42, z: 1 },
    });
  });

  it("treats legacy positions like absolute anchors and requires one placement source", () => {
    const terrain = new TerrainWorld(createStackedMap());
    const resolved = resolvePlacementAnchor(terrain, undefined, { x: 1, y: -7, z: 1 });

    expect(resolved).toEqual({
      surfaceId: "bridge.deck.test",
      position: { x: 1, y: -7, z: 1 },
    });
    expect(() => resolvePlacementAnchor(terrain, undefined, undefined)).toThrow(
      "Map item must define either position or anchor.",
    );
  });

  it("rejects missing or out-of-bounds surface anchors", () => {
    const terrain = new TerrainWorld(createHeightfieldMap());

    expect(() =>
      resolvePlacementAnchor(terrain, { kind: "surface", surfaceId: "missing.surface", x: 1, z: 1 }, undefined),
    ).toThrow("Surface anchor is outside surface missing.surface: 1,1");
    expect(() =>
      resolvePlacementAnchor(terrain, { kind: "surface", surfaceId: "ground.overworld", x: 5, z: 1 }, undefined),
    ).toThrow("Surface anchor is outside surface ground.overworld: 5,1");
  });
});

function createHeightfieldMap(): MapDefinition {
  return {
    version: 2,
    name: "anchor-heightfield-test",
    size: { cellsX: 1, cellsZ: 1, cellSize: 2 },
    terrain: {
      revision: 1,
      defaultSurfaceId: "ground.overworld",
      surfaces: [
        {
          id: "ground.overworld",
          kind: "heightfield",
          cellSize: 2,
          cellsX: 1,
          cellsZ: 1,
          origin: { x: 0, z: 0 },
          cornerHeights: [0, 2, 0, 2],
          material: "grass",
        },
      ],
      waterBodies: [],
      volumes: [],
      overlays: [],
      portals: [],
    },
    placements: [],
    actors: [],
  };
}

function createStackedMap(): MapDefinition {
  return {
    version: 2,
    name: "anchor-stacked-test",
    size: { cellsX: 1, cellsZ: 1, cellSize: 2 },
    terrain: {
      revision: 1,
      defaultSurfaceId: "ground.overworld",
      surfaces: [
        {
          id: "ground.overworld",
          kind: "heightfield",
          cellSize: 2,
          cellsX: 1,
          cellsZ: 1,
          origin: { x: 0, z: 0 },
          cornerHeights: [0, 0, 0, 0],
          material: "grass",
        },
        {
          id: "bridge.deck.test",
          kind: "deck",
          cellSize: 2,
          cellsX: 1,
          cellsZ: 1,
          origin: { x: 0, z: 0 },
          y: 2,
          material: "concrete",
        },
        {
          id: "tunnel.floor.test",
          kind: "tunnel",
          cellSize: 2,
          cellsX: 1,
          cellsZ: 1,
          origin: { x: 0, z: 0 },
          y: -1,
          material: "road",
        },
      ],
      waterBodies: [],
      volumes: [],
      overlays: [],
      portals: [],
    },
    placements: [],
    actors: [],
  };
}

function createWaterMap(options: { bottomY: number; waterY: number }): MapDefinition {
  return {
    version: 2,
    name: "anchor-water-test",
    size: { cellsX: 1, cellsZ: 1, cellSize: 2 },
    terrain: {
      revision: 1,
      defaultSurfaceId: "ground.overworld",
      surfaces: [
        {
          id: "ground.overworld",
          kind: "heightfield",
          cellSize: 2,
          cellsX: 1,
          cellsZ: 1,
          origin: { x: 0, z: 0 },
          cornerHeights: [options.bottomY, options.bottomY, options.bottomY, options.bottomY],
          material: "grass",
        },
      ],
      waterBodies: [
        {
          id: "lake.test",
          kind: "water",
          polygon: [
            { x: 0, z: 0 },
            { x: 2, z: 0 },
            { x: 2, z: 2 },
            { x: 0, z: 2 },
          ],
          surface: { mode: "constantY", y: options.waterY },
          bottomSurfaceId: "ground.overworld",
          waterType: "fresh",
        },
      ],
      volumes: [],
      overlays: [],
      portals: [],
    },
    placements: [],
    actors: [],
  };
}
