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
 */
export function moveToViewHeader(node: HTMLElement, enabled: boolean) {
  let placeholder: Comment | null = null;
  let leaf: HTMLElement | null = null;
  let title: HTMLElement | null = null;

  function attach(): void {
    if (placeholder) return;
    leaf = node.closest<HTMLElement>(".workspace-leaf-content");
    title = leaf?.querySelector<HTMLElement>(".view-header-title-container") ?? null;
    if (!leaf || !title) return;
    placeholder = node.ownerDocument.createComment("ppp-view-tabs");
    node.before(placeholder);
    title.appendChild(node);
    leaf.classList.add("ppp-tabs-in-header");
  }

  function detach(): void {
    if (!placeholder) return;
    if (placeholder.parentNode) placeholder.replaceWith(node);
    else node.remove();
    placeholder = null;
    leaf?.classList.remove("ppp-tabs-in-header");
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
