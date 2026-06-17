import type { CrackEvent, Point2 } from "./types";

type CrackDetectorOptions = {
  velocityThreshold: number;
  directionChangeThreshold: number;
  cooldownMs: number;
};

const DEFAULT_OPTIONS: CrackDetectorOptions = {
  velocityThreshold: 8,
  directionChangeThreshold: 0.35,
  cooldownMs: 280,
};

export class CrackDetector {
  private readonly options: CrackDetectorOptions;
  private previousTip: Point2 | null = null;
  private previousVelocity: Point2 = { x: 0, y: 0 };
  private previousTime = 0;
  private lastCrackTime = -Infinity;

  constructor(options: Partial<CrackDetectorOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  update(tip: Point2, timeMs: number): CrackEvent {
    if (!this.previousTip) {
      this.previousTip = { ...tip };
      this.previousTime = timeMs;

      return { triggered: false, speed: 0, intensity: 0, direction: { x: 0, y: 0 } };
    }

    const dt = Math.max((timeMs - this.previousTime) / 1000, 0.001);
    const velocity = {
      x: (tip.x - this.previousTip.x) / dt,
      y: (tip.y - this.previousTip.y) / dt,
    };

    const speed = Math.hypot(velocity.x, velocity.y);
    const direction =
      speed > 0.001 ? { x: velocity.x / speed, y: velocity.y / speed } : { x: 0, y: 0 };
    const previousSpeed = Math.hypot(this.previousVelocity.x, this.previousVelocity.y);
    const directionChange =
      previousSpeed > 0.001 && speed > 0.001
        ? 1 -
          (velocity.x * this.previousVelocity.x + velocity.y * this.previousVelocity.y) /
            (speed * previousSpeed)
        : 0;

    const canTrigger = timeMs - this.lastCrackTime > this.options.cooldownMs;
    const triggered =
      canTrigger &&
      speed > this.options.velocityThreshold &&
      directionChange > this.options.directionChangeThreshold;

    if (triggered) {
      this.lastCrackTime = timeMs;
    }

    this.previousTip = { ...tip };
    this.previousVelocity = velocity;
    this.previousTime = timeMs;

    return {
      triggered,
      speed,
      intensity: triggered ? Math.min((speed - this.options.velocityThreshold) / 6, 1) : 0,
      direction,
    };
  }
}
