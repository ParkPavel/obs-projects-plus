import { Component } from "obsidian";
import { onDestroy } from "svelte";

/**
 * The owner of Markdown a Svelte component renders (MarkdownRenderer.render's
 * last argument): an Obsidian Component that lives exactly as long as the
 * calling Svelte component — loaded now, unloaded in onDestroy — so embeds and
 * post-processors inside the rendered fragment are cleaned up with it.
 *
 * It replaces one module-level store holding the last opened Projects view,
 * which made every leaf's Markdown belong to whichever leaf opened last.
 * Call it during component initialisation.
 */
export function markdownOwner(): Component {
  const owner = new Component();
  owner.load();
  onDestroy(() => owner.unload());
  return owner;
}
