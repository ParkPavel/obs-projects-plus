<script lang="ts">
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import FloatingPopup from "src/ui/components/FloatingPopup/FloatingPopup.svelte";
  import ViewConfigTab from "src/ui/components/Navigation/SettingsMenu/tabs/ViewConfigTab.svelte";
  import type { ViewDefinition } from "src/settings/settings";
  import type { DataField } from "src/lib/dataframe/dataframe";

  export let view: ViewDefinition;
  export let fields: readonly DataField[];
  export let onChange: (config: Record<string, unknown>) => void;
  export let linkedName: string | undefined = undefined;
  export let onUnlink: (() => void) | undefined = undefined;
  let open = false;
  let triggerEl: HTMLButtonElement;
</script>

<button bind:this={triggerEl} type="button" class="clickable-icon"
  aria-label={$i18n.t("settings-menu.tabs.view-config")}
  title={$i18n.t("settings-menu.tabs.view-config")} on:click={() => (open = !open)}>
  <Icon name="settings-2" size="sm" />
</button>
<FloatingPopup {triggerEl} bind:open placement="bottom-end" role="dialog"
  ariaLabel={$i18n.t("settings-menu.tabs.view-config")}>
  <div class="embedded-view-settings">
    {#if linkedName}
      <p>{$i18n.t("views.dashboard.database-call.linked-view-label", { name: linkedName })}</p>
      {#if onUnlink}
        <button type="button" on:click={onUnlink}>{$i18n.t("views.dashboard.database-call.unlink-view")}</button>
      {/if}
    {/if}
    <ViewConfigTab {view} fields={[...fields]}
      on:update={(event) => onChange({ ...view.config, ...event.detail })} />
  </div>
</FloatingPopup>

<style>
  .embedded-view-settings { width: 23em; max-width: 100%; padding: 0.75em; box-sizing: border-box; }
  p { color: var(--text-muted); font-size: var(--font-ui-small); }
</style>
