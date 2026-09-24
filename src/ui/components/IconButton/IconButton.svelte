<!--
  IconButton — an icon-only action that works from the keyboard.

  Same props and look as obsidian-svelte's IconButton, which renders a bare
  `<div on:click>`: no role, no tab stop, no key handler. This one is a
  `role="button"` with a tab stop that activates on Enter and Space, and a
  disabled button leaves the tab order.
-->
<script lang="ts">
  import { useIcon } from "obsidian-svelte";

  /** Lucide icon identifier. */
  export let icon: string;
  export let size: "xs" | "sm" | "md" | "lg" = "md";
  export let active = false;
  /** Tooltip, also the accessible name. */
  export let tooltip = "";
  export let nopadding = false;
  export let disabled = false;
  export let onClick: (event: MouseEvent) => void = () => {};

  function handleClick(event: MouseEvent) {
    if (!disabled) onClick(event);
  }

  // Callers open menus at the event's position, so a key press is passed on
  // as a click at the button's lower-left corner — where a menu belongs.
  function handleKeydown(event: KeyboardEvent) {
    if (disabled || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    // The key belongs to this button; a parent with its own Enter handler
    // (a tag that edits on Enter) must not act on it too.
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    onClick(new MouseEvent("click", { clientX: rect.left, clientY: rect.bottom }));
  }
</script>

<div
  class="clickable-icon"
  class:nopadding
  class:is-active={active}
  class:icon-xs={size === "xs"}
  class:icon-sm={size === "sm"}
  class:icon-md={size === "md"}
  class:icon-lg={size === "lg"}
  role="button"
  tabindex={disabled ? -1 : 0}
  aria-label={tooltip}
  aria-disabled={disabled}
  use:useIcon={icon}
  on:click={handleClick}
  on:keydown={handleKeydown}
/>

<style>
  .nopadding {
    padding: 0;
  }
  .icon-xs {
    --icon-size: var(--icon-xs);
    --icon-stroke: var(--icon-xs-stroke-width);
  }
  .icon-sm {
    --icon-size: var(--icon-s);
    --icon-stroke: var(--icon-s-stroke-width);
  }
  .icon-md {
    --icon-size: var(--icon-m);
    --icon-stroke: var(--icon-m-stroke-width);
  }
  .icon-lg {
    --icon-size: var(--icon-l);
    --icon-stroke: var(--icon-l-stroke-width);
  }
</style>
