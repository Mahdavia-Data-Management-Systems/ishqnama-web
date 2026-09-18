// The Three.js side of the book. No React here. Rendering is on demand: a frame is drawn only
// while the pose is easing toward its target, while the About book is being turned, or when the
// size or progress changes. At rest the GPU does nothing.
import {
  ACESFilmicToneMapping,
  Box3,
  BoxGeometry,
  DirectionalLight,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Texture,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type BookVariant = "hero" | "card" | "inspect";

export interface BookSceneOptions {
  variant: BookVariant;
  modelUrl: string;
  progress?: number;
  /** Pointer devices tilt with the pointer; others settle once on load and then hold still. */
  hoverCapable: boolean;
}

export interface BookScene {
  /** Pointer position over the containing card, each axis in [-1, 1]. (0, 0) is rest. */
  setTilt(x: number, y: number): void;
  /** Fraction through the Quran, or undefined to hide the ribbon. */
  setProgress(progress: number | undefined): void;
  resize(width: number, height: number): void;
  /** False pauses drawing (off-screen, hidden tab); true resumes and redraws once. */
  setActive(active: boolean): void;
  dispose(): void;
}

declare global {
  interface Window {
    __renderBookPoster?: () => string;
  }
}

// Pose. Radians throughout.
export const BASE_YAW = MathUtils.degToRad(25);
export const BASE_PITCH = MathUtils.degToRad(12);
export const SETTLE_FROM_YAW = MathUtils.degToRad(35);
export const MAX_YAW_TILT = MathUtils.degToRad(6);
export const MAX_PITCH_TILT = MathUtils.degToRad(4);
const SMOOTHING = 0.09; // per frame; about a second from 35 to 25 degrees at 60 Hz
const REST_EPSILON = MathUtils.degToRad(0.01);
const FOV_DEGREES = 30;

// Orientation of the export so the front cover faces the camera, title upright, spine on the
// right as an Urdu book sits. The export lies flat with its thickness along local Y, so a
// quarter turn about X stands it up. Task 4 corrects these three constants by eye.
const MODEL_ROTATION: [number, number, number] = [Math.PI / 2, 0, 0];
/** +1 or -1: which side of the page block's local Y (thickness) axis the front board is on. */
const FRONT_SIGN = 1;
/** +1 or -1: which end of the page block's local Z (height) axis is the bottom edge. */
const BOTTOM_SIGN = 1;

const RIBBON_COLOR = 0xbeaa30;
const RIBBON_WIDTH = 0.015; // metres across the page
const RIBBON_THICKNESS = 0.0006;
const RIBBON_TAIL = 0.035; // how far the tail hangs below the bottom edge
const RIBBON_INSET = 0.02; // keep it off the boards at 0 and 1

export async function createBookScene(
  canvas: HTMLCanvasElement,
  options: BookSceneOptions,
): Promise<BookScene> {
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = environment;

  // One warm key light from the upper left; the environment does the rest. No shadow maps.
  const key = new DirectionalLight(0xfbf3d0, 1.6);
  key.position.set(-2, 3, 4);
  scene.add(key);

  const camera = new PerspectiveCamera(FOV_DEGREES, 1, 0.01, 10);
  camera.position.set(0, 0, 1); // direction only; fitCamera sets the distance
  const pivot = new Group();
  scene.add(pivot);

  const gltf = await new GLTFLoader().loadAsync(options.modelUrl);
  const model = gltf.scene;
  model.rotation.set(...MODEL_ROTATION);
  const bounds = new Box3().setFromObject(model);
  model.position.sub(bounds.getCenter(new Vector3()));
  pivot.add(model);
  const radius = bounds.getSize(new Vector3()).length() / 2;

  // Ribbon lives in the page block's local space, where X runs across the page, Y through the
  // thickness and Z along the height. The export gives Book_Pages two primitives, so the loader
  // makes it a Group of meshes with identity transforms; their geometry boxes are unioned.
  const pages = model.getObjectByName("Book_Pages");
  let ribbon: Mesh | null = null;
  let pageBox: Box3 | null = null;
  if (pages) {
    const box = new Box3();
    pages.traverse((object) => {
      if (object instanceof Mesh) {
        object.geometry.computeBoundingBox();
        box.union(object.geometry.boundingBox!);
      }
    });
    if (!box.isEmpty()) pageBox = box;
  }
  if (pages && pageBox) {
    const size = pageBox.getSize(new Vector3());
    ribbon = new Mesh(
      new BoxGeometry(RIBBON_WIDTH, RIBBON_THICKNESS, size.z + RIBBON_TAIL),
      new MeshStandardMaterial({ color: RIBBON_COLOR, roughness: 0.6, metalness: 0 }),
    );
    ribbon.name = "Progress_Ribbon";
    ribbon.visible = false;
    pages.add(ribbon);
  }

  function placeRibbon(progress: number | undefined) {
    if (!ribbon || !pageBox) return;
    if (progress === undefined || Number.isNaN(progress)) {
      ribbon.visible = false;
      return;
    }
    const p = MathUtils.clamp(progress, 0, 1) * (1 - 2 * RIBBON_INSET) + RIBBON_INSET;
    const centre = pageBox.getCenter(new Vector3());
    const size = pageBox.getSize(new Vector3());
    const front = centre.y + FRONT_SIGN * (size.y / 2);
    ribbon.position.set(
      centre.x,
      front - FRONT_SIGN * p * size.y,
      centre.z + BOTTOM_SIGN * (RIBBON_TAIL / 2),
    );
    ribbon.visible = true;
  }
  placeRibbon(options.progress);

  // Pose state.
  let targetYaw = BASE_YAW;
  let targetPitch = BASE_PITCH;
  let yaw = options.hoverCapable ? BASE_YAW : SETTLE_FROM_YAW;
  let pitch = BASE_PITCH;
  let active = true;
  let frame = 0;
  let disposed = false;

  let controls: OrbitControls | null = null;
  // A plain wheel over the About book keeps scrolling the page. Only a pinch reaches the
  // controls: two fingers on a touch screen, or a trackpad pinch, which browsers report as a
  // wheel event with ctrlKey set. Capture phase on the same element runs before the controls'
  // own listener, so stopping propagation here keeps it from zooming and preventing the scroll.
  const blockPlainWheel = (event: WheelEvent) => {
    if (!event.ctrlKey) event.stopImmediatePropagation();
  };
  if (options.variant === "inspect") {
    const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
    controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.zoomSpeed = 0.6;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    canvas.addEventListener("wheel", blockPlainWheel, { capture: true, passive: true });
    // The controls fire "change" whenever the camera actually moved: on every pointer move or
    // pinch, and from update() while damping coasts. Each one buys exactly one more frame, so a
    // finger held still, or a missed pointer-up, never keeps the loop running.
    controls.addEventListener("change", requestFrame);
  }

  function applyPose() {
    pivot.rotation.set(pitch, yaw, 0);
  }

  // Distance at which the whole book fits the canvas; the reader's pinch zoom is relative to it.
  let fitDistance = 0;

  function fitCamera(width: number, height: number) {
    camera.aspect = width / Math.max(height, 1);
    const halfFov = MathUtils.degToRad(FOV_DEGREES / 2);
    let distance = radius / Math.sin(halfFov);
    if (camera.aspect < 1) distance /= camera.aspect;
    distance *= 1.02;
    // Keep the reader's viewing angle and zoom across resizes rather than snapping back.
    const zoom = fitDistance > 0 ? camera.position.length() / fitDistance : 1;
    fitDistance = distance;
    camera.position.setLength(distance * zoom);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    if (controls) {
      controls.minDistance = distance * 0.45;
      controls.maxDistance = distance * 1.6;
      controls.update();
    }
  }

  function requestFrame() {
    if (disposed || !active || frame) return;
    frame = requestAnimationFrame(tick);
  }

  function tick() {
    frame = 0;
    if (disposed) return;

    yaw += (targetYaw - yaw) * SMOOTHING;
    pitch += (targetPitch - pitch) * SMOOTHING;
    const moving =
      Math.abs(targetYaw - yaw) > REST_EPSILON || Math.abs(targetPitch - pitch) > REST_EPSILON;
    if (!moving) {
      yaw = targetYaw;
      pitch = targetPitch;
    }
    applyPose();

    // With damping on, update() keeps the camera coasting after the pointer lifts; while it moves
    // it fires "change", which schedules the next frame.
    controls?.update();

    renderer.render(scene, camera);
    if (moving) requestFrame();
  }

  const bookScene: BookScene = {
    setTilt(x, y) {
      targetYaw = BASE_YAW + MathUtils.clamp(x, -1, 1) * MAX_YAW_TILT;
      targetPitch = BASE_PITCH + MathUtils.clamp(y, -1, 1) * MAX_PITCH_TILT;
      requestFrame();
    },
    setProgress(progress) {
      placeRibbon(progress);
      requestFrame();
    },
    resize(width, height) {
      renderer.setSize(width, height, false);
      fitCamera(width, height);
      requestFrame();
    },
    setActive(next) {
      active = next;
      if (next) requestFrame();
      else if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    },
    dispose() {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      canvas.removeEventListener("wheel", blockPlainWheel, { capture: true });
      controls?.dispose();
      if (window.__renderBookPoster === renderPoster) delete window.__renderBookPoster;
      model.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            for (const value of Object.values(material)) {
              if ((value as Texture | null)?.isTexture) {
                (value as Texture).dispose();
              }
            }
            material.dispose();
          }
        }
      });
      environment.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };

  // Development-only hook for scripts/render-book-poster.mjs: draw the rest pose and hand back
  // the pixels. Next.js strips this branch from production bundles.
  function renderPoster(): string {
    yaw = targetYaw = BASE_YAW;
    pitch = targetPitch = BASE_PITCH;
    applyPose();
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL("image/png");
  }
  if (process.env.NODE_ENV === "development") {
    window.__renderBookPoster = renderPoster;
  }

  fitCamera(canvas.clientWidth || 1, canvas.clientHeight || 1);
  applyPose();
  renderer.render(scene, camera);
  requestFrame(); // carries a touch device's settle from 35 to 25 degrees
  return bookScene;
}
