import { fitVisibleViewport } from "src/ui/actions/fitVisibleViewport";
import { visibleViewport } from "src/ui/utils/visibleViewport";

/** Keep the editor inside both its calendar container and its OWN visible window. */
export function fitAgendaOverlay(node: HTMLElement, container: HTMLElement | null) {
  const fitted = fitVisibleViewport(node, view => {
    const bounds = visibleViewport(view);
    if (!container) return bounds;
    const rect = container.getBoundingClientRect();
    const left = Math.max(bounds.left, Math.min(rect.left, bounds.right));
    const top = Math.max(bounds.top, Math.min(rect.top, bounds.bottom));
    const right = Math.max(left, Math.min(rect.right, bounds.right));
    const bottom = Math.max(top, Math.min(rect.bottom, bounds.bottom));
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  });
  const Observer = node.ownerDocument.defaultView?.ResizeObserver ?? ResizeObserver;
  const observer = container ? new Observer(fitted.update) : null;
  if (container) observer?.observe(container);
  return { destroy() { observer?.disconnect(); fitted.destroy(); } };
}
