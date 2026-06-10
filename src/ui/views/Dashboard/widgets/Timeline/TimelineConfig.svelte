<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { DataField } from "src/lib/dataframe/dataframe";
  import { DataFieldType } from "src/lib/dataframe/dataframe";
  import type { TimelineConfig } from "../../types";

  export let config: Record<string, unknown>;
  export let fields: DataField[];

  const dispatch = createEventDispatcher<{ change: Record<string, unknown>; close: void }>();

  $: cfg = config as unknown as TimelineConfig;

  $: dateFields = fields.filter(
    (f) => f.type === DataFieldType.Date || f.type === DataFieldType.String
  );
  $: allFields = fields;

  function update(patch: Partial<TimelineConfig>) {
    dispatch("change", { ...cfg, ...patch } as unknown as Record<string, unknown>);
  }

  function handleZoomChange(e: Event) {
    update({ zoom: (e.currentTarget as HTMLSelectElement).value as TimelineConfig["zoom"] });
  }
</script>

<div class="ppp-tl-cfg">
  <div class="ppp-tl-cfg-row">
    <label for="tl-start">Start field</label>
    <select id="tl-start" value={cfg.startField} on:change={(e) => update({ startField: e.currentTarget.value })}>
      <option value="">— none —</option>
      {#each dateFields as f}
        <option value={f.name}>{f.name}</option>
      {/each}
    </select>
  </div>

  <div class="ppp-tl-cfg-row">
    <label for="tl-end">End field</label>
    <select id="tl-end" value={cfg.endField ?? ""} on:change={(e) => { const v = e.currentTarget.value; update(v ? { endField: v } : {}); }}>
      <option value="">— same as start —</option>
      {#each dateFields as f}
        <option value={f.name}>{f.name}</option>
      {/each}
    </select>
  </div>

  <div class="ppp-tl-cfg-row">
    <label for="tl-label">Label field</label>
    <select id="tl-label" value={cfg.labelField ?? ""} on:change={(e) => { const v = e.currentTarget.value; update(v ? { labelField: v } : {}); }}>
      <option value="">— record name —</option>
      {#each allFields as f}
        <option value={f.name}>{f.name}</option>
      {/each}
    </select>
  </div>

  <div class="ppp-tl-cfg-row">
    <label for="tl-color">Color by field</label>
    <select id="tl-color" value={cfg.colorField ?? ""} on:change={(e) => { const v = e.currentTarget.value; update(v ? { colorField: v } : {}); }}>
      <option value="">— none —</option>
      {#each allFields as f}
        <option value={f.name}>{f.name}</option>
      {/each}
    </select>
  </div>

  <div class="ppp-tl-cfg-row">
    <label for="tl-zoom">Zoom</label>
    <select id="tl-zoom" value={cfg.zoom ?? "month"} on:change={handleZoomChange}>
      <option value="day">Day</option>
      <option value="week">Week</option>
      <option value="month">Month</option>
      <option value="quarter">Quarter</option>
      <option value="year">Year</option>
    </select>
  </div>

  <div class="ppp-tl-cfg-actions">
    <button class="mod-cta" on:click={() => dispatch("close")}>Done</button>
  </div>
</div>

<style>
  .ppp-tl-cfg {
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border-bottom: 0.0625rem solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  .ppp-tl-cfg-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .ppp-tl-cfg-row label {
    width: 6rem;
    flex-shrink: 0;
    font-size: var(--font-ui-small);
    color: var(--text-muted);
  }

  .ppp-tl-cfg-row select {
    flex: 1;
    font-size: var(--font-ui-small);
  }

  .ppp-tl-cfg-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.25rem;
  }
</style>
