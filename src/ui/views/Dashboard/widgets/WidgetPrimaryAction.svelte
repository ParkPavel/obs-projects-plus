<script lang="ts">
  /**
   * WidgetPrimaryAction — #169.
   *
   * The block's own action, at header weight. It is a separate component and
   * not four more lines of WidgetHeaderActions on purpose: the design spec asks
   * for "its own element, never inside the hover-only group", and a sibling
   * file makes that structural instead of a convention the next edit can lose.
   *
   * It dispatches and does nothing else. What "add a record" means belongs to
   * the component that already owns that interaction — the header must not grow
   * a second way to create the thing the block is read for.
   */
  import { createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import type { PrimaryAction } from "./headerChrome";

  /** `null` for a type with no primary action — most of them. */
  export let action: PrimaryAction | null = null;

  const dispatch = createEventDispatcher<{ primaryAction: void }>();

  $: label = action ? $i18n.t(action.labelKey, { defaultValue: action.labelDefault }) : "";
</script>

{#if action}
  <button
    class="ppp-widget-primary-btn"
    on:click={() => dispatch("primaryAction")}
    aria-label={label}
    title={label}
  >
    <Icon name="plus" size="sm" />
    <span class="ppp-widget-primary-label">{label}</span>
  </button>
{/if}

<style>
  /*
   * Three things carry the weight, and none of them is size: the fill, the
   * text label next to an icon where every neighbour is a bare glyph, and
   * being visible at rest while the cluster beside it is not. Sized in `em`
   * throughout — a header inside a narrow widget should not render a button
   * scaled to the document root (R0.16, ADR_MATRYOSHKA_SIZING).
   */
  .ppp-widget-primary-btn {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 0.3em;
    padding: 0.35em 0.7em;
    border: none;
    border-radius: var(--radius-s);
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    font-size: var(--font-ui-smaller);
    line-height: 1.4;
    cursor: pointer;
  }

  .ppp-widget-primary-btn:hover {
    background: var(--interactive-accent-hover, var(--interactive-accent));
  }

  /*
   * Below the width where the label would crowd the title, the button keeps
   * its fill and drops its text. A `@container` query and not a media query:
   * what ran out of room is the widget, which on this canvas can be narrow
   * inside a wide window. Named `widget` — the name WidgetShell declares on
   * `.ppp-widget-host` — so it resolves against the widget and not against
   * whichever ancestor happens to be the nearest container that day.
   *
   * The threshold is in `em`, which here reads the query container's own font
   * size. `rem` would anchor it to the document root, and it would also count
   * against R0.16 from inside a media condition.
   */
  @container widget (max-width: 24em) {
    .ppp-widget-primary-label {
      display: none;
    }
  }
</style>
