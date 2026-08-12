import type { Grade } from '../../../shared/game-types.ts';
import type { LeaderboardResponse, PlayerDto } from '../../../shared/contracts/api.ts';
import type { AvatarEntry } from '../../../shared/content/avatars.ts';
import { SELECTABLE_AVATARS, resolveAvatarForDisplay } from '../../../shared/content/avatars.ts';
import { formatScore } from '../../../shared/math/format-number.ts';
import { validateNickname } from '../../../shared/validation/nickname.ts';
import { SELECTABLE_AGES, validateAge } from '../../../shared/validation/profile.ts';
import { resolveAssetUrl } from '../../utils/asset-url.ts';
import { AvatarPicker } from '../components/AvatarPicker.ts';
import { LeaderboardBoard } from '../components/LeaderboardBoard.ts';
import type { LeaderboardFilters } from '../components/LeaderboardBoard.ts';
import { onClick, requireElement, requireElementOfType, setHidden, setText } from '../dom.ts';

export interface PlayerDraft {
  nickname: string;
  age: number;
  avatarId: string;
}

export interface PlayerHubCallbacks {
  onSave(draft: PlayerDraft): void;
  onEnterRace(): void;
  onFiltersChanged(filters: LeaderboardFilters): void;
  onRefreshLeaderboard(): void;
  onAvatarPreview(): void;
}

type HubMode = 'create' | 'returning' | 'edit';

/**
 * The Player Hub: a racer's pass and a trophy board standing on the track.
 *
 * Everything the child types is validated here for instant feedback, and again
 * on the server, which is the authority. Nothing about the profile is treated
 * as saved until the API confirms it.
 */
export class PlayerHubScreen {
  private readonly picker: AvatarPicker;
  readonly leaderboard: LeaderboardBoard;

  private readonly title = requireElement('pass-title');
  private readonly avatarImage = requireElementOfType('pass-avatar-img', HTMLImageElement);
  private readonly avatarName = requireElement('pass-avatar-name');
  private readonly nicknameInput = requireElementOfType('input-nickname', HTMLInputElement);
  private readonly nicknameError = requireElement('nickname-error');
  private readonly ageContainer = requireElement('age-badges');
  private readonly ageError = requireElement('age-error');
  private readonly editableBlock = requireElement('pass-editable');
  private readonly stats = requireElement('pass-stats');
  private readonly notice = requireElement('pass-notice');
  private readonly saveButton = requireElementOfType('btn-save-player', HTMLButtonElement);
  private readonly saveButtonText = requireElement('btn-save-player-text');
  private readonly editButton = requireElement('btn-edit-profile');
  private readonly cancelEditButton = requireElement('btn-cancel-edit');
  private readonly pickerScreen = requireElement('screen-avatar-picker');

  private readonly ageButtons = new Map<number, HTMLButtonElement>();

  private mode: HubMode = 'create';
  private selectedAvatarId: string = SELECTABLE_AVATARS[0]?.id ?? 'animal-panda-01';
  private selectedAge: number | null = null;
  private savedProfile: PlayerDto | null = null;

  constructor(private readonly callbacks: PlayerHubCallbacks) {
    this.picker = new AvatarPicker((avatar) => {
      this.setAvatar(avatar);
      this.callbacks.onAvatarPreview();
    });

    this.leaderboard = new LeaderboardBoard({
      onFiltersChanged: (filters) => {
        this.callbacks.onFiltersChanged(filters);
      },
      onRefresh: () => {
        this.callbacks.onRefreshLeaderboard();
      },
      onExpand: () => {
        /* Expanding only re-renders what is already loaded. */
      },
    });

    this.buildAgeBadges();
    this.bind();
    this.setAvatar(resolveAvatarForDisplay(this.selectedAvatarId));
  }

  private buildAgeBadges(): void {
    for (const age of SELECTABLE_AGES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'age-badge';
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', 'false');
      button.setAttribute('aria-label', `Tuổi ${String(age)}`);
      button.dataset.testid = `age-${String(age)}`;
      setText(button, String(age));
      button.addEventListener('click', () => {
        this.setAge(age);
      });
      this.ageButtons.set(age, button);
      this.ageContainer.append(button);
    }
  }

  private bind(): void {
    onClick(requireElement('btn-open-avatar'), () => {
      this.picker.focusOn(this.selectedAvatarId);
      setHidden(this.pickerScreen, false);
      requireElement('btn-avatar-done').focus();
    });
    onClick(requireElement('btn-avatar-done'), () => {
      setHidden(this.pickerScreen, true);
    });

    onClick(this.saveButton, () => {
      if (this.mode === 'returning') {
        this.callbacks.onEnterRace();
        return;
      }
      const draft = this.readDraft();
      if (draft !== null) this.callbacks.onSave(draft);
    });

    onClick(this.editButton, () => {
      this.setMode('edit');
    });
    onClick(this.cancelEditButton, () => {
      if (this.savedProfile !== null) this.showReturning(this.savedProfile);
    });

    // Live validation, but only after the child has had a chance to type.
    this.nicknameInput.addEventListener('blur', () => {
      this.validateNicknameField();
    });
    this.nicknameInput.addEventListener('input', () => {
      if (!this.nicknameError.classList.contains('is-hidden')) {
        this.validateNicknameField();
      }
    });
  }

  /* ------------------------------- Modes -------------------------------- */

  showCreate(suggestedAge: number | null = null): void {
    this.savedProfile = null;
    this.selectedAge = suggestedAge;
    this.nicknameInput.value = '';
    // Start on a real avatar rather than an empty frame: a child sees a
    // character straight away and only opens the picker to change it.
    this.setAvatar(resolveAvatarForDisplay(this.selectedAvatarId));
    this.setMode('create');
    this.clearNotice();
  }

  showReturning(player: PlayerDto): void {
    this.savedProfile = player;
    this.selectedAge = player.age;
    this.nicknameInput.value = player.nickname;
    this.setAvatar(resolveAvatarForDisplay(player.avatarId));
    this.setMode('returning');
    this.clearNotice();
  }

  private setMode(mode: HubMode): void {
    this.mode = mode;

    const editing = mode !== 'returning';
    setHidden(this.editableBlock, !editing);
    setHidden(this.editButton, mode !== 'returning');
    setHidden(this.cancelEditButton, mode !== 'edit');
    setHidden(this.stats, mode !== 'returning');

    if (mode === 'create') {
      setText(this.title, 'Tạo tay đua');
      setText(this.saveButtonText, 'Lưu và vào đường đua');
    } else if (mode === 'edit') {
      setText(this.title, 'Sửa hồ sơ');
      setText(this.saveButtonText, 'Lưu thay đổi');
    } else {
      setText(this.title, this.savedProfile?.nickname ?? 'Tay đua');
      setText(this.saveButtonText, 'Vào đường đua');
    }

    this.setAge(this.selectedAge);
    this.hideFieldErrors();
  }

  /** Personal bests and age, shown only in the player's own pass. */
  setStats(age: number, bestScores: Partial<Record<Grade, number>>, grade: Grade): void {
    const best = bestScores[grade] ?? 0;
    const bestText =
      best > 0 ? `Kỷ lục Lớp ${String(grade)}: ${formatScore(best)}` : 'Chưa có kỷ lục';
    setText(this.stats, `Tuổi ${String(age)} · ${bestText}`);
  }

  /* ------------------------------- Fields ------------------------------- */

  private setAvatar(avatar: AvatarEntry): void {
    this.selectedAvatarId = avatar.id;
    this.avatarImage.src = resolveAssetUrl(avatar.imageUrl);
    this.avatarImage.alt = `Avatar ${avatar.displayName}`;
    setText(this.avatarName, avatar.displayName);
    this.picker.select(avatar.id);
  }

  private setAge(age: number | null): void {
    this.selectedAge = age;
    for (const [value, button] of this.ageButtons) {
      button.setAttribute('aria-checked', value === age ? 'true' : 'false');
    }
    if (age !== null) setHidden(this.ageError, true);
  }

  private validateNicknameField(): boolean {
    const result = validateNickname(this.nicknameInput.value);
    if (result.ok) {
      setHidden(this.nicknameError, true);
      this.nicknameInput.classList.remove('pass__input--invalid');
      this.nicknameInput.removeAttribute('aria-invalid');
      return true;
    }

    setText(this.nicknameError, result.message);
    setHidden(this.nicknameError, false);
    this.nicknameInput.classList.add('pass__input--invalid');
    this.nicknameInput.setAttribute('aria-invalid', 'true');
    return false;
  }

  private hideFieldErrors(): void {
    setHidden(this.nicknameError, true);
    setHidden(this.ageError, true);
    this.nicknameInput.classList.remove('pass__input--invalid');
  }

  /** Reads the form, or null when something is not valid yet. */
  private readDraft(): PlayerDraft | null {
    const nicknameOk = this.validateNicknameField();
    const age = validateAge(this.selectedAge);

    if (!age.ok) {
      setText(this.ageError, age.message);
      setHidden(this.ageError, false);
    }
    if (!nicknameOk || !age.ok) {
      (nicknameOk ? this.ageContainer : this.nicknameInput).focus();
      return null;
    }

    return {
      nickname: this.nicknameInput.value.normalize('NFC').trim(),
      age: age.value,
      avatarId: this.selectedAvatarId,
    };
  }

  /* ------------------------------ Feedback ------------------------------ */

  setBusy(busy: boolean): void {
    this.saveButton.disabled = busy;
  }

  showNotice(message: string, tone: 'error' | 'ok' = 'error'): void {
    setText(this.notice, message);
    this.notice.classList.toggle('pass__notice--ok', tone === 'ok');
    setHidden(this.notice, false);
  }

  clearNotice(): void {
    setHidden(this.notice, true);
  }

  /** Marks a field the server rejected, e.g. a nickname it will not accept. */
  showFieldError(field: string | undefined, message: string): void {
    if (field === 'nickname') {
      setText(this.nicknameError, message);
      setHidden(this.nicknameError, false);
      this.nicknameInput.classList.add('pass__input--invalid');
      this.nicknameInput.focus();
      return;
    }
    if (field === 'age') {
      setText(this.ageError, message);
      setHidden(this.ageError, false);
      return;
    }
    this.showNotice(message);
  }

  renderLeaderboard(response: LeaderboardResponse): void {
    this.leaderboard.render(response, this.savedProfile?.nickname ?? null);
  }

  closeAvatarPicker(): void {
    setHidden(this.pickerScreen, true);
  }

  get isAvatarPickerOpen(): boolean {
    return !this.pickerScreen.classList.contains('is-hidden');
  }
}
