import { describe, expect, it } from "vitest";
import type { MapDefinition } from "../map/MapTypes";
import { TerrainWorld, waterSurfaceId } from "../terrain/TerrainWorld";

describe("TerrainWorld", () => {
  it("samples bilinear heightfield heights and normals", () => {
    const terrain = new TerrainWorld(createMap({ cornerHeights: [0, 2, 0, 2] }));
    const sample = terrain.sampleSurface("ground.overworld", 0, 0);

    expect(sample?.position.y).toBeCloseTo(1);
    expect(sample?.normal.y).toBeLessThan(1);
    expect(sample?.material).toBe("grass");
  });

  it("derives water depth from water surface and bottom terrain", () => {
    const terrain = new TerrainWorld(
      createMap({
        cornerHeights: [-2, -2, -2, -2],
        water: true,
      }),
    );

    const bottom = terrain.sampleSurface("ground.overworld", 0, 0);
    const water = terrain.sampleSurface(waterSurfaceId("lake.test"), 0, 0);

    expect(bottom?.waterDepth).toBeCloseTo(3);
    expect(water?.position.y).toBe(1);
    expect(water?.waterDepth).toBeCloseTo(3);
  });
});

function createMap(options: { cornerHeights: number[]; water?: boolean }): MapDefinition {
  return {
    version: 2,
    name: "test-map",
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
          origin: { x: -1, z: -1 },
          cornerHeights: options.cornerHeights,
          material: "grass",
        },
      ],
      waterBodies: options.water
        ? [
            {
              id: "lake.test",
              kind: "water",
              polygon: [
                { x: -1, z: -1 },
                { x: 1, z: -1 },
                { x: 1, z: 1 },
                { x: -1, z: 1 },
              ],
              surface: { mode: "constantY", y: 1 },
              bottomSurfaceId: "ground.overworld",
              waterType: "fresh",
            },
          ]
        : [],
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
