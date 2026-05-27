import type { MapDefinition, MovementProfile } from "../map/MapTypes";

export const DEFAULT_MOVEMENT_PROFILES: MovementProfile[] = [
  {
    id: "wheeled.scout",
    radius: 0.9,
    height: 2.1,
    mediums: { land: true },
    surfaceCosts: { default: 3, grass: 3, road: 1, concrete: 1, mud: 4, rock: 7, water: 99 },
    overlayPreferences: { default: 1, "road.main": 1, "road.bridge": 1, "road.tunnel": 1, "ford.shallow": 1.4 },
    slope: { maxNormalSlopeDeg: 24, maxRoadSlopeDeg: 34, uphillPenalty: 1.5, downhillPenalty: 0.45 },
    steps: { maxStepUp: 1.2, maxDropDown: 1.4, maxCliffDelta: 2.2 },
    water: { maxWadeDepth: 0.55 },
    clearance: { minCeiling: 2.2, minWidth: 2.2 },
  },
  {
    id: "boat.light",
    radius: 1.2,
    height: 1.6,
    mediums: { waterSurface: true },
    surfaceCosts: { default: 1, water: 1 },
    slope: { maxNormalSlopeDeg: 90, uphillPenalty: 0, downhillPenalty: 0 },
    steps: { maxStepUp: 100, maxDropDown: 100, maxCliffDelta: 100 },
    water: { minBoatDepth: 1.1 },
    clearance: { minCeiling: 1.5, minWidth: 2.4 },
  },
  {
    id: "amphibious.light",
    radius: 1,
    height: 2,
    mediums: { land: true, waterSurface: true },
    surfaceCosts: { default: 2.4, grass: 2.4, road: 1.2, concrete: 1.1, mud: 3, rock: 5, water: 1.5 },
    overlayPreferences: { default: 1, "road.main": 1, "road.bridge": 1, "ford.shallow": 1 },
    slope: { maxNormalSlopeDeg: 28, maxRoadSlopeDeg: 36, uphillPenalty: 1.1, downhillPenalty: 0.35 },
    steps: { maxStepUp: 1.4, maxDropDown: 1.6, maxCliffDelta: 2.4 },
    water: { maxWadeDepth: 0.7, minBoatDepth: 0.8 },
    clearance: { minCeiling: 2.1, minWidth: 2.2 },
  },
  {
    id: "tall.vehicle",
    radius: 1.1,
    height: 4.6,
    mediums: { land: true },
    surfaceCosts: { default: 3, grass: 3, road: 1, concrete: 1, mud: 4, rock: 7 },
    overlayPreferences: { default: 1, "road.main": 1, "road.bridge": 1 },
    slope: { maxNormalSlopeDeg: 22, maxRoadSlopeDeg: 30, uphillPenalty: 1.6, downhillPenalty: 0.5 },
    steps: { maxStepUp: 1, maxDropDown: 1.2, maxCliffDelta: 2 },
    water: { maxWadeDepth: 0.35 },
    clearance: { minCeiling: 4.6, minWidth: 2.5 },
  },
  {
    id: "infantry",
    radius: 0.35,
    height: 1.8,
    mediums: { land: true },
    surfaceCosts: { default: 2, grass: 2, road: 1, concrete: 1, mud: 3, rock: 4 },
    overlayPreferences: { default: 1, "road.main": 1, "road.bridge": 1, "road.tunnel": 1 },
    slope: { maxNormalSlopeDeg: 38, maxRoadSlopeDeg: 42, uphillPenalty: 0.8, downhillPenalty: 0.3 },
    steps: { maxStepUp: 1, maxDropDown: 1.6, maxCliffDelta: 2.6 },
    water: { maxWadeDepth: 0.4 },
    clearance: { minCeiling: 1.8, minWidth: 0.8 },
  },
];

export function getMovementProfile(map: MapDefinition, profileId: string | undefined): MovementProfile {
  const profiles = map.version === 2 ? [...DEFAULT_MOVEMENT_PROFILES, ...(map.movementProfiles ?? [])] : DEFAULT_MOVEMENT_PROFILES;
  const id = profileId ?? "wheeled.scout";
  const profile = profiles.find((candidate) => candidate.id === id);
  if (!profile) throw new Error(`Unknown movement profile: ${id}`);
  return profile;
}
