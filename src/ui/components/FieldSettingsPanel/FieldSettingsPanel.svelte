<script lang="ts">
  /**
   * Dashboard V2 (DG-3 / S3.1) — field settings slide-in panel.
   *
   * Replaces the existing ConfigureField modal with a right-edge
   * slide-in. MVP includes inline name edit, type picker, and basic
   * field-specific config (options for Select/Status, time toggle for
   * Date, etc.). Width slider / alignment / aggregation pills deferred
   * to Sprint 4+.
   */
  import { createEventDispatcher } from "svelte";
  import { SlideInPanel } from "src/ui/components/SlideInPanel";
  import type { DataField } from "src/lib/dataframe/dataframe";
  import { DataFieldType } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import { dataFieldTypeOptions } from "src/ui/modals/components/dataFieldTypeOptions";

  export let open: boolean;
  export let field: DataField;
  export let existingFields: DataField[] = [];

  const dispatch = createEventDispatcher<{
    save: DataField;
    close: void;
  }>();

  let editedField = { ...field };
  let nameError = "";

  $: if (open) {
    editedField = { ...field };
    nameError = validateFieldName(editedField.name);
  }

  function validateFieldName(name: string): string {
    if (!name.trim()) {
      return $i18n.t("modals.field.configure.empty-name-error", {
        defaultValue: "Field name cannot be empty",
      });
    }
    const existing = existingFields.find(
      (f) => f.name === name && f.name !== field.name
    );
    if (existing) {
      return $i18n.t("modals.field.configure.existing-name-error", {
        defaultValue: "A field with this name already exists",
      });
    }
    return "";
  }

  function handleNameInput(e: Event) {
    const input = e.target as HTMLInputElement;
    editedField = { ...editedField, name: input.value };
    nameError = validateFieldName(input.value);
  }

  function checkboxChecked(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }

  function handleTypeChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    const nextType = select.value as DataFieldType;
    // Prune incompatible typeConfig keys when switching types
    const prev = (editedField.typeConfig ?? {}) as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    const keep = (key: string) => {
      if (prev[key] !== undefined) next[key] = prev[key];
    };
    switch (nextType) {
      case DataFieldType.String:
        keep("options");
        keep("richText");
        keep("fileLinks");
        break;
      case DataFieldType.Select:
      case DataFieldType.Status:
        keep("options");
        break;
      case DataFieldType.Date:
        keep("time");
        break;
      case DataFieldType.Relation:
        keep("relation");
        break;
      case DataFieldType.Rollup:
        keep("rollup");
        break;
      case DataFieldType.Formula:
        keep("formula");
        break;
      default:
        break;
    }
    editedField = {
      ...editedField,
      type: nextType,
      typeConfig: Object.keys(next).length > 0 ? next : undefined,
    };
  }

  function handleSave() {
    if (nameError) return;
    dispatch("save", editedField);
    dispatch("close");
  }

  function handleClose() {
    dispatch("close");
  }

  $: typeLabel =
    dataFieldTypeOptions.find((opt) => opt.value === editedField.type)?.label ??
    editedField.type;
</script>

<SlideInPanel
  {open}
  title={$i18n.t("views.dashboard.field-settings.title", {
    defaultValue: "Field Settings",
  })}
  on:close={handleClose}
>
  <div class="ppp-field-settings">
    <!-- Name -->
    <div class="ppp-field-settings-section">
      <label class="ppp-field-settings-label" for="ppp-field-name">
        {$i18n.t("modals.field.configure.name-label", { defaultValue: "Name" })}
      </label>
      <input
        id="ppp-field-name"
        type="text"
        class="ppp-field-settings-input"
        class:ppp-field-settings-input--error={!!nameError}
        value={editedField.name}
        on:input={handleNameInput}
        placeholder="Field name"
      />
      {#if nameError}
        <span class="ppp-field-settings-error">{nameError}</span>
      {/if}
    </div>

    <!-- Type -->
    <div class="ppp-field-settings-section">
      <label class="ppp-field-settings-label" for="ppp-field-type">
        {$i18n.t("modals.field.configure.type-label", { defaultValue: "Type" })}
      </label>
      <select
        id="ppp-field-type"
        class="ppp-field-settings-select"
        value={editedField.type}
        on:change={handleTypeChange}
        disabled={!field.derived && field.name !== editedField.name}
      >
        {#each dataFieldTypeOptions as opt (opt.value)}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
      <span class="ppp-field-settings-hint">
        {$i18n.t(`data-types.${editedField.type}.hint`, {
          defaultValue: typeLabel,
        })}
      </span>
    </div>

    <!-- Type-specific config (Sprint 4+: expand inline editors here) -->
    {#if editedField.type === DataFieldType.String}
      <div class="ppp-field-settings-section">
        <label class="ppp-field-settings-checkbox">
          <input
            type="checkbox"
            checked={!!(editedField.typeConfig as { richText?: boolean })?.richText}
            on:change={(e) => {
              editedField = {
                ...editedField,
                typeConfig: {
                  ...(editedField.typeConfig ?? {}),
                  richText: checkboxChecked(e),
                },
              };
            }}
          />
          <span>{$i18n.t("modals.field.configure.rich-text.name", {
            defaultValue: "Rich text"
          })}</span>
        </label>
        <span class="ppp-field-settings-hint">{$i18n.t("modals.field.configure.rich-text.description", {
          defaultValue: "Render field content as Markdown (bold, italic, links, inline color via HTML spans)"
        })}</span>
      </div>
      <div class="ppp-field-settings-section">
        <label class="ppp-field-settings-checkbox">
          <input
            type="checkbox"
            checked={!!(editedField.typeConfig as { fileLinks?: boolean })?.fileLinks}
            on:change={(e) => {
              editedField = {
                ...editedField,
                typeConfig: {
                  ...(editedField.typeConfig ?? {}),
                  fileLinks: checkboxChecked(e),
                },
              };
            }}
          />
          <span>{$i18n.t("modals.field.configure.file-links.name", {
            defaultValue: "File links"
          })}</span>
        </label>
        <span class="ppp-field-settings-hint">{$i18n.t("modals.field.configure.file-links.description", {
          defaultValue: "Render [[wiki-link]] values as clickable file chips"
        })}</span>
      </div>
    {/if}
    {#if editedField.type === DataFieldType.Date}
      <div class="ppp-field-settings-section">
        <label class="ppp-field-settings-checkbox">
          <input
            type="checkbox"
            checked={!!(editedField.typeConfig as { time?: boolean })?.time}
            on:change={(e) => {
              editedField = {
                ...editedField,
                typeConfig: {
                  ...(editedField.typeConfig ?? {}),
                  time: checkboxChecked(e),
                },
              };
            }}
          />
          <span>{$i18n.t("modals.field.configure.date-include-time", {
            defaultValue: "Include time"
          })}</span>
        </label>
      </div>
    {/if}

    <!-- Actions -->
    <div class="ppp-field-settings-actions">
      <button
        class="ppp-field-settings-btn ppp-field-settings-btn--primary"
        on:click={handleSave}
        disabled={!!nameError}
      >
        {$i18n.t("common.save", { defaultValue: "Save" })}
      </button>
      <button
        class="ppp-field-settings-btn"
        on:click={handleClose}
      >
        {$i18n.t("common.cancel", { defaultValue: "Cancel" })}
      </button>
    </div>
  </div>
</SlideInPanel>

<style>
  .ppp-field-settings {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .ppp-field-settings-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .ppp-field-settings-label {
    font-size: var(--font-ui-small, 0.875rem);
    font-weight: 600;
    color: var(--text-normal);
  }

  .ppp-field-settings-input,
  .ppp-field-settings-select {
    padding: 0.5rem 0.75rem;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: var(--font-ui-small, 0.875rem);
  }

  .ppp-field-settings-input:focus,
  .ppp-field-settings-select:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .ppp-field-settings-input--error {
    border-color: var(--text-error);
  }

  .ppp-field-settings-error {
    font-size: var(--font-ui-smaller, 0.8125rem);
    color: var(--text-error);
  }

  .ppp-field-settings-hint {
    font-size: var(--font-ui-smaller, 0.8125rem);
    color: var(--text-faint);
    font-style: italic;
  }

  .ppp-field-settings-checkbox {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    user-select: none;
  }

  .ppp-field-settings-checkbox input[type="checkbox"] {
    cursor: pointer;
  }

  .ppp-field-settings-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 0.0625rem solid var(--background-modifier-border);
  }

  .ppp-field-settings-btn {
    flex: 1;
    padding: 0.5rem 1rem;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    font-size: var(--font-ui-small, 0.875rem);
    transition: background 120ms ease, color 120ms ease;
  }

  .ppp-field-settings-btn:hover:not(:disabled) {
    background: var(--background-modifier-hover);
  }

  .ppp-field-settings-btn--primary {
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .ppp-field-settings-btn--primary:hover:not(:disabled) {
    background: var(--interactive-accent-hover);
    border-color: var(--interactive-accent-hover);
  }

  .ppp-field-settings-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
