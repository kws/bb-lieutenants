# Build & Bungle Lieutenants Sprint Tracker

Status date: 2026-05-27.

Live main-branch target: <https://kws.github.io/bb-lieutenants/>

Latest cuts:

| Commit | Status | Notes |
| ------ | ------ | ----- |
| `43a72c4` | Done | GitHub Pages build now uses the `/bb-lieutenants/` base path, and runtime JSON/GLB asset fetches use Vite's `BASE_URL`. |
| `3db614b` | Done | Added lower-right vehicle camera inset, isolated sky for that inset, non-blocking pointer behavior, and visible route debug tube. |
| `3556a19` | Done | Added GitHub Pages deployment workflow and full **Build & Bungle Lieutenants** naming in project metadata. |
| `c1b7a47` | Done | Initial playable 3D demo cut: Babylon/Vite app, JSON map, Kenney assets, nav grid, A*, Rapier collision, debug UI, and tests. |

## Sprint 1 Result

| Area | Status | Notes |
| ---- | ------ | ----- |
| Bootable app | Done | Vite + TypeScript + Babylon app boots locally. |
| 3D world | Done | Data-driven industrial yard map with ground, roads, buildings, trees, rocks, crates, barriers, lights, and one vehicle. |
| Asset loading | Done | GLB registry loads Kenney assets once and instantiates placements. Missing assets fall back to simple placeholders. |
| Roads | Done | City road tiles are in the map, scaled to tile spacing, with corrected rotations for the current demo layout. |
| Navigation | Done | Grid navigation, explicit footprints, actor-radius padding, nearest-walkable targeting, 8-way A*, and diagonal corner-cut prevention are implemented. |
| Terrain costs | Partial | The model exists. Current demo uses `grass = 3` via map default cost and `road = 1`; costs are clamped to at least `1` to keep the A* heuristic stable. |
| Vehicle movement | Done | Click-to-move, waypoint following, yaw rotation, reset-to-spawn, and stuck-to-blocked handling are implemented. |
| Collision | Done | Rapier static colliders and a kinematic vehicle collider are active. Shift-click direct movement exists as a collision test path. |
| Debug tooling | Done | FPS, camera mode, mouse world/cell, actor state, collision state, nav grid, footprints, inspector, and route line are available. |
| Vehicle camera | Done | Lower-right hood/inset camera renders alongside the isometric view and has its own sky layer. |
| Deployment | Done | GitHub Actions builds, tests, uploads, and deploys the static demo to GitHub Pages. |
| Verification | Done | Latest verified commands: `npm run test` and `BASE_PATH=/bb-lieutenants/ npm run build`. |

## Sprint 1 Divergences

These replace or refine assumptions in the original plan below:

- The optional chase-camera toggle became an always-visible lower-right vehicle camera inset. The main camera remains the command camera.
- Runtime route preview is not always-on planning preview; it draws the last commanded path and can be toggled with `P`.
- Map reload is not implemented yet. `R` resets the vehicle to spawn.
- Road preference is currently modeled with terrain cost only. Roads cost `1`, grass costs `3`; future C&C-style behavior needs per-vehicle movement profiles and probably directional/lane-aware road costs.
- A* prevents diagonal corner-cutting through blocked cells, but it does not understand road lanes, right-side driving, traffic rules, or road direction.
- Stuck handling stops and marks the actor as `blocked`; it does not automatically repath yet.
- Navigation still comes from explicit map/registry footprints, not GLB mesh geometry.
- Project structure is close to the original proposal but not identical. Some planned helper modules were folded into nearby files because the first sprint did not need the extra indirection.

## Next Slice: Terrain Semantics v1

Before building a map authoring tool, define the terrain model that tool will author. The map should describe physical terrain facts, not every possible vehicle class.

### Terrain Modeling Correction

Do not model terrain as object-like patches placed on top of a flat world. That approach treats hills, ridges, dikes, ramps, and cliffs like blockers or decals, and it breaks down immediately for normal game terrain.

Terrain is the ground. The world should no longer be assumed flat with special terrain objects layered over it. Elevation must come from the ground model itself: a heightfield, terrain mesh, tile-corner heights, or another continuous surface representation that can express slopes, ridges, plateaus, dikes, and cliff edges as part of the walkable surface.

Future terrain work should start from these rules:

```text
The ground owns elevation.
Terrain samples come from the ground surface, not from placed objects.
Slopes and cliffs are derived from neighboring ground heights.
Surface type and water depth annotate the ground.
Buildings, trees, rocks, walls, and props remain placed objects with footprints/colliders.
```

The failed patch-based direction should not be extended with more special patch shapes, such as ramp, wedge, ridge, mound, or cliff objects. A dike-like test should instead be authored as ground elevation: one side has a gentle slope, the crest has height, and the far edge drops faster than the vehicle profile permits.

Restart terrain from a shared ground source:

```text
TerrainField/TerrainGround is the authoritative source for elevation.
The renderer builds the ground mesh from that source.
Pathfinding samples the same source for cell heights and edge slopes.
Physics/collision is aligned to the same source, or explicitly documented as simplified until terrain physics exists.
Surface, road, water, and overlay data are annotation layers on the ground, not height-producing objects.
Placed assets stay separate: buildings, vegetation, rocks, walls, props, and their blockers/colliders.
```

Prefer a minimal heightfield or tile-corner-height schema before any editor work:

```text
terrain.elevation: grid or heightmap-backed samples
terrain.surface: per-cell surface/material data
terrain.water: per-cell depth data
terrain.overlays: roads, bridges, fords, ramps as annotations
```

The next proof should be a single authored ground profile, not a new patch type: flat approach, gentle slope up, short crest, steep drop. A wheeled profile should drive up the gentle side, slow while climbing, and reject the cliff edge because the derived edge slope/drop exceeds its limits.

Map-authored terrain facts should include:

```text
Height/elevation
Surface type, such as grass, road, dirt, rock, sand, or water
Water depth where applicable
Optional overlays, such as road, bridge, ford, or ramp
Static blockers from footprints
```

Vehicle movement profiles should describe how a vehicle interprets those facts:

```text
Surface movement costs
Maximum normal slope
Cliff/climb capability
Water traversal capability
Maximum water depth
Uphill/downhill cost modifiers
```

Traversal should be calculated mostly as an edge cost, not only as a tile cost. Moving from one cell to another depends on the destination surface, height delta, slope, cliff threshold, water depth, static blockers, and the selected vehicle's movement profile.

The first implementation should avoid per-click recomputation by caching derived movement data by:

```text
terrain revision + movement profile id = cached movement/edge-cost layer
```

Initial profiles:

```text
wheeled.vehicle: roads preferred, grass allowed, steep slopes blocked, water blocked
climber.vehicle: steep/rocky terrain allowed at high cost, water blocked
water.vehicle: water allowed, land blocked or expensive depending on craft type
amphibious.vehicle: land and shallow water allowed, deep water optional by profile
```

Acceptance for this slice:

```text
Map schema supports height, surface, water depth, and overlays.
Movement profiles convert terrain facts into walkability and traversal cost.
A* accepts a movement profile or derived movement layer.
Hills are slower uphill than flat ground for normal vehicles.
Steep cliffs are blocked unless the profile has climb capability.
Water is blocked unless the profile has water/amphibious capability.
The demo includes at least one hill/cliff/water test area.
Unit tests cover slope, cliff, water, and profile-specific traversal.
```

---

Below is the original implementation-ready spec for a **first 3D isometric navigable-world POC**, updated where sprint 1 changed the shape of the demo. It deliberately excludes multiplayer, resource gameplay, AI, production UI, and economy. The goal is to prove that the rendering, asset loading, map format, navigability model, and basic movement/physics all work together.

Kenney is a good fit for this slice: their 3D import guide says Kenney distributes glTF assets as **GLB**, recommends GLB for BabylonJS, and notes that isometric renders may also be included in some 3D packages. ([Kenney][1]) The City Kit Industrial page, for example, is a 3D CC0 pack with buildings/factory/warehouse-style content. ([Kenney][2])

---

# POC spec: 3D isometric navigable world

## 1. Objective

Build a browser-based 3D scene that loads low-poly Kenney-style GLB assets, renders them with an isometric RTS camera, defines a map through JSON, computes navigability from object footprints, and allows a single controllable vehicle/unit to move across the map using click-to-move pathfinding.

The POC should answer these questions:

1. Can we load and place 3D assets cleanly?
2. Can we build maps from data rather than hand-coded scenes?
3. Can we define which parts of the world are navigable?
4. Can a unit move to a clicked destination without passing through buildings/trees/rocks?
5. Can we keep the scene readable in a C&C-like isometric camera?
6. Can this architecture later support RTS gameplay and multiplayer?

---

## 2. Recommended stack

Use this stack for the first implementation:

```text
TypeScript
Vite
Babylon.js
@babylonjs/loaders
@dimforge/rapier3d-compat
Vitest
```

Reasoning:

Babylon.js gives us a fast path to a complete 3D game scene: camera, lights, GLB loading, asset containers, picking, shadows, and inspector tooling. Babylon’s loader docs show support for `.gltf` and `.glb`, and recommend bringing in loaders via `@babylonjs/loaders/dynamic` or `@babylonjs/loaders` in bundled apps. ([GitHub][3])

Rapier is optional for very early rendering, but include it now because it gives us a clean path for kinematic movement and obstacle handling. Rapier’s JavaScript character controller computes corrected movement using ray/shape casts, can stop at obstacles, slide on slopes, climb small steps, and can be used for moving objects that are not literal characters. ([Rapier][4])

Do **not** introduce React, multiplayer, Colyseus, PartyKit, ECS libraries, procedural generation, or a visual map editor in this slice.

---

## 3. Non-goals

The POC must not attempt these yet:

```text
No multiplayer
No resource harvesting
No unit production
No combat
No strategic AI
No fog of war
No deterministic simulation
No save-game system
No procedural terrain
No full in-browser map editor
No production asset pipeline
No user accounts
```

This is a **world/navigation/rendering** slice only.

---

# 4. User-visible behavior

When the app starts, the user sees a small isometric 3D map with:

```text
Ground plane
Road/path areas
Trees
Rocks
A few buildings
A few decorative objects
One controllable vehicle/unit
Debug nav-grid toggle
```

The user can:

```text
Pan camera
Zoom camera
Rotate camera in 90° increments or free yaw
Click ground to move the selected vehicle
See the last commanded path as a debug line
See blocked nav cells in debug mode
See a lower-right vehicle camera inset
Reset vehicle to spawn
```

The controlled vehicle should:

```text
Path around buildings and trees
Stop if no path exists
Smoothly follow waypoints
Rotate toward movement direction
Not pass through solid obstacles
Mark itself blocked if it gets stuck
```

---

# 5. POC acceptance criteria

The POC is complete when all of the following are true:

| Area              | Acceptance criterion                                                                                    | Sprint 1 status |
| ----------------- | ------------------------------------------------------------------------------------------------------- | --------------- |
| App boot          | `npm install && npm run dev` starts a browser app through Vite.                                         | Done |
| Rendering         | A Babylon.js scene renders a 3D map with ground, lights, camera, and at least 15 placed static objects. | Done |
| Assets            | At least 3 different asset categories are loaded: building, vegetation, vehicle.                        | Done |
| Camera            | Default camera is orthographic/isometric and supports pan + zoom.                                       | Done |
| Vehicle view      | A secondary vehicle view is available for inspection/debugging.                                         | Done as an inset, not a toggle |
| Map data          | Scene is built from a JSON map file, not hard-coded object placement.                                   | Done |
| Nav grid          | The app generates a nav grid from the map’s object footprints.                                          | Done |
| Debug overlay     | Pressing a key toggles visible blocked/walkable cells.                                                  | Done |
| Click-to-move     | Clicking walkable ground commands the vehicle to move there.                                            | Done |
| Pathfinding       | Vehicle uses A* over the nav grid and avoids blocked cells.                                             | Done, without road-lane direction |
| Physics/collision | Vehicle does not pass through solid obstacles.                                                          | Done |
| Stuck handling    | If movement is blocked for more than a short threshold, vehicle stops and marks blocked.                | Done |
| Tests             | Core nav-grid and A* functions have unit tests.                                                         | Done |
| Deployment        | `main` can be built and deployed to GitHub Pages under `/bb-lieutenants/`.                              | Done |
| Extensibility     | Map schema can later support resource nodes, player starts, unit types, and terrain costs.              | Partial; terrain costs exist, per-vehicle costs are future |

---

# 6. Project structure

The current project uses this directory structure:

```text
bb-lieutenants/
  package.json
  vite.config.ts
  tsconfig.json
  index.html

  public/
    assets/
      kenney/
        city-kit-industrial/
        city-kit-roads/
        factory-kit/
        nature-kit/
        car-kit/
    maps/
      poc.map.json
    asset-registry.json

  src/
    main.ts

    app/
      GameApp.ts
      GameLoop.ts

    render/
      createEngine.ts
      AssetManager.ts
      CameraController.ts
      Lighting.ts
      Ground.ts
      DebugDraw.ts
      NavGridOverlay.ts
      RenderLayers.ts
      VehicleCameraInset.ts

    map/
      MapTypes.ts
      MapLoader.ts
      MapBuilder.ts
      FootprintRasterizer.ts

    nav/
      NavGrid.ts
      AStar.ts
      NavTypes.ts
      nearestWalkable.ts

    physics/
      PhysicsWorld.ts

    sim/
      Actor.ts
      VehicleController.ts

    input/
      InputController.ts

    debug/
      DebugPanel.ts

    utils/
      basePath.ts

    test/
      navgrid.test.ts
      astar.test.ts
      rasterizer.test.ts
```

---

# 7. Coordinate system

Use a consistent RTS-friendly coordinate system:

```text
X = east/west
Y = up/down
Z = north/south
```

All game logic should use world units, not pixels.

Recommended defaults:

```ts
const WORLD_UNITS_PER_TILE = 2;
const MAP_CELLS_X = 64;
const MAP_CELLS_Z = 64;
const WORLD_WIDTH = MAP_CELLS_X * WORLD_UNITS_PER_TILE;
const WORLD_DEPTH = MAP_CELLS_Z * WORLD_UNITS_PER_TILE;
```

The ground plane should be centered at world origin:

```text
x range: -64 to +64 if 64 cells × 2 units
z range: -64 to +64 if 64 cells × 2 units
```

Cell conversion helpers:

```ts
export function worldToCell(
  x: number,
  z: number,
  grid: NavGrid
): { cx: number; cz: number } {
  const halfW = grid.widthCells * grid.cellSize * 0.5;
  const halfD = grid.depthCells * grid.cellSize * 0.5;

  return {
    cx: Math.floor((x + halfW) / grid.cellSize),
    cz: Math.floor((z + halfD) / grid.cellSize),
  };
}

export function cellToWorldCenter(
  cx: number,
  cz: number,
  grid: NavGrid
): { x: number; z: number } {
  const halfW = grid.widthCells * grid.cellSize * 0.5;
  const halfD = grid.depthCells * grid.cellSize * 0.5;

  return {
    x: cx * grid.cellSize - halfW + grid.cellSize * 0.5,
    z: cz * grid.cellSize - halfD + grid.cellSize * 0.5,
  };
}
```

---

# 8. Map format

The POC map should be a JSON file.

Example:

```json
{
  "version": 1,
  "name": "poc-industrial-road-yard",
  "size": {
    "cellsX": 64,
    "cellsZ": 64,
    "cellSize": 2
  },
  "terrain": {
    "base": "grass",
    "heightMode": "flat",
    "defaultCost": 3
  },
  "playerStarts": [
    {
      "id": "player-1-start",
      "position": { "x": -40, "y": 0, "z": -40 },
      "rotationY": 0
    }
  ],
  "placements": [
    {
      "id": "factory-01",
      "assetId": "building.industrial.a",
      "position": { "x": 0, "y": 0, "z": 0 },
      "rotationY": 0,
      "scale": 1,
      "nav": {
        "blocks": true,
        "shape": "rect",
        "width": 10,
        "depth": 8,
        "padding": 1
      },
      "physics": {
        "solid": true,
        "shape": "box",
        "size": { "x": 10, "y": 6, "z": 8 }
      }
    },
    {
      "id": "tree-01",
      "assetId": "nature.tree.oak",
      "position": { "x": -16, "y": 0, "z": 12 },
      "rotationY": 0.4,
      "scale": 1,
      "nav": {
        "blocks": true,
        "shape": "circle",
        "radius": 1.5,
        "padding": 0.5
      },
      "physics": {
        "solid": true,
        "shape": "cylinder",
        "radius": 1.5,
        "height": 5
      }
    },
    {
      "id": "road-01",
      "assetId": "road.straight",
      "position": { "x": 0, "y": 0.02, "z": -20 },
      "rotationY": 1.5708,
      "scale": 1,
      "nav": {
        "blocks": false,
        "shape": "rect",
        "width": 4,
        "depth": 8,
        "terrainCost": 1
      },
      "physics": {
        "solid": false
      }
    }
  ],
  "actors": [
    {
      "id": "scout-01",
      "type": "vehicle.scout",
      "assetId": "vehicle.sedan",
      "position": { "x": -40, "y": 0, "z": -40 },
      "rotationY": 0,
      "movement": {
        "radius": 0.8,
        "speed": 8,
        "turnRate": 8
      },
      "physics": {
        "shape": "capsule",
        "radius": 0.7,
        "height": 1.2
      }
    }
  ]
}
```

Important design choice: **the map schema defines navigability explicitly through footprints**. Do not attempt to infer navigation from arbitrary GLB mesh geometry in this POC. Mesh-derived navigation can come later.

---

# 9. Asset registry

Use an asset registry so the map file does not reference raw file paths everywhere.

Example `public/asset-registry.json`:

```json
{
  "building.industrial.a": {
    "url": "/assets/kenney/city-kit-industrial/building-a.glb",
    "category": "building",
    "defaultScale": 1,
    "defaultNav": {
      "blocks": true,
      "shape": "rect",
      "width": 10,
      "depth": 8,
      "padding": 1
    }
  },
  "nature.tree.oak": {
    "url": "/assets/kenney/nature-kit/Models/GLB/tree.glb",
    "category": "vegetation",
    "defaultScale": 1,
    "defaultNav": {
      "blocks": true,
      "shape": "circle",
      "radius": 1.5,
      "padding": 0.5
    }
  },
  "vehicle.sedan": {
    "url": "/assets/kenney/car-kit/sedan.glb",
    "category": "vehicle",
    "defaultScale": 1
  },
  "road.straight": {
    "url": "/assets/kenney/city-kit-roads/road-straight.glb",
    "category": "terrain",
    "defaultScale": 1,
    "defaultNav": {
      "blocks": false,
      "shape": "rect",
      "width": 4,
      "depth": 8,
      "terrainCost": 1
    }
  }
}
```

The exact Kenney filenames may differ depending on the downloaded packs. The implementation should log a clear error if an asset path is missing, and should optionally substitute a primitive placeholder box/cylinder in development mode.

---

# 10. Asset loading behavior

Implement `AssetManager` with this behavior:

```ts
class AssetManager {
  async loadRegistry(url: string): Promise<void>;
  async preloadAsset(assetId: string): Promise<void>;
  instantiate(assetId: string, name: string): BABYLON.TransformNode;
}
```

Requirements:

1. Load each unique GLB only once.
2. Store it as an asset container or source root node.
3. Instantiate/copy it for each map placement.
4. Normalize the asset root so map placement controls position, rotation, and scale.
5. Mark decorative meshes as non-pickable unless needed.
6. Keep the ground mesh pickable for click-to-move.

Use Babylon’s current loader functions where possible. Babylon’s docs list `LoadAssetContainerAsync`, `AppendSceneAsync`, `LoadSceneAsync`, and `ImportMeshAsync` as module-level loading functions, and show that `.gltf` and `.glb` are supported through the loader plugin. ([GitHub][3])

Sprint 1 uses `SceneLoader.LoadAssetContainerAsync` for GLB container loading because it was the shortest stable route with the installed Babylon version. Revisit module-level imports later if bundle size or API churn becomes a problem.

---

# 11. Rendering spec

## Scene

Create:

```text
Babylon Engine
Babylon Scene
Orthographic isometric camera
Hemispheric light
Directional light
Ground plane
Optional shadows
Debug layer toggle
```

Recommended camera defaults:

```ts
alpha = -Math.PI / 4;  // yaw
beta = Math.PI / 3;    // pitch
radius = 100;
target = Vector3.Zero();
mode = ORTHOGRAPHIC_CAMERA;
orthoSize = 60;
```

The app should feel like an RTS, not a free-fly 3D editor.

## Camera controls

Implement custom controls rather than relying entirely on default camera controls:

```text
Middle mouse or right-drag: pan
Mouse wheel: zoom
Q/E: rotate camera yaw
Home: reset camera
F: follow selected actor
Lower-right vehicle camera inset: always visible in the current demo
```

Panning should be along the ground plane, not screen-space vertical movement.

## Rendering debug toggles

Use hotkeys:

```text
G = toggle nav grid
P = toggle path line
B = toggle placement footprints
I = toggle Babylon inspector/debug layer
R = reset vehicle
```

The Babylon Inspector is useful for this phase because it lets developers inspect the live scene, mesh hierarchy, materials, transforms, and related runtime state. Babylon describes the Inspector as a diagnostic tool for inspecting and manipulating a scene in real time. ([Babylon.js Docs][5])

---

# 12. Navigability model

The POC should use a **grid-based navigation model**.

Do not use a navmesh yet.

Reason: RTS-style movement, harvesting, building placement, fog of war, resource patches, and terrain costs are all naturally grid-friendly. Navmesh can come later if the game needs complex ramps, bridges, cliffs, or ride-along terrain traversal.

## Nav cell data

```ts
export type NavCell = {
  walkable: boolean;
  terrainCost: number;
  blockedBy?: string;
};

export class NavGrid {
  widthCells: number;
  depthCells: number;
  cellSize: number;
  cells: NavCell[];

  isInside(cx: number, cz: number): boolean;
  isWalkable(cx: number, cz: number): boolean;
  setBlocked(cx: number, cz: number, blockedBy: string): void;
  setTerrainCost(cx: number, cz: number, cost: number): void;
  get(cx: number, cz: number): NavCell;
}
```

Defaults:

```text
walkable = true
terrainCost = map.terrain.defaultCost if set, otherwise the current builder fallback of 1.2
```

## Obstacle rasterization

Every map placement with `nav.blocks = true` should be rasterized into the nav grid.

Supported footprints for POC:

```ts
type NavFootprint =
  | {
      blocks: true;
      shape: "rect";
      width: number;
      depth: number;
      padding?: number;
    }
  | {
      blocks: true;
      shape: "circle";
      radius: number;
      padding?: number;
    }
  | {
      blocks: false;
      shape?: "rect" | "circle";
      width?: number;
      depth?: number;
      radius?: number;
      terrainCost?: number;
    };
```

For vehicle navigation, expand blockers by the vehicle radius before pathfinding. This is the simplest way to prevent paths from scraping through gaps that the vehicle cannot physically fit through.

In practical terms:

```text
effectiveObstaclePadding = footprint.padding + actor.movement.radius
```

## Diagonal movement

A* should support 8-way movement, but disable corner-cutting.

A diagonal step from `(x, z)` to `(x + 1, z + 1)` is allowed only if both side-adjacent cells are walkable:

```text
(x + 1, z)
(x, z + 1)
```

This prevents the vehicle from sliding through diagonal cracks between two blocked cells.

## Terrain cost

Terrain cost should exist in the data model now, even if used lightly.

Examples:

```text
road = 1
grass = 3
rough = 5
water = blocked
building = blocked
```

This lets future vehicles prefer roads without requiring a new navigation architecture. Current costs are clamped to at least `1`; per-vehicle cost profiles and directional road-lane behavior are future work.

---

# 13. Pathfinding

Implement A* over the nav grid.

Interface:

```ts
export type Cell = {
  cx: number;
  cz: number;
};

export type PathResult =
  | {
      ok: true;
      cells: Cell[];
      worldPoints: { x: number; z: number }[];
      cost: number;
    }
  | {
      ok: false;
      reason: "start-blocked" | "target-blocked" | "no-path";
      nearestTarget?: Cell;
    };

export function findPath(
  grid: NavGrid,
  start: Cell,
  target: Cell,
  options?: {
    allowNearestTarget?: boolean;
    maxSearchCells?: number;
  }
): PathResult;
```

Use octile distance for the heuristic:

```ts
function octile(dx: number, dz: number): number {
  const F = Math.SQRT2 - 1;
  return dx < dz ? F * dx + dz : F * dz + dx;
}
```

After pathfinding, smooth the path lightly:

```text
Remove duplicate points
Remove unnecessary collinear waypoints
Optional: line-of-sight shortcut over walkable cells
```

Do not over-engineer smoothing yet.

---

# 14. Click picking

Implement click-to-move as:

```text
Pointer down
  → Babylon ray pick against ground mesh only
  → Convert picked point to world X/Z
  → Convert world point to nav cell
  → If blocked, find nearest walkable cell
  → Run A*
  → Set actor path
  → Draw debug path
```

The ground mesh should have a known name/tag:

```ts
ground.name = "ground.pickable";
ground.isPickable = true;
```

Most decorative assets should not be pickable for movement. This keeps picking predictable.

---

# 15. Physics spec

Use **basic kinematic physics**, not dynamic rigid-body simulation.

The vehicle is not a tumbling physical object. It is an RTS-controlled actor that follows a path. Physics exists to prevent clipping and to prepare for later ride-along/collision behavior.

## Rapier world

Create:

```ts
class PhysicsWorld {
  world: RAPIER.World;
  characterController: RAPIER.KinematicCharacterController;

  step(dt: number): void;
  createStaticBox(...): PhysicsHandle;
  createStaticCylinder(...): PhysicsHandle;
  createKinematicActor(...): PhysicsActorHandle;
}
```

Use:

```text
Static collider for ground
Static colliders for buildings/trees/rocks
Kinematic body/collider for vehicle
```

Vehicle movement loop:

```ts
const desired = computeDesiredTranslationAlongPath(actor, dt);

characterController.computeColliderMovement(
  actor.collider,
  desired
);

const corrected = characterController.computedMovement();

actor.rigidBody.setNextKinematicTranslation({
  x: current.x + corrected.x,
  y: current.y + corrected.y,
  z: current.z + corrected.z
});
```

Then sync the Babylon mesh from the Rapier rigid body after the physics step.

Rapier’s docs specifically describe this two-step character-controller flow: compute the corrected movement from a desired translation, then apply the corrected movement to a collider or kinematic rigid body. ([Rapier][4])

## Physics limitations for POC

Do not implement:

```text
Vehicle suspension
Wheel physics
Rigid-body pushing
Destructible objects
Projectile physics
Terrain deformation
Dynamic obstacle avoidance
```

Implement only:

```text
Grounding
Obstacle collision
Kinematic movement
Basic stuck detection
```

---

# 16. Actor movement

Actor state:

```ts
export type Actor = {
  id: string;
  assetId: string;
  root: BABYLON.TransformNode;
  physics: PhysicsActorHandle;

  position: BABYLON.Vector3;
  rotationY: number;

  movement: {
    radius: number;
    speed: number;
    turnRate: number;
    path: BABYLON.Vector3[];
    currentWaypointIndex: number;
    state: "idle" | "moving" | "blocked";
    stuckTime: number;
  };
};
```

Movement behavior:

```text
If no path: idle
If path exists:
  Target next waypoint
  Move toward waypoint at speed
  Rotate toward movement direction
  If close enough, advance waypoint
  If final waypoint reached, idle
  If corrected physics movement is near zero while desired movement is nonzero, accumulate stuck time
  If stuck time > threshold, stop and mark blocked
```

Recommended constants:

```ts
const WAYPOINT_REACHED_DISTANCE = 0.35;
const STUCK_SPEED_EPSILON = 0.05;
const STUCK_TIME_SECONDS = 0.75;
```

Rotation:

```ts
const desiredYaw = Math.atan2(direction.x, direction.z);
actor.rotationY = dampAngle(actor.rotationY, desiredYaw, turnRate * dt);
```

---

# 17. Map builder

Implement `MapBuilder` as the orchestration layer.

```ts
class MapBuilder {
  constructor(
    private scene: BABYLON.Scene,
    private assetManager: AssetManager,
    private physicsWorld: PhysicsWorld
  ) {}

  async build(map: MapDefinition): Promise<BuiltMap>;
}
```

Build flow:

```text
1. Create ground mesh
2. Create NavGrid
3. Load all unique assets referenced by map
4. Instantiate static placements
5. Apply transforms
6. Rasterize nav footprints
7. Create physics colliders
8. Instantiate actors
9. Create actor physics bodies
10. Return BuiltMap
```

`BuiltMap`:

```ts
export type BuiltMap = {
  map: MapDefinition;
  navGrid: NavGrid;
  ground: BABYLON.Mesh;
  footprintRoot: BABYLON.TransformNode;
  placements: BuiltPlacement[];
  actors: Actor[];
};
```

---

# 18. Development map

Create one hand-authored map:

```text
poc-industrial-road-yard
```

It should include:

```text
1 ground plane
1 road crossing through map
3–5 buildings
15–30 trees/rocks/crates/decorative objects
1 vehicle spawn
Several narrow-but-passable lanes
At least one intentionally blocked area
```

The map should test pathfinding meaningfully:

```text
Vehicle can cross the map
Vehicle must go around factory
Vehicle cannot pass through dense forest/rocks
Clicking blocked destination selects nearest walkable cell
```

---

# 19. Debug UI

Add a small HTML overlay, not a full UI framework.

Display:

```text
FPS
Camera mode
Mouse world position
Mouse nav cell
Selected actor id
Actor state
Current path length
Nav cell walkable/blocked
```

Example:

```text
FPS: 60
Camera: ISO
Mouse: x=12.4 z=-8.1
Cell: 38, 27 walkable
Actor: scout-01 moving
Path: 14 waypoints
```

Debug hotkeys:

```ts
const HOTKEYS = {
  toggleNavGrid: "KeyG",
  togglePath: "KeyP",
  toggleFootprints: "KeyB",
  toggleInspector: "KeyI",
  resetActor: "KeyR",
  focusActor: "KeyF"
};
```

---

# 20. Testing requirements

Use Vitest for pure logic tests.

Minimum tests:

## `NavGrid`

```text
Creates correct dimensions
Converts world → cell correctly
Converts cell → world center correctly
Rejects out-of-bounds cells
Blocks and unblocks expected cells
```

## `FootprintRasterizer`

```text
Rect footprint blocks expected cells
Circle footprint blocks expected cells
Padding expands blocked area
Rotation is handled for rect footprints or explicitly rejected for POC
```

Sprint 1 implements rotated rectangular footprint rasterization and uses it for road/placement footprints. The first test cut still mainly covers axis-aligned rectangles, circles, padding, actor-radius expansion, and terrain cost. Add an explicit rotated-rect test in the next cleanup pass.

## `AStar`

```text
Finds straight path in empty grid
Avoids blocked cells
Rejects blocked target
Finds nearest walkable target when requested
Prevents diagonal corner-cutting
Returns no-path for separated regions
```

---

# 21. Implementation phases

## Phase 1 — Bootable 3D scene

Deliver:

```text
Vite + TypeScript project
Babylon engine and scene
Ground plane
Orthographic isometric camera
Pan and zoom
Basic light setup
Debug overlay shell
```

Acceptance:

```text
App opens in browser and displays a simple 3D ground plane.
Camera feels like an RTS camera.
```

---

## Phase 2 — Asset loading

Deliver:

```text
asset-registry.json
AssetManager
Load one building GLB
Load one tree GLB
Load one vehicle GLB
Place them manually or through temporary config
```

Acceptance:

```text
At least three GLB assets appear in the scene.
Missing assets produce readable console errors.
```

---

## Phase 3 — JSON map loading

Deliver:

```text
MapTypes.ts
MapLoader.ts
MapBuilder.ts
poc.map.json
```

Acceptance:

```text
All scene placements come from JSON.
Changing a placement in JSON changes the scene after refresh.
```

---

## Phase 4 — Nav grid and debug overlay

Deliver:

```text
NavGrid
FootprintRasterizer
NavGridOverlay
Hotkey toggle
```

Acceptance:

```text
Buildings and trees mark cells as blocked.
Debug overlay shows blocked/walkable cells.
```

---

## Phase 5 — Pathfinding

Deliver:

```text
AStar
nearestWalkable
Path debug rendering
Click ground → compute path
```

Acceptance:

```text
Clicking a walkable point draws a valid path around blockers.
Clicking a blocked point chooses nearest walkable destination or reports no valid point.
```

---

## Phase 6 — Vehicle movement

Deliver:

```text
Actor
VehicleController
Path following
Yaw rotation
Arrival/stuck states
```

Acceptance:

```text
Vehicle follows the computed path and stops at destination.
Vehicle rotates in direction of travel.
```

---

## Phase 7 — Basic Rapier collision

Deliver:

```text
PhysicsWorld
Static colliders
Kinematic actor collider
Babylon/Rapier transform sync
```

Acceptance:

```text
Vehicle does not visually pass through buildings or trees.
If commanded into an impossible area, it stops and marks itself blocked.
```

---

## Phase 8 — Polish and handoff

Deliver:

```text
README
Controls list
Known limitations
Unit tests
One good demo map
```

Acceptance:

```text
A new developer or coding agent can run, understand, and extend the POC.
```

---

# 22. README requirements

The agent should create a `README.md` with:

```text
Project purpose
Setup commands
How to add Kenney assets
Expected asset folder structure
Controls
Map format overview
Debug hotkeys
Known limitations
Next suggested slices
```

Example setup section:

````md
## Setup

```bash
npm install
npm run dev
````

Place Kenney GLB assets under:

```text
public/assets/kenney/
```

Then update:

```text
public/asset-registry.json
public/maps/poc.map.json
```

````

---

# 23. Known limitations to document

The agent should explicitly document these:

```text
Navigation is grid-based, not navmesh-based.
Footprints are manually authored; they are not inferred from GLB geometry.
Terrain is flat.
Physics is kinematic only.
There is only one controllable actor.
There is no multiplayer.
There is no gameplay state beyond movement.
Stuck handling stops the actor; it does not automatically repath.
Roads have terrain costs, but no lane, direction, or right-side-driving model yet.
Terrain has no elevation, slope, cliff, water, bridge, ford, or ramp semantics yet.
Traversal is not yet vehicle-profile-specific.
There is no in-app map reload; reset only returns the vehicle to spawn.
Asset filenames depend on downloaded Kenney packs.
````

---

# 24. Future slices enabled by this POC

After this works, the next slices are straightforward:

```text
Terrain semantics and movement profiles
Map authoring tool
Multiple selectable units
Box selection
Command queue
Resource nodes
Harvest/refinery loop
Building placement preview
Fog of war
Server-authoritative multiplayer
Unit sensors
Attack-move
Formation movement
Per-vehicle road preference and terrain penalties
Directional road lanes/right-side driving
Navmesh/ramp support
Toggleable or enlarged ride-along perspective camera
```

The important thing is that this POC already creates the foundation those systems need: world coordinates, map data, asset placement, navigability, physics boundaries, and actor movement. The terrain semantics slice should come before a map authoring tool so the editor authors stable physical terrain facts rather than temporary demo-only costs.

---

# 25. Copy-paste implementation brief for an agent

```text
Implement a browser-based TypeScript/Vite POC for a 3D isometric RTS-style navigable world.

Use Babylon.js for rendering and GLB asset loading. Use @babylonjs/loaders for GLB support. Use @dimforge/rapier3d-compat for basic kinematic collision. Do not implement multiplayer, economy, combat, AI, or production UI.

The app must load a JSON map from public/maps/poc.map.json. The map defines size, terrain, static placements, and one actor. Static placements reference asset IDs from public/asset-registry.json. Assets are Kenney-style GLB files stored under public/assets/kenney/.

Implement:
- Babylon engine/scene setup.
- Orthographic isometric RTS camera with pan and zoom.
- AssetManager that loads each GLB once and instantiates it.
- MapLoader and MapBuilder that construct the scene from JSON.
- NavGrid generated from manually authored placement footprints.
- A* pathfinding over the nav grid with 8-way movement and no diagonal corner-cutting.
- Click-to-move by ray-picking the ground.
- One controllable vehicle actor that follows computed paths.
- Basic Rapier static colliders for obstacles and kinematic collider for the vehicle.
- Debug overlays for nav grid, path, actor state, and mouse cell.
- Vitest tests for NavGrid, footprint rasterization, and A*.

Acceptance:
- npm install && npm run dev starts the app.
- A 3D isometric map renders with buildings, trees, roads/decorations, and one vehicle.
- The map is data-driven from JSON.
- The nav grid marks buildings/trees as blocked.
- Pressing G toggles nav-grid debug.
- Clicking walkable ground moves the vehicle there.
- The vehicle paths around obstacles.
- The vehicle does not pass through solid objects.
- Core navigation logic has tests.
- README documents setup, controls, asset folder layout, map format, and limitations.
```

My recommendation is to keep this POC brutally focused: **one map, one actor, grid navigation, GLB assets, isometric camera, basic collision**. Once that feels good, the multiplayer/backend decision becomes much lower-risk because there will be an actual simulation and map model to host.

[1]: https://kenney.nl/knowledge-base/game-assets-3d/importing-3d-models-into-game-engines "https://kenney.nl/knowledge-base/game-assets-3d/importing-3d-models-into-game-engines"
[2]: https://kenney.nl/assets/city-kit-industrial "https://kenney.nl/assets/city-kit-industrial"
[3]: https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/importers/loadingFileTypes.md "https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/importers/loadingFileTypes.md"
[4]: https://rapier.rs/docs/user_guides/javascript/character_controller/ "https://rapier.rs/docs/user_guides/javascript/character_controller/"
[5]: https://doc.babylonjs.com/toolsAndResources/inspectorv2/ "https://doc.babylonjs.com/toolsAndResources/inspectorv2/"
