<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { DataField } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";

  export let config: Record<string, unknown> = {};
  export let fields: DataField[] = [];

  const dispatch = createEventDispatcher<{ change: Record<string, unknown> }>();

  $: checkField = String(config["field"] ?? "");
  $: labelField = String(config["labelField"] ?? "name");
  $: sortField = String(config["sortField"] ?? labelField);
  $: sortOrder = config["sortOrder"] === "desc" ? "desc" : "asc";
  $: showMode = ["all", "open", "done"].includes(String(config["showMode"] ?? ""))
    ? String(config["showMode"])
    : "all";
  $: limit = Number(config["limit"] ?? 0) || 0;

  $: fieldNames = fields.map((f) => f.name);

  function inputVal(e: Event): string {
    return (e.currentTarget as HTMLInputElement).value;
  }

  function selectVal(e: Event): string {
    return (e.currentTarget as HTMLSelectElement).value;
  }

  function emit(patch: Record<string, unknown>) {
    dispatch("change", { ...config, ...patch });
  }
</script>

<div class="ppp-checklist-config">
  <label>
    {$i18n.t("views.dashboard.checklist.config.check-field", { defaultValue: "Checkbox field" })}
    <input
      type="text"
      list="ppp-checklist-fields"
      value={checkField}
      placeholder={$i18n.t("views.dashboard.checklist.config.check-field-placeholder", { defaultValue: "e.g. completed" })}
      on:input={(e) => emit({ field: inputVal(e) })}
    />
  </label>

  <label>
    {$i18n.t("views.dashboard.checklist.config.label-field", { defaultValue: "Label field" })}
    <input
      type="text"
      list="ppp-checklist-fields"
      value={labelField}
      placeholder={$i18n.t("views.dashboard.checklist.config.label-field-placeholder", { defaultValue: "name" })}
      on:input={(e) => emit({ labelField: inputVal(e) })}
    />
  </label>

  <label>
    {$i18n.t("views.dashboard.checklist.config.show", { defaultValue: "Show" })}
    <select value={showMode} on:change={(e) => emit({ showMode: selectVal(e) })}>
      <option value="all">{$i18n.t("views.dashboard.checklist.config.show-all", { defaultValue: "All notes" })}</option>
      <option value="open">{$i18n.t("views.dashboard.checklist.config.show-open", { defaultValue: "Only open" })}</option>
      <option value="done">{$i18n.t("views.dashboard.checklist.config.show-done", { defaultValue: "Only done" })}</option>
    </select>
  </label>

  <div class="ppp-checklist-config-row">
    <label>
      {$i18n.t("views.dashboard.checklist.config.sort-field", { defaultValue: "Sort field" })}
      <input
        type="text"
        list="ppp-checklist-fields"
        value={sortField}
        placeholder={$i18n.t("views.dashboard.checklist.config.sort-field-placeholder", { defaultValue: "name" })}
        on:input={(e) => emit({ sortField: inputVal(e) })}
      />
    </label>

    <label>
      {$i18n.t("views.dashboard.checklist.config.sort-order", { defaultValue: "Order" })}
      <select value={sortOrder} on:change={(e) => emit({ sortOrder: selectVal(e) })}>
        <option value="asc">ASC</option>
        <option value="desc">DESC</option>
      </select>
    </label>
  </div>

  <label>
    {$i18n.t("views.dashboard.checklist.config.limit", { defaultValue: "Limit" })}
    <input
      type="number"
      min="0"
      value={limit}
      placeholder={$i18n.t("views.dashboard.checklist.config.limit-placeholder", { defaultValue: "0 = no limit" })}
      on:input={(e) => emit({ limit: Math.max(0, Number(inputVal(e)) || 0) })}
    />
  </label>

  <datalist id="ppp-checklist-fields">
    {#each fieldNames as name}
      <option value={name} />
    {/each}
  </datalist>
</div>

<style>
  .ppp-checklist-config {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  .ppp-checklist-config-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.5rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
  }

  input,
  select {
    min-height: 2rem;
    padding: 0.3rem 0.45rem;
    border-radius: var(--radius-s, 0.25rem);
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    color: var(--text-normal);
  }
</style>