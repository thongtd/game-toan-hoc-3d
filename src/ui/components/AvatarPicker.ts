import type { AvatarCategory, AvatarEntry } from '../../../shared/content/avatars.ts';
import { AVATAR_CATEGORIES, SELECTABLE_AVATARS } from '../../../shared/content/avatars.ts';
import { resolveAssetUrl } from '../../utils/asset-url.ts';
import { createIcon, requireElement, setText } from '../dom.ts';

/**
 * Grid of pre-made avatars.
 *
 * There is no upload path anywhere in the product: a player picks one of the
 * bundled CC0 sprites, and only its id is ever stored.
 */
export class AvatarPicker {
  private readonly tabs = new Map<AvatarCategory, HTMLButtonElement>();
  private readonly options = new Map<string, HTMLButtonElement>();
  private readonly grid = requireElement('avatar-grid');
  private readonly tabBar = requireElement('avatar-categories');

  private category: AvatarCategory = 'animals';
  private selectedId: string | null = null;

  constructor(private readonly onSelect: (avatar: AvatarEntry) => void) {
    for (const category of AVATAR_CATEGORIES) {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'avatar-tab';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', 'false');
      tab.dataset.testid = `avatar-tab-${category.id}`;
      setText(tab, category.label);
      tab.addEventListener('click', () => {
        this.showCategory(category.id);
      });
      this.tabs.set(category.id, tab);
      this.tabBar.append(tab);
    }

    this.buildOptions();
    this.showCategory('animals');
  }

  private buildOptions(): void {
    for (const avatar of SELECTABLE_AVATARS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'avatar-option';
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', `Chọn avatar ${avatar.displayName}`);
      button.dataset.testid = `avatar-option-${avatar.id}`;
      button.dataset.category = avatar.category;
      button.dataset.avatarId = avatar.id;

      const image = document.createElement('img');
      image.className = 'avatar-option__img';
      image.src = resolveAssetUrl(avatar.imageUrl);
      image.alt = '';
      image.width = 88;
      image.height = 88;
      // Only the first tab's worth of images are needed straight away.
      image.loading = 'lazy';
      image.decoding = 'async';

      button.append(image, createIcon('icon-check', 'avatar-option__check'));
      button.addEventListener('click', () => {
        this.select(avatar.id);
        this.onSelect(avatar);
      });

      this.options.set(avatar.id, button);
      this.grid.append(button);
    }
  }

  showCategory(category: AvatarCategory): void {
    this.category = category;
    for (const [id, tab] of this.tabs) {
      tab.setAttribute('aria-selected', id === category ? 'true' : 'false');
    }
    for (const button of this.options.values()) {
      button.hidden = button.dataset.category !== category;
    }
  }

  select(avatarId: string): void {
    this.selectedId = avatarId;
    for (const [id, button] of this.options) {
      button.setAttribute('aria-pressed', id === avatarId ? 'true' : 'false');
    }
  }

  /** Opens the picker on the category containing the current selection. */
  focusOn(avatarId: string | null): void {
    if (avatarId === null) {
      this.showCategory(this.category);
      return;
    }
    const avatar = SELECTABLE_AVATARS.find((entry) => entry.id === avatarId);
    this.select(avatarId);
    this.showCategory(avatar?.category ?? this.category);
  }

  get value(): string | null {
    return this.selectedId;
  }
}
