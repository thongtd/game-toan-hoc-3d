/** Every audio file the game may play, with its role and default volume. */

export type SfxId = 'correct' | 'wrong' | 'finish' | 'newRecord' | 'click' | 'rollover' | 'switch';

export interface SfxEntry {
  id: SfxId;
  url: string;
  volume: number;
}

export const MUSIC_URL = 'assets/audio/music/childrens-march-theme.ogg';

export const MUSIC_VOLUME = 0.22;
export const SFX_VOLUME = 0.65;

export const SFX_MANIFEST: readonly SfxEntry[] = [
  { id: 'correct', url: 'assets/audio/sfx/correct.ogg', volume: 0.7 },
  { id: 'wrong', url: 'assets/audio/sfx/wrong.ogg', volume: 0.45 },
  { id: 'finish', url: 'assets/audio/sfx/finish.ogg', volume: 0.7 },
  { id: 'newRecord', url: 'assets/audio/sfx/new-record.ogg', volume: 0.7 },
  { id: 'click', url: 'assets/audio/ui/click.ogg', volume: 0.5 },
  { id: 'rollover', url: 'assets/audio/ui/rollover.ogg', volume: 0.25 },
  { id: 'switch', url: 'assets/audio/ui/switch.ogg', volume: 0.4 },
];
