import type { Point2, WhipChainOptions, WhipPoint } from "./types";

const DEFAULT_OPTIONS: WhipChainOptions = {
  segmentCount: 32,
  segmentLength: 0.1,
  damping: 0.985,
  gravity: 0.016,
  constraintIterations: 8,
  rootLift: 0.72,
  rootStiffness: 0.55,
  swingInfluence: 1.35,
  rootLockedSegments: 6,
  rootLean: 0,
};

export class WhipChain {
  private readonly options: WhipChainOptions;
  private readonly points: WhipPoint[];
  private handle: Point2 = { x: 0, y: -0.72 };
  private handleDelta: Point2 = { x: 0, y: 0 };
  private rootDirection: Point2 = { x: 0, y: 1 };

  constructor(options: Partial<WhipChainOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.rootDirection = this.normalize({
      x: this.options.rootLean,
      y: this.options.rootLift,
    });
    this.points = Array.from({ length: this.options.segmentCount }, (_, index) => {
      const t = index / Math.max(this.options.segmentCount - 1, 1);
      const x =
        this.handle.x +
        this.rootDirection.x * index * this.options.segmentLength +
        Math.sin(index * 0.36) * 0.014 * (1 - t);
      const y = this.handle.y + this.rootDirection.y * index * this.options.segmentLength;

      return {
        x,
        y,
        previousX: x,
        previousY: y,
      };
    });
  }

  setHandle(handle: Point2) {
    this.handleDelta = {
      x: handle.x - this.handle.x,
      y: handle.y - this.handle.y,
    };
    this.handle = handle;
  }

  step(dt: number) {
    const dtScale = Math.min(dt * 60, 2);
    const guidedSegments = Math.min(this.options.rootLockedSegments, this.points.length - 2);

    this.updateRootDirection();
    this.pinRoot();

    for (let index = 1; index < this.points.length; index += 1) {
      const point = this.points[index];
      const velocityX = (point.x - point.previousX) * this.options.damping;
      const velocityY = (point.y - point.previousY) * this.options.damping;

      point.previousX = point.x;
      point.previousY = point.y;
      point.x += velocityX;
      point.y += velocityY - this.options.gravity * dtScale;
    }

    this.applySwingImpulse();

    for (let i = 0; i < this.options.constraintIterations; i += 1) {
      this.pinRoot();
      this.solveRootGuide(guidedSegments);
      this.solveSegmentLengths();
      this.solveBendStability();
      this.solveRootGuide(guidedSegments);
    }

    this.pinRoot();
    this.solveRootGuide(guidedSegments);
    this.handleDelta = { x: 0, y: 0 };
  }

  snapshot(): Point2[] {
    return this.points.map((point) => ({ x: point.x, y: point.y }));
  }

  private pinRoot() {
    const root = this.points[0];
    root.x = this.handle.x;
    root.y = this.handle.y;
    root.previousX = this.handle.x;
    root.previousY = this.handle.y;
  }

  private solveSegmentLengths() {
    for (let index = 0; index < this.points.length - 1; index += 1) {
      const a = this.points[index];
      const b = this.points[index + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy) || 0.0001;
      const difference = (distance - this.options.segmentLength) / distance;
      const offsetX = dx * difference;
      const offsetY = dy * difference;

      if (index === 0) {
        b.x -= offsetX;
        b.y -= offsetY;
      } else {
        a.x += offsetX * 0.5;
        a.y += offsetY * 0.5;
        b.x -= offsetX * 0.5;
        b.y -= offsetY * 0.5;
      }
    }
  }

  private updateRootDirection() {
    const movement = Math.hypot(this.handleDelta.x, this.handleDelta.y);
    const desired =
      movement > 0.00001
        ? {
            x: this.options.rootLean + this.handleDelta.x * 4.2,
            y: this.options.rootLift + Math.max(this.handleDelta.y * 1.4, -0.18),
          }
        : { x: this.options.rootLean, y: this.options.rootLift };
    const normalized = this.normalize(desired);
    const blend = movement > 0.00001 ? Math.min(0.18 + movement * 2.6, 0.48) : 0.1;

    this.rootDirection = {
      x: this.rootDirection.x + (normalized.x - this.rootDirection.x) * blend,
      y: this.rootDirection.y + (normalized.y - this.rootDirection.y) * blend,
    };

    const length = Math.hypot(this.rootDirection.x, this.rootDirection.y) || 1;
    this.rootDirection.x /= length;
    this.rootDirection.y /= length;
  }

  private normalize(point: Point2): Point2 {
    const length = Math.hypot(point.x, point.y) || 1;

    return {
      x: point.x / length,
      y: point.y / length,
    };
  }

  private solveRootGuide(guidedSegments: number) {
    const root = this.points[0];

    for (let index = 1; index <= guidedSegments; index += 1) {
      const point = this.points[index];
      const targetX = root.x + this.rootDirection.x * this.options.segmentLength * index;
      const targetY = root.y + this.rootDirection.y * this.options.segmentLength * index;
      const t = index / guidedSegments;
      const stiffness = this.options.rootStiffness * Math.pow(1 - t, 1.8);

      point.x += (targetX - point.x) * stiffness;
      point.y += (targetY - point.y) * stiffness;
    }
  }

  private applySwingImpulse() {
    const movement = Math.hypot(this.handleDelta.x, this.handleDelta.y);

    if (movement < 0.00001) {
      return;
    }

    const guidedSegments = Math.min(this.options.rootLockedSegments, this.points.length - 2);

    for (let index = guidedSegments + 1; index < this.points.length; index += 1) {
      const t = index / (this.points.length - 1);
      const falloff = Math.pow(1 - t, 2.8);
      const point = this.points[index];

      point.x += this.handleDelta.x * falloff * this.options.swingInfluence;
      point.y += this.handleDelta.y * falloff * this.options.swingInfluence;
    }
  }

  private solveBendStability() {
    for (let index = 2; index < this.points.length - 2; index += 1) {
      const previous = this.points[index - 1];
      const point = this.points[index];
      const next = this.points[index + 1];
      const t = index / (this.points.length - 1);
      const stiffness = 0.18 * Math.pow(1 - t, 0.55) + 0.045;
      const targetX = (previous.x + next.x) * 0.5;
      const targetY = (previous.y + next.y) * 0.5;

      point.x += (targetX - point.x) * stiffness;
      point.y += (targetY - point.y) * stiffness;
    }
  }
}
