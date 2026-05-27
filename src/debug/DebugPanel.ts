export type DebugPanelState = {
  fps: number;
  camera: string;
  mouseWorld?: { x: number; z: number };
  mouseCell?: { cx: number; cz: number; walkable: boolean; blockedBy?: string };
  actorId?: string;
  actorState?: string;
  pathLength?: number;
  collision?: boolean;
};

export class DebugPanel {
  constructor(private readonly element: HTMLElement) {}

  update(state: DebugPanelState): void {
    const mouse = state.mouseWorld
      ? `Mouse: x=${state.mouseWorld.x.toFixed(1)} z=${state.mouseWorld.z.toFixed(1)}`
      : "Mouse: --";
    const cell = state.mouseCell
      ? `Cell: ${state.mouseCell.cx}, ${state.mouseCell.cz} ${
          state.mouseCell.walkable ? "walkable" : `blocked:${state.mouseCell.blockedBy ?? "unknown"}`
        }`
      : "Cell: --";

    this.element.textContent = [
      `FPS: ${state.fps.toFixed(0)}`,
      `Camera: ${state.camera}`,
      mouse,
      cell,
      `Actor: ${state.actorId ?? "--"} ${state.actorState ?? ""}`.trim(),
      `Collision: ${state.collision ? "contact/blocked" : "clear"}`,
      `Path: ${state.pathLength ?? 0} waypoints`,
      "Controls: click move | RMB/MMB pan | wheel zoom | Q/E rotate",
      "Debug: Shift+click collision test | G grid | P path | B footprints | I inspector | R reset",
    ].join("\n");
  }
}
