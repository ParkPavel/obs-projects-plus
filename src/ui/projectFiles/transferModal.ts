import { Modal, FuzzySuggestModal, type App } from "obsidian";
import { fitVisibleViewport } from "src/ui/actions/fitVisibleViewport";

/** One owned viewport subscription for each open native transfer window. */
export function transferModalViewport(container: HTMLElement) {
  const idle = { destroy() {} };
  // Some embedding hosts expose no real container until the native window opens.
  if (container.nodeType !== 1) return idle;
  container.classList.add("ppp-transfer-modal");
  const view = container.ownerDocument.defaultView;
  if (!view || !container.ownerDocument.body.classList.contains("is-mobile") && !view.matchMedia?.("(pointer: coarse)").matches) return idle;
  container.classList.add("ppp-transfer-viewport");
  const before = ["top", "left", "width", "height"].map(key => [key, container.style.getPropertyValue(key)] as const);
  const fit = fitVisibleViewport(container);
  return { destroy() {
    fit.destroy();
    container.classList.remove("ppp-transfer-viewport");
    for (const [key, value] of before) if (value) container.style.setProperty(key, value); else container.style.removeProperty(key);
  } };
}

export class ProjectTransferModal extends Modal {
  private viewport: { destroy(): void } | undefined;
  constructor(app: App) { super(app); this.containerEl.addClass("ppp-modal"); }
  open(): void { this.viewport?.destroy(); super.open(); this.viewport = transferModalViewport(this.containerEl); }
  close(): void { this.viewport?.destroy(); this.viewport = undefined; super.close(); }
}

export abstract class ProjectTransferSuggestModal<T> extends FuzzySuggestModal<T> {
  private viewport: { destroy(): void } | undefined;
  constructor(app: App) { super(app); this.containerEl.addClass("ppp-modal"); }
  open(): void { this.viewport?.destroy(); super.open(); this.viewport = transferModalViewport(this.containerEl); }
  close(): void { this.viewport?.destroy(); this.viewport = undefined; super.close(); }
}
