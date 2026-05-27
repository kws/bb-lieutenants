# BB Lieutenants RTS World POC

Browser-based TypeScript/Vite demo for a 3D isometric RTS-style world. It loads Kenney GLB assets, builds a JSON-authored map, computes a grid navigation layer from explicit footprints, and moves one vehicle with click-to-move pathfinding plus Rapier kinematic collision.

## Setup

```bash
npm install
npm run dev
```

The dev server serves the app from the repo root. The demo map is `public/maps/poc.map.json`, and asset IDs are defined in `public/asset-registry.json`.

## Controls

- Left click: move the selected vehicle.
- Shift + left click: direct collision test. The vehicle ignores A* and drives straight toward the clicked point so Rapier can stop it on buildings/props.
- Right or middle drag: pan camera.
- Mouse wheel: zoom.
- `Q` / `E`: rotate camera.
- `Home`: reset camera.
- `F`: focus camera on the vehicle.
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

The map file defines size, flat terrain, placements, and one actor. Placements reference registry asset IDs and may override `nav` and `physics`. Navigation is explicitly authored through rectangle/circle footprints; mesh geometry is not used for navigation.

## Known Limitations

- Navigation is grid-based, not navmesh-based.
- Footprints are manually authored and axis-aligned for this demo.
- Terrain is flat.
- Physics is kinematic only.
- There is one controllable actor.
- No multiplayer, economy, combat, AI, fog of war, or save-game system.
- Road costs are supported, but this demo keeps path costs at `>= 1` for stable A* heuristics.

## Verification

```bash
npm run test
npm run build
```
