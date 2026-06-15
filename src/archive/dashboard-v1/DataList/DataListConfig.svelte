<script lang="ts">
  // MPLAN-008 — Config panel for the DataList widget.
  import { createEventDispatcher } from "svelte";
  import type { DataField } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";

  export let config: Record<string, unknown> = {};
  export let fields: DataField[] = [];

  const dispatch = createEventDispatcher<{
    change: Record<string, unknown>;
    close: void;
  }>();

  $: titleField = String(config["titleField"] ?? "");
  $: selectedFields = Array.isArray(config["fields"])
    ? (config["fields"] as unknown[]).map((v) => String(v))
    : [];
  $: sortField = String(config["sortField"] ?? "");
  $: sortOrder = config["sortOrder"] === "desc" ? "desc" : "asc";
  $: limit = Number(config["limit"] ?? 0) || 0;

  $: fieldNames = fields.map((f) => f.name);
  $: availableFields = fieldNames.filter((n) => !selectedFields.includes(n));

  function emit(patch: Record<string, unknown>) {
    dispatch("change", { ...config, fields: selectedFields, ...patch });
  }

  function addField(name: string) {
    if (!name || selectedFields.includes(name)) return;
    emit({ fields: [...selectedFields, name] });
  }

  function removeField(name: string) {
    emit({ fields: selectedFields.filter((f) => f !== name) });
  }

  function moveField(name: string, delta: number) {
    const idx = selectedFields.indexOf(name);
    if (idx < 0) return;
    const next = idx + delta;
    if (next < 0 || next >= selectedFields.length) return;
    const copy = [...selectedFields];
    const [item] = copy.splice(idx, 1);
    if (item !== undefined) copy.splice(next, 0, item);
    emit({ fields: copy });
  }
</script>

<div class="ppp-list-config">
  <label>
    {$i18n.t("views.dashboard.list.config.title-field", { defaultValue: "Title field" })}
    <select
      value={titleField}
      on:change={(e) => emit({ titleField: e.currentTarget.value })}
    >
      <option value="">{$i18n.t("views.dashboard.list.config.title-fallback", { defaultValue: "(note name)" })}</option>
      {#each fieldNames as name}
        <option value={name}>{name}</option>
      {/each}
    </select>
  </label>

  <div class="ppp-list-config-section">
    <div class="ppp-list-config-label">
      {$i18n.t("views.dashboard.list.config.fields", { defaultValue: "Inline fields" })}
    </div>
    {#if selectedFields.length === 0}
      <div class="ppp-list-config-empty">
        {$i18n.t("views.dashboard.list.config.no-fields", { defaultValue: "No fields selected" })}
      </div>
    {:else}
      <ul class="ppp-list-config-chips">
        {#each selectedFields as name (name)}
          <li class="ppp-list-config-chip">
            <span>{name}</span>
            <button type="button" on:click={() => moveField(name, -1)} aria-label="up">↑</button>
            <button type="button" on:click={() => moveField(name, 1)} aria-label="down">↓</button>
            <button type="button" on:click={() => removeField(name)} aria-label="remove">×</button>
          </li>
        {/each}
      </ul>
    {/if}
    {#if availableFields.length > 0}
      <select
        value=""
        on:change={(e) => {
          const name = e.currentTarget.value;
          if (name) {
            addField(name);
            e.currentTarget.value = "";
          }
        }}
      >
        <option value="">{$i18n.t("views.dashboard.list.config.add-field", { defaultValue: "+ Add field…" })}</option>
        {#each availableFields as name}
          <option value={name}>{name}</option>
        {/each}
      </select>
    {/if}
  </div>

  <div class="ppp-list-config-row">
    <label>
      {$i18n.t("views.dashboard.list.config.sort-field", { defaultValue: "Sort field" })}
      <select value={sortField} on:change={(e) => emit({ sortField: e.currentTarget.value })}>
        <option value="">—</option>
        {#each fieldNames as name}
          <option value={name}>{name}</option>
        {/each}
      </select>
    </label>
    <label>
      {$i18n.t("views.dashboard.list.config.sort-order", { defaultValue: "Order" })}
      <select value={sortOrder} on:change={(e) => emit({ sortOrder: e.currentTarget.value })}>
        <option value="asc">ASC</option>
        <option value="desc">DESC</option>
      </select>
    </label>
  </div>

  <label>
    {$i18n.t("views.dashboard.list.config.limit", { defaultValue: "Limit" })}
    <input
      type="number"
      min="0"
      value={limit}
      placeholder="0 = no limit"
      on:input={(e) => emit({ limit: Math.max(0, Number(e.currentTarget.value) || 0) })}
    />
  </label>
</div>

<style>
  .ppp-list-config {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem;
    border-bottom: 0.0625rem solid var(--background-modifier-border);
    background: var(--background-secondary);
  }
  .ppp-list-config-section {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .ppp-list-config-label {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
  }
  .ppp-list-config-chips {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  .ppp-list-config-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    background: var(--background-primary);
    border: 0.0625rem solid var(--background-modifier-border);
    font-size: var(--font-ui-smaller);
  }
  .ppp-list-config-chip button {
    background: transparent;
    border: none;
    color: var(--text-faint);
    cursor: pointer;
    padding: 0 0.125rem;
    font: inherit;
  }
  .ppp-list-config-chip button:hover {
    color: var(--text-normal);
  }
  .ppp-list-config-empty {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
    font-style: italic;
  }
  .ppp-list-config-row {
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
    border: 0.0625rem solid var(--background-modifier-border);
    background: var(--background-primary);
    color: var(--text-normal);
  }
</style>
