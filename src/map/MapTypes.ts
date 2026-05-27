import type { WorldPoint } from "../nav/NavTypes";

export type Vector2Data = {
  x: number;
  z: number;
};

export type Vector3Data = {
  x: number;
  y: number;
  z: number;
};

export type SurfaceMaterialId = string;

export type CellLayer<T> =
  | T
  | {
      default: T;
      cells?: T[];
    };

export type HeightRecipeFeature =
  | {
      kind: "hill";
      center: Vector2Data;
      radius: number;
      height: number;
    }
  | {
      kind: "basin";
      center: Vector2Data;
      radius: number;
      depth: number;
    }
  | {
      kind: "ramp";
      area: { xMin: number; xMax: number; zMin: number; zMax: number };
      axis: "x" | "z";
      startY: number;
      endY: number;
    }
  | {
      kind: "ridge";
      axis: "x" | "z";
      center: number;
      width: number;
      height: number;
      area?: { xMin: number; xMax: number; zMin: number; zMax: number };
    }
  | {
      kind: "step";
      axis: "x" | "z";
      at: number;
      direction: "negative" | "positive";
      delta: number;
      range?: { min: number; max: number };
    };

export type HeightRecipe = {
  baseY?: number;
  features: HeightRecipeFeature[];
};

export type TerrainSurfaceDefinition =
  | {
      id: string;
      kind: "heightfield";
      cellSize: number;
      cellsX: number;
      cellsZ: number;
      origin?: Vector2Data;
      cornerHeights?: number[];
      heightRecipe?: HeightRecipe;
      material?: CellLayer<SurfaceMaterialId>;
      roughness?: CellLayer<number>;
    }
  | {
      id: string;
      kind: "deck" | "tunnel";
      cellSize: number;
      cellsX: number;
      cellsZ: number;
      origin: Vector2Data;
      y: number;
      material?: CellLayer<SurfaceMaterialId>;
      roughness?: CellLayer<number>;
      approximateClearance?: number;
    };

export type TransportOverlay = {
  id: string;
  type: "road" | "rail" | "bridge-road" | "ford" | "track" | "tunnel-road";
  surfaceId: string;
  corridor:
    | { kind: "polyline"; points: Vector2Data[]; width: number }
    | { kind: "polygon"; points: Vector2Data[] };
  movement: {
    allowedProfiles?: string[];
    costMultiplier?: number;
    preferred?: boolean;
  };
  renderAssetId?: string;
};

export type SurfacePortal = {
  id: string;
  kind: "ramp" | "tunnel-mouth" | "bridge-approach" | "stairs" | "lift" | "ford-entry";
  from: { surfaceId: string; x: number; z: number; radius?: number };
  to: { surfaceId: string; x: number; z: number; radius?: number };
  constraints?: {
    maxVehicleHeight?: number;
    maxVehicleWidth?: number;
    allowedProfiles?: string[];
    maxSlope?: number;
  };
  cost?: number;
};

export type WaterBody = {
  id: string;
  kind: "water";
  polygon: Vector2Data[];
  surface: { mode: "constantY"; y: number };
  bottomSurfaceId: string;
  waterType: "fresh" | "salt" | "muddy" | "toxic";
  flow?: { x: number; z: number; speed: number };
  navigation?: {
    surfaceAllowed: boolean;
    submergedAllowed: boolean;
    seabedAllowed: boolean;
  };
  clearanceUnderOverlays?: Record<string, number>;
};

export type TerrainVolume =
  | {
      id: string;
      kind: "air";
      underground?: boolean;
      floorSurfaceId: string;
      ceilingSurfaceId?: string;
      approximateClearance?: number;
      polygon?: Vector2Data[];
    }
  | WaterBody;

export type MovementProfile = {
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

export type PlacementAnchor =
  | { kind: "absolute"; position: Vector3Data }
  | { kind: "surface"; surfaceId: string; x: number; z: number; offsetY?: number }
  | { kind: "waterSurface"; waterBodyId: string; x: number; z: number; offsetY?: number };

export type FoundationMode = "conform" | "requires-flat" | "flatten-pad" | "deck" | "cuts-into-terrain";

export type NavFootprint =
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

export type PhysicsSpec =
  | {
      solid: true;
      shape: "box";
      size: Vector3Data;
    }
  | {
      solid: true;
      shape: "cylinder";
      radius: number;
      height: number;
    }
  | {
      solid: false;
    };

export type AssetDefinition = {
  url?: string;
  procedural?: "boat";
  category: "terrain" | "building" | "vegetation" | "rock" | "vehicle" | "prop";
  defaultScale?: number;
  defaultRotationY?: number;
  defaultNav?: NavFootprint;
};

export type AssetRegistry = Record<string, AssetDefinition>;

export type PlacementDefinition = {
  id: string;
  assetId: string;
  position?: Vector3Data;
  anchor?: PlacementAnchor;
  rotationY?: number;
  scale?: number;
  nav?: NavFootprint;
  physics?: PhysicsSpec;
  foundation?: FoundationMode;
};

export type ActorDefinition = {
  id: string;
  type: string;
  assetId: string;
  position?: Vector3Data;
  anchor?: PlacementAnchor;
  rotationY?: number;
  movement: {
    radius: number;
    speed: number;
    turnRate: number;
    profileId?: string;
  };
  physics: {
    shape: "capsule";
    radius: number;
    height: number;
  };
};

export type MapV1Definition = {
  version: 1;
  name: string;
  size: {
    cellsX: number;
    cellsZ: number;
    cellSize: number;
  };
  terrain: {
    base: string;
    heightMode: "flat";
    defaultCost?: number;
  };
  playerStarts: Array<{
    id: string;
    position: Vector3Data;
    rotationY?: number;
  }>;
  placements: PlacementDefinition[];
  actors: ActorDefinition[];
};

export type MapV2Definition = {
  version: 2;
  name: string;
  size: {
    cellsX: number;
    cellsZ: number;
    cellSize: number;
  };
  terrain: {
    revision: number;
    defaultSurfaceId: string;
    surfaces: TerrainSurfaceDefinition[];
    waterBodies: WaterBody[];
    volumes: TerrainVolume[];
    overlays: TransportOverlay[];
    portals: SurfacePortal[];
  };
  movementProfiles?: MovementProfile[];
  playerStarts?: Array<{
    id: string;
    anchor: PlacementAnchor;
    rotationY?: number;
  }>;
  placements: PlacementDefinition[];
  actors: ActorDefinition[];
};

export type MapDefinition = MapV1Definition | MapV2Definition;

export type BuiltPlacement = {
  id: string;
  assetId: string;
  position: WorldPoint;
  surfaceId: string;
  nav?: NavFootprint;
};
