import { Engine } from "@babylonjs/core/Engines/engine";

export function createEngine(canvas: HTMLCanvasElement): Engine {
  return new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    antialias: true,
  });
}

