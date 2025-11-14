import { UIInteractionState } from '../state/ui-interaction-state.js';

export class DropdownManager {
  constructor(private readonly uiState: UIInteractionState) {}

  open(trigger: HTMLElement, dropdown: HTMLElement): void {
    dropdown.classList.add('show');
    dropdown.style.visibility = 'hidden';
    this.position(trigger, dropdown);
    dropdown.style.visibility = '';
    this.uiState.activeDropdown = { trigger, dropdown };
  }

  hide(dropdown: HTMLElement | null | undefined): void {
    if (!dropdown) return;
    dropdown.classList.remove('show');
    dropdown.style.removeProperty('left');
    dropdown.style.removeProperty('top');
    dropdown.style.removeProperty('right');
    dropdown.style.removeProperty('bottom');
    dropdown.style.removeProperty('position');
    dropdown.style.removeProperty('visibility');
    dropdown.style.removeProperty('width');

    if (this.uiState.activeDropdown?.dropdown === dropdown) {
      this.uiState.activeDropdown = null;
    }
  }

  repositionActive(): void {
    const active = this.uiState.activeDropdown;
    if (!active) return;
    const { trigger, dropdown } = active;

    if (!dropdown.classList.contains('show')) {
      this.uiState.activeDropdown = null;
      return;
    }

    dropdown.style.visibility = 'hidden';
    this.position(trigger, dropdown);
    dropdown.style.visibility = '';
  }

  private position(trigger: HTMLElement, dropdown: HTMLElement): void {
    const margin = 8;
    const triggerRect = trigger.getBoundingClientRect();

    dropdown.style.position = 'fixed';
    dropdown.style.left = '0px';
    dropdown.style.top = '0px';
    dropdown.style.right = '';
    dropdown.style.bottom = '';

    let dropdownRect = dropdown.getBoundingClientRect();
    const availableWidth = Math.max(window.innerWidth - margin * 2, 0);

    if (dropdownRect.width > availableWidth && availableWidth > 0) {
      dropdown.style.width = `${availableWidth}px`;
      dropdownRect = dropdown.getBoundingClientRect();
    } else {
      dropdown.style.removeProperty('width');
    }

    const dropdownHeight = dropdownRect.height;
    const dropdownWidth = dropdownRect.width;

    let left = triggerRect.left;
    const maxLeft = window.innerWidth - dropdownWidth - margin;
    if (maxLeft < margin) {
      left = margin;
    } else {
      left = Math.min(Math.max(left, margin), maxLeft);
    }

    let top = triggerRect.bottom + margin;
    const maxTop = window.innerHeight - dropdownHeight - margin;
    if (maxTop < margin) {
      top = margin;
    } else if (top > maxTop) {
      const alternateTop = triggerRect.top - margin - dropdownHeight;
      top = Math.max(alternateTop, margin);
    }

    dropdown.style.left = `${left}px`;
    dropdown.style.top = `${top}px`;
  }
}
