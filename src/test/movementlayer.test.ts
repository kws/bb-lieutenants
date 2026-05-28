import { describe, expect, it } from "vitest";
import type { MapDefinition, MovementProfile } from "../map/MapTypes";
import { createMovementLayer, evaluateEdge, getMovementNode } from "../nav/MovementLayer";
import { MovementLayerCache } from "../nav/MovementLayerCache";
import { DEFAULT_MOVEMENT_PROFILES } from "../nav/MovementProfiles";
import { findSurfacePath } from "../nav/SurfaceAStar";
import { TerrainWorld } from "../terrain/TerrainWorld";

const scout = DEFAULT_MOVEMENT_PROFILES.find((profile) => profile.id === "wheeled.scout") as MovementProfile;
const tall = DEFAULT_MOVEMENT_PROFILES.find((profile) => profile.id === "tall.vehicle") as MovementProfile;
const boat = DEFAULT_MOVEMENT_PROFILES.find((profile) => profile.id === "boat.light") as MovementProfile;

describe("MovementLayer", () => {
  it("rejects edge traversal over cliff-height deltas", () => {
    const terrain = new TerrainWorld(createStackedMap({ includePortal: false, cliff: true }));
    const layer = createMovementLayer(terrain, scout);
    const result = evaluateEdge(
      layer,
      { surfaceId: "ground.overworld", cx: 0, cz: 0 },
      { surfaceId: "ground.overworld", cx: 1, cz: 0 },
    );

    expect(result).toEqual({ allowed: false, reason: "cliff" });
  });

  it("uses explicit portals instead of connecting stacked surfaces by shared X/Z", () => {
    const withoutPortal = createMovementLayer(new TerrainWorld(createStackedMap({ includePortal: false })), scout);
    const withPortal = createMovementLayer(new TerrainWorld(createStackedMap({ includePortal: true })), scout);

    expect(
      findSurfacePath(
        withoutPortal,
        { surfaceId: "ground.overworld", cx: 0, cz: 0 },
        { surfaceId: "bridge.deck.test", cx: 0, cz: 0 },
      ).ok,
    ).toBe(false);

    expect(
      findSurfacePath(
        withPortal,
        { surfaceId: "ground.overworld", cx: 0, cz: 0 },
        { surfaceId: "bridge.deck.test", cx: 0, cz: 0 },
      ).ok,
    ).toBe(true);
  });

  it("rejects low-clearance tunnel nodes for tall profiles", () => {
    const layer = createMovementLayer(new TerrainWorld(createStackedMap({ includePortal: true })), tall);
    const node = getMovementNode(layer, { surfaceId: "tunnel.floor.test", cx: 0, cz: 0 });

    expect(node?.walkable).toBe(false);
    expect(node?.rejection).toBe("low-clearance");
  });

  it("rejects water surface nodes under low overhead decks", () => {
    const layer = createMovementLayer(new TerrainWorld(createLowBridgeWaterMap()), boat);
    const node = getMovementNode(layer, { surfaceId: "water.lake.test.surface", cx: 0, cz: 0 });

    expect(node?.walkable).toBe(false);
    expect(node?.rejection).toBe("low-clearance");
  });

  it("charges more for uphill edges than flat edges", () => {
    const flatLayer = createMovementLayer(new TerrainWorld(createSlopeMap([0, 0, 0, 0, 0, 0])), scout);
    const uphillLayer = createMovementLayer(new TerrainWorld(createSlopeMap([0, 0.8, 1.6, 0, 0.8, 1.6])), scout);

    const flat = evaluateEdge(flatLayer, { surfaceId: "ground.overworld", cx: 0, cz: 0 }, { surfaceId: "ground.overworld", cx: 1, cz: 0 });
    const uphill = evaluateEdge(uphillLayer, { surfaceId: "ground.overworld", cx: 0, cz: 0 }, { surfaceId: "ground.overworld", cx: 1, cz: 0 });

    expect(flat.allowed).toBe(true);
    expect(uphill.allowed).toBe(true);
    if (flat.allowed && uphill.allowed) expect(uphill.cost).toBeGreaterThan(flat.cost);
  });

  it("honors water bodies that disable surface navigation", () => {
    const layer = createMovementLayer(new TerrainWorld(createWaterNavigationMap(false)), boat);
    const node = getMovementNode(layer, { surfaceId: "water.lake.test.surface", cx: 0, cz: 0 });

    expect(node?.walkable).toBe(false);
    expect(node?.rejection).toBe("surface-navigation-disabled");
  });

  it("caches movement layers per actor radius so footprint inflation is actor-specific", () => {
    const terrain = new TerrainWorld(createStackedMap({ includePortal: false }));
    const cache = new MovementLayerCache(terrain, [
      {
        id: "crate",
        surfaceId: "ground.overworld",
        position: { x: 3, y: 0, z: 1 },
        footprint: { blocks: true, shape: "rect", width: 0.5, depth: 0.5 },
        rotationY: 0,
      },
    ]);

    const tightLayer = cache.get(scout, 0);
    const wideLayer = cache.get(scout, 1.9);

    expect(getMovementNode(tightLayer, { surfaceId: "ground.overworld", cx: 0, cz: 0 })?.walkable).toBe(true);
    expect(getMovementNode(wideLayer, { surfaceId: "ground.overworld", cx: 0, cz: 0 })?.walkable).toBe(false);
    expect(cache.get(scout, 1.9)).toBe(wideLayer);
  });
});

function createStackedMap(options: { includePortal: boolean; cliff?: boolean }): MapDefinition {
  return {
    version: 2,
    name: "movement-test",
    size: { cellsX: 2, cellsZ: 1, cellSize: 2 },
    terrain: {
      revision: 1,
      defaultSurfaceId: "ground.overworld",
      surfaces: [
        {
          id: "ground.overworld",
          kind: "heightfield",
          cellSize: 2,
          cellsX: 2,
          cellsZ: 1,
          origin: { x: 0, z: 0 },
          cornerHeights: options.cliff ? [0, 8, 8, 0, 8, 8] : [0, 0, 0, 0, 0, 0],
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
          y: -2,
          material: "road",
          approximateClearance: 2.4,
        },
      ],
      waterBodies: [],
      volumes: [],
      overlays: [],
      portals: options.includePortal
        ? [
            {
              id: "test-portal",
              kind: "bridge-approach",
              from: { surfaceId: "ground.overworld", x: 1, z: 1 },
              to: { surfaceId: "bridge.deck.test", x: 1, z: 1 },
              cost: 1,
            },
          ]
        : [],
    },
    placements: [],
    actors: [
      {
        id: "actor",
        type: "vehicle.scout",
        assetId: "vehicle.sedan",
        position: { x: 0, y: 0, z: 0 },
        movement: { radius: 1, speed: 1, turnRate: 1, profileId: "wheeled.scout" },
        physics: { shape: "capsule", radius: 1, height: 1 },
      },
    ],
  };
}

function createSlopeMap(cornerHeights: number[]): MapDefinition {
  return {
    version: 2,
    name: "slope-test",
    size: { cellsX: 2, cellsZ: 1, cellSize: 2 },
    terrain: {
      revision: 1,
      defaultSurfaceId: "ground.overworld",
      surfaces: [
        {
          id: "ground.overworld",
          kind: "heightfield",
          cellSize: 2,
          cellsX: 2,
          cellsZ: 1,
          origin: { x: 0, z: 0 },
          cornerHeights,
          material: "grass",
        },
      ],
      waterBodies: [],
      volumes: [],
      overlays: [],
      portals: [],
    },
    placements: [],
    actors: [
      {
        id: "actor",
        type: "vehicle.scout",
        assetId: "vehicle.sedan",
        position: { x: 0, y: 0, z: 0 },
        movement: { radius: 1, speed: 1, turnRate: 1, profileId: "wheeled.scout" },
        physics: { shape: "capsule", radius: 1, height: 1 },
      },
    ],
  };
}

function createWaterNavigationMap(surfaceAllowed: boolean): MapDefinition {
  return {
    version: 2,
    name: "water-navigation-test",
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
          cornerHeights: [-2, -2, -2, -2],
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
          surface: { mode: "constantY", y: 0 },
          bottomSurfaceId: "ground.overworld",
          waterType: "fresh",
          navigation: { surfaceAllowed, submergedAllowed: false, seabedAllowed: false },
        },
      ],
      volumes: [],
      overlays: [],
      portals: [],
    },
    placements: [],
    actors: [
      {
        id: "boat",
        type: "boat.light",
        assetId: "vehicle.sedan",
        position: { x: 1, y: 0, z: 1 },
        movement: { radius: 1, speed: 1, turnRate: 1, profileId: "boat.light" },
        physics: { shape: "capsule", radius: 1, height: 1 },
      },
    ],
  };
}

function createLowBridgeWaterMap(): MapDefinition {
  return {
    version: 2,
    name: "low-bridge-water-test",
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
          cornerHeights: [-2, -2, -2, -2],
          material: "grass",
        },
        {
          id: "bridge.deck.low",
          kind: "deck",
          cellSize: 2,
          cellsX: 1,
          cellsZ: 1,
          origin: { x: 0, z: 0 },
          y: 1,
          material: "concrete",
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
          surface: { mode: "constantY", y: 0 },
          bottomSurfaceId: "ground.overworld",
          waterType: "fresh",
        },
      ],
      volumes: [],
      overlays: [],
      portals: [],
    },
    placements: [],
    actors: [
      {
        id: "boat",
        type: "boat.light",
        assetId: "vehicle.sedan",
        position: { x: 1, y: 0, z: 1 },
        movement: { radius: 1, speed: 1, turnRate: 1, profileId: "boat.light" },
        physics: { shape: "capsule", radius: 1, height: 1 },
      },
    ],
  };
}
