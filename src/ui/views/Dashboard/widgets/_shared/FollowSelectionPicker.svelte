<script lang="ts">
  /**
   * FollowSelectionPicker — which block's selection narrows this chart or
   * stats block, and through which relation field (3.6.0, selectionFollow.ts).
   * "Pick a client in the clients table → this chart shows that client's
   * visits" is: follow the clients table, through the visits' `client` field.
   */
  import { createEventDispatcher } from "svelte";
  import type { DataField } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import type { LinkedSelectionConfig } from "../../types";

  export let value: LinkedSelectionConfig | undefined = undefined;
  export let availableWidgets: Array<{ id: string; title: string }> = [];
  export let fields: DataField[] = [];
  export let rowClass = "ppp-config-row";

  const dispatch = createEventDispatcher<{ change: LinkedSelectionConfig | undefined }>();

  function setSource(id: string) {
    dispatch("change", id ? { sourceWidgetId: id, relationField: value?.relationField ?? "" } : undefined);
  }
  function setField(name: string) {
    if (value) dispatch("change", { ...value, relationField: name });
  }
</script>

{#if availableWidgets.length > 0}
  <label class={rowClass}>
    <span>{$i18n.t("views.dashboard.follow.label")}</span>
    <select value={value?.sourceWidgetId ?? ""} on:change={(e) => setSource(e.currentTarget.value)}>
      <option value="">{$i18n.t("views.dashboard.follow.none")}</option>
      {#each availableWidgets as w (w.id)}
        <option value={w.id}>{w.title || w.id}</option>
      {/each}
    </select>
  </label>
  {#if value}
    <label class={rowClass}>
      <span>{$i18n.t("views.dashboard.follow.field")}</span>
      <select value={value.relationField} on:change={(e) => setField(e.currentTarget.value)}>
        <option value="">—</option>
        {#each fields as f (f.name)}
          <option value={f.name}>{f.name}</option>
        {/each}
      </select>
    </label>
  {/if}
{/if}
