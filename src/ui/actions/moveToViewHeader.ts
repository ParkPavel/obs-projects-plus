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
  return style?.display === "none";
}

export function moveToViewHeader(node: HTMLElement, enabled: boolean) {
  let placeholder: Comment | null = null;
  let leaf: HTMLElement | null = null;
  let observer: MutationObserver | null = null;
  let on = false;

  // i3-final: a view can mount before its leaf is in the document; then the
  // header is not there yet. A few frames later it is — a bounded retry.
  let retry = 0;
  let tries = 0;
  // Changes come in bursts (a header rebuilt node by node): one placement per frame.
  let frame = 0;

  function home(): void {
    if (placeholder?.parentNode && node.previousSibling !== placeholder) placeholder.after(node);
    leaf?.classList.remove("ppp-tabs-in-header");
  }

  /** Puts the strip where it belongs now: the current title container, or home. */
  function place(): void {
    frame = 0;
    if (!on || !leaf) return;
    const title = leaf.querySelector<HTMLElement>(".view-header-title-container");
    const header = title?.closest(".view-header") ?? null;
    if (!title || hidden(header)) {
      home();
      return;
    }
    if (node.parentElement !== title) title.appendChild(node);
    leaf.classList.add("ppp-tabs-in-header");
  }

  function schedule(): void {
    const view = node.ownerDocument.defaultView;
    if (frame || !view) return;
    if (view.requestAnimationFrame) frame = view.requestAnimationFrame(place);
    else place();
  }

  function attach(): void {
    on = true;
    if (!placeholder) {
      leaf = node.closest<HTMLElement>(".workspace-leaf-content");
      if (!leaf) {
        const view = node.ownerDocument.defaultView;
        if (tries < 10 && view?.requestAnimationFrame) {
          tries += 1;
          retry = view.requestAnimationFrame(() => { retry = 0; attach(); });
        }
        return;
      }
      placeholder = node.ownerDocument.createComment("ppp-view-tabs");
      node.before(placeholder);
      const View = node.ownerDocument.defaultView?.MutationObserver;
      if (View) {
        observer = new View(schedule);
        observer.observe(leaf, { childList: true, subtree: true });
        // A theme switches its options by body classes (Minimal's "hide tab title").
        observer.observe(node.ownerDocument.body, { attributes: true, attributeFilter: ["class"] });
      }
    }
    place();
  }

  function detach(): void {
    on = false;
    const view = node.ownerDocument.defaultView;
    if (retry) view?.cancelAnimationFrame(retry);
    if (frame) view?.cancelAnimationFrame(frame);
    retry = 0;
    frame = 0;
    tries = 0;
    observer?.disconnect();
    observer = null;
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
      detach();
    },
  };
}
