// blockJump.ts — i3-dash: move the page to a block picked in the jump bar.
//
// i3-dash: an instant jump on purpose. The smooth-scroll preference lives in
// the settings store (lib/helpers/animation.ts), and a jump across a long page
// is navigation, not an animation the eye has to follow; instant also needs no
// reduced-motion branch. Focus moves too, so the keyboard continues from the
// block that was reached, and `preventScroll` keeps focus from scrolling again.

export interface JumpItem {
  readonly id: string;
  readonly title: string;
  readonly collapsed: boolean;
}

/** The jump bar's entries, in page order. */
export function jumpItems(widgets: ReadonlyArray<{ id: string; title: string; collapsed?: boolean }>): JumpItem[] {
  // A stored block can lack a title at runtime whatever the type says.
  return widgets.map((w) => ({ id: w.id, title: typeof w.title === "string" ? w.title.trim() : "", collapsed: w.collapsed ?? false }));
}

/** Scrolls the block `id` under `root` to the top and focuses it. False when it is not there. */
export function jumpToBlock(root: ParentNode | null | undefined, id: string): boolean {
  const node = Array.from(root?.querySelectorAll<HTMLElement>("[data-widget-id]") ?? []).find((el) => el.dataset["widgetId"] === id);
  if (!node) return false;
  node.scrollIntoView?.({ block: "start", inline: "nearest" });
  node.focus({ preventScroll: true });
  return true;
}
