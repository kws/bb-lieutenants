export type TickHandler = (dt: number) => void;

export class GameLoop {
  private lastTime = performance.now();

  constructor(private readonly onTick: TickHandler) {}

  tick(): void {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.onTick(dt);
  }
}

