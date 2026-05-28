import "@babylonjs/inspector";
import { Scene } from "@babylonjs/core/scene";
import { createEngine } from "../render/createEngine";
import { createLighting } from "../render/Lighting";
import { CameraController } from "../render/CameraController";
import { AssetManager } from "../render/AssetManager";
import { MapBuilder } from "../map/MapBuilder";
import { loadMap } from "../map/MapLoader";
import { NavGridOverlay } from "../render/NavGridOverlay";
import { DebugDraw } from "../render/DebugDraw";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { VehicleController } from "../sim/VehicleController";
import { InputController } from "../input/InputController";
import { DebugPanel } from "../debug/DebugPanel";
import { VehicleCameraInset } from "../render/VehicleCameraInset";
import { SelectionMarker } from "../render/SelectionMarker";
import { getMovementProfile } from "../nav/MovementProfiles";
import { assetUrl } from "../utils/basePath";
import { GameLoop } from "./GameLoop";

export class GameApp {
  private scene?: Scene;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly debugElement: HTMLElement,
    private readonly loadingElement: HTMLElement,
  ) {}

  async start(): Promise<void> {
    const engine = createEngine(this.canvas);
    const scene = new Scene(engine);
    this.scene = scene;
    scene.clearColor.set(0.58, 0.68, 0.74, 1);
    createLighting(scene);

    const cameraController = new CameraController(scene, this.canvas);
    const assetManager = new AssetManager(scene);
    await assetManager.loadRegistry(assetUrl("asset-registry.json"));

    const physicsWorld = await PhysicsWorld.create();
    const map = await loadMap(assetUrl("maps/terrain-poc.map.json"));
    const builtMap = await new MapBuilder(scene, assetManager, physicsWorld).build(map);
    if (!builtMap.actors[0]) throw new Error("Built map did not create an actor.");
    const controllers = new Map<string, VehicleController>();
    const actorLayers = new Map(
      builtMap.actors.map((actor) => [
        actor.id,
        builtMap.movementLayerCache.get(getMovementProfile(builtMap.map, actor.movement.profileId), actor.movement.radius),
      ]),
    );
    for (const actor of builtMap.actors) {
      const controller = new VehicleController(actor, physicsWorld, builtMap.terrain);
      controller.syncFromPhysics();
      controllers.set(actor.id, controller);
    }

    let selectedActorId = builtMap.actors[0].id;
    const getSelectedController = () => {
      const controller = controllers.get(selectedActorId);
      if (!controller) throw new Error(`No controller for selected actor ${selectedActorId}.`);
      return controller;
    };
    const getSelectedLayer = () => actorLayers.get(selectedActorId) ?? builtMap.movementLayer;

    const vehicleCameraInset = new VehicleCameraInset(scene);
    vehicleCameraInset.update(getSelectedController().actor);
    scene.activeCameras = [cameraController.camera, vehicleCameraInset.camera];

    const navOverlay = new NavGridOverlay(scene, getSelectedLayer());
    const debugDraw = new DebugDraw(scene);
    const selectionMarker = new SelectionMarker(scene);
    selectionMarker.update(getSelectedController().actor);
    const selectActor = (actorId: string) => {
      if (!controllers.has(actorId)) return;
      selectedActorId = actorId;
      navOverlay.setLayer(getSelectedLayer());
      debugDraw.drawPath(getSelectedController().actor.movement.path);
      selectionMarker.update(getSelectedController().actor);
      vehicleCameraInset.update(getSelectedController().actor);
    };
    const inputController = new InputController(
      scene,
      builtMap.terrain,
      () => ({ vehicleController: getSelectedController(), movementLayer: getSelectedLayer() }),
      selectActor,
      debugDraw,
      cameraController.camera,
    );
    const debugPanel = new DebugPanel(this.debugElement);

    let pathVisible = true;
    this.bindHotkeys(cameraController, navOverlay, debugDraw, builtMap.footprintRoot, getSelectedController, () => {
      pathVisible = !pathVisible;
      return pathVisible;
    });

    const loop = new GameLoop((dt) => {
      for (const controller of controllers.values()) controller.update(dt);
      physicsWorld.step(dt);
      for (const controller of controllers.values()) controller.syncFromPhysics();
      const selectedController = getSelectedController();
      selectionMarker.update(selectedController.actor);
      vehicleCameraInset.update(selectedController.actor);
      const pointerNode = inputController.getPointerNodeState();
      debugPanel.update({
        fps: engine.getFps(),
        camera: cameraController.modeLabel,
        mouseWorld: inputController.pointer.world,
        mouseCell: inputController.pointer.cell
          ? {
              ...inputController.pointer.cell,
              walkable: pointerNode?.walkable ?? false,
              blockedBy: pointerNode?.blockedBy,
            }
          : undefined,
        mouseMedium: inputController.pointer.medium,
        mouseMaterial: inputController.pointer.material,
        mouseWaterDepth: inputController.pointer.waterDepth,
        mouseOverlays: inputController.pointer.overlays,
        actorId: selectedController.actor.id,
        actorSurfaceId: selectedController.actor.surfaceId,
        actorProfileId: selectedController.actor.movement.profileId,
        actorState: selectedController.actor.movement.state,
        pathLength: selectedController.actor.movement.path.length,
        collision: selectedController.actor.movement.lastCollision,
      });
      scene.render();
    });

    engine.runRenderLoop(() => loop.tick());
    window.addEventListener("resize", () => {
      engine.resize();
      cameraController.resize();
    });
    this.loadingElement.classList.add("hidden");
  }

  dispose(): void {
    this.scene?.dispose();
  }

  private bindHotkeys(
    cameraController: CameraController,
    navOverlay: NavGridOverlay,
    debugDraw: DebugDraw,
    footprintRoot: { isEnabled(): boolean; setEnabled(enabled: boolean): void },
    getSelectedController: () => VehicleController,
    togglePathVisible: () => boolean,
  ): void {
    window.addEventListener("keydown", async (event) => {
      if (event.repeat) return;
      if (event.code === "KeyG") navOverlay.toggle();
      if (event.code === "KeyP") debugDraw.setPathVisible(togglePathVisible());
      if (event.code === "KeyB") footprintRoot.setEnabled(!footprintRoot.isEnabled());
      if (event.code === "KeyR") getSelectedController().reset();
      if (event.code === "KeyF") cameraController.follow(getSelectedController().actor.position);
      if (event.code === "KeyI" && this.scene) {
        if (this.scene.debugLayer.isVisible()) {
          this.scene.debugLayer.hide();
        } else {
          await this.scene.debugLayer.show({ embedMode: true });
        }
      }
    });
  }
}
