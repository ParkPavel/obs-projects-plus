<script lang="ts">
  /**
   * i3-gallery — the `content` card preview: the note's first paragraph as
   * text, where a card has no cover image (Notion's "Page content"). The note
   * is read once, through the vault's cache, when the card mounts; the gallery
   * renders a large set progressively, so only the cards on screen read.
   * Nothing to show (no prose, a file that is not a note, a read that fails)
   * leaves the plain image placeholder.
   */
  import { Icon } from "obsidian-svelte";
  import type { TFile, Vault } from "obsidian";
  import { onMount } from "svelte";
  import { app } from "src/lib/stores/obsidian";
  import { firstParagraph } from "../../gallery";

  export let path: string;

  let text = "";

  onMount(() => {
    let alive = true;
    // A test or an embed may hand a partial app: every member is checked.
    const vault = ($app as { vault?: Partial<Vault> } | undefined)?.vault;
    const file = vault?.getAbstractFileByPath?.(path);
    const read = vault?.cachedRead?.bind(vault);
    if (file && "extension" in file && read) {
      read(file as TFile)
        .then((content) => {
          if (alive) text = firstParagraph(content);
        })
        .catch(() => undefined);
    }
    return () => {
      alive = false;
    };
  });
</script>

{#if text}
  <p class="ppp-gallery-content-preview" data-gallery-content-preview>{text}</p>
{:else}
  <Icon name="image" size="lg" />
{/if}

<style>
  /* i3-gallery: the text fills the media box from its top, clipped by the
     box's own ratio (the media hides overflow), in the card's font. */
  .ppp-gallery-content-preview {
    align-self: stretch;
    width: 100%;
    margin: 0;
    padding: 0.75em 0.85em;
    overflow: hidden;
    font-size: var(--font-ui-smaller);
    line-height: 1.45;
    color: var(--text-muted);
    overflow-wrap: anywhere;
    background: var(--background-primary);
  }
</style>
