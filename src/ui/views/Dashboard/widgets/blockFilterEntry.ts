// blockFilterEntry.ts — B7: «Filter for all views of this block» in the «⋯» menu.
//
// The block filter already exists: BlockFilterBar inside a database block,
// stored as the block's `subFilter`. The menu does not add a second editor;
// it opens that same one, by pressing its own «Filter» control. Waits a tick
// so a block the same click just expanded has rendered the bar.

import { tick } from "svelte";

export const BLOCK_FILTER_TRIGGER = ".ppp-blockfilter .ppp-filterpills-add";

export function openBlockFilter(widgetId: string, root: ParentNode = document): Promise<boolean> {
  return tick().then(() => {
    const host = Array.from(root.querySelectorAll<HTMLElement>("[data-widget-id]")).find((el) => el.dataset["widgetId"] === widgetId);
    const trigger = host?.querySelector<HTMLElement>(BLOCK_FILTER_TRIGGER);
    if (!trigger) return false;
    trigger.click();
    return true;
  });
}
