/**
 * i3-nav — on a phone the leaf's own header carries the view tabs.
 *
 * Obsidian's view header on a phone shows only "Projects" between its back
 * and menu buttons, a whole row (more in landscape) that says nothing the
 * user needs, while the plugin's own bar squeezed the view tabs and the view
 * tools into one line under it. This action moves the node it is on (the
 * view-tab strip) into that header's title container and hides the title;
 * the plugin bar keeps the tools. On destroy the strip goes back and the
 * title returns. Desktop and tablets are left alone: their tab header
 * already names the view.
 *
 * w4-p09 (audit F07, N1, CONSOLIDATION §7 row 18) — the header is Obsidian's
 * and a theme's to redraw, so the move is kept, not done once:
 * - it is idempotent: whenever the leaf's DOM changes (a header rebuilt,
 *   replaced or emptied) the strip is put into the title container that is
 *   there now — never left in a detached one, never copied;
 * - themes may style the header but not hide the strip: Things shows the title
 *   container only on hover (a phone has none), Minimal hides it with "hide
 *   tab title" and in focus mode. The leaf's `ppp-tabs-in-header` rules keep
 *   the container shown (CompactNavBar);
 * - a theme that hides the whole header row gets the strip back in the
 *   plugin's own bar, where it is seen.
 */

function hidden(el: Element | null): boolean {
  if (!el) return true;
  const view = el.ownerDocument.defaultView;
  const style = view?.getComputedStyle(el);
  return style?.display === "none" || style?.visibility === "hidden" || style?.opacity === "0";
}

export function moveToViewHeader(node: HTMLElement, enabled: boolean) {
  const view = node.ownerDocument.defaultView;
  let placeholder: Comment | null = null;
  let leaf: HTMLElement | null = null;
  let observer: MutationObserver | null = null;
  let headerObserver: MutationObserver | null = null;
  let watchedHeader: Element | null = null;
  let on = false;
  let alive = true, epoch = 0;

  // i3-final: a view can mount before its leaf is in the document; then the
  // header is not there yet. A few frames later it is — a bounded retry.
  let retry: number | null = null;
  let tries = 0;
  // Changes come in bursts (a header rebuilt node by node): one placement per frame.
  let frame: number | null = null;

  function home(): void {
    if (placeholder?.parentNode && node.previousSibling !== placeholder) placeholder.after(node);
    if (leaf?.classList.contains("ppp-tabs-in-header")) leaf.classList.remove("ppp-tabs-in-header");
  }

  /** Puts the strip where it belongs now: the current title container, or home. */
  function place(): void {
    if (!alive || !on || !leaf) return;
    const title = leaf.querySelector<HTMLElement>(".view-header-title-container");
    const header = title?.closest(".view-header") ?? null;
    if (watchedHeader !== header) {
      headerObserver?.disconnect();
      watchedHeader = header;
      if (header) headerObserver?.observe(header, { attributes: true, subtree: true, attributeFilter: ["style", "class", "hidden"] });
    }
    if (!title || hidden(header)) {
      home();
      return;
    }
    if (!leaf.classList.contains("ppp-tabs-in-header")) leaf.classList.add("ppp-tabs-in-header");
    if (hidden(title)) { home(); return; }
    if (node.parentElement !== title) title.appendChild(node);
  }

  function schedule(): void {
    if (!alive || !on || frame !== null || !view) return;
    const ownEpoch = epoch;
    if (view.requestAnimationFrame) frame = view.requestAnimationFrame(() => {
      if (!alive || !on || epoch !== ownEpoch) return;
      frame = null;
      place();
    });
    else place();
  }

  function attach(): void {
    if (!alive) return;
    on = true;
    if (!placeholder) {
      leaf = node.closest<HTMLElement>(".workspace-leaf-content");
      if (!leaf) {
        if (retry === null && tries < 10 && view?.requestAnimationFrame) {
          tries += 1;
          const ownEpoch = epoch;
          retry = view.requestAnimationFrame(() => {
            if (!alive || !on || epoch !== ownEpoch) return;
            retry = null;
            attach();
          });
        }
        return;
      }
      placeholder = node.ownerDocument.createComment("ppp-view-tabs");
      node.before(placeholder);
      const View = node.ownerDocument.defaultView?.MutationObserver;
      if (View) {
        observer = new View(schedule);
        headerObserver = new View(schedule);
        observer.observe(leaf, { childList: true, subtree: true });
        // A theme switches its options by body classes (Minimal's "hide tab title").
        observer.observe(node.ownerDocument.body, { attributes: true, attributeFilter: ["class"] });
      }
      view?.addEventListener("resize", schedule);
    }
    place();
  }

  function detach(): void {
    on = false;
    epoch++;
    if (retry !== null) view?.cancelAnimationFrame(retry);
    if (frame !== null) view?.cancelAnimationFrame(frame);
    retry = null;
    frame = null;
    view?.removeEventListener("resize", schedule);
    tries = 0;
    observer?.disconnect();
    observer = null;
    headerObserver?.disconnect();
    headerObserver = null;
    watchedHeader = null;
    if (!placeholder) return;
    if (placeholder.parentNode) placeholder.replaceWith(node);
    else node.remove();
    placeholder = null;
    leaf?.classList.remove("ppp-tabs-in-header");
    leaf = null;
  }

  if (enabled) attach();

  return {
    update(next: boolean): void {
      if (next) attach();
      else detach();
    },
    destroy(): void {
      alive = false;
      detach();
    },
  };
}
