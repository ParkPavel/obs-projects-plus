<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { isMobile } from "src/lib/stores/ui";
  import FloatingPopup from "src/ui/components/FloatingPopup/FloatingPopup.svelte";
  import { provideFormFields } from "src/ui/components/fields/formFields";
  const fields = provideFormFields();
  export let label: string;
  export let beforeClose: (() => boolean) | undefined = undefined;
  let anchor: HTMLSpanElement;
  $: trigger = anchor?.closest(".ppp-widget-host")?.querySelector<HTMLElement>('button[aria-haspopup="menu"]') ?? anchor;
  const dispatch = createEventDispatcher<{ close: void }>();
</script>

<span class="ppp-widget-settings-anchor" bind:this={anchor} aria-hidden="true"></span>
{#if $isMobile}
  <slot />
{:else}
  <FloatingPopup open triggerEl={trigger} placement="bottom-end" width="44em" ariaLabel={label} beforeClose={() => fields.syncForSubmit() && (beforeClose?.() ?? true)} on:close={() => dispatch("close")}>
    <slot />
  </FloatingPopup>
{/if}

<style>.ppp-widget-settings-anchor { display: block; block-size: 0; pointer-events: none; }</style>
