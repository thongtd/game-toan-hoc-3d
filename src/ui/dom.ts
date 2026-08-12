/** Small typed helpers over the DOM lookups the UI needs. */

export function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`Missing element in index.html: #${id}`);
  }
  return element;
}

/**
 * Looks up an element and checks it really is the expected kind.
 *
 * The markup and the code can drift apart; failing loudly at start-up beats a
 * confusing runtime error the first time a property is touched.
 */
export function requireElementOfType<T extends HTMLElement>(
  id: string,
  constructor: abstract new (...args: never[]) => T,
): T {
  const element = requireElement(id);
  if (!(element instanceof constructor)) {
    throw new Error(`Element #${id} is not a ${constructor.name}`);
  }
  return element;
}

export function setHidden(element: HTMLElement, hidden: boolean): void {
  element.classList.toggle('is-hidden', hidden);
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/**
 * Builds an `<svg><use href="#id"></svg>` node from the sprite in index.html.
 *
 * Icons are internal SVG shapes rather than emoji, so they render identically
 * on every device and match the game's outline style.
 */
export function createIcon(symbolId: string, className: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const use = document.createElementNS(SVG_NAMESPACE, 'use');
  use.setAttribute('href', `#${symbolId}`);
  svg.append(use);

  return svg;
}

/** Points an existing `<use>` inside `svg` at a different sprite symbol. */
export function setIcon(svg: Element, symbolId: string): void {
  svg.querySelector('use')?.setAttribute('href', `#${symbolId}`);
}

/** Sets text through `textContent` - generated content is never parsed as HTML. */
export function setText(element: HTMLElement, text: string): void {
  element.textContent = text;
}

export function onClick(element: HTMLElement, handler: () => void): () => void {
  const listener = (): void => {
    handler();
  };
  element.addEventListener('click', listener);
  return () => {
    element.removeEventListener('click', listener);
  };
}
