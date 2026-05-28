# Build & Bungle Lieutenants RTS World POC

Browser-based TypeScript/Vite demo for **Build & Bungle Lieutenants**, a 3D isometric RTS-style world. It loads Kenney GLB assets, builds a JSON-authored terrain map, derives movement grids from terrain surfaces and explicit footprints, and moves selectable vehicles with click-to-move pathfinding plus Rapier kinematic collision.

## Setup

```bash
npm install
npm run dev
```

The dev server serves the app from the repo root. The active demo map is `public/maps/terrain-poc.map.json`; `public/maps/poc.map.json` is the legacy flat v1 map. Asset IDs are defined in `public/asset-registry.json`.

The `main` branch deploys to GitHub Pages at <https://kws.github.io/bb-lieutenants/>.

## Controls

- Left click a unit: select it.
- Left click terrain: move the selected unit using that unit's movement profile.
- Shift + left click: direct collision test. The selected unit ignores A* and drives straight toward the clicked point so Rapier can stop it on buildings/props.
- Lower-right inset: live hood camera from the selected unit.
- Right or middle drag: pan camera.
- Mouse wheel: zoom.
- `Q` / `E`: rotate camera.
- `Home`: reset camera.
- `F`: focus camera on the selected unit.
- `R`: reset vehicle to spawn.
- `G`: toggle nav grid.
- `P`: toggle path line.
- `B`: toggle footprint debug.
- `I`: toggle Babylon Inspector.

## Asset Layout

The demo uses a curated subset extracted from `3pty-assets/` into:

```text
public/assets/kenney/
  car-kit/
  city-kit-industrial/
  city-kit-roads/
  factory-kit/
  nature-kit/
```

The registry references sanitized paths without Kenney's original `GLB format` / `GLTF format` directory names.

## Map Format

The active v2 map defines terrain surfaces, water bodies, air volumes, overlays, portals, placements, and actors. The terrain POC includes a heightfield, bridge deck, tunnel floor, water surface, surface/water anchors, and movement profiles for scout, boat, amphibious, tall vehicle, and infantry-style traversal. Placements reference registry asset IDs and may override `nav` and `physics`. Navigation blockers are still explicitly authored through rectangle/circle footprints; GLB mesh geometry is not used for navigation.

## Known Limitations

- Navigation is movement-grid-based, not navmesh-based.
- Footprints are manually authored; they are not inferred from GLB geometry.
- Terrain v2 has heightfields, decks, tunnel floors, water volumes, overlays, portals, and placement anchors, but it is still hand-authored POC data.
- Physics is kinematic only.
- Physics terrain still uses a flat proxy collider; visual/nav terrain owns elevation for now.
- Actors are selectable, but there is no box selection or command queue yet.
- No multiplayer, economy, combat, AI, fog of war, or save-game system.
- Road overlays and profile costs exist, but there is no lane, direction, or right-side-driving model yet.
- There are no submerged/underwater navigation layers yet.

## Verification

```bash
npm run test
npm run build
```
