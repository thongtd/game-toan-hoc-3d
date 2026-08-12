import type { Grade } from '../../../shared/game-types.ts';
import { ALL_GRADES } from '../../../shared/game-types.ts';
import type {
  LeaderboardEntryDto,
  LeaderboardPeriod,
  LeaderboardResponse,
} from '../../../shared/contracts/api.ts';
import { resolveAvatarForDisplay } from '../../../shared/content/avatars.ts';
import { formatScore } from '../../../shared/math/format-number.ts';
import { resolveAssetUrl } from '../../utils/asset-url.ts';
import {
  createIcon,
  onClick,
  requireElement,
  requireElementOfType,
  setHidden,
  setText,
} from '../dom.ts';

export interface LeaderboardFilters {
  grade: Grade;
  period: LeaderboardPeriod;
}

export interface LeaderboardCallbacks {
  onFiltersChanged(filters: LeaderboardFilters): void;
  onRefresh(): void;
  onExpand(): void;
}

const COMPACT_ROWS = 5;

/**
 * The trophy board.
 *
 * Shows rank, avatar, nickname and score - nothing else. Age, player ids and
 * timings never reach this component because the API never sends them.
 */
export class LeaderboardBoard {
  private readonly rows = requireElement('lb-rows');
  private readonly message = requireElement('lb-message');
  private readonly retryButton = requireElement('btn-lb-retry');
  private readonly expandButton = requireElement('btn-lb-expand');
  private readonly gradeContainer = requireElement('lb-grades');
  private readonly weeklyButton = requireElement('btn-period-weekly');
  private readonly allTimeButton = requireElement('btn-period-all');
  private readonly refreshButton = requireElementOfType('btn-lb-refresh', HTMLButtonElement);

  private readonly gradeButtons = new Map<Grade, HTMLButtonElement>();
  private filters: LeaderboardFilters = { grade: 1, period: 'weekly' };
  private expanded = false;
  private lastResponse: LeaderboardResponse | null = null;
  private refreshCooldownUntil = 0;

  constructor(private readonly callbacks: LeaderboardCallbacks) {
    for (const grade of ALL_GRADES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'lb__grade';
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', 'false');
      button.dataset.testid = `lb-grade-${String(grade)}`;
      setText(button, `Lớp ${String(grade)}`);
      button.addEventListener('click', () => {
        this.setFilters({ ...this.filters, grade });
        this.callbacks.onFiltersChanged(this.filters);
      });
      this.gradeButtons.set(grade, button);
      this.gradeContainer.append(button);
    }

    onClick(this.weeklyButton, () => {
      this.setFilters({ ...this.filters, period: 'weekly' });
      this.callbacks.onFiltersChanged(this.filters);
    });
    onClick(this.allTimeButton, () => {
      this.setFilters({ ...this.filters, period: 'all_time' });
      this.callbacks.onFiltersChanged(this.filters);
    });
    onClick(this.retryButton, () => {
      this.callbacks.onRefresh();
    });
    onClick(this.expandButton, () => {
      this.expanded = true;
      setHidden(this.expandButton, true);
      if (this.lastResponse !== null) this.render(this.lastResponse);
      this.callbacks.onExpand();
    });
    onClick(this.refreshButton, () => {
      // A ten second cooldown keeps an eager tapper from hammering the API.
      const now = Date.now();
      if (now < this.refreshCooldownUntil) return;
      this.refreshCooldownUntil = now + 10_000;
      this.refreshButton.disabled = true;
      setTimeout(() => {
        this.refreshButton.disabled = false;
      }, 10_000);
      this.callbacks.onRefresh();
    });
  }

  setFilters(filters: LeaderboardFilters): void {
    this.filters = filters;
    for (const [grade, button] of this.gradeButtons) {
      button.setAttribute('aria-checked', grade === filters.grade ? 'true' : 'false');
    }
    this.weeklyButton.setAttribute('aria-checked', filters.period === 'weekly' ? 'true' : 'false');
    this.allTimeButton.setAttribute(
      'aria-checked',
      filters.period === 'all_time' ? 'true' : 'false',
    );
  }

  get currentFilters(): LeaderboardFilters {
    return { ...this.filters };
  }

  /** Placeholder rows so the board keeps its shape instead of collapsing. */
  showLoading(): void {
    setHidden(this.message, true);
    setHidden(this.retryButton, true);
    setHidden(this.expandButton, true);
    this.rows.replaceChildren();

    for (let i = 0; i < COMPACT_ROWS; i += 1) {
      const row = document.createElement('li');
      row.className = 'lb__row lb__row--skeleton';

      const rank = document.createElement('span');
      rank.className = 'lb__rank';
      setText(rank, String(i + 1));

      const block = document.createElement('span');
      block.className = 'lb__skeleton-block';
      block.style.flex = '1';

      row.append(rank, block);
      this.rows.append(row);
    }
  }

  showError(): void {
    this.rows.replaceChildren();
    setText(this.message, 'Bảng thành tích đang nghỉ một chút.');
    setHidden(this.message, false);
    setHidden(this.retryButton, false);
    setHidden(this.expandButton, true);
  }

  render(response: LeaderboardResponse, currentNickname: string | null = null): void {
    this.lastResponse = response;
    setHidden(this.retryButton, true);
    this.rows.replaceChildren();

    if (response.entries.length === 0) {
      setText(this.message, 'Chưa có tay đua nào — bạn mở hàng nhé!');
      setHidden(this.message, false);
      setHidden(this.expandButton, true);
      return;
    }

    setHidden(this.message, true);

    const visible = this.expanded ? response.entries : response.entries.slice(0, COMPACT_ROWS);
    for (const entry of visible) {
      this.rows.append(this.buildRow(entry, isCurrent(entry, response, currentNickname)));
    }

    // A player outside the visible slice is pinned at the bottom after a gap.
    const current = response.currentPlayerEntry;
    if (current !== null && !visible.some((entry) => entry.rank === current.rank)) {
      const gap = document.createElement('li');
      gap.className = 'lb__gap';
      setText(gap, '…');
      this.rows.append(gap, this.buildRow(current, true));
    }

    const hasMore = response.entries.length > visible.length;
    setHidden(this.expandButton, !hasMore || this.expanded);
  }

  private buildRow(entry: LeaderboardEntryDto, isMe: boolean): HTMLLIElement {
    const row = document.createElement('li');
    row.className = 'lb__row';
    row.dataset.testid = `lb-row-${String(entry.rank)}`;
    if (entry.rank === 1) row.classList.add('lb__row--gold');
    else if (entry.rank === 2) row.classList.add('lb__row--silver');
    else if (entry.rank === 3) row.classList.add('lb__row--bronze');
    if (isMe) {
      row.classList.add('lb__row--me');
      row.dataset.me = 'true';
    }

    const rank = document.createElement('span');
    rank.className = 'lb__rank';
    if (entry.rank <= 3) {
      const medalClass =
        entry.rank === 1
          ? 'lb__medal--gold'
          : entry.rank === 2
            ? 'lb__medal--silver'
            : 'lb__medal--bronze';
      rank.append(createIcon('icon-medal', `lb__medal ${medalClass}`));
      rank.setAttribute('aria-label', `Hạng ${String(entry.rank)}`);
    } else {
      setText(rank, String(entry.rank));
    }

    const avatar = resolveAvatarForDisplay(entry.avatarId);
    const image = document.createElement('img');
    image.className = 'lb__avatar';
    image.src = resolveAssetUrl(avatar.imageUrl);
    image.alt = '';
    image.width = 44;
    image.height = 44;
    image.loading = 'lazy';

    const nickname = document.createElement('span');
    nickname.className = 'lb__nickname';
    // Player-supplied text is always assigned, never parsed as markup.
    setText(nickname, entry.nickname);

    const score = document.createElement('span');
    score.className = 'lb__score';
    score.append(createIcon('icon-coin', 'lb__score-icon'));
    const scoreValue = document.createElement('span');
    setText(scoreValue, formatScore(entry.score));
    score.append(scoreValue);

    row.append(rank, image, nickname);
    if (isMe) {
      const tag = document.createElement('span');
      tag.className = 'lb__me-tag';
      setText(tag, 'Bạn');
      row.append(tag);
    }
    row.append(score);

    return row;
  }
}

function isCurrent(
  entry: LeaderboardEntryDto,
  response: LeaderboardResponse,
  currentNickname: string | null,
): boolean {
  const current = response.currentPlayerEntry;
  if (current === null) return false;
  if (entry.rank !== current.rank) return false;
  // Rank plus nickname is enough: the API deliberately omits player ids.
  return currentNickname === null || entry.nickname === currentNickname;
}
