export type DebugPanelState = {
  fps: number;
  camera: string;
  mouseWorld?: { surfaceId: string; x: number; y: number; z: number };
  mouseCell?: { surfaceId: string; cx: number; cz: number; walkable: boolean; blockedBy?: string };
  mouseMedium?: string;
  mouseMaterial?: string;
  mouseWaterDepth?: number;
  mouseOverlays?: string[];
  actorId?: string;
  actorSurfaceId?: string;
  actorProfileId?: string;
  actorState?: string;
  pathLength?: number;
  collision?: boolean;
};

export class DebugPanel {
  constructor(private readonly element: HTMLElement) {}

  update(state: DebugPanelState): void {
    const mouse = state.mouseWorld
      ? `Mouse: ${state.mouseWorld.surfaceId} x=${state.mouseWorld.x.toFixed(1)} y=${state.mouseWorld.y.toFixed(
          1,
        )} z=${state.mouseWorld.z.toFixed(1)}`
      : "Mouse: --";
    const cell = state.mouseCell
      ? `Cell: ${state.mouseCell.surfaceId} ${state.mouseCell.cx}, ${state.mouseCell.cz} ${
          state.mouseCell.walkable ? "walkable" : `blocked:${state.mouseCell.blockedBy ?? "unknown"}`
        }`
      : "Cell: --";
    const terrain = state.mouseWorld
      ? `Terrain: ${state.mouseMedium ?? "--"} ${state.mouseMaterial ?? "--"} depth=${(state.mouseWaterDepth ?? 0).toFixed(
          1,
        )} overlays=${state.mouseOverlays?.join(",") || "--"}`
      : "Terrain: --";

    this.element.textContent = [
      `FPS: ${state.fps.toFixed(0)}`,
      `Camera: ${state.camera}`,
      mouse,
      cell,
      terrain,
      `Actor: ${state.actorId ?? "--"} ${state.actorState ?? ""} ${state.actorSurfaceId ?? ""} ${
        state.actorProfileId ?? ""
      }`.trim(),
      `Collision: ${state.collision ? "contact/blocked" : "clear"}`,
      `Path: ${state.pathLength ?? 0} waypoints`,
      "Controls: click unit select | click terrain move | RMB/MMB pan | wheel zoom | Q/E rotate",
      "Debug: Shift+click collision test | G grid | P path | B footprints | I inspector | R reset",
    ].join("\n");
  }
}
