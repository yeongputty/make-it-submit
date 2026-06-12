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

appRoot.append(actionBar);

const AUTO_X_MULTIPLIER = 0;
const UP_Y = 2.4;
const DOWN_Y = 0.2;
const AUTO_DOWN_DURATION = 5.8;
const AUTO_UP_DURATION = 4.2;
const AUTO_RETURN_DURATION = 0;
const WHIP_DIRECTION_CHANGE_DOT_MAX = 0.45;
const WHIP_TRIGGER_SPEED = 2.4;
const WHIP_TRIGGER_ACCELERATION = 42;
const WHIP_SPEED_SMOOTHING = 0.22;
const FOCUS_ACTION_COOLDOWN_MS = 650;
const WHIP_CRACK_DELAY_SECONDS = 0.4;
const WHIP_MASTER_GAIN = 1.35;
const WHIP_WHOOSH_GAIN = 1.05;
const WHIP_CRACK_GAIN = 2.35;
const WHIP_SLAP_BODY_GAIN = 1.02;
const WHIP_ECHO_GAIN = 0.76;

type HandlePosition = { x: number; y: number };

type AutoAnimationStep = {
  to: HandlePosition;
  duration: number;
};

type AutoAnimation = {
  status: "idle" | "running" | "done";
  from: HandlePosition;
  to: HandlePosition;
  progress: number;
  duration: number;
  next?: AutoAnimationStep;
  hideSpotlightOnComplete?: boolean;
};

let isPunished = true;
let isDragging = false;
let handle = getUpHandle();
let autoAnimation: AutoAnimation = {
  status: "running",
  from: { ...handle },
  to: getDownHandle(),
  progress: 0,
  duration: AUTO_DOWN_DURATION,
  hideSpotlightOnComplete: true,
};
let lastTime = performance.now();
let previousHandle = { ...handle };
let handleSpeed = 0;
let smoothedHandleSpeed = 0;
let previousSmoothedHandleSpeed = 0;
let peakHandleSpeed = 0;
let swingDirectionAnchor = { x: 0, y: 0 };
let hasSwingDirectionAnchor = false;
let lastFocusActionTime = -Infinity;
let audioContext: AudioContext | undefined;
let whipNoiseBuffer: AudioBuffer | undefined;
let whipMaster: GainNode | undefined;
let whipCompressor: DynamicsCompressorNode | undefined;

type TriggerEnterResult = {
  ok: boolean;
  reason?: string | null;
};

let nextInteractionRegionUpdate = 0;

type InteractionRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function normalizeDirection(direction: { x: number; y: number }) {
  const length = Math.hypot(direction.x, direction.y);

  if (length < 0.001) {
    return { x: 0, y: 0 };
  }

  return {
    x: direction.x / length,
    y: direction.y / length,
  };
}

function getAudioContext() {
  if (!audioContext) {
    const AudioContextConstructor =
      window.AudioContext ??
      (
        window as Window &
          typeof globalThis & {
            webkitAudioContext?: typeof AudioContext;
          }
      ).webkitAudioContext;

    if (!AudioContextConstructor) {
      return undefined;
    }

    audioContext = new AudioContextConstructor();
    whipMaster = audioContext.createGain();
    whipCompressor = audioContext.createDynamicsCompressor();

    whipMaster.gain.value = WHIP_MASTER_GAIN;
    whipCompressor.threshold.value = -12;
    whipCompressor.knee.value = 18;
    whipCompressor.ratio.value = 5;
    whipCompressor.attack.value = 0.001;
    whipCompressor.release.value = 0.08;

    whipMaster.connect(whipCompressor);
    whipCompressor.connect(audioContext.destination);
  }

  return audioContext;
}

function makeNoiseBuffer(context: AudioContext) {
  if (whipNoiseBuffer) {
    return whipNoiseBuffer;
  }

  const duration = 1.2;
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const channel = buffer.getChannelData(0);
  let previous = 0;

  for (let index = 0; index < channel.length; index += 1) {
    const white = Math.random() * 2 - 1;
    previous = previous * 0.72 + white * 0.28;
    channel[index] = white * 0.72 + previous * 0.28;
  }

  whipNoiseBuffer = buffer;
  return buffer;
}

function connectCrackEcho(context: AudioContext, source: AudioNode, startTime: number) {
  if (!whipMaster) {
    return;
  }

  const delay = context.createDelay(0.22);
  const feedback = context.createGain();
  const wet = context.createGain();
  const tone = context.createBiquadFilter();
  const cutMud = context.createBiquadFilter();

  delay.delayTime.value = 0.078;
  feedback.gain.value = 0.27;
  wet.gain.setValueAtTime(WHIP_ECHO_GAIN, startTime);
  wet.gain.exponentialRampToValueAtTime(0.001, startTime + 0.48);
  tone.type = "lowpass";
  tone.frequency.value = 4200;
  tone.Q.value = 0.5;
  cutMud.type = "highpass";
  cutMud.frequency.value = 1250;
  cutMud.Q.value = 0.72;

  source.connect(delay);
  delay.connect(cutMud);
  cutMud.connect(tone);
  tone.connect(wet);
  wet.connect(whipMaster);
  tone.connect(feedback);
  feedback.connect(delay);
}

function playWhipSound() {
  const context = getAudioContext();

  if (!context || !whipMaster) {
    return;
  }

  void context.resume().catch((error) => {
    console.warn("Failed to resume audio context", error);
  });

  const now = context.currentTime + 0.012;
  const crackTime = now + WHIP_CRACK_DELAY_SECONDS;
  const noiseBuffer = makeNoiseBuffer(context);
  const whooshOffset = Math.random() * 0.32;
  const crackOffset = Math.random() * 0.32;
  const slapBodyOffset = Math.random() * 0.32;
  const snapOffset = Math.random() * 0.32;

  const whoosh = context.createBufferSource();
  const whooshBand = context.createBiquadFilter();
  const whooshHighpass = context.createBiquadFilter();
  const whooshGain = context.createGain();
  const whooshPan = context.createStereoPanner();

  whoosh.buffer = noiseBuffer;
  whooshBand.type = "bandpass";
  whooshBand.frequency.setValueAtTime(6200, now);
  whooshBand.frequency.exponentialRampToValueAtTime(1450, crackTime + 0.035);
  whooshBand.Q.setValueAtTime(0.92, now);
  whooshBand.Q.linearRampToValueAtTime(2.25, crackTime);
  whooshHighpass.type = "highpass";
  whooshHighpass.frequency.value = 720;
  whooshPan.pan.setValueAtTime(-0.18, now);
  whooshPan.pan.linearRampToValueAtTime(0.16, crackTime);
  whooshGain.gain.setValueAtTime(0.001, now);
  whooshGain.gain.exponentialRampToValueAtTime(WHIP_WHOOSH_GAIN, now + 0.17);
  whooshGain.gain.exponentialRampToValueAtTime(0.018, crackTime + 0.1);

  whoosh.connect(whooshBand);
  whooshBand.connect(whooshHighpass);
  whooshHighpass.connect(whooshGain);
  whooshGain.connect(whooshPan);
  whooshPan.connect(whipMaster);
  whoosh.start(now, whooshOffset);
  whoosh.stop(crackTime + 0.16);

  const crackNoise = context.createBufferSource();
  const crackBand = context.createBiquadFilter();
  const crackHighpass = context.createBiquadFilter();
  const crackGain = context.createGain();
  const crackDrive = context.createWaveShaper();
  const crackPan = context.createStereoPanner();
  const curve = new Float32Array(2048);

  for (let index = 0; index < curve.length; index += 1) {
    const x = (index / (curve.length - 1)) * 2 - 1;
    curve[index] = Math.tanh(x * 5.4);
  }

  crackNoise.buffer = noiseBuffer;
  crackBand.type = "bandpass";
  crackBand.frequency.setValueAtTime(6400, crackTime);
  crackBand.frequency.exponentialRampToValueAtTime(3100, crackTime + 0.09);
  crackBand.Q.value = 1.55;
  crackHighpass.type = "highpass";
  crackHighpass.frequency.value = 1450;
  crackGain.gain.setValueAtTime(0.001, crackTime);
  crackGain.gain.exponentialRampToValueAtTime(WHIP_CRACK_GAIN, crackTime + 0.004);
  crackGain.gain.exponentialRampToValueAtTime(0.055, crackTime + 0.14);
  crackGain.gain.exponentialRampToValueAtTime(0.001, crackTime + 0.28);
  crackDrive.curve = curve;
  crackDrive.oversample = "4x";
  crackPan.pan.setValueAtTime(0.08, crackTime);

  crackNoise.connect(crackBand);
  crackBand.connect(crackHighpass);
  crackHighpass.connect(crackDrive);
  crackDrive.connect(crackGain);
  crackGain.connect(crackPan);
  crackPan.connect(whipMaster);
  connectCrackEcho(context, crackPan, crackTime);
  crackNoise.start(crackTime, crackOffset);
  crackNoise.stop(crackTime + 0.3);

  const slapBody = context.createBufferSource();
  const slapBodyBand = context.createBiquadFilter();
  const slapBodyNotch = context.createBiquadFilter();
  const slapBodyGain = context.createGain();
  const slapBodyPan = context.createStereoPanner();

  slapBody.buffer = noiseBuffer;
  slapBodyBand.type = "bandpass";
  slapBodyBand.frequency.setValueAtTime(1850, crackTime);
  slapBodyBand.frequency.exponentialRampToValueAtTime(780, crackTime + 0.13);
  slapBodyBand.Q.value = 1.05;
  slapBodyNotch.type = "notch";
  slapBodyNotch.frequency.value = 420;
  slapBodyNotch.Q.value = 1.2;
  slapBodyGain.gain.setValueAtTime(0.001, crackTime);
  slapBodyGain.gain.exponentialRampToValueAtTime(WHIP_SLAP_BODY_GAIN, crackTime + 0.006);
  slapBodyGain.gain.exponentialRampToValueAtTime(0.045, crackTime + 0.095);
  slapBodyGain.gain.exponentialRampToValueAtTime(0.001, crackTime + 0.18);
  slapBodyPan.pan.setValueAtTime(0.02, crackTime);

  slapBody.connect(slapBodyBand);
  slapBodyBand.connect(slapBodyNotch);
  slapBodyNotch.connect(slapBodyGain);
  slapBodyGain.connect(slapBodyPan);
  slapBodyPan.connect(whipMaster);
  connectCrackEcho(context, slapBodyPan, crackTime);
  slapBody.start(crackTime, slapBodyOffset);
  slapBody.stop(crackTime + 0.26);

  const snap = context.createBufferSource();
  const snapGain = context.createGain();
  const snapFilter = context.createBiquadFilter();
  const snapPresence = context.createBiquadFilter();

  snap.buffer = noiseBuffer;
  snapGain.gain.setValueAtTime(0.001, crackTime);
  snapGain.gain.exponentialRampToValueAtTime(0.52, crackTime + 0.002);
  snapGain.gain.exponentialRampToValueAtTime(0.001, crackTime + 0.055);
  snapFilter.type = "highpass";
  snapFilter.frequency.value = 2100;
  snapPresence.type = "peaking";
  snapPresence.frequency.value = 4300;
  snapPresence.Q.value = 0.9;
  snapPresence.gain.value = 1.2;

  snap.connect(snapFilter);
  snapFilter.connect(snapPresence);
  snapPresence.connect(snapGain);
  snapGain.connect(whipMaster);
  snap.start(crackTime, snapOffset);
  snap.stop(crackTime + 0.06);
}

function getUpHandle() {
  return {
    x: scene.aspectScale() * AUTO_X_MULTIPLIER,
    y: UP_Y,
  };
}

function getDownHandle() {
  return {
    x: scene.aspectScale() * AUTO_X_MULTIPLIER,
    y: DOWN_Y,
  };
}

function startAutoAnimation(
  to: HandlePosition,
  duration: number,
  next?: AutoAnimationStep,
  hideSpotlightOnComplete = false,
) {
  autoAnimation = {
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
  if (!isPunished && autoAnimation.status === "running") {
    setPunishedState(true);
    setSpotlightOverlay(false);
  }
}

function triggerFocusAction(time: number, position?: { x: number; y: number }) {
  if (time - lastFocusActionTime < FOCUS_ACTION_COOLDOWN_MS) {
    return false;
  }

  lastFocusActionTime = time;
  playWhipSound();

  if (position) {
    scene.options.onCrack(scene.toScenePoint(position));
  }

  void invoke<TriggerEnterResult>("trigger_enter")
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

function elementInteractionRegion(element: HTMLElement, padding = 8): InteractionRegion {
  const rect = element.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;

  return {
    x: Math.round((rect.left - padding) * scale),
    y: Math.round((rect.top - padding) * scale),
    width: Math.round((rect.width + padding * 2) * scale),
    height: Math.round((rect.height + padding * 2) * scale),
  };
}

function currentInteractionRegions(): InteractionRegion[] {
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

  return [scene.handleInteractionRegion(), elementInteractionRegion(actionButton)];
}

function sendInteractionRegions(regions: InteractionRegion[]) {
  void invoke("update_interaction_region", { regions }).catch((error) => {
    console.warn("Failed to update interaction region", error);
  });
}

function updateInteractionRegion(time: number, force = false) {
  if (!force && time < nextInteractionRegionUpdate) {
    return;
  }

  nextInteractionRegionUpdate = time + 50;
  sendInteractionRegions(currentInteractionRegions());
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
  updateInteractionRegion(performance.now(), true);
  cancelPardonAsPunished();
  autoAnimation.status = "idle";
  setSpotlightOverlay(false);
  handle = mapPointer(event);
  previousHandle = { ...handle };
  handleSpeed = 0;
  smoothedHandleSpeed = 0;
  previousSmoothedHandleSpeed = 0;
  peakHandleSpeed = 0;
  swingDirectionAnchor = { x: 0, y: 0 };
  hasSwingDirectionAnchor = false;
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

  handle = mapPointer(event);
}

function endDrag(event: PointerEvent) {
  isDragging = false;
  updateInteractionRegion(performance.now(), true);

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
    startAutoAnimation(getDownHandle(), AUTO_DOWN_DURATION, undefined, true);
  } else {
    setSpotlightOverlay(false);
    startAutoAnimation(getDownHandle(), AUTO_RETURN_DURATION, {
      to: getUpHandle(),
      duration: AUTO_UP_DURATION,
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
});

function tick(time: number) {
  const dt = Math.min((time - lastTime) / 1000, 0.034);
  lastTime = time;

  if (!isDragging && autoAnimation.status === "running") {
    autoAnimation.progress = Math.min(autoAnimation.progress + dt / autoAnimation.duration, 1);
    handle = {
      x: autoAnimation.from.x + (autoAnimation.to.x - autoAnimation.from.x) * autoAnimation.progress,
      y: autoAnimation.from.y + (autoAnimation.to.y - autoAnimation.from.y) * autoAnimation.progress,
    };

    if (autoAnimation.progress >= 1) {
      const nextAnimation = autoAnimation.next;
      const shouldHideSpotlight = autoAnimation.hideSpotlightOnComplete;

      autoAnimation.status = "done";
      handle = { ...autoAnimation.to };

      if (nextAnimation) {
        startAutoAnimation(nextAnimation.to, nextAnimation.duration);
      } else if (shouldHideSpotlight) {
        setSpotlightOverlay(false);
      }
    }
  }

  const easedHandle = handle;
  const handleDeltaX = easedHandle.x - previousHandle.x;
  const handleDeltaY = easedHandle.y - previousHandle.y;

  handleSpeed = Math.hypot(handleDeltaX, handleDeltaY) / Math.max(dt, 0.001);
  smoothedHandleSpeed += (handleSpeed - smoothedHandleSpeed) * WHIP_SPEED_SMOOTHING;
  const handleAcceleration = (smoothedHandleSpeed - previousSmoothedHandleSpeed) / Math.max(dt, 0.001);
  previousSmoothedHandleSpeed = smoothedHandleSpeed;
  peakHandleSpeed = Math.max(smoothedHandleSpeed, peakHandleSpeed * 0.94);
  previousHandle = { ...easedHandle };
  const swingDirection = normalizeDirection({ x: handleDeltaX, y: handleDeltaY });
  const hasSwingDirection = Math.hypot(swingDirection.x, swingDirection.y) > 0.001 && smoothedHandleSpeed > 0.35;
  const swingDirectionDot =
    swingDirection.x * swingDirectionAnchor.x + swingDirection.y * swingDirectionAnchor.y;
  const hasWhipDirectionChange =
    hasSwingDirection && hasSwingDirectionAnchor && swingDirectionDot < WHIP_DIRECTION_CHANGE_DOT_MAX;

  handle = easedHandle;
  chain.setHandle(easedHandle);
  chain.step(dt);

  const snapshot = chain.snapshot();
  const tip = snapshot[snapshot.length - 1];
  const crack = crackDetector.update(tip, time);

  scene.renderWhip(snapshot, dt, crack.intensity);
  updateInteractionRegion(time);

  if (
    (isPunished || isDragging) &&
    smoothedHandleSpeed > WHIP_TRIGGER_SPEED &&
    handleAcceleration > WHIP_TRIGGER_ACCELERATION &&
    smoothedHandleSpeed > peakHandleSpeed * 0.82 &&
    hasWhipDirectionChange
  ) {
    const crackDirection =
      Math.hypot(swingDirection.x, swingDirection.y) > 0.001 ? swingDirection : crack.direction;
    const crackPoint = {
      x: tip.x + crackDirection.x * 0.22,
      y: tip.y + crackDirection.y * 0.22,
    };

    triggerFocusAction(time, crackPoint);
    swingDirectionAnchor = swingDirection;
    hasSwingDirectionAnchor = true;
  }

  if (hasSwingDirection && !hasSwingDirectionAnchor) {
    swingDirectionAnchor = swingDirection;
    hasSwingDirectionAnchor = true;
  }

  requestAnimationFrame(tick);
}

chain.setHandle(handle);
scene.renderWhip(chain.snapshot(), 0, 0);
updateInteractionRegion(performance.now(), true);
requestAnimationFrame(tick);
