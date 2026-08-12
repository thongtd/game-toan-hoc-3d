import * as THREE from 'three';
import type { QualitySettings } from './quality.ts';

export class WebGLUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('WebGL context could not be created');
    this.name = 'WebGLUnavailableError';
    this.cause = cause;
  }
}

/**
 * Creates the WebGL renderer.
 *
 * Throws `WebGLUnavailableError` instead of letting Three.js fail deep inside
 * the first frame, so the app can show a friendly "browser not supported"
 * screen rather than a blank page.
 */
export function createRenderer(
  canvas: HTMLCanvasElement,
  quality: QualitySettings,
): THREE.WebGLRenderer {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: quality.antialias,
      alpha: false,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false,
      // Reading pixels back needs the drawing buffer to survive compositing.
      // It costs performance, so only the thumbnail capture route asks for it.
      preserveDrawingBuffer: isThumbnailCapture(),
    });
  } catch (error) {
    throw new WebGLUnavailableError(error);
  }

  applyQuality(renderer, quality);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  return renderer;
}

/** True on the `?previewMap=` route used to photograph the maps. */
function isThumbnailCapture(): boolean {
  return new URLSearchParams(window.location.search).has('previewMap');
}

export function applyQuality(renderer: THREE.WebGLRenderer, quality: QualitySettings): void {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.pixelRatioCap));
  renderer.shadowMap.enabled = quality.shadowsEnabled;
}

export function resizeRenderer(
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
): void {
  const safeWidth = Math.max(1, Math.floor(width));
  const safeHeight = Math.max(1, Math.floor(height));
  renderer.setSize(safeWidth, safeHeight, false);
  camera.aspect = safeWidth / safeHeight;
  camera.updateProjectionMatrix();
}
