# Build & Bungle Lieutenants Sprint Tracker

Status date: 2026-05-28.

Live main-branch target: <https://kws.github.io/bb-lieutenants/>

Latest cuts:

| Commit | Status | Notes |
| ------ | ------ | ----- |
| `f79c0eb` | Done | Implemented the terrain proof of concept: v2 map schema, `TerrainWorld`, heightfield/deck/tunnel/water surfaces, movement profiles/layers, portal-aware `SurfaceAStar`, terrain rendering/picking, vehicle Y snapping, and terrain tests. |
| `8a23ea7` | Done | Added the terrain semantics rules and implementation slices for surfaces, volumes, overlays, portals, movement profiles, and edge-cost pathfinding. |
| `00aaedb` | Done | Corrected the terrain model away from flat ground plus patches and toward named physical surfaces in 3D space. |
| `e4d82a0` | Done | Updated the sprint tracker after the initial deployable demo work. |
| `43a72c4` | Done | GitHub Pages build now uses the `/bb-lieutenants/` base path, and runtime JSON/GLB asset fetches use Vite's `BASE_URL`. |
| `3db614b` | Done | Added lower-right vehicle camera inset, isolated sky for that inset, non-blocking pointer behavior, and visible route debug tube. |
| `3556a19` | Done | Added GitHub Pages deployment workflow and full **Build & Bungle Lieutenants** naming in project metadata. |
| `c1b7a47` | Done | Initial playable 3D demo cut: Babylon/Vite app, JSON map, Kenney assets, nav grid, A*, Rapier collision, debug UI, and tests. |

## Sprint 1 Result

| Area | Status | Notes |
| ---- | ------ | ----- |
| Bootable app | Done | Vite + TypeScript + Babylon app boots locally. |
| 3D world | Done | Data-driven industrial yard map with terrain, roads, buildings, trees, rocks, crates, barriers, lights, and multiple demo actors. |
| Asset loading | Done | GLB registry loads Kenney assets once and instantiates placements. Missing assets fall back to simple placeholders. |
| Roads | Done | City road tiles are in the map, scaled to tile spacing, with corrected rotations for the current demo layout. |
| Navigation | Done | Sprint 1 `NavGrid`/`AStar` remains tested. The active terrain demo now uses `MovementLayer` plus `SurfaceAStar` over `surfaceId + cell` nodes. |
| Terrain costs | Partial | Terrain materials, overlays, movement profiles, slope/step/cliff checks, water-depth checks, and portal constraints now exist. Costs are still clamped to at least `1`; road lanes/direction are future work. |
| Terrain semantics | Partial | Active app loads `public/maps/terrain-poc.map.json` v2 with a heightfield, bridge deck, tunnel floor, water volume, overlays, portals, and placement anchors. This is still a POC, not an authoring-ready terrain system. |
| Vehicle movement | Done | Click-to-move, waypoint following, yaw rotation, reset-to-spawn, and stuck-to-blocked handling are implemented. |
| Collision | Partial | Rapier static object colliders and a kinematic vehicle collider are active. Terrain physics still uses one low flat proxy collider; visual/nav terrain owns elevation. |
| Debug tooling | Done | FPS, camera mode, mouse world/cell, actor state, collision state, nav grid, footprints, inspector, and route line are available. |
| Vehicle camera | Done | Lower-right hood/inset camera renders alongside the isometric view and has its own sky layer. |
| Deployment | Done | GitHub Actions builds, tests, uploads, and deploys the static demo to GitHub Pages. |
| Verification | Done | NPM tooling confirmed fixed on 2026-05-28: `npm --version` resolves as `11.13.0`, and `npm run test` plus `BASE_PATH=/bb-lieutenants/ npm run build` pass. |

## Sprint 1 Divergences

These replace or refine assumptions in the original plan below:

- The optional chase-camera toggle became an always-visible lower-right vehicle camera inset. The main camera remains the command camera.
- Runtime route preview is not always-on planning preview; it draws the last commanded path and can be toggled with `P`.
- The active demo now loads `public/maps/terrain-poc.map.json`; `public/maps/poc.map.json` remains as the legacy flat v1 map.
- Map reload is not implemented yet. `R` resets the selected actor to spawn.
- Road preference is now modeled through movement profiles, materials, and overlays, but multipliers are clamped to at least `1`; future C&C-style behavior still needs directional/lane-aware road costs.
- A* prevents diagonal corner-cutting through blocked cells, but it does not understand road lanes, right-side driving, traffic rules, or road direction.
- Stuck handling stops and marks the actor as `blocked`; it does not automatically repath yet.
- Navigation blockers still come from explicit map/registry footprints, not GLB mesh geometry.
- The terrain map includes multiple actors, and runtime control follows the individually selected actor.
- The terrain demo uses real visual/nav height, but physics terrain remains a flat proxy until heightfield/trimesh colliders are added.
- Project structure is close to the original proposal but not identical. Some planned helper modules were folded into nearby files because the first sprint did not need the extra indirection.

## Next Slice: Terrain Semantics v1

Before building a map authoring tool, define the terrain model that tool will author. The map should describe physical terrain facts, not every possible vehicle class.

### Governing Terrain Rule

Do not model terrain as object-like patches placed on top of a flat world. That approach treats hills, ridges, dikes, ramps, and cliffs like blockers or decals, and it breaks down immediately for normal game terrain.

Terrain is not one flat plane plus patches. Terrain is a set of named physical surfaces embedded in 3D space.

The main outdoor world may be represented by a heightfield. Additional traversable structures, such as bridges, decks, tunnel floors, cave floors, underwater floors, ramps, and overpasses, are additional surfaces.

Water is a volume whose top lies above a bottom surface. Roads, rails, fords, bridges, and tunnels are transport semantics attached to surfaces, not height-producing terrain patches.

A navigation node is identified by `surfaceId + cell coordinates`. Overlapping X/Z positions do not imply connectivity. Connectivity between surfaces is explicit through portals such as ramps, bridge approaches, tunnel mouths, lifts, fords, and docks.

Use four terrain primitives:

```text
Surface = a traversable or physical 2.5D/mesh surface
Volume  = water, air, cave space, solid earth/rock, etc.
Overlay = semantic transport/material feature on a surface
Portal  = explicit connection between surfaces or volumes
```

This preserves the earlier rule that the ground owns elevation, while correcting the limit of a single heightfield: one heightfield is enough for hills, ridges, shorelines, slopes, cliffs, and mountains, but not for tunnels, caves, bridges, road-over-road crossings, rail-over-road, underwater volumes, or anything where more than one traversable thing exists at the same X/Z coordinate.

### Current Terrain POC Baseline

The current implementation is no longer flat-only:

```text
Active map: public/maps/terrain-poc.map.json, MapDefinition version 2.
Legacy map: public/maps/poc.map.json, MapDefinition version 1.
TerrainWorld constructs heightfield, deck, tunnel, and runtime water-surface surfaces.
TerrainRenderer renders heightfield meshes, deck/tunnel meshes, water polygons, and tunnel visual helpers.
MovementLayer derives profile-specific surface grids from TerrainWorld samples.
SurfaceAStar pathfinds over NavNode(surfaceId, cx, cz) and explicit portal edges.
Movement profiles exist for wheeled.scout, boat.light, amphibious.light, tall.vehicle, and infantry.
MapBuilder resolves absolute, surface, and waterSurface anchors.
Objects can conform to terrain samples for placement orientation.
Input picking targets meshes with terrainSurfaceId metadata and stores NavPoint plus medium/material/depth/overlays.
VehicleController follows NavPoint paths and samples terrain for Y snapping.
Physics still uses one low flat ground collider plus object colliders; no heightfield/trimesh terrain collider yet.
Terrain POC actors can be selected individually; each selected actor uses a cached movement layer for its profile/radius.
```

This replaces the older Sprint 1 flat baseline. The next terrain work should harden and expose these systems rather than introduce a new terrain model.

### Surface Model

A surface is any piece of terrain or engineered deck that can be sampled, rendered, collided with, and navigated on.

Examples:

```text
ground.overworld
bridge.deck.east
tunnel.floor.north
cave.floor.alpha
rail.viaduct.deck
underwater.seabed
```

Recommended first surface types:

```ts
type TerrainSurface =
  | HeightfieldSurface
  | MeshSurface
  | DeckSurface
  | TunnelSurface;
```

Location identity must include the surface:

```ts
type NavPoint = {
  surfaceId: string;
  x: number;
  y: number;
  z: number;
};
```

A tank on `ground.overworld` is not automatically connected to a truck on `bridge.deck.east`, even if they occupy the same X/Z footprint. They are only connected if a ramp, tunnel mouth, bridge approach, elevator, ferry, ford, or another explicit portal connects them.

### Outdoor Heightfield

For the main outdoor terrain, use a corner-height grid:

```text
cellsX * cellsZ cells
(cellsX + 1) * (cellsZ + 1) height samples
```

Corner heights create a continuous surface. Each tile can be triangulated consistently, and height at any X/Z point can be interpolated.

Runtime representation:

```ts
type HeightfieldSurface = {
  id: string;
  kind: "heightfield";
  cellSize: number;
  cellsX: number;
  cellsZ: number;
  cornerHeights: number[];
  material: CellLayer<SurfaceMaterialId>;
  roughness?: CellLayer<number>;
};
```

This supports rolling hills, ridges, dikes, plateaus, valleys, ramps, cliffs, shorelines, mountain passes, sunken basins, and dry river beds without assuming `y = 0` is special.

The runtime terrain query should become the authoritative API:

```ts
type SurfaceSample = {
  surfaceId: string;
  position: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
  material: SurfaceMaterialId;
  roughness: number;
  waterDepth: number;
  overlays: string[];
};

interface TerrainQuery {
  sampleSurface(surfaceId: string, x: number, z: number): SurfaceSample | undefined;
  sampleBestSurface(x: number, z: number, filter?: SurfaceFilter): SurfaceSample | undefined;
  sampleVolumes(x: number, y: number, z: number): TerrainVolumeSample[];
}
```

Rendering, picking, movement, object placement, and physics should call this terrain query or consume data derived from it. That prevents rendering, nav, and physics from each inventing their own flat ground.

### Water Volumes

Water should be water sitting on top of sunk terrain, not a blue terrain tile.

Represent a lake, river, sea, flooded quarry, harbor, reservoir, or underwater cave as a water volume with a top surface and a bottom surface:

```ts
type WaterBody = {
  id: string;
  kind: "water";
  polygon: Array<{ x: number; z: number }>;
  surface:
    | { mode: "constantY"; y: number }
    | { mode: "heightfield"; surfaceId: string };
  bottomSurfaceId: string;
  waterType: "fresh" | "salt" | "muddy" | "toxic";
  flow?: { x: number; z: number; speed: number };
  navigation?: {
    surfaceAllowed: boolean;
    submergedAllowed: boolean;
    seabedAllowed: boolean;
  };
};
```

Depth is derived:

```text
waterDepth(x, z) = waterSurfaceY(x, z) - terrainBottomY(x, z)
```

If depth is less than or equal to zero, there is no water at that point.

Movement profiles interpret the same water differently:

```text
wheeled vehicle: blocked if waterDepth > maxWadeDepth
amphibious vehicle: allowed up to profile-specific depth
boat: navigates water surface, blocked by land and shallow water
submarine: navigates within water volume, needs min depth and clearance
diver/underwater drone: may navigate near seabed or within depth bands
```

For the first underwater implementation, do not add full continuous 3D pathfinding. Model underwater movement as two or three water navigation layers, such as:

```text
lake.surface
lake.shallow-submerged
lake.deep-submerged
lake.seabed
```

### Underground, Bridges, And Crossings

Caves and tunnels are the reason a pure heightfield is not enough. A heightfield gives one Y value per X/Z point. A cave requires at least two: the hill surface above and the cave floor below.

Represent caves and tunnels as separate surfaces inside air volumes:

```ts
type CaveVolume = {
  id: string;
  kind: "air";
  underground: true;
  floorSurfaceId: string;
  ceilingSurfaceId?: string;
  approximateClearance?: number;
  polygon?: Array<{ x: number; z: number }>;
};
```

A tunnel is:

```text
surface: tunnel.floor.north
volume:  tunnel.air.north
portal:  tunnel-mouth-west connects ground.overworld to tunnel.floor.north
portal:  tunnel-mouth-east connects tunnel.floor.north to ground.overworld
```

Roads and rails should become transport overlays on surfaces, not objects that own terrain height:

```ts
type TransportOverlay = {
  id: string;
  type: "road" | "rail" | "bridge-road" | "ford" | "track" | "tunnel-road";
  surfaceId: string;
  corridor:
    | { kind: "polyline"; points: Array<{ x: number; z: number }>; width: number }
    | { kind: "polygon"; points: Array<{ x: number; z: number }> };
  movement: {
    allowedProfiles?: string[];
    costMultiplier?: number;
    preferred?: boolean;
    lanes?: LaneSpec[];
  };
  renderAssetId?: string;
};
```

The physical deck of a bridge is a surface. The road painted on the bridge is an overlay. The pillars are placed objects with blockers/colliders. The water under the bridge is a volume. Boats pass under the bridge only if their profile fits the vertical clearance.

If two transport corridors overlap in X/Z but are on different surfaces, they do not connect. They only connect through an explicit portal, ramp, or junction:

```ts
type SurfacePortal = {
  id: string;
  kind: "ramp" | "tunnel-mouth" | "bridge-approach" | "stairs" | "lift" | "ford-entry";
  from: { surfaceId: string; areaId?: string };
  to: { surfaceId: string; areaId?: string };
  constraints?: {
    maxVehicleHeight?: number;
    maxVehicleWidth?: number;
    allowedProfiles?: string[];
    maxSlope?: number;
  };
  cost?: number;
};
```

### Movement Profiles And Edge Costs

Terrain facts belong to the map. Vehicle movement profiles decide how those facts affect traversal.

```ts
type MovementProfile = {
  id: string;
  radius: number;
  height: number;
  mediums: {
    land?: boolean;
    waterSurface?: boolean;
    underwater?: boolean;
    air?: boolean;
  };
  surfaceCosts: Record<SurfaceMaterialId, number>;
  overlayPreferences?: Record<string, number>;
  slope: {
    maxNormalSlopeDeg: number;
    maxRoadSlopeDeg?: number;
    uphillPenalty: number;
    downhillPenalty: number;
  };
  steps: {
    maxStepUp: number;
    maxDropDown: number;
    maxCliffDelta: number;
  };
  water?: {
    maxWadeDepth?: number;
    minBoatDepth?: number;
    minSubmergedDepth?: number;
    maxCurrentSpeed?: number;
  };
  clearance?: {
    minCeiling: number;
    minWidth: number;
  };
};
```

Initial profiles:

```text
wheeled.scout: land only, road preferred, low slope tolerance, shallow ford only
tracked.tank: land only, rough ground tolerated, moderate slope tolerance
climber.vehicle: land only, steep slope allowed, rock allowed at high cost
hovercraft: land + water surface, bad on steep slopes
boat.light: water surface only, requires minimum depth
submarine.small: underwater, requires depth and volume clearance
infantry: land, higher slope tolerance, can use stairs/tunnels/caves
train: rail overlay only, limited turning and slope
```

Traversal should be calculated mostly as an edge cost, not only as a tile cost:

```ts
type NavNode = {
  surfaceId: string;
  cx: number;
  cz: number;
};

type EdgeEval =
  | { allowed: true; cost: number; reason?: undefined }
  | { allowed: false; reason: string };

function evaluateEdge(
  terrain: TerrainQuery,
  profile: MovementProfile,
  from: NavNode,
  to: NavNode,
): EdgeEval;
```

The edge evaluator samples from height, to height, horizontal distance, 3D distance, slope, step/cliff delta, destination material, water depth, overlay bonuses, blockers, clearance, and portal constraints.

Simple first formula:

```text
base = horizontalDistance
surface = profile.surfaceCosts[destinationMaterial]
slopePenalty =
  1
  + uphillPenalty   * max(0, slope)
  + downhillPenalty * max(0, -slope)
overlayMultiplier = road/rail/track preference if present
cost = base * surface * slopePenalty * overlayMultiplier
```

Block the edge if the surface is unsupported, slope exceeds the profile limit, height delta exceeds step/cliff limits, water depth violates the profile, the cell is blocked on that surface, a portal is absent between stacked surfaces, or portal clearance is too low/narrow.

Important A* detail: current terrain costs are clamped to at least `1` to keep the heuristic stable. If road overlays ever make cost less than `1`, the heuristic must use the actual minimum possible edge multiplier, or the route may become non-admissible. The simpler option is to keep roads at `1` and make grass, mud, forest, rock, and slopes cost more than `1`.

### Movement Layers

Do not throw away the grid immediately. Evolve it from the current `NavGrid` into cached movement layers derived from the terrain world:

```text
TerrainWorld
  surfaces
  water bodies
  overlays
  portals
  blockers

MovementLayerCache
  key: terrain revision + movement profile id
  value: derived walkability + edge costs
```

New structure:

```ts
type MovementLayer = {
  profileId: string;
  terrainRevision: number;
  surfaces: Record<string, SurfaceMovementGrid>;
  portals: PortalMovementEdge[];
};

type SurfaceMovementGrid = {
  surfaceId: string;
  widthCells: number;
  depthCells: number;
  nodes: MovementNode[];
};

type MovementNode = {
  walkable: boolean;
  sampleY: number;
  material: SurfaceMaterialId;
  waterDepth: number;
  overlays: string[];
  blockedBy?: string;
};
```

Pathfinding becomes:

```ts
findPath(layer, start: NavNode, target: NavNode)
```

instead of:

```ts
findPath(grid, start: Cell, target: Cell)
```

### Map Schema V2 Direction

Introduce a versioned map schema instead of stretching the current flat v1 schema too far. Version 2 should remain backward-compatible by converting v1 maps into one flat `ground.overworld` surface during load.

Compact v2 shape:

```json
{
  "version": 2,
  "name": "terrain-semantics-test",
  "size": { "cellsX": 64, "cellsZ": 64, "cellSize": 2 },
  "terrain": {
    "revision": 1,
    "defaultSurfaceId": "ground.overworld",
    "surfaces": [],
    "waterBodies": [],
    "volumes": [],
    "overlays": [],
    "portals": []
  },
  "placements": [],
  "actors": []
}
```

For authoring, the editor can expose terrain operations like ridges, depressions, plateaus, ramps, and noise. The runtime should consume the resolved heightfield/mesh, not a pile of special gameplay patches.

### Placement Anchors

The current map places objects with absolute `{ x, y, z }`, and most objects use `y: 0`. The next schema should allow objects to anchor to a surface:

```ts
type PlacementAnchor =
  | { kind: "absolute"; position: { x: number; y: number; z: number } }
  | { kind: "surface"; surfaceId: string; x: number; z: number; offsetY?: number }
  | { kind: "waterSurface"; waterBodyId: string; x: number; z: number; offsetY?: number };
```

Different asset classes need different foundation behavior:

```text
conformToTerrain: trees, rocks, debris
requiresFlatPad: factories, barracks, power plants
createsFoundation: building placement modifies terrain/pad
cutsIntoTerrain: bunker, tunnel mouth, cave entrance
floatsOnWater: boats, buoys, docks
```

Represent that explicitly:

```ts
type FoundationMode =
  | "conform"
  | "requires-flat"
  | "flatten-pad"
  | "deck"
  | "cuts-into-terrain";
```

### Rendering, Physics, And Picking

Rendering v1:

```text
Build one Babylon mesh from the heightfield.
Use corner heights for vertices.
Generate normals.
Assign material by cell/slope/overlay.
Make the terrain mesh pickable.
Render water body surfaces separately over sunk terrain.
Render bridge decks, tunnel floors, cave floors, ceilings, and walls as separate meshes.
```

Physics should not become the source of terrain truth. Physics enforces the terrain model.

Staged physics:

```text
Stage A:
  Visual terrain and nav terrain use real height.
  Vehicle Y is snapped to terrain sample.
  Rapier remains mostly for object collision.

Stage B:
  Replace flat ground collider with a heightfield or trimesh collider.
  Kinematic actor follows the sampled terrain surface.

Stage C:
  Add separate colliders for bridge decks, tunnel floors, cave walls, ceilings, and water-volume triggers.
```

Pointer state should include surface and medium information:

```ts
type PointerNavState = {
  world?: NavPoint;
  cell?: NavNode;
  surfaceId?: string;
  medium?: "land" | "waterSurface" | "underwater" | "air";
};
```

The engine must be able to distinguish clicks on overworld ground, bridge deck, road on bridge, water surface, tunnel floor, cave floor, and underground objects.

### Terrain Implementation Slices

Do not implement all of this at once.

Current todo review after the actor-selection/cache slice:

| Slice | Status | Reviewed notes |
| ----- | ------ | -------------- |
| 1. Terrain surface v1 | Mostly done | `TerrainWorld`, height recipes/corner heights, surface samples, normals, material lookup, custom Babylon heightfield mesh, `NavPoint.y`, slope/step/cliff edge checks, surface anchors, terrain-Y debug paths, vehicle Y snapping, and uphill-cost coverage exist. Remaining: placement anchoring acceptance tests; physics still needs real terrain colliders. |
| 2. Water volume v1 | Partial | `WaterBody`, derived water depth, water-surface runtime surfaces, water rendering, `maxWadeDepth`/`minBoatDepth`, boat/amphibious profiles, `WaterBody.navigation.surfaceAllowed`, and runtime selection for non-scout actors exist. Remaining: shoreline derivation and stronger boat/amphibious route tests. |
| 3. Multi-surface navigation | Partial | `surfaceId` nav nodes, multiple movement grids, bridge/tunnel surfaces, explicit portals, portal-aware A*, `MovementLayerCache`, and actor-specific runtime layers exist. Remaining: road-over-road/ramp acceptance maps and broader bridge clearance behavior. |
| 4. Underground/cave semantics | Partial | Tunnel floors, air-volume schema, tunnel-mouth portals, low-clearance constraints, and tall-profile rejection tests exist. Remaining: cave floor/route demo, camera/debug layer controls for underground visibility, and playable tunnel actor scenarios. |
| 5. Underwater missions | Not started | No submerged nav layers, depth bands, seabed obstacles, submarine profile, or underwater routing yet. |

Slice 1, terrain surface v1:

```text
Goal: replace flat ground with one authoritative heightfield.

Add:
TerrainWorld
TerrainSurface
TerrainQuery
heightAt / normalAt / materialAt
custom Babylon terrain mesh
NavPoint with y
A* edge slope costs
vehicle y snapping

Acceptance:
Map has a hill, gentle slope, crest, steep drop, and sunken basin.
Wheeled vehicle climbs the gentle slope.
Wheeled vehicle refuses the cliff edge.
Uphill path costs more than flat path.
Debug path follows terrain Y instead of drawing at constant Y.
Objects anchor to terrain surface instead of y=0.
```

Slice 2, water volume v1:

```text
Goal: water is on top of sunk terrain.

Add:
WaterBody
water depth query
water material/render mesh
shoreline derivation
movement profiles with maxWadeDepth / minBoatDepth

Acceptance:
Car is blocked by deep water.
Car can cross shallow ford if profile allows it.
Boat can route across lake/river surface.
Boat is blocked by land and shallow water.
Amphibious unit can cross land and water according to profile.
```

Slice 3, multi-surface navigation:

```text
Goal: stacked surfaces and explicit portals.

Add:
surfaceId in nav nodes
multiple movement grids
portals
bridge deck surface
tunnel floor surface
portal-aware A*

Acceptance:
Road bridge crosses water.
Land vehicle crosses bridge.
Boat passes under bridge if clearance allows.
Road-over-road crossing does not create an accidental intersection.
Ramp portal connects lower road to upper road.
```

Slice 4, underground/cave semantics:

```text
Goal: tunnels and caves are real spaces.

Add:
underground floor surfaces
air volumes
clearance constraints
tunnel mouths
camera/debug layer controls

Acceptance:
Unit can enter tunnel only through tunnel mouth.
Surface unit and tunnel unit can share X/Z at different Y without semantic collision.
Tall unit is blocked by low tunnel clearance.
Cave route can pass under hill.
```

Slice 5, underwater missions:

```text
Goal: water volume gets depth-aware navigation.

Add:
submerged nav layers or simple 3D water graph
depth bands
seabed obstacles
submarine movement profile

Acceptance:
Surface boat, amphibious unit, and submarine interpret the same water body differently.
Submarine requires sufficient depth.
Seabed unit follows bottom terrain.
Surface craft cannot enter submerged cave unless clearance/depth allows.
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
Multiple individually selectable demo units
Debug nav-grid toggle
```

The user can:

```text
Pan camera
Zoom camera
Rotate camera in 90° increments or free yaw
Click a unit to select it
Click terrain to move the selected unit
See the last commanded path as a debug line
See blocked nav cells in debug mode
See a lower-right vehicle camera inset
Reset selected unit to spawn
```

The selected unit should:

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
| Nav grid          | The app generates a grid navigation layer from the map’s object footprints.                             | Done; active terrain demo uses `MovementLayer` |
| Debug overlay     | Pressing a key toggles visible blocked/walkable cells.                                                  | Done |
| Click-to-move     | Clicking walkable terrain commands the selected actor to move there.                                    | Done |
| Pathfinding       | Vehicle uses A* over the nav grid and avoids blocked cells.                                             | Done; active terrain demo uses surface-aware A*, without road-lane direction |
| Physics/collision | Vehicle does not pass through solid obstacles.                                                          | Done |
| Stuck handling    | If movement is blocked for more than a short threshold, vehicle stops and marks blocked.                | Done |
| Tests             | Core nav-grid and A* functions have unit tests.                                                         | Done |
| Deployment        | `main` can be built and deployed to GitHub Pages under `/bb-lieutenants/`.                              | Done |
| Extensibility     | Map schema can later support resource nodes, player starts, unit types, and terrain costs.              | Partial; v2 terrain supports surfaces, water, volumes, overlays, portals, anchors, and movement profiles; resource/player/editor systems are future |

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
      terrain-poc.map.json
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
      TerrainRenderer.ts
      SelectionMarker.ts
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
      MovementProfiles.ts
      MovementLayer.ts
      MovementLayerCache.ts
      SurfaceAStar.ts
      nearestWalkable.ts

    terrain/
      TerrainWorld.ts

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
      terrainworld.test.ts
      movementlayer.test.ts
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

Reason: RTS-style movement, harvesting, building placement, fog of war, resource patches, and terrain costs are all naturally grid-friendly. Complex ramps, bridges, cliffs, and ride-along terrain traversal should first be represented as sampled surfaces, movement layers, and portals. Navmesh can still come later if the game needs it, but it is not the core terrain model.

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
terrain-poc.map.json
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
public/maps/terrain-poc.map.json
```

````

---

# 23. Known limitations to document

The agent should explicitly document these:

```text
Navigation is movement-grid-based, not navmesh-based.
Footprints are manually authored; they are not inferred from GLB geometry.
Terrain v2 has heightfields, decks, tunnel floors, water volumes, overlays, portals, and placement anchors, but it is still hand-authored POC data.
The active terrain POC remains one maintained map for now; if it feels tight, rebalance or expand `terrain-poc.map.json` in place instead of adding a second sandbox map.
Physics is kinematic only.
Physics terrain still uses a flat proxy collider; no heightfield or trimesh terrain collider exists yet.
Actors are individually selectable at runtime, but there is no box selection, multi-select, or command queue yet.
There is no multiplayer.
There is no gameplay state beyond movement.
Stuck handling stops the actor; it does not automatically repath.
Road overlays and profile costs exist, but there is no lane, direction, or right-side-driving model yet.
Traversal is vehicle-profile-specific; the active runtime layer follows the currently selected actor.
There are no submerged/underwater navigation layers yet.
There is no in-app terrain/map authoring tool.
There is no in-app map reload; reset only returns the selected actor to spawn.
Asset filenames depend on downloaded Kenney packs.
````

---

# 24. Future slices enabled by this POC

After the terrain POC, the next slices are:

```text
Add remaining terrain POC acceptance tests and demo controls
Rebalance or expand the active `terrain-poc.map.json` layout in place if feature tests need more space
Heightfield/trimesh terrain physics collider
Shoreline derivation and stronger water-routing demos
Bridge/tunnel/cave camera and debug layer controls
Underwater mission layers
Submarine and seabed movement profiles
Map authoring tool
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
Toggleable or enlarged ride-along perspective camera
```

The important thing is that this POC now creates the foundation those systems need: world coordinates, v2 terrain data, asset placement, navigability, physics boundaries, and actor movement. Keep one maintained active map until the terrain model settles; if test zones need room, resize or rebalance `terrain-poc.map.json` directly instead of maintaining a second manual sandbox. Harden the terrain semantics before building a map authoring tool so the editor authors stable physical terrain facts rather than temporary demo-only costs.

---

# 25. Copy-paste implementation brief for an agent

```text
Implement a browser-based TypeScript/Vite POC for a 3D isometric RTS-style navigable world.

Use Babylon.js for rendering and GLB asset loading. Use @babylonjs/loaders for GLB support. Use @dimforge/rapier3d-compat for basic kinematic collision. Do not implement multiplayer, economy, combat, AI, or production UI.

The app must load the active JSON terrain map from public/maps/terrain-poc.map.json. The legacy flat public/maps/poc.map.json may remain as a v1 compatibility map. The active map defines size, terrain surfaces, water bodies, volumes, transport overlays, portals, static placements, and multiple actors. Static placements reference asset IDs from public/asset-registry.json. Assets are Kenney-style GLB files stored under public/assets/kenney/.

Implement:
- Babylon engine/scene setup.
- Orthographic isometric RTS camera with pan and zoom.
- AssetManager that loads each GLB once and instantiates it.
- MapLoader and MapBuilder that construct the scene from JSON.
- Movement layers generated from terrain surfaces and manually authored placement footprints.
- Surface-aware A* pathfinding over `surfaceId + cell` nodes with 8-way movement, no diagonal corner-cutting, and explicit portal edges.
- Click-to-move by ray-picking terrain surfaces.
- Selectable actor control with cached actor-specific movement layers.
- Basic Rapier static colliders for obstacles and kinematic colliders for actors.
- Debug overlays for nav grid, path, actor state, and mouse cell.
- Vitest tests for NavGrid, footprint rasterization, A*, TerrainWorld, MovementLayer, and SurfaceAStar.

Acceptance:
- npm install && npm run dev starts the app.
- A 3D isometric terrain map renders with buildings, trees, roads/decorations, bridge/tunnel/water surfaces, and multiple actors.
- The map is data-driven from JSON.
- Movement layers mark buildings/trees as blocked according to actor radius/profile.
- Pressing G toggles nav-grid debug.
- Clicking a unit selects it; clicking walkable terrain commands the selected actor.
- Selected actors path around obstacles according to their movement profile.
- Actors do not pass through solid objects.
- Core navigation logic has tests.
- README documents setup, controls, asset folder layout, map format, and limitations.
```

My recommendation is to keep this POC focused on **one map, selectable actors, terrain-derived movement grids, GLB assets, isometric camera, and basic collision**. Harden terrain semantics and runtime controls before taking on economy, combat, multiplayer, or the map editor.

[1]: https://kenney.nl/knowledge-base/game-assets-3d/importing-3d-models-into-game-engines "https://kenney.nl/knowledge-base/game-assets-3d/importing-3d-models-into-game-engines"
[2]: https://kenney.nl/assets/city-kit-industrial "https://kenney.nl/assets/city-kit-industrial"
[3]: https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/importers/loadingFileTypes.md "https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/importers/loadingFileTypes.md"
[4]: https://rapier.rs/docs/user_guides/javascript/character_controller/ "https://rapier.rs/docs/user_guides/javascript/character_controller/"
[5]: https://doc.babylonjs.com/toolsAndResources/inspectorv2/ "https://doc.babylonjs.com/toolsAndResources/inspectorv2/"
