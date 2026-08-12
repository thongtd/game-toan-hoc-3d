import { GRADE_CONFIGS } from '../../../shared/content/grade-config.ts';
import type { Grade } from '../../../shared/game-types.ts';
import { ALL_GRADES } from '../../../shared/game-types.ts';
import { createIcon, setText } from '../dom.ts';

/**
 * Grade selection as five game medals.
 *
 * Deliberately not tabs, chips or a dropdown: each grade is a shield badge, and
 * the selected one is marked by scale, colour *and* a star so the choice never
 * relies on colour alone.
 */
export class GradeMedals {
  private readonly buttons = new Map<Grade, HTMLButtonElement>();
  private selected: Grade = 1;

  constructor(
    private readonly container: HTMLElement,
    private readonly onSelect: (grade: Grade) => void,
  ) {
    for (const grade of ALL_GRADES) {
      const config = GRADE_CONFIGS[grade];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'medal';
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', 'false');
      button.setAttribute('aria-label', `${config.label}: ${config.description}`);
      button.dataset.testid = `grade-${String(grade)}`;
      button.dataset.grade = String(grade);

      const label = document.createElement('span');
      label.className = 'medal__label';
      setText(label, 'Lớp');

      const number = document.createElement('span');
      number.className = 'medal__number';
      setText(number, String(grade));

      const star = createIcon('icon-star', 'medal__star');

      button.append(label, number, star);
      button.addEventListener('click', () => {
        this.onSelect(grade);
      });

      this.buttons.set(grade, button);
      this.container.append(button);
    }
  }

  setSelected(grade: Grade): void {
    this.selected = grade;
    for (const [value, button] of this.buttons) {
      button.setAttribute('aria-checked', value === grade ? 'true' : 'false');
      button.tabIndex = value === grade ? 0 : -1;
    }
  }

  get value(): Grade {
    return this.selected;
  }
}
