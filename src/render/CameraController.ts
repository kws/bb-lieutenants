import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import { DEBUG_LAYER_MASK, WORLD_LAYER_MASK } from "./RenderLayers";

const MIN_ORTHO_SIZE = 24;
const MAX_ORTHO_SIZE = 110;

export class CameraController {
  readonly camera: ArcRotateCamera;

  private orthoSize = 68;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  constructor(
    scene: Scene,
    private readonly canvas: HTMLCanvasElement,
  ) {
    this.camera = new ArcRotateCamera("camera.iso", -Math.PI / 4, Math.PI / 3, 100, Vector3.Zero(), scene);
    this.camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    this.camera.layerMask = WORLD_LAYER_MASK | DEBUG_LAYER_MASK;
    this.camera.lowerBetaLimit = Math.PI / 5;
    this.camera.upperBetaLimit = Math.PI / 2.4;
    this.camera.attachControl(canvas, false);
    this.applyOrtho();
    this.bindControls();
  }

  reset(): void {
    this.camera.alpha = -Math.PI / 4;
    this.camera.beta = Math.PI / 3;
    this.camera.target = Vector3.Zero();
    this.orthoSize = 68;
    this.applyOrtho();
  }

  rotate(delta: number): void {
    this.camera.alpha += delta;
  }

  follow(position: Vector3): void {
    this.camera.target = new Vector3(position.x, 0, position.z);
  }

  resize(): void {
    this.applyOrtho();
  }

  get modeLabel(): string {
    return "ISO";
  }

  private bindControls(): void {
    this.canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      const zoom = event.deltaY > 0 ? 1.08 : 0.92;
      this.orthoSize = clamp(this.orthoSize * zoom, MIN_ORTHO_SIZE, MAX_ORTHO_SIZE);
      this.applyOrtho();
    });

    this.canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 1 && event.button !== 2) return;
      this.dragging = true;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.canvas.setPointerCapture(event.pointerId);
    });

    this.canvas.addEventListener("pointermove", (event) => {
      if (!this.dragging) return;
      const dx = event.clientX - this.lastX;
      const dy = event.clientY - this.lastY;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.pan(dx, dy);
    });

    this.canvas.addEventListener("pointerup", (event) => {
      if (!this.dragging) return;
      this.dragging = false;
      this.canvas.releasePointerCapture(event.pointerId);
    });

    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());

    window.addEventListener("keydown", (event) => {
      if (event.code === "KeyQ") this.rotate(-Math.PI / 2);
      if (event.code === "KeyE") this.rotate(Math.PI / 2);
      if (event.code === "Home") this.reset();
    });
  }

  private pan(screenDx: number, screenDy: number): void {
    const scale = this.orthoSize / Math.max(1, this.canvas.clientHeight);
    const right = new Vector3(Math.cos(this.camera.alpha), 0, Math.sin(this.camera.alpha));
    const forward = new Vector3(Math.sin(this.camera.alpha), 0, -Math.cos(this.camera.alpha));
    const delta = right.scale(-screenDx * scale).addInPlace(forward.scale(screenDy * scale));
    this.camera.target.addInPlace(delta);
  }

  private applyOrtho(): void {
    const aspect = Math.max(1, this.canvas.clientWidth) / Math.max(1, this.canvas.clientHeight);
    this.camera.orthoTop = this.orthoSize * 0.5;
    this.camera.orthoBottom = -this.orthoSize * 0.5;
    this.camera.orthoLeft = -this.orthoSize * aspect * 0.5;
    this.camera.orthoRight = this.orthoSize * aspect * 0.5;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
