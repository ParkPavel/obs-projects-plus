declare global {
  interface Window {
    /** Obsidian runtime global — available before plugin onload(). */
    app?: import("obsidian").App;
    /** Obsidian bundles moment.js and exposes it as window.moment. */
    moment?: typeof import("moment");
  }
}

declare type Item = import("svelte-dnd-action").Item;
declare type DndEvent<ItemType = Item> =
  import("svelte-dnd-action").DndEvent<ItemType>;
// Handlers take a DndEvent of their own item type; `never` in this parameter
// position accepts every one of them.
declare namespace svelte.JSX {
  interface HTMLAttributes<T> {
    onconsider?: (
      event: CustomEvent<DndEvent<never>> & { target: EventTarget & T }
    ) => void;
    onfinalize?: (
      event: CustomEvent<DndEvent<never>> & { target: EventTarget & T }
    ) => void;
  }
}
