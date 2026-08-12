import { Howl, Howler } from 'howler';
import { resolveAssetUrl } from '../utils/asset-url.ts';
import type { SfxId } from './audio-manifest.ts';
import { MUSIC_URL, MUSIC_VOLUME, SFX_MANIFEST, SFX_VOLUME } from './audio-manifest.ts';

/**
 * Single owner of every sound in the game.
 *
 * Nothing else touches Howler directly, which keeps mute state, the autoplay
 * unlock and pause/resume behaviour in one place.
 */
export class AudioManager {
  private readonly sfx = new Map<SfxId, Howl>();
  private music: Howl | null = null;
  private musicRequested = false;
  private muted = false;
  private unlocked = false;
  /** Guards against stacking identical feedback sounds on rapid input. */
  private readonly lastPlayedAt = new Map<SfxId, number>();

  constructor(muted: boolean) {
    this.muted = muted;
    Howler.volume(SFX_VOLUME);
    Howler.mute(muted);
  }

  /**
   * Loads the short effects. Music is intentionally left out so the first
   * screen is interactive without waiting for a 2.5 MB download.
   */
  loadEffects(): void {
    if (this.sfx.size > 0) return;
    for (const entry of SFX_MANIFEST) {
      const howl = new Howl({
        src: [resolveAssetUrl(entry.url)],
        volume: entry.volume,
        preload: true,
        html5: false,
      });
      this.sfx.set(entry.id, howl);
    }
  }

  /**
   * Marks audio as usable. Browsers only allow playback after a real user
   * gesture, so this is called from the first button press.
   */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    const context: AudioContext | undefined = Howler.ctx;
    if (context?.state === 'suspended') {
      void context.resume().catch(() => {
        // Nothing to do - the game stays playable without sound.
      });
    }
  }

  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    Howler.mute(muted);
    if (muted) {
      this.music?.pause();
    } else if (this.musicRequested) {
      this.playMusic();
    }
  }

  play(id: SfxId, minimumGapMs = 120): void {
    if (this.muted || !this.unlocked) return;
    const howl = this.sfx.get(id);
    if (howl === undefined) return;

    const now = performance.now();
    const previous = this.lastPlayedAt.get(id) ?? -Infinity;
    if (now - previous < minimumGapMs) return;
    this.lastPlayedAt.set(id, now);

    howl.play();
  }

  /** Lazily fetches and starts the looping background music. */
  playMusic(): void {
    this.musicRequested = true;
    if (!this.unlocked || this.muted) return;

    this.music ??= new Howl({
      src: [resolveAssetUrl(MUSIC_URL)],
      loop: true,
      volume: MUSIC_VOLUME,
      html5: false,
      preload: true,
    });

    if (!this.music.playing()) {
      this.music.play();
    }
  }

  pauseMusic(): void {
    this.music?.pause();
  }

  resumeMusic(): void {
    if (!this.musicRequested || this.muted || !this.unlocked) return;
    this.playMusic();
  }

  stopMusic(): void {
    this.musicRequested = false;
    this.music?.stop();
  }

  /** Fades the music down while an overlay is showing. */
  duckMusic(ducked: boolean): void {
    if (this.music === null) return;
    this.music.volume(ducked ? MUSIC_VOLUME * 0.35 : MUSIC_VOLUME);
  }

  dispose(): void {
    for (const howl of this.sfx.values()) {
      howl.unload();
    }
    this.sfx.clear();
    this.music?.unload();
    this.music = null;
  }
}
