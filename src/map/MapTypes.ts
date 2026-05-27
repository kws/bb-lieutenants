import type { WorldPoint } from "../nav/NavTypes";

export type Vector3Data = {
  x: number;
  y: number;
  z: number;
};

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
  url: string;
  category: "terrain" | "building" | "vegetation" | "rock" | "vehicle" | "prop";
  defaultScale?: number;
  defaultRotationY?: number;
  defaultNav?: NavFootprint;
};

export type AssetRegistry = Record<string, AssetDefinition>;

export type PlacementDefinition = {
  id: string;
  assetId: string;
  position: Vector3Data;
  rotationY?: number;
  scale?: number;
  nav?: NavFootprint;
  physics?: PhysicsSpec;
};

export type ActorDefinition = {
  id: string;
  type: string;
  assetId: string;
  position: Vector3Data;
  rotationY?: number;
  movement: {
    radius: number;
    speed: number;
    turnRate: number;
  };
  physics: {
    shape: "capsule";
    radius: number;
    height: number;
  };
};

export type MapDefinition = {
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

export type BuiltPlacement = {
  id: string;
  assetId: string;
  position: WorldPoint;
  nav?: NavFootprint;
};
