import { CrackDetector, WhipChain } from "@whip/physics";
import { WhipScene } from "@whip/renderer";
import { invoke } from "@tauri-apps/api/core";
import "./styles.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

const appRoot = app;

const chain = new WhipChain({
  segmentCount: 28,
  segmentLength: 0.058,
  damping: 0.935,
  gravity: 0.018,
  constraintIterations: 22,
  rootLift: 1,
  rootStiffness: 0.82,
  swingInfluence: 0.32,
  rootLockedSegments: 13,
  rootLean: -0.14,
});

const crackDetector = new CrackDetector({
  velocityThreshold: 7.2,
  directionChangeThreshold: 0.52,
  cooldownMs: 650,
});

const scene = new WhipScene(app, {
  onCrack: (position) => {
    scene.flashAt(position);
  },
});

const svgNamespace = "http://www.w3.org/2000/svg";
const spotlightOverlay = document.createElementNS(svgNamespace, "svg");
spotlightOverlay.classList.add("spotlight-overlay");
spotlightOverlay.classList.add("is-active");
spotlightOverlay.setAttribute("viewBox", "0 0 100 100");
spotlightOverlay.setAttribute("preserveAspectRatio", "none");
spotlightOverlay.setAttribute("aria-hidden", "true");

const spotlightMask = document.createElementNS(svgNamespace, "path");
spotlightMask.setAttribute("fill-rule", "evenodd");
spotlightMask.setAttribute("d", "M0 0H100V100H0Z M50 -36L86 100H14Z");
spotlightOverlay.append(spotlightMask);
appRoot.append(spotlightOverlay);

const actionBar = document.createElement("section");
actionBar.className = "action-bar";

const actionButton = document.createElement("button");
actionButton.className = "action-button";
actionButton.type = "button";
actionButton.textContent = "Pardon";
actionBar.append(actionButton);

const shortcutHint = document.createElement("div");
shortcutHint.className = "shortcut-hint";
shortcutHint.textContent = "Press Alt + Shift + Q to quit";
actionBar.append(shortcutHint);

appRoot.append(actionBar);

const AUTO_X = 0;
const UP_Y = 2.4;
const DOWN_Y = 0.2;
const DOWN_TIME = 3.8;
const UP_TIME = 2.4;
const RETURN_TIME = 0;
const ACTION_COOLDOWN_MS = 650;
const DRAG_ARM_DELAY_MS = 220;
const SOUND_SRC = "/audio/whip.mp3";
const SOUND_POOL_SIZE = 4;

type Pos = { x: number; y: number };

type AnimStep = {
  to: Pos;
  duration: number;
};

type Anim = {
  status: "idle" | "running" | "done";
  from: Pos;
  to: Pos;
  progress: number;
  duration: number;
  next?: AnimStep;
  hideSpotlightOnComplete?: boolean;
};

let isPunished = true;
let isDragging = false;
let dragStartedAt = -Infinity;
let dragOffset: Pos = { x: 0, y: 0 };
let handle = getUpHandle();
let anim: Anim = {
  status: "running",
  from: { ...handle },
  to: getDownHandle(),
  progress: 0,
  duration: DOWN_TIME,
  hideSpotlightOnComplete: true,
};
let lastTime = performance.now();
let lastActionTime = -Infinity;
let soundIndex = 0;
const whipSounds = Array.from({ length: SOUND_POOL_SIZE }, () => {
  const audio = new Audio(SOUND_SRC);
  audio.preload = "auto";
  audio.volume = 0.6;

  return audio;
});

type EnterResult = {
  ok: boolean;
  reason?: string | null;
};

let nextRegionUpdate = 0;

type Region = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function playWhipSound() {
  const sound = whipSounds[soundIndex];
  soundIndex = (soundIndex + 1) % whipSounds.length;
  sound.currentTime = 0;

  void sound.play().catch((error) => {
    console.warn("Failed to play whip sound", error);
  });
}

function getUpHandle() {
  return {
    x: scene.aspectScale() * AUTO_X,
    y: UP_Y,
  };
}

function getDownHandle() {
  return {
    x: scene.aspectScale() * AUTO_X,
    y: DOWN_Y,
  };
}

function startAnim(
  to: Pos,
  duration: number,
  next?: AnimStep,
  hideSpotlightOnComplete = false,
) {
  anim = {
    status: "running",
    from: { ...handle },
    to,
    progress: 0,
    duration: Math.max(duration, 0.001),
    next,
    hideSpotlightOnComplete,
  };
}

function setSpotlightOverlay(isActive: boolean) {
  spotlightOverlay.classList.toggle("is-active", isActive);
}

function setPunishedState(nextIsPunished: boolean) {
  isPunished = nextIsPunished;
  actionButton.textContent = isPunished ? "Pardon" : "Punish";
}

function cancelPardonAsPunished() {
  if (!isPunished && anim.status === "running") {
    setPunishedState(true);
    setSpotlightOverlay(false);
  }
}

function triggerFocusAction(time: number, position?: { x: number; y: number }) {
  if (time - lastActionTime < ACTION_COOLDOWN_MS) {
    return false;
  }

  lastActionTime = time;
  playWhipSound();

  if (position) {
    scene.options.onCrack(scene.toScenePoint(position));
  }

  void invoke<EnterResult>("trigger_enter")
    .then((result) => {
      if (!result.ok) {
        console.warn("Enter was not delivered", result.reason);
      }
    })
    .catch((error) => {
      console.warn("Failed to trigger Enter", error);
    });

  return true;
}

function elementRegion(element: HTMLElement, padding = 8): Region {
  const rect = element.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;

  return {
    x: Math.round((rect.left - padding) * scale),
    y: Math.round((rect.top - padding) * scale),
    width: Math.round((rect.width + padding * 2) * scale),
    height: Math.round((rect.height + padding * 2) * scale),
  };
}

function currentRegions(): Region[] {
  if (isDragging) {
    const rect = scene.bounds();
    const scale = window.devicePixelRatio || 1;

    return [
      {
        x: 0,
        y: 0,
        width: Math.round(rect.width * scale),
        height: Math.round(rect.height * scale),
      },
    ];
  }

  return [scene.handleInteractionRegion(), elementRegion(actionButton)];
}

function sendRegions(regions: Region[]) {
  void invoke("update_interaction_region", { regions }).catch((error) => {
    console.warn("Failed to update interaction region", error);
  });
}

function updateRegions(time: number, force = false) {
  if (!force && time < nextRegionUpdate) {
    return;
  }

  nextRegionUpdate = time + 50;
  sendRegions(currentRegions());
}

function mapPointer(event: PointerEvent) {
  const rect = scene.bounds();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

  return {
    x: x * scene.aspectScale(),
    y: y * 1.04,
  };
}

function startDrag(event: PointerEvent) {
  isDragging = true;
  dragStartedAt = performance.now();
  updateRegions(performance.now(), true);
  cancelPardonAsPunished();
  anim.status = "idle";
  setSpotlightOverlay(false);
  const pointer = mapPointer(event);
  dragOffset = {
    x: handle.x - pointer.x,
    y: handle.y - pointer.y,
  };
  chain.setHandle(handle);

  try {
    appRoot.setPointerCapture(event.pointerId);
  } catch {
    // Overlay windows can fail pointer capture depending on platform/compositor.
  }
}

function moveDrag(event: PointerEvent) {
  if (!isDragging && event.buttons === 1) {
    startDrag(event);
  }

  if (!isDragging) {
    return;
  }

  const pointer = mapPointer(event);
  handle = {
    x: pointer.x + dragOffset.x,
    y: pointer.y + dragOffset.y,
  };
}

function endDrag(event: PointerEvent) {
  isDragging = false;
  dragStartedAt = -Infinity;
  updateRegions(performance.now(), true);

  try {
    appRoot.releasePointerCapture(event.pointerId);
  } catch {
    // Capture may already be released when the pointerup arrives on window.
  }
}

actionButton.addEventListener("pointerdown", (event) => {
  event.stopPropagation();
});

actionButton.addEventListener("click", (event) => {
  event.stopPropagation();
  setPunishedState(!isPunished);

  if (isPunished) {
    setSpotlightOverlay(true);
    startAnim(getDownHandle(), DOWN_TIME, undefined, true);
  } else {
    setSpotlightOverlay(false);
    startAnim(getDownHandle(), RETURN_TIME, {
      to: getUpHandle(),
      duration: UP_TIME,
    });
  }

});

appRoot.addEventListener("pointerdown", (event) => {
  if (event.target instanceof HTMLElement && event.target.closest(".action-button")) {
    return;
  }

  startDrag(event);
});

window.addEventListener("pointermove", moveDrag);
window.addEventListener("pointerup", endDrag);
window.addEventListener("pointercancel", () => {
  isDragging = false;
  dragStartedAt = -Infinity;
});

function tick(time: number) {
  const dt = Math.min((time - lastTime) / 1000, 0.034);
  lastTime = time;

  if (!isDragging && anim.status === "running") {
    anim.progress = Math.min(anim.progress + dt / anim.duration, 1);
    handle = {
      x: anim.from.x + (anim.to.x - anim.from.x) * anim.progress,
      y: anim.from.y + (anim.to.y - anim.from.y) * anim.progress,
    };

    if (anim.progress >= 1) {
      const next = anim.next;
      const shouldHideSpotlight = anim.hideSpotlightOnComplete;

      anim.status = "done";
      handle = { ...anim.to };

      if (next) {
        startAnim(next.to, next.duration);
      } else if (shouldHideSpotlight) {
        setSpotlightOverlay(false);
      }
    }
  }

  chain.setHandle(handle);
  chain.step(dt);

  const snapshot = chain.snapshot();
  const tip = snapshot[snapshot.length - 1];
  const crack = crackDetector.update(tip, time);

  scene.renderWhip(snapshot, dt, crack.intensity);
  updateRegions(time);

  const isDragArmed = !isDragging || time - dragStartedAt > DRAG_ARM_DELAY_MS;

  if (
    isPunished &&
    isDragging &&
    isDragArmed &&
    crack.triggered
  ) {
    const crackPoint = {
      x: tip.x + crack.direction.x * 0.22,
      y: tip.y + crack.direction.y * 0.22,
    };

    triggerFocusAction(time, crackPoint);
  }

  requestAnimationFrame(tick);
}

chain.setHandle(handle);
scene.renderWhip(chain.snapshot(), 0, 0);
updateRegions(performance.now(), true);
requestAnimationFrame(tick);
