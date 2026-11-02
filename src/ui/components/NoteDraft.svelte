<script lang="ts">
  import { onMount } from "svelte";
  import TextField from "src/ui/components/fields/TextField.svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { app } from "src/lib/stores/obsidian";
  import { initialNoteName, noteNameProblem } from "src/ui/modals/createNoteModal";
  import type { ProjectDefinition } from "src/settings/settings";

  export let project: ProjectDefinition;
  export let onSave: (
    name: string,
    templatePath: string,
    project: ProjectDefinition
  ) => void | Promise<unknown>;
  export let onCancel: () => void;

  let name = initialNoteName(project);
  let templatePath = project.templates[0] ?? "";
  let field: TextField;
  let saving = false;
  let saveError = "";

  $: nameProblem = noteNameProblem($app, project, name);

  function validName(value: string): boolean {
    return noteNameProblem($app, project, value) === "";
  }

  async function submit(value = name): Promise<void> {
    const problem = noteNameProblem($app, project, value);
    if (saving || problem) return;

    saving = true;
    saveError = "";
    try {
      await onSave(value.trim(), templatePath, project);
    } catch (error) {
      saveError = $i18n.t("modals.note.create.save-error", {
        message: error instanceof Error ? error.message : String(error),
      });
      field.retryCommit();
    } finally {
      saving = false;
    }
  }

  onMount(() => field.select());
</script>

<div
  class="ppp-note-draft"
  data-note-draft
  role="group"
  aria-label={$i18n.t("modals.note.create.title")}
>
  <span class="ppp-note-draft-title">{$i18n.t("modals.note.create.title")}</span>
  <div class="ppp-note-draft-field">
    <span>{$i18n.t("modals.note.create.name.name")}</span>
    <TextField
      bind:this={field}
      data-note-name
      value={name}
      ariaLabel={$i18n.t("modals.note.create.name.name")}
      validate={validName}
      error={!!nameProblem || !!saveError}
      disabled={saving}
      on:input={(event) => {
        name = event.detail;
        saveError = "";
      }}
      on:commit={(event) => {
        if (event.detail.reason === "enter") void submit(event.detail.value);
      }}
      on:cancel={onCancel}
    />
  </div>
  {#if project.templates.length}
    <div class="ppp-note-draft-field">
      <span>{$i18n.t("modals.note.create.templatePath.name")}</span>
      <select
        data-note-template
        aria-label={$i18n.t("modals.note.create.templatePath.name")}
        bind:value={templatePath}
        disabled={saving}
        on:change={() => (saveError = "")}
      >
        <option value="">{$i18n.t("modals.note.create.templatePath.none")}</option>
        {#each project.templates as path}
          <option value={path}>{path}</option>
        {/each}
      </select>
    </div>
  {/if}
  {#if nameProblem || saveError}
    <span class="ppp-note-draft-error" role="alert">{saveError || nameProblem}</span>
  {/if}
  <div class="ppp-note-draft-actions">
    <button
      type="button"
      data-note-cancel
      disabled={saving}
      on:pointerdown|preventDefault
      on:mousedown|preventDefault
      on:click={onCancel}
    >
      {$i18n.t("common.cancel")}
    </button>
    <button
      type="button"
      data-note-save
      disabled={saving || !!nameProblem}
      on:pointerdown|preventDefault
      on:mousedown|preventDefault
      on:click={() => void submit()}
    >
      {saving ? $i18n.t("modals.note.create.creating") : $i18n.t("modals.note.create.create")}
    </button>
  </div>
</div>

<style>
  .ppp-note-draft {
    display: grid;
    gap: 0.5rem;
    min-width: 0;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    padding: var(--size-4-3);
    border: var(--ppp-border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    background: var(--background-secondary);
  }

  .ppp-note-draft-title {
    font-weight: var(--font-semibold);
  }

  .ppp-note-draft-field {
    display: grid;
    gap: 0.25rem;
    min-width: 0;
    color: var(--text-muted);
    font-size: var(--font-ui-small);
  }

  .ppp-note-draft-field :global(input),
  .ppp-note-draft-field select {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: var(--ppp-touch-target-min, 2rem);
  }

  .ppp-note-draft-error {
    color: var(--text-error);
    font-size: var(--font-ui-small);
  }

  .ppp-note-draft-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .ppp-note-draft-actions button {
    min-height: var(--ppp-touch-target-min, 2rem);
  }
</style>
