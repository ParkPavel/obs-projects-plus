<script lang="ts">
  /**
   * Schema — full project schema editor (Stage A.9).
   *
   * Surfaces every field in a project as a flat list with quick access to
   * Configure / Delete actions and an explicit "+ Add field" entry point.
   * This is the canonical user surface for managing a project's field
   * universe; previously the only access route was the Table column
   * context-menu, which left the Database view (no DataTable on canvas)
   * without any way to edit project schema.
   *
   * Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.9 — Schema panel.
   */
  import {
    Button,
    ModalButtonGroup,
    ModalContent,
    ModalLayout,
    SettingItem,
  } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import {
    DataFieldType,
    type DataField,
  } from "src/lib/dataframe/dataframe";
  import type {
    RelationFieldConfig,
    RollupFieldConfig,
  } from "src/settings/base/settings";
  import type { ProjectDefinition } from "src/settings/settings";

  export let title: string;
  export let fields: DataField[];
  /**
   * All projects in the current vault. Used to resolve `targetProjectId`
   * GUIDs to human-readable names in the Relation / Rollup row summaries.
   * Pass an empty array if unknown — the summary degrades gracefully to
   * the raw id, which is still better than a missing chip.
   */
  export let availableProjects: ProjectDefinition[] = [];
  /** Current project id — reserved for future "self-link" detection. */
  export let currentProjectId: string = "";
  /** Invoked when user clicks Configure on a row. */
  export let onConfigure: (field: DataField) => void;
  /** Invoked when user clicks Add field. */
  export let onAdd: () => void;
  /** Invoked when user clicks Delete on a row (caller confirms). */
  export let onDelete: (field: DataField) => void;
  export let onClose: () => void;

  // Reserve currentProjectId to silence unused-prop warnings while keeping
  // the API stable for future self-relation diagnostics.
  void currentProjectId;

  $: projectNameById = new Map(
    availableProjects.map((p) => [p.id, p.name] as const)
  );

  function resolveProjectLabel(id: string | undefined | null): string {
    if (!id) return "";
    return projectNameById.get(id) ?? id;
  }

  function typeLabel(field: DataField): string {
    switch (field.type) {
      case DataFieldType.String:
        return $i18n.t("data-types.string");
      case DataFieldType.Number:
        return $i18n.t("data-types.number");
      case DataFieldType.Boolean:
        return $i18n.t("data-types.boolean");
      case DataFieldType.Date:
        return field.typeConfig?.time
          ? $i18n.t("data-types.datetime")
          : $i18n.t("data-types.date");
      case DataFieldType.List:
        return $i18n.t("data-types.list");
      case DataFieldType.Select:
        return $i18n.t("data-types.select");
      case DataFieldType.Status:
        return $i18n.t("data-types.status");
      case DataFieldType.Formula:
        return $i18n.t("data-types.formula");
      case DataFieldType.Relation:
        return $i18n.t("data-types.relation");
      case DataFieldType.Rollup:
        return $i18n.t("data-types.rollup");
      default:
        return $i18n.t("data-types.unknown");
    }
  }

  function typeBadge(field: DataField): string {
    // A short glyph that previews the type at a glance (Apple-grade
    // visual density: never more than 2 chars).
    switch (field.type) {
      case DataFieldType.String:
        return "Aa";
      case DataFieldType.Number:
        return "#";
      case DataFieldType.Boolean:
        return "✓";
      case DataFieldType.Date:
        return "📅";
      case DataFieldType.List:
        return "☰";
      case DataFieldType.Select:
        return "◉";
      case DataFieldType.Status:
        return "●";
      case DataFieldType.Formula:
        return "ƒ";
      case DataFieldType.Relation:
        return "↔";
      case DataFieldType.Rollup:
        return "Σ";
      default:
        return "?";
    }
  }

  function relationSummary(field: DataField): string {
    const cfg = (field.typeConfig as { relation?: RelationFieldConfig })
      ?.relation;
    if (!cfg?.targetProjectId) return "";
    return $i18n.t("modals.schema.relation-summary", {
      project: resolveProjectLabel(cfg.targetProjectId),
    });
  }

  function relationMissingTarget(field: DataField): boolean {
    if (field.type !== DataFieldType.Relation) return false;
    const cfg = (field.typeConfig as { relation?: RelationFieldConfig })
      ?.relation;
    return !cfg?.targetProjectId;
  }

  function rollupFunctionLabel(fn: string): string {
    return $i18n.t(`modals.field.configure.rollup.functions.${fn}`, {
      defaultValue: fn,
    });
  }

  function rollupSummary(field: DataField): string {
    const cfg = (field.typeConfig as { rollup?: RollupFieldConfig })?.rollup;
    if (!cfg?.relationField || !cfg?.targetField || !cfg?.function) return "";
    const projectLabel = resolveProjectLabel(cfg.targetProjectId);
    return $i18n.t("modals.schema.rollup-summary", {
      function: rollupFunctionLabel(cfg.function),
      target: projectLabel
        ? `${projectLabel}.${cfg.targetField}`
        : cfg.targetField,
      via: cfg.relationField,
    });
  }
</script>

<ModalLayout {title}>
  <ModalContent>
    {#if fields.length === 0}
      <p class="ppp-schema-empty">
        {$i18n.t("modals.schema.empty")}
      </p>
    {:else}
      <ul class="ppp-schema-list">
        {#each fields as field (field.name)}
          <li class="ppp-schema-row">
            <span
              class="ppp-schema-badge"
              aria-hidden="true"
              data-type={field.type}
            >
              {typeBadge(field)}
            </span>
            <span class="ppp-schema-meta">
              <span class="ppp-schema-name">{field.name}</span>
              <span class="ppp-schema-type">
                {typeLabel(field)}{#if field.repeated}
                  · {$i18n.t("data-types.repeated")}{/if}{#if field.identifier}
                  · {$i18n.t("modals.schema.identifier")}{/if}
              </span>
              {#if field.type === DataFieldType.Relation && relationSummary(field)}
                <span class="ppp-schema-summary">{relationSummary(field)}</span>
              {/if}
              {#if relationMissingTarget(field)}
                <span class="ppp-schema-warning" role="status">
                  ⚠ {$i18n.t("modals.schema.relation-missing-target")}
                </span>
              {/if}
              {#if field.type === DataFieldType.Rollup && rollupSummary(field)}
                <span class="ppp-schema-summary">{rollupSummary(field)}</span>
              {/if}
            </span>
            <span class="ppp-schema-actions">
              <Button
                variant="default"
                tooltip={$i18n.t("modals.schema.configure")}
                on:click={() => onConfigure(field)}
              >
                {$i18n.t("modals.schema.configure")}
              </Button>
              {#if !field.identifier && !field.derived}
                <Button
                  variant="default"
                  tooltip={$i18n.t("modals.schema.delete")}
                  on:click={() => onDelete(field)}
                >
                  {$i18n.t("modals.schema.delete")}
                </Button>
              {/if}
            </span>
          </li>
        {/each}
      </ul>
    {/if}

    <SettingItem
      name={$i18n.t("modals.schema.add-field.name")}
      description={$i18n.t("modals.schema.add-field.description")}
    >
      <Button variant="primary" on:click={onAdd}>
        + {$i18n.t("modals.schema.add-field.button")}
      </Button>
    </SettingItem>
  </ModalContent>
  <ModalButtonGroup>
    <Button variant="default" on:click={onClose}>
      {$i18n.t("modals.schema.close")}
    </Button>
  </ModalButtonGroup>
</ModalLayout>

<style>
  .ppp-schema-empty {
    margin: 0 0 var(--ppp-space-md, 0.75rem);
    color: var(--text-muted);
  }
  .ppp-schema-list {
    list-style: none;
    margin: 0 0 var(--ppp-space-md, 0.75rem);
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--ppp-space-xs, 0.25rem);
  }
  .ppp-schema-row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: var(--ppp-space-md, 0.75rem);
    padding: var(--ppp-space-sm, 0.375rem) var(--ppp-space-md, 0.75rem);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-secondary);
    transition: background-color 120ms ease;
  }
  .ppp-schema-row:hover {
    background: var(--background-modifier-hover);
  }
  .ppp-schema-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-modifier-border);
    color: var(--text-normal);
    font-family: var(--font-monospace);
    font-weight: 600;
    font-size: 0.85rem;
    line-height: 1;
    user-select: none;
  }
  .ppp-schema-meta {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
  }
  .ppp-schema-name {
    color: var(--text-normal);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ppp-schema-type {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller, 0.75rem);
  }
  .ppp-schema-summary {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller, 0.75rem);
    font-family: var(--font-monospace);
  }
  .ppp-schema-warning {
    color: var(--text-warning, var(--text-error));
    font-size: var(--font-ui-smaller, 0.75rem);
    font-weight: 500;
  }
  .ppp-schema-actions {
    display: inline-flex;
    gap: var(--ppp-space-xs, 0.25rem);
  }
  @media (max-width: 30rem) {
    .ppp-schema-row {
      grid-template-columns: auto 1fr;
    }
    .ppp-schema-actions {
      grid-column: 1 / -1;
      justify-content: flex-end;
    }
  }
  /* Touch sizing — Apple-grade thumb target. */
  .ppp-schema-actions :global(button) {
    min-height: 2.25rem;
  }
</style>
