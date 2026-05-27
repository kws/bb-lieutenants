import "./style.css";
import { GameApp } from "./app/GameApp";

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
const debugPanel = document.querySelector<HTMLElement>("#debug-panel");
const loading = document.querySelector<HTMLElement>("#loading");

if (!canvas || !debugPanel || !loading) {
  throw new Error("Missing required DOM elements.");
}

const app = new GameApp(canvas, debugPanel, loading);
app.start().catch((error) => {
  console.error(error);
  loading.textContent = error instanceof Error ? error.message : "Failed to start demo.";
});

