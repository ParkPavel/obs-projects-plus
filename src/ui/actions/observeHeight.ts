/**
 * 17.10 (freeze): `bind:clientHeight` in Svelte 3 adds a hidden <iframe> to
 * every bound element (add_iframe_resize_listener) and reads its computed
 * style. A month in list mode bound every day cell — 42 per month, 11–24
 * months mounted: hundreds of iframes, each a document of its own. Switching
 * a calendar to the month exhausted memory until Windows could not start
 * new processes.
 *
 * One ResizeObserver serves every node; each node reports its own height.
 */
type Report = (height: number) => void;

let shared: ResizeObserver | null = null;
const reports = new WeakMap<Element, Report>();

function observer(): ResizeObserver | null {
  if (shared) return shared;
  if (typeof ResizeObserver === "undefined") return null;
  shared = new ResizeObserver((entries) => {
    for (const entry of entries) reports.get(entry.target)?.(entry.contentRect.height);
  });
  return shared;
}

export function observeHeight(node: HTMLElement, report: Report): { update(next: Report): void; destroy(): void } {
  reports.set(node, report);
  observer()?.observe(node);
  return {
    update(next) {
      reports.set(node, next);
    },
    destroy() {
      observer()?.unobserve(node);
      reports.delete(node);
    },
  };
}
