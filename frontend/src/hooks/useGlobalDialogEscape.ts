import { useEffect } from 'react';

function getTopmostElement(elements: HTMLElement[]): HTMLElement | null {
  if (elements.length === 0) return null;
  return elements.reduce((top, element) => {
    const topZ = Number.parseInt(getComputedStyle(top).zIndex, 10) || 0;
    const elementZ = Number.parseInt(getComputedStyle(element).zIndex, 10) || 0;
    return elementZ >= topZ ? element : top;
  });
}

function clickDialogCloseButton(container: HTMLElement) {
  const isAlert = container.matches('[data-slot="alert-dialog-content"]');
  const closeSelector = isAlert
    ? '[data-slot="alert-dialog-cancel"]'
    : '[data-slot="dialog-close"]';
  const closeButton = container.querySelector<HTMLElement>(closeSelector);
  closeButton?.click();
}

/**
 * Ensures Escape closes the topmost open Dialog or AlertDialog,
 * including when nested selects or popovers would otherwise consume the key.
 */
export function useGlobalDialogEscape() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      const openDialogs = [
        ...document.querySelectorAll<HTMLElement>('[data-slot="dialog-content"][data-open]'),
      ];
      const openAlertDialogs = [
        ...document.querySelectorAll<HTMLElement>('[data-slot="alert-dialog-content"][data-open]'),
      ];
      const topmost = getTopmostElement([...openDialogs, ...openAlertDialogs]);
      if (!topmost) return;

      event.preventDefault();
      event.stopPropagation();
      clickDialogCloseButton(topmost);
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, []);
}
