<script lang="ts">
  /**
   * cards-g2: the one card shell Gallery and Board render through.
   *
   * It owns the card's root (an `article`), its public classes and the colour
   * bar (ColorItem). Everything a view does with a card — opening it, the long
   * press, the drag grip, the checkbox — stays in the view and arrives through
   * the named slots, so this shell has no behaviour of its own: a click or a
   * keypress on the root is forwarded to whoever listens, and the root is not a
   * control (no role, no tabindex; the title link and the drag grip are).
   *
   * Slots, each rendered only when given (an absent slot adds no element):
   *   grip     — before everything (the board's drag lane);
   *   media    — before the body (the gallery cover);
   *   header   — the ColorItem header line (title link, checkbox, pencil);
   *   metadata — under the header (CardMetadata);
   *   controls — after the body, reserved.
   *
   * Hooks for later batches are classes and custom properties only: the
   * variant classes, `--interactive` / `--disabled`, and `--ppp-shared-card-size`
   * (set from `size`; cards-g3 writes the gallery's card width there, for
   * the later batches to read).
   */
  import ColorItem from "src/ui/components/ColorItem/ColorItem.svelte";

  /** The record the card shows; written to the root as a data hook. */
  export let recordId: string;
  export let variant: "gallery" | "board";
  export let color: string | null = null;
  /** Reserved: a size token for saved frames, exposed as a custom property. */
  export let size: string | undefined = undefined;
  /** Whether the body itself opens the record (a class hook, no behaviour). */
  export let interactive = false;
  /** A class hook for a card that cannot be acted on; no behaviour. */
  export let disabled = false;
</script>

<article
  class="ppp-shared-card"
  class:ppp-shared-card--gallery={variant === "gallery"}
  class:ppp-shared-card--board={variant === "board"}
  class:projects--gallery--card={variant === "gallery"}
  class:projects--board--card={variant === "board"}
  class:ppp-shared-card--interactive={interactive}
  class:ppp-shared-card--disabled={disabled}
  data-ppp-card-id={recordId}
  style:--ppp-shared-card-size={size}
  on:click
  on:keypress
>
  <slot name="grip" />
  <slot name="media" />
  {#if variant === "gallery"}
    <div class="projects--gallery--card__body">
      <ColorItem {color}>
        <svelte:fragment slot="header"><slot name="header" /></svelte:fragment>
        <slot name="metadata" />
      </ColorItem>
    </div>
  {:else}
    <ColorItem {color}>
      <svelte:fragment slot="header"><slot name="header" /></svelte:fragment>
      <slot name="metadata" />
    </ColorItem>
  {/if}
  <slot name="controls" />
</article>

<style>
  /* cards-g1, moved here by cards-g2 with the article it styles: two lanes —
     the grip's own, then the content. The grip is in flow, so no field label,
     title or checkbox ever starts under it, at any card width. The lane begins
     at the card's left border (its padding is the lane), sized from the space
     scale; a narrow pane tightens it through `--board-card-grip-lane`
     (styles.css container query), never a viewport. The grip's own rules stay
     in CardList, which renders it into the `grip` slot. */
  .projects--board--card {
    display: grid;
    grid-template-columns: var(--board-card-grip-lane, var(--size-4-5)) minmax(0, 1fr);
    align-items: start;
    padding-left: 0;
    transition: background 150ms ease, box-shadow 150ms ease;
    position: relative;
  }
  .projects--board--card:focus-within {
    background: var(--background-primary-alt);
    box-shadow: 0 0.0625rem 0.25rem rgba(0, 0, 0, 0.08);
  }
  /* ios-t1: hover states reach only a pointer that hovers; a tap left them stuck. */
  @media (hover: hover) and (pointer: fine) {
    .projects--board--card:hover {
      background: var(--background-primary-alt);
      box-shadow: 0 0.0625rem 0.25rem rgba(0, 0, 0, 0.08);
    }
  }

  /* ios-d1 / cards-g1: on touch the grip lane is a full finger target wide. */
  @media (pointer: coarse) {
    .projects--board--card {
      grid-template-columns: var(--ppp-touch-target-min) minmax(0, 1fr);
    }
  }
</style>
