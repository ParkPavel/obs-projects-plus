<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import type { ProjectDefinition } from "src/settings/settings";
  import type { RelationPreviewSummary, RelationSetupDraft } from "src/lib/relations/relationSetup";
  import { i18n } from "src/lib/stores/i18n";

  export let projects: readonly ProjectDefinition[] = [];
  export let draft: RelationSetupDraft;
  export let summary: RelationPreviewSummary | undefined = undefined;
  export let error = "";
  const dispatch = createEventDispatcher<{ save: RelationSetupDraft; cancel: void; preview: RelationSetupDraft }>();
  let firstInput: HTMLInputElement;
  onMount(() => firstInput?.focus());
  function cancel() { dispatch("cancel"); }
  function keydown(event: KeyboardEvent) { if (event.key === "Escape") { event.preventDefault(); cancel(); } }
  function update(patch: Partial<RelationSetupDraft>) { draft = { ...draft, ...patch }; dispatch("preview", draft); }
</script>

<svelte:window on:keydown={keydown} />
<section class="ppp-relation-setup" role="dialog" aria-modal="true" aria-label={$i18n.t("relation-setup.title", { defaultValue: "Link property to database" })}>
  <h2>{$i18n.t("relation-setup.title", { defaultValue: "Link property to database" })}</h2>
  <p>{$i18n.t("relation-setup.description", { defaultValue: "Values stay as WikiLinks in Markdown. Preview makes no changes." })}</p>
  <label>{$i18n.t("relation-setup.property-label", { defaultValue: "Property" })}
    <input bind:this={firstInput} value={draft.fieldName} on:input={(event) => update({ fieldName: event.currentTarget.value })} />
  </label>
  <label>{$i18n.t("relation-setup.database-label", { defaultValue: "Database" })}
    <select value={draft.targetProjectId} on:change={(event) => update({ targetProjectId: event.currentTarget.value })}>
      <option value="">{$i18n.t("relation-setup.database-placeholder", { defaultValue: "Choose a database…" })}</option>
      {#each projects as project}
        <option value={project.id}>{project.name}</option>
      {/each}
    </select>
  </label>
  {#if draft.targetProjectId}
    <label>{$i18n.t("relation-setup.display-field-label", { defaultValue: "Display field" })}
      <input
        value={draft.displayField ?? ""}
        placeholder={$i18n.t("relation-setup.display-field-placeholder", { defaultValue: "e.g. title" })}
        on:input={(event) => { const v = event.currentTarget.value; update(v ? { displayField: v } : {}); }}
      />
    </label>
  {/if}
  <label><input type="checkbox" checked={draft.inverse?.enabled ?? false} on:change={(event) => update({ inverse: { enabled: event.currentTarget.checked, fieldName: draft.inverse?.fieldName ?? "" } })} /> {$i18n.t("relation-setup.inverse-enable-label", { defaultValue: "Create inverse property in schema" })}</label>
  {#if draft.inverse?.enabled}
    <label>{$i18n.t("relation-setup.inverse-field-label", { defaultValue: "Inverse property name" })}
      <input value={draft.inverse.fieldName} on:input={(event) => update({ inverse: { enabled: true, fieldName: event.currentTarget.value } })} />
    </label>
    <p role="status">{$i18n.t("relation-setup.inverse-warning", { defaultValue: "The inverse property will only be declared after saving. Existing notes are not rewritten." })}</p>
  {/if}
  {#if summary}
    <p aria-live="polite">
      {$i18n.t("relation-setup.preview-resolved", { count: summary.resolved, defaultValue: "Matched: {{count}}" })}; {$i18n.t("relation-setup.preview-unmatched", { count: summary.unmatched, defaultValue: "Not found: {{count}}" })}; {$i18n.t("relation-setup.preview-ambiguous", { count: summary.ambiguous, defaultValue: "Ambiguous: {{count}}" })}.
    </p>
  {/if}
  {#if error}<p role="alert">{error}</p>{/if}
  <footer>
    <button type="button" on:click={cancel}>{$i18n.t("relation-setup.cancel", { defaultValue: "Cancel" })}</button>
    <button type="button" on:click={() => dispatch("save", draft)}>{$i18n.t("relation-setup.save", { defaultValue: "Save relation" })}</button>
  </footer>
</section>

<style>
  .ppp-relation-setup { display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; }
  label { display: flex; flex-direction: column; gap: 0.25rem; }
  label:has(input[type="checkbox"]) { flex-direction: row; align-items: center; }
  footer { display: flex; justify-content: flex-end; gap: 0.5rem; }
</style>
