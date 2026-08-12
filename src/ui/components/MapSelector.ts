import type { MapDefinition, MapId } from '../../../shared/maps/map-manifest.ts';
import { enabledMaps, getMapDefinition } from '../../../shared/maps/map-manifest.ts';
import type { MapSelectionMode } from '../../player/map-preference.ts';
import { resolveAssetUrl } from '../../utils/asset-url.ts';
import { onClick, requireElement, requireElementOfType, setText } from '../dom.ts';

export interface MapSelectorIntents {
  /** Raised whenever the previewed map or the mode changes. */
  onChange(selection: { mode: MapSelectionMode; mapId: MapId }): void;
  /** A short blip when the player flicks through the carousel. */
  onPreview(): void;
}

/**
 * The map carousel on the home screen.
 *
 * It is a display stand, not a form: one big preview, an arrow either side, a
 * row of dots and a dice badge for "surprise me". Swipe works on phones, and
 * the arrows and dots are real buttons so a keyboard reaches everything.
 */
export class MapSelector {
  private readonly root = requireElement('map-card');
  private readonly image = requireElementOfType('map-thumbnail', HTMLImageElement);
  private readonly name = requireElement('map-name');
  private readonly description = requireElement('map-description');
  private readonly dots = requireElement('map-dots');
  private readonly randomButton = requireElement('btn-map-random');

  private readonly maps: MapDefinition[] = enabledMaps();
  private readonly disposers: (() => void)[] = [];

  private index = 0;
  private mode: MapSelectionMode = 'smart-random';
  private touchStartX: number | null = null;

  constructor(private readonly intents: MapSelectorIntents) {
    this.renderDots();

    this.disposers.push(
      onClick(requireElement('btn-map-prev'), () => {
        this.step(-1);
      }),
      onClick(requireElement('btn-map-next'), () => {
        this.step(1);
      }),
      onClick(this.randomButton, () => {
        this.setMode(this.mode === 'smart-random' ? 'manual' : 'smart-random', true);
      }),
    );

    this.bindSwipe();
  }

  /** Restores what the player last chose. */
  setSelection(mode: MapSelectionMode, mapId: MapId): void {
    const index = this.maps.findIndex((map) => map.id === mapId);
    this.index = index < 0 ? 0 : index;
    this.mode = mode;
    this.render();
  }

  get selectedMapId(): MapId {
    const map = this.maps[this.index];
    return map?.id ?? this.maps[0]?.id ?? getMapDefinition('rainbow-skyway').id;
  }

  get selectionMode(): MapSelectionMode {
    return this.mode;
  }

  /** Shows which map the roulette actually landed on. */
  showResolved(mapId: MapId): void {
    const index = this.maps.findIndex((map) => map.id === mapId);
    if (index < 0) return;
    this.index = index;
    this.render();
  }

  private step(direction: -1 | 1): void {
    if (this.maps.length === 0) return;
    this.index = (this.index + direction + this.maps.length) % this.maps.length;
    // Flicking through the stand is a deliberate choice, so it turns the
    // roulette off - the child is picking now.
    this.mode = 'manual';
    this.intents.onPreview();
    this.render();
    this.emit();
  }

  private setMode(mode: MapSelectionMode, notify: boolean): void {
    this.mode = mode;
    this.render();
    if (notify) this.emit();
  }

  private select(index: number): void {
    this.index = index;
    this.mode = 'manual';
    this.intents.onPreview();
    this.render();
    this.emit();
  }

  private emit(): void {
    this.intents.onChange({ mode: this.mode, mapId: this.selectedMapId });
  }

  private renderDots(): void {
    this.dots.replaceChildren();
    this.maps.forEach((map, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'map-dot';
      dot.setAttribute('role', 'radio');
      dot.setAttribute('aria-label', map.displayName);
      dot.dataset.testid = `map-dot-${map.id}`;
      this.disposers.push(
        onClick(dot, () => {
          this.select(index);
        }),
      );
      this.dots.append(dot);
    });
  }

  private render(): void {
    const map = this.maps[this.index];
    if (map === undefined) return;

    this.image.src = resolveAssetUrl(map.thumbnailUrl);
    this.image.alt = `Ảnh xem trước bản đồ ${map.displayName}`;
    setText(this.name, map.displayName);
    setText(
      this.description,
      this.mode === 'smart-random' ? 'Mỗi lượt một hành trình mới!' : map.description,
    );

    this.root.dataset.mapId = map.id;
    this.root.classList.toggle('map-card--random', this.mode === 'smart-random');

    // Re-trigger the little pop so switching maps reads as a change.
    this.root.classList.remove('map-card--switching');
    void this.root.offsetWidth;
    this.root.classList.add('map-card--switching');

    const dots = [...this.dots.children];
    dots.forEach((dot, index) => {
      const active = index === this.index && this.mode === 'manual';
      dot.classList.toggle('map-dot--active', active);
      dot.setAttribute('aria-checked', String(active));
    });

    const random = this.mode === 'smart-random';
    this.randomButton.classList.toggle('map-dice--on', random);
    this.randomButton.setAttribute('aria-pressed', String(random));
  }

  /** Horizontal swipe on the preview flicks between maps. */
  private bindSwipe(): void {
    const start = (event: PointerEvent): void => {
      if (event.pointerType === 'mouse') return;
      this.touchStartX = event.clientX;
    };
    const end = (event: PointerEvent): void => {
      if (this.touchStartX === null) return;
      const delta = event.clientX - this.touchStartX;
      this.touchStartX = null;
      if (Math.abs(delta) < 36) return;
      this.step(delta > 0 ? -1 : 1);
    };

    this.root.addEventListener('pointerdown', start);
    this.root.addEventListener('pointerup', end);
    this.root.addEventListener('pointercancel', () => {
      this.touchStartX = null;
    });

    this.disposers.push(() => {
      this.root.removeEventListener('pointerdown', start);
      this.root.removeEventListener('pointerup', end);
    });
  }

  dispose(): void {
    for (const disposer of this.disposers) disposer();
    this.disposers.length = 0;
  }
}
