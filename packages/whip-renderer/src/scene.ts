import type { Point2 } from "@whip/physics";
import {
  AdditiveBlending,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Quaternion,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";

type WhipSceneOptions = {
  onCrack: (position: Vector3) => void;
};

type Spark = {
  core: Points;
  shadow: Points;
  birth: number;
  origin: Vector3;
  velocities: Float32Array;
};

export type InteractionRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const MAX_SPARKS = 96;
const SPARK_LIFETIME_SECONDS = 0.34;
const UP = new Vector3(0, 1, 0);

export class WhipScene {
  readonly options: WhipSceneOptions;

  private readonly host: HTMLElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly whipGroup = new Group();
  private readonly handle: Mesh;
  private readonly handleOutline: Mesh;
  private readonly cordMesh: Mesh;
  private readonly cordOutline: Mesh;
  private readonly outlineMaterial: MeshBasicMaterial;
  private readonly cordMaterial: MeshStandardMaterial;
  private readonly sparkMaterial: PointsMaterial;
  private readonly sparks: Spark[] = [];
  private flashEnergy = 0;
  private lastRenderTime = performance.now();
  private lastOrigin: Point2 = { x: 0, y: 0 };
  private readonly visualScale = 0.48;

  constructor(host: HTMLElement, options: WhipSceneOptions) {
    this.host = host;
    this.options = options;

    this.scene = new Scene();
    this.scene.background = null;

    this.camera = new PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(0, 0.16, 4.8);

    this.renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      premultipliedAlpha: false,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(host.clientWidth, host.clientHeight);
    host.append(this.renderer.domElement);

    this.scene.add(new AmbientLight(0x8da7c7, 1.35));

    const keyLight = new DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(1.8, 2.6, 3.4);
    this.scene.add(keyLight);

    const fillLight = new DirectionalLight(0x6fdfff, 1.2);
    fillLight.position.set(-2.8, -0.7, 2.2);
    this.scene.add(fillLight);

    this.outlineMaterial = new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      depthTest: false,
    });

    this.cordMaterial = new MeshStandardMaterial({
      color: 0x17110d,
      emissive: 0x040201,
      metalness: 0.02,
      roughness: 0.72,
    });

    this.handle = new Mesh(
      new CylinderGeometry(0.01, 0.012, 0.16, 10),
      new MeshStandardMaterial({
        color: 0x1f1511,
        emissive: 0x070302,
        metalness: 0.12,
        roughness: 0.62,
      }),
    );
    this.handleOutline = new Mesh(
      new CylinderGeometry(0.015, 0.017, 0.178, 10),
      this.outlineMaterial,
    );
    this.whipGroup.add(this.handleOutline);
    this.whipGroup.add(this.handle);
    this.cordOutline = new Mesh(new BufferGeometry(), this.outlineMaterial);
    this.cordMesh = new Mesh(new BufferGeometry(), this.cordMaterial);
    this.whipGroup.add(this.cordOutline);
    this.whipGroup.add(this.cordMesh);

    this.sparkMaterial = new PointsMaterial({
      color: 0xffffff,
      size: 0.013,
      transparent: true,
      opacity: 0.98,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });

    this.scene.add(this.whipGroup);
    window.addEventListener("resize", () => this.resize());
    this.resize();
  }

  bounds() {
    return this.renderer.domElement.getBoundingClientRect();
  }

  aspectScale() {
    return this.camera.aspect * 1.24;
  }

  handleInteractionRegion(padding = 42): InteractionRegion {
    const rect = this.bounds();
    const projected = this.handle.position.clone().project(this.camera);
    const centerX = ((projected.x + 1) / 2) * rect.width;
    const centerY = ((1 - projected.y) / 2) * rect.height;
    const scale = window.devicePixelRatio || 1;

    return {
      x: Math.round((centerX - padding) * scale),
      y: Math.round((centerY - padding) * scale),
      width: Math.round(padding * 2 * scale),
      height: Math.round(padding * 2 * scale),
    };
  }

  toScenePoint(point: Point2, index = 0, origin: Point2 = this.lastOrigin) {
    const depth = Math.sin(point.x * 1.2 + index * 0.18) * 0.04 + index * 0.0012;

    return new Vector3(
      origin.x + (point.x - origin.x) * this.visualScale,
      origin.y + (point.y - origin.y) * this.visualScale,
      depth,
    );
  }

  renderWhip(points: Point2[], dt: number, crackIntensity: number) {
    const now = performance.now();
    const elapsed = Math.max((now - this.lastRenderTime) / 1000, dt);
    this.lastRenderTime = now;

    const origin = points[0];
    this.lastOrigin = origin;
    const scenePoints = points.map((point, index) => this.toScenePoint(point, index, origin));
    this.updateHandle(scenePoints);
    this.updateCord(scenePoints, crackIntensity);
    this.updateSparks(now);

    this.flashEnergy = Math.max(0, this.flashEnergy - elapsed * 3.8);
    this.camera.position.x = Math.sin(now * 0.006) * 0.012 + this.flashEnergy * 0.026;
    this.camera.position.y = 0.16 + this.flashEnergy * 0.018;
    this.camera.lookAt(0, -0.03, 0);

    this.renderer.render(this.scene, this.camera);
  }

  flashAt(position: Vector3) {
    this.flashEnergy = 1;
    this.spawnSpark(position);
  }

  private updateHandle(points: Vector3[]) {
    const root = points[0];
    const towardCord = points[Math.min(4, points.length - 1)].clone().sub(root);
    const direction =
      towardCord.lengthSq() > 0.0001 ? towardCord.normalize() : new Vector3(0.32, -0.95, 0);
    const gripDirection = direction.clone().multiplyScalar(-1);
    const center = root.clone().add(gripDirection.clone().multiplyScalar(0.08));

    this.handle.position.copy(center);
    this.handle.quaternion.copy(new Quaternion().setFromUnitVectors(UP, direction));
    this.handleOutline.position.copy(this.handle.position);
    this.handleOutline.quaternion.copy(this.handle.quaternion);
  }

  private updateCord(points: Vector3[], crackIntensity: number) {
    if (points.length < 2) {
      return;
    }

    this.cordMesh.geometry.dispose();
    this.cordOutline.geometry.dispose();
    this.cordMesh.geometry = this.createCordTube(points, 0.005);
    this.cordOutline.geometry = this.createCordTube(points, 0.009);
    this.cordMaterial.emissiveIntensity = 0.08 + crackIntensity * 0.5;
  }

  private createCordTube(points: Vector3[], radius: number) {
    const curve = new CatmullRomCurve3(points);
    const samples = curve.getPoints(42);
    const radialSegments = 8;
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    for (let index = 0; index < samples.length; index += 1) {
      const point = samples[index];
      const previous = samples[Math.max(0, index - 1)];
      const next = samples[Math.min(samples.length - 1, index + 1)];
      const tangent = next.clone().sub(previous).normalize();
      const side = new Vector3(-tangent.y, tangent.x, 0);

      if (side.lengthSq() < 0.0001) {
        side.set(1, 0, 0);
      }

      side.normalize();
      const binormal = new Vector3().crossVectors(tangent, side).normalize();
      for (let ring = 0; ring < radialSegments; ring += 1) {
        const angle = (ring / radialSegments) * Math.PI * 2;
        const normal = side
          .clone()
          .multiplyScalar(Math.cos(angle))
          .add(binormal.clone().multiplyScalar(Math.sin(angle)))
          .normalize();
        const vertex = point.clone().add(normal.clone().multiplyScalar(radius));

        positions.push(vertex.x, vertex.y, vertex.z);
        normals.push(normal.x, normal.y, normal.z);
      }
    }

    for (let index = 0; index < samples.length - 1; index += 1) {
      for (let ring = 0; ring < radialSegments; ring += 1) {
        const current = index * radialSegments + ring;
        const next = index * radialSegments + ((ring + 1) % radialSegments);
        const below = (index + 1) * radialSegments + ring;
        const belowNext = (index + 1) * radialSegments + ((ring + 1) % radialSegments);

        indices.push(current, below, next);
        indices.push(next, below, belowNext);
      }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute("normal", new BufferAttribute(new Float32Array(normals), 3));
    geometry.setIndex(indices);

    return geometry;
  }

  private spawnSpark(origin: Vector3) {
    const positions = new Float32Array(MAX_SPARKS * 3);
    const velocities = new Float32Array(MAX_SPARKS * 3);

    for (let i = 0; i < MAX_SPARKS; i += 1) {
      const angle = (i / MAX_SPARKS) * Math.PI * 2 + (Math.random() - 0.5) * 0.18;
      const speed = 0.16 + Math.random() * 0.28;
      const zLift = (Math.random() - 0.5) * 0.18;

      positions[i * 3] = origin.x;
      positions[i * 3 + 1] = origin.y;
      positions[i * 3 + 2] = origin.z;
      velocities[i * 3] = Math.cos(angle) * speed;
      velocities[i * 3 + 1] = Math.sin(angle) * speed;
      velocities[i * 3 + 2] = zLift;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    const shadow = new Points(
      geometry,
      new PointsMaterial({
        color: 0x05070a,
        size: 0.027,
        transparent: true,
        opacity: 0.68,
        depthWrite: false,
        depthTest: false,
      }),
    );
    const core = new Points(geometry, this.sparkMaterial.clone());

    this.sparks.push({ core, shadow, birth: performance.now(), origin: origin.clone(), velocities });
    this.scene.add(shadow);
    this.scene.add(core);
  }

  private updateSparks(now: number) {
    for (let index = this.sparks.length - 1; index >= 0; index -= 1) {
      const spark = this.sparks[index];
      const age = (now - spark.birth) / 1000;
      const progress = Math.min(age / SPARK_LIFETIME_SECONDS, 1);
      const spread = 1 - Math.pow(1 - progress, 2.4);
      const coreMaterial = spark.core.material;
      const shadowMaterial = spark.shadow.material;
      const positionAttribute = spark.core.geometry.getAttribute("position");

      if (coreMaterial instanceof PointsMaterial) {
        coreMaterial.opacity = Math.max(0, 0.98 * (1 - progress));
        coreMaterial.size = Math.max(0.003, 0.013 * (1 - progress * 0.65));
      }

      if (shadowMaterial instanceof PointsMaterial) {
        shadowMaterial.opacity = Math.max(0, 0.68 * (1 - progress));
        shadowMaterial.size = Math.max(0.006, 0.027 * (1 - progress * 0.58));
      }

      if (positionAttribute instanceof BufferAttribute) {
        for (let particleIndex = 0; particleIndex < positionAttribute.count; particleIndex += 1) {
          const velocityIndex = particleIndex * 3;

          positionAttribute.setXYZ(
            particleIndex,
            spark.origin.x + spark.velocities[velocityIndex] * spread,
            spark.origin.y + spark.velocities[velocityIndex + 1] * spread,
            spark.origin.z + spark.velocities[velocityIndex + 2] * spread,
          );
        }

        positionAttribute.needsUpdate = true;
      }

      if (age > SPARK_LIFETIME_SECONDS) {
        this.scene.remove(spark.core);
        this.scene.remove(spark.shadow);
        spark.core.geometry.dispose();
        if (spark.core.material instanceof PointsMaterial) {
          spark.core.material.dispose();
        }
        if (spark.shadow.material instanceof PointsMaterial) {
          spark.shadow.material.dispose();
        }
        this.sparks.splice(index, 1);
      }
    }
  }

  private resize() {
    const width = Math.max(this.host.clientWidth, 1);
    const height = Math.max(this.host.clientHeight, 1);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }
}
