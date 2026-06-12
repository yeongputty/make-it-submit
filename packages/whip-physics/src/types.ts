export type Point2 = {
  x: number;
  y: number;
};

export type WhipPoint = Point2 & {
  previousX: number;
  previousY: number;
};

export type WhipChainOptions = {
  segmentCount: number;
  segmentLength: number;
  damping: number;
  gravity: number;
  constraintIterations: number;
  rootLift: number;
  rootStiffness: number;
  swingInfluence: number;
  rootLockedSegments: number;
  rootLean: number;
};

export type CrackEvent = {
  triggered: boolean;
  speed: number;
  intensity: number;
  direction: Point2;
};
