/**
 * Shared driver for the tests of the sites that moved onto ComboField
 * (stab-forms, steps 4-5): find the comboboxes of a mounted component, type,
 * press keys, pick with a pointer, and read the portalled listbox.
 */

import { tick } from "svelte";

export const listbox = (): HTMLElement | null => document.querySelector<HTMLElement>('[role="listbox"]');

export const optionRows = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));

export const optionLabels = (): string[] => optionRows().map((o) => o.textContent ?? "");

/** The comboboxes (inputs) inside `root`, in document order. */
export function comboInputs(root: ParentNode): HTMLInputElement[] {
  return Array.from(root.querySelectorAll<HTMLInputElement>('input[role="combobox"]'));
}

/** Set the text of an input the way a keystroke does. */
export function typeInto(el: HTMLInputElement, text: string): void {
  el.value = text;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

export function press(el: HTMLElement, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const e = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(e);
  return e;
}

/** Focus the input and let the list open. */
export async function enter(el: HTMLInputElement): Promise<void> {
  el.focus();
  await tick();
  await tick();
}

/** A pointer press on a row, then the click that ends the same tap. */
export function tap(row: HTMLElement): void {
  row.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  row.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

export async function settle(): Promise<void> {
  await tick();
  await tick();
}

/** Mount a Svelte component into the document and collect the payloads of one event. */
export function mountCollecting<T = unknown>(
  Component: new (options: { target: HTMLElement; props: Record<string, unknown> }) => {
    $on(name: string, cb: (e: CustomEvent) => void): () => void;
    $destroy(): void;
    $set(props: Record<string, unknown>): void;
  },
  props: Record<string, unknown>,
  eventName: string
) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new Component({ target, props });
  const events: T[] = [];
  component.$on(eventName, (e: CustomEvent) => events.push(e.detail as T));
  return {
    target,
    component,
    events,
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}
