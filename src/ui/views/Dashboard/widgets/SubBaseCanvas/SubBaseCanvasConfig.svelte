<script lang="ts">
  // R5-009 — Config panel for SubBaseCanvas widget. Sub-base CRUD
  // happens via the tabs themselves; this panel only configures how
  // each tab's records are rendered (title field + inline fields +
  // limit).
  // R5-010 — adds inverse mode config: relation field + target record picker.
  import { createEventDispatcher } from "svelte";
  import type { DataFrame, DataField } from "src/lib/dataframe/dataframe";
  import { DataFieldType } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";

  export let config: Record<string, unknown> = {};
  export let fields: DataField[] = [];
  /** Full source frame — used to populate the inverse target record picker. */
  export let source: DataFrame | undefined = undefined;

  const dispatch = createEventDispatcher<{
    change: Record<string, unknown>;
    close: void;
  }>();

  $: titleField = String(config["titleField"] ?? "");
  $: selectedFields = Array.isArray(config["fields"])
    ? (config["fields"] as unknown[]).map((v) => String(v))
    : [];
  $: limit = Number(config["limit"] ?? 0) || 0;

  $: fieldNames = fields.map((f) => f.name);
  $: availableFields = fieldNames.filter((n) => !selectedFields.includes(n));

  // R5-010 inverse mode
  $: relationFields = fields.filter((f) => f.type === DataFieldType.Relation).map((f) => f.name);
  $: inverseRelationField = String(config["inverseRelationField"] ?? "");
  $: inverseTargetId = String(config["inverseTargetId"] ?? "");
  $: sourceRecords = source?.records ?? [];
  // Derive display name for each record: prefer name/title field, fallback to basename
  $: recordOptions = sourceRecords.map((r) => {
    const basename = (() => {
      const slash = Math.max(r.id.lastIndexOf("/"), r.id.lastIndexOf("\\"));
      const base = slash >= 0 ? r.id.slice(slash + 1) : r.id;
      const dot = base.lastIndexOf(".");
      return dot > 0 ? base.slice(0, dot) : base;
    })();
    const label =
      (typeof r.values["name"] === "string" && r.values["name"]) ||
      (typeof r.values["title"] === "string" && r.values["title"]) ||
      basename;
    return { id: r.id, label, basename };
  });

  function handleLimitInput(e: Event) {
    emit({ limit: Number((e.currentTarget as HTMLInputElement).value) || 0 });
  }

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

<div class="ppp-sbc-config">
  <label>
    {$i18n.t("views.dashboard.sub-base.config.title-field", { defaultValue: "Title field" })}
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

  <div class="ppp-sbc-config-section">
    <div class="ppp-sbc-config-label">
      {$i18n.t("views.dashboard.sub-base.config.fields", { defaultValue: "Inline fields" })}
    </div>
    {#if selectedFields.length === 0}
      <div class="ppp-sbc-config-empty">
        {$i18n.t("views.dashboard.list.config.no-fields", { defaultValue: "No fields selected" })}
      </div>
    {:else}
      <ul class="ppp-sbc-config-chips">
        {#each selectedFields as name (name)}
          <li class="ppp-sbc-config-chip">
            <span>{name}</span>
            <button type="button" on:click={() => moveField(name, -1)} aria-label="up">↑</button>
            <button type="button" on:click={() => moveField(name, 1)} aria-label="down">↓</button>
            <button type="button" on:click={() => removeField(name)} aria-label="remove">×</button>
          </li>
        {/each}
      </ul>
    {/if}
    {#if availableFields.length > 0}
      <select on:change={(e) => { addField(e.currentTarget.value); e.currentTarget.value = ""; }}>
        <option value="">+ {$i18n.t("views.dashboard.list.config.add-field", { defaultValue: "Add field" })}</option>
        {#each availableFields as name}
          <option value={name}>{name}</option>
        {/each}
      </select>
    {/if}
  </div>

  <label>
    {$i18n.t("views.dashboard.list.config.limit", { defaultValue: "Limit" })}
    <input
      type="number"
      min="0"
      step="1"
      value={limit}
      on:input={handleLimitInput}
    />
  </label>

  <!-- R5-010 inverse mode: show records that reference a chosen target via a relation field -->
  <div class="ppp-sbc-config-section">
    <div class="ppp-sbc-config-label">
      {$i18n.t("views.dashboard.sub-base.config.inverse-mode", { defaultValue: "Inverse mode (optional)" })}
    </div>
    <div class="ppp-sbc-config-hint">
      {$i18n.t("views.dashboard.sub-base.config.inverse-hint", {
        defaultValue: "Show records from other notes that point TO a chosen target record, grouped by tabs."
      })}
    </div>

    <label>
      {$i18n.t("views.dashboard.sub-base.config.inverse-field", { defaultValue: "Relation field" })}
      <select
        value={inverseRelationField}
        on:change={(e) => emit({ inverseRelationField: e.currentTarget.value || undefined })}
      >
        <option value="">— {$i18n.t("views.dashboard.sub-base.config.none", { defaultValue: "None (disabled)" })} —</option>
        {#each relationFields as name}
          <option value={name}>{name}</option>
        {/each}
      </select>
    </label>

    {#if inverseRelationField}
      <label>
        {$i18n.t("views.dashboard.sub-base.config.inverse-target", { defaultValue: "Target record" })}
        <select
          value={inverseTargetId}
          on:change={(e) => emit({ inverseTargetId: e.currentTarget.value || undefined })}
        >
          <option value="">— {$i18n.t("views.dashboard.sub-base.config.choose", { defaultValue: "Choose record" })} —</option>
          {#each recordOptions as rec (rec.id)}
            <option value={rec.basename}>{rec.label}</option>
          {/each}
        </select>
      </label>
    {/if}
  </div>
</div>

<style>
  .ppp-sbc-config {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-secondary);
  }
  .ppp-sbc-config label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: var(--font-ui-smaller);
  }
  .ppp-sbc-config-section { display: flex; flex-direction: column; gap: 0.25rem; }
  .ppp-sbc-config-label { font-size: var(--font-ui-smaller); color: var(--text-muted); }
  .ppp-sbc-config-empty { color: var(--text-faint); font-style: italic; font-size: var(--font-ui-smaller); }
  .ppp-sbc-config-chips { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.125rem; }
  .ppp-sbc-config-chip {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.25rem;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
  }
  .ppp-sbc-config-chip span { flex: 1; }
  .ppp-sbc-config-chip button {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-muted);
    padding: 0 0.25rem;
  }
  .ppp-sbc-config-hint {
    font-size: var(--font-ui-smaller);
    color: var(--text-faint);
    font-style: italic;
  }
</style>
