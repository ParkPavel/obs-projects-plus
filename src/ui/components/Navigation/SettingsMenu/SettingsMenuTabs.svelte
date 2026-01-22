<script context="module" lang="ts">
  export type SettingsTabId = "viewConfig" | "projects" | "views" | "filters" | "colors" | "sort";
</script>

<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { isTouchDevice } from "src/lib/stores/ui";

  export let activeTab: SettingsTabId;

  // "Вид" (viewConfig) первым в списке
  $: tabs = [
    { id: "viewConfig" as SettingsTabId, label: $i18n.t("settings-menu.tabs.view-config") },
    { id: "projects" as SettingsTabId, label: $i18n.t("settings-menu.tabs.projects") },
    { id: "views" as SettingsTabId, label: $i18n.t("settings-menu.tabs.views") },
    { id: "filters" as SettingsTabId, label: $i18n.t("settings-menu.tabs.filters") },
    { id: "colors" as SettingsTabId, label: $i18n.t("settings-menu.tabs.colors") },
    { id: "sort" as SettingsTabId, label: $i18n.t("settings-menu.tabs.sort") },
  ];

  const dispatch = createEventDispatcher<{ change: SettingsTabId }>();
  
  let tabsContainer: HTMLDivElement;
  
  // Wheel scroll for pointer devices (mouse/trackpad) - not touch
  function handleWheel(event: WheelEvent) {
    if (!tabsContainer || $isTouchDevice) return; // Only on pointer devices
    
    // Always handle wheel on pointer devices (hovering = intent to scroll)
    const isHorizontalWheel = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    
    event.preventDefault();
    
    if (isHorizontalWheel) {
      // Horizontal trackpad scroll
      tabsContainer.scrollLeft += event.deltaX;
    } else {
      // Vertical wheel = horizontal scroll (desired UX for horizontal tabs)
      tabsContainer.scrollLeft += event.deltaY;
    }
  }
</script>

<div 
  class="tabs" 
  role="tablist" 
  aria-label="Settings tabs"
  bind:this={tabsContainer}
  on:wheel={handleWheel}
>
  {#each tabs as tab (tab.id)}
    <button
      class:selected={tab.id === activeTab}
      role="tab"
      aria-selected={tab.id === activeTab}
      on:click={() => dispatch("change", tab.id)}
    >
      {tab.label}
    </button>
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    gap: 0.125rem;
    padding: 0 0.75rem;
    border-bottom: 1px solid var(--background-modifier-border, rgba(255, 255, 255, 0.1));
    overflow-x: auto;
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE/Edge */
  }

  .tabs::-webkit-scrollbar {
    display: none;
  }

  button {
    padding: 0.5rem 0.5rem;
    border: none;
    border-bottom: 0.125rem solid transparent;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.6875rem;
    white-space: nowrap;
    transition: all 0.15s ease;
    min-height: 2.5rem;
    flex-shrink: 0;
  }

  button:hover {
    color: var(--text-normal);
  }

  button.selected {
    color: var(--text-accent);
    border-bottom-color: var(--interactive-accent, #7b68ee);
  }

  /* Mobile: меньше padding */
  @media (max-width: 30rem) {
    .tabs {
      padding: 0 0.5rem;
    }
    button {
      padding: 0.375rem 0.375rem;
      font-size: 0.625rem;
    }
  }
</style>
