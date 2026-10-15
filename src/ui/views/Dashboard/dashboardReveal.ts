import { tick } from "svelte";
import { getScrollBehavior } from "src/lib/helpers/animation";

/** New creation gets focus, never a later prop echo or an Undo restoration. */
export function createWidgetReveal(getRoot: () => HTMLElement | null | undefined): (id: string) => void {
  let request = 0;
  return id => {
    const revision = ++request;
    void tick().then(() => {
      const root = getRoot();
      if (revision !== request || !root?.isConnected) return;
      const node = Array.from(root.querySelectorAll<HTMLElement>("[data-widget-id]")).find(el => el.dataset["widgetId"] === id);
      if (!node) return;
      node.focus({ preventScroll: true });
      node.scrollIntoView({ block: "nearest", inline: "nearest", behavior: getScrollBehavior() });
    });
  };
}
