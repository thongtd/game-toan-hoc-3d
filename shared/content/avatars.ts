import catalog from './avatars.json' with { type: 'json' };

/**
 * Avatar catalog.
 *
 * `avatars.json` is the single source of truth, shared by three consumers:
 * the asset pipeline (which copies the source sprites), the web client (which
 * renders the picker) and the server (which validates `avatarId`). Nothing
 * else may hard-code an avatar id.
 */

export type AvatarCategory = 'animals' | 'robots' | 'aircraft' | 'vehicles';

export interface AvatarEntry {
  id: string;
  category: AvatarCategory;
  displayName: string;
  /** Path under `public/`, resolved against the deployment base at runtime. */
  imageUrl: string;
  sourcePack: string;
  /** Path of the original sprite inside its source pack. */
  sourceFile: string;
  license: string;
  enabled: boolean;
  sortOrder: number;
}

export interface AvatarCatalog {
  version: number;
  items: AvatarEntry[];
}

const CATALOG = catalog as AvatarCatalog;

export const AVATAR_CATALOG_VERSION = CATALOG.version;

/** Every avatar, including disabled ones, sorted for stable display. */
export const ALL_AVATARS: readonly AvatarEntry[] = [...CATALOG.items].sort(
  (a, b) => a.sortOrder - b.sortOrder,
);

/** Avatars a player may pick right now. */
export const SELECTABLE_AVATARS: readonly AvatarEntry[] = ALL_AVATARS.filter(
  (avatar) => avatar.enabled,
);

export const AVATAR_CATEGORIES: readonly { id: AvatarCategory; label: string }[] = [
  { id: 'animals', label: 'Con vật' },
  { id: 'robots', label: 'Robot' },
  { id: 'aircraft', label: 'Bay lượn' },
  { id: 'vehicles', label: 'Xe cộ' },
];

const BY_ID = new Map(ALL_AVATARS.map((avatar) => [avatar.id, avatar]));

/** Any known avatar, even one that has since been disabled. */
export function findAvatar(id: string): AvatarEntry | null {
  return BY_ID.get(id) ?? null;
}

/** True when `id` may be chosen for a new or updated profile. */
export function isSelectableAvatar(id: string): boolean {
  return BY_ID.get(id)?.enabled === true;
}

/**
 * Avatar used when a player's stored choice has since been disabled or
 * removed, so an old profile never renders a broken image.
 */
export const FALLBACK_AVATAR: AvatarEntry = ALL_AVATARS[0] ?? {
  id: 'animal-panda-01',
  category: 'animals',
  displayName: 'Gấu trúc',
  imageUrl: 'assets/avatars/animal-panda-01.png',
  sourcePack: 'Kenney Animal Pack Remastered',
  sourceFile: 'PNG/Round/panda.png',
  license: 'CC0',
  enabled: true,
  sortOrder: 10,
};

/** Resolves an avatar for display, falling back when the id is unknown. */
export function resolveAvatarForDisplay(id: string): AvatarEntry {
  return findAvatar(id) ?? FALLBACK_AVATAR;
}

export function avatarsByCategory(category: AvatarCategory): readonly AvatarEntry[] {
  return SELECTABLE_AVATARS.filter((avatar) => avatar.category === category);
}
