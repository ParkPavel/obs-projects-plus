import { getContext, setContext } from "svelte";
import { readable, writable, type Readable } from "svelte/store";

export const TABLE_CONTROLS_HOST = Symbol("table-controls-host");

/** Each block provides its own header; standalone tables keep their local toolbar. */
export function provideTableControlsHost() {
  const host = writable<HTMLElement | null>(null);
  let current: HTMLElement | null = null;
  setContext(TABLE_CONTROLS_HOST, host);
  return (node: HTMLElement) => {
    current = node; host.set(node);
    return { destroy() { if (current === node) { current = null; host.set(null); } } };
  };
}

export function readTableControlsHost(): Readable<HTMLElement | null> {
  return getContext<Readable<HTMLElement | null>>(TABLE_CONTROLS_HOST) ?? readable(null);
}

/** Move the original controls without copying their input or their table's search state. */
export function moveTableControls(node: HTMLElement, initial: HTMLElement | null) {
  const doc = node.ownerDocument, home = doc.createComment("table-controls-home");
  let destroyed = false;
  node.before(home);
  function update(target: HTMLElement | null): void {
    if (destroyed) return;
    const destination = target?.isConnected && target.ownerDocument === doc && !node.contains(target) ? target : null;
    if (destination ? node.parentNode === destination : node.previousSibling === home) return;
    const focused = node.contains(doc.activeElement) ? doc.activeElement as HTMLElement : null;
    const input = focused && "selectionStart" in focused ? focused as HTMLInputElement : null;
    const start = input?.selectionStart, end = input?.selectionEnd, direction = input?.selectionDirection;
    if (destination) destination.appendChild(node);
    else if (home.parentNode) home.after(node);
    if (focused?.isConnected && doc.activeElement !== focused) {
      focused.focus({ preventScroll: true });
      if (input && typeof start === "number" && typeof end === "number") input.setSelectionRange(start, end, direction ?? undefined);
    }
  }
  update(initial);
  return { update, destroy() { destroyed = true; home.remove(); node.remove(); } };
}
