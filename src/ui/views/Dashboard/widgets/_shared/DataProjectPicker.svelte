<script lang="ts">
  /**
   * DataProjectPicker — which project a chart or stats block reads (3.6.0).
   *
   * "This project" is the empty value; any other project makes the block read
   * that project's rows instead (`widget.config.dataProjectId`, see
   * `otherProjectSource`). Shared by the chart and stats panels so the choice
   * reads the same in both.
   */
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";

  export let value: string | undefined = undefined;
  export let availableSources: Array<{ id: string; name: string }> = [];
  /** A row class of the host panel, so the picker sits in its grid. */
  export let rowClass = "ppp-config-row";

  const dispatch = createEventDispatcher<{ change: string }>();
</script>

{#if availableSources.length > 0}
  <label class={rowClass}>
    <span>{$i18n.t("views.dashboard.data-project.label")}</span>
    <select
      value={value ?? ""}
      aria-label={$i18n.t("views.dashboard.data-project.label")}
      on:change={(e) => dispatch("change", e.currentTarget.value)}
    >
      <option value="">{$i18n.t("views.dashboard.data-project.this-project")}</option>
      {#each availableSources as src (src.id)}
        <option value={src.id}>{src.name}</option>
      {/each}
    </select>
  </label>
{/if}
