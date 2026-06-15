<script lang="ts">
  import {
    Button,
    ModalButtonGroup,
    ModalContent,
    ModalLayout,
    Select,
    SettingItem,
    Switch,
    TextInput,
  } from "obsidian-svelte";
  import MultiTextInput from "src/ui/components/MultiTextInput/MultiTextInput.svelte";
  import FormulaEditor from "src/ui/components/FormulaEditor/FormulaEditor.svelte";
  import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";
  import type {
    RelationFieldConfig,
    RollupFieldConfig,
  } from "src/settings/base/settings";
  import type { ProjectDefinition } from "src/settings/settings";
  import { i18n } from "src/lib/stores/i18n";
  import { settings as settingsStore } from "src/lib/stores/settings";
  import { dataFieldTypeOptions } from "./dataFieldTypeOptions";

  export let title: string;
  export let field: DataField;
  export let editable: boolean;
  export let existingFields: DataField[];
  export let onSave: (field: DataField) => void;
  /**
   * Catalogue of all known projects in the vault. Used by Relation/Rollup
   * sub-panels to populate the target-project picker. Defaults to an empty
   * array so callers that have not yet been migrated keep working
   * (Stage A.9 backward-compat).
   */
  export let availableProjects: ProjectDefinition[] = [];
  /**
   * Identifier of the project this field belongs to. Filtered out of
   * Relation target candidates because a self-referencing relation cannot
   * be resolved against an *external* frame (Stage A engine contract).
   */
  export let currentProjectId: string = "";

  $: fieldNameError = validateFieldName(field.name);

  function validateFieldName(fieldName: string) {
    if (fieldName.trim() === "") {
      return $i18n.t("modals.field.configure.empty-name-error");
    }
    if (existingFields.findIndex((field) => field.name === fieldName) !== -1)
      return $i18n.t("modals.field.configure.existing-name-error");
    return "";
  }

  function handleNameChange(value: CustomEvent<string>) {
    field = {
      ...field,
      name: value.detail,
    };
  }

  /**
   * When the user converts the field to a different DataFieldType we must
   * prune incompatible sub-config — leaving stale Relation or Rollup
   * settings on a String field would cause the engine to attempt
   * cross-project enrichment against a non-existent target (Stage A.9).
   *
   * Stage A.10 hardening: replace targeted deletes with a per-type
   * allowlist so future typeConfig keys (e.g. formula expressions, list
   * separator) cannot leak across types either. Each branch declares
   * exactly which keys survive a type change.
   */
  function handleTypeChange(value: CustomEvent<string>) {
    const nextType = value.detail as DataFieldType;
    const prev = (field.typeConfig ?? {}) as Record<string, unknown>;
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
        keep("statusGroups");
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
      case DataFieldType.UniqueId:
        keep("uniqueIdPrefix");
        break;
      // Number / Boolean / List / AutoTime / Unknown — no surviving keys
      default:
        break;
    }
    if (Object.keys(next).length === 0) {
      const { typeConfig: _drop, ...rest } = field;
      void _drop;
      field = { ...rest, type: nextType };
    } else {
      field = {
        ...field,
        type: nextType,
        typeConfig: next as NonNullable<typeof field.typeConfig>,
      };
    }
  }

  function handleOptionsChange(options: string[]) {
    field = {
      ...field,
      typeConfig: {
        ...field.typeConfig,
        options,
      },
    };
  }

  // ── UniqueId sub-panel (NPLAN-A2) ────────────────────────
  $: uniqueIdPrefixValue = (field.typeConfig?.uniqueIdPrefix ?? "") as string;

  function handleUniqueIdPrefixChange(ev: CustomEvent<string>) {
    const val = ev.detail;
    if (val === "") {
      const { uniqueIdPrefix: _d, ...restCfg } = (field.typeConfig ?? {}) as {
        uniqueIdPrefix?: string;
      } & Record<string, unknown>;
      void _d;
      const restTyped = restCfg as NonNullable<typeof field.typeConfig>;
      if (Object.keys(restTyped).length > 0) {
        field = { ...field, typeConfig: restTyped };
      } else {
        const { typeConfig: _tc, ...fieldRest } = field;
        void _tc;
        field = fieldRest as typeof field;
      }
    } else {
      field = { ...field, typeConfig: { ...(field.typeConfig ?? {}), uniqueIdPrefix: val } };
    }
  }

  // ── Formula sub-panel (#077) ─────────────────────────────
  $: formulaExpression = (field.typeConfig?.formula ?? "") as string;
  $: formulaFieldNames = existingFields.map((f) => f.name);

  function handleFormulaChange(ev: CustomEvent<string>) {
    const expr = ev.detail;
    if (expr === "") {
      const { formula: _d, ...restCfg } = (field.typeConfig ?? {}) as {
        formula?: string;
      } & Record<string, unknown>;
      void _d;
      const restTyped = restCfg as NonNullable<typeof field.typeConfig>;
      if (Object.keys(restTyped).length > 0) {
        field = { ...field, typeConfig: restTyped };
      } else {
        const { typeConfig: _tc, ...fieldRest } = field;
        void _tc;
        field = fieldRest as typeof field;
      }
    } else {
      field = { ...field, typeConfig: { ...(field.typeConfig ?? {}), formula: expr } };
    }
  }

  // ── Status semantic groups (NPLAN-C1) ────────────────────
  $: statusGroupsCfg = (
    field.typeConfig as
      | { statusGroups?: { todo?: string[]; inProgress?: string[]; complete?: string[] } }
      | undefined
  )?.statusGroups ?? {};

  $: optionsWithBuckets = (field.typeConfig?.options ?? []).map((opt) => ({
    opt,
    bucket: statusGroupsCfg.todo?.includes(opt)
      ? "todo"
      : statusGroupsCfg.inProgress?.includes(opt)
        ? "inProgress"
        : statusGroupsCfg.complete?.includes(opt)
          ? "complete"
          : ("" as "todo" | "inProgress" | "complete" | ""),
  }));

  function handleStatusGroupChange(opt: string, bucket: string) {
    const prev = statusGroupsCfg;
    const groups: { todo?: string[]; inProgress?: string[]; complete?: string[] } = {};
    if (prev.todo) groups.todo = prev.todo.filter((v) => v !== opt);
    if (prev.inProgress) groups.inProgress = prev.inProgress.filter((v) => v !== opt);
    if (prev.complete) groups.complete = prev.complete.filter((v) => v !== opt);
    if (bucket === "todo") groups.todo = [...(groups.todo ?? []), opt];
    else if (bucket === "inProgress") groups.inProgress = [...(groups.inProgress ?? []), opt];
    else if (bucket === "complete") groups.complete = [...(groups.complete ?? []), opt];
    if (!groups.todo?.length) delete groups.todo;
    if (!groups.inProgress?.length) delete groups.inProgress;
    if (!groups.complete?.length) delete groups.complete;
    const hasGroups =
      (groups.todo?.length ?? 0) +
        (groups.inProgress?.length ?? 0) +
        (groups.complete?.length ?? 0) >
      0;
    if (hasGroups) {
      field = { ...field, typeConfig: { ...field.typeConfig, statusGroups: groups } };
    } else {
      const { statusGroups: _drop, ...restCfg } = (field.typeConfig ?? {}) as {
        statusGroups?: unknown;
      } & Record<string, unknown>;
      void _drop;
      const restTyped = restCfg as NonNullable<typeof field.typeConfig>;
      if (Object.keys(restTyped).length > 0) {
        field = { ...field, typeConfig: restTyped };
      } else {
        const { typeConfig: _tc, ...fieldRest } = field;
        void _tc;
        field = fieldRest as typeof field;
      }
    }
  }

  function handleRichTextChange({ detail: richText }: CustomEvent<boolean>) {
    field = {
      ...field,
      typeConfig: {
        ...field.typeConfig,
        richText,
      },
    };
  }

  function handleFileLinksChange({ detail: fileLinks }: CustomEvent<boolean>) {
    field = {
      ...field,
      typeConfig: {
        ...field.typeConfig,
        fileLinks,
      },
    };
  }

  function handleTimeChange({ detail: time }: CustomEvent<boolean>) {
    field = {
      ...field,
      typeConfig: {
        ...field.typeConfig,
        time,
      },
    };
  }

  // ── Relation sub-panel ────────────────────────────────────
  // Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.5a — Stage A makes
  // Relation a first-class type. Configuring it requires picking a target
  // project and (optionally) overriding the field used for adaptive
  // rendering of the wiki-link target.
  $: relationCfg = (field.typeConfig as { relation?: RelationFieldConfig })
    ?.relation;

  // Fallback to the live settings store when callers haven't forwarded
  // `availableProjects` (or it has not hydrated yet). Self-reference is
  // allowed: a project may relate records to other records of itself
  // (parent-task pattern). The current project is annotated for clarity.
  $: effectiveProjects =
    availableProjects.length > 0 ? availableProjects : $settingsStore.projects;

  $: projectOptions = [
    { label: $i18n.t("modals.field.configure.relation.no-project"), value: "" },
    ...effectiveProjects.map((p) => ({
      label:
        p.id === currentProjectId
          ? `${p.name} ${$i18n.t("modals.field.configure.relation.this-project-suffix", { defaultValue: "(this project)" })}`
          : p.name,
      value: p.id,
    })),
  ];

  function handleRelationProjectChange(ev: CustomEvent<string>) {
    const targetProjectId = ev.detail;
    const next = { ...(field.typeConfig ?? {}) } as {
      relation?: RelationFieldConfig;
    };
    if (!targetProjectId) {
      delete next.relation;
    } else {
      next.relation = {
        targetProjectId,
        ...(relationCfg?.displayField
          ? { displayField: relationCfg.displayField }
          : {}),
      };
    }
    field = { ...field, typeConfig: next };
  }

  function handleRelationDisplayFieldChange(ev: CustomEvent<string>) {
    const displayField = ev.detail.trim();
    if (!relationCfg?.targetProjectId) return;
    const next = { ...(field.typeConfig ?? {}) } as {
      relation?: RelationFieldConfig;
    };
    next.relation = {
      targetProjectId: relationCfg.targetProjectId,
      ...(displayField ? { displayField } : {}),
      ...(relationCfg.inverseFieldName ? { inverseFieldName: relationCfg.inverseFieldName } : {}),
      ...(relationCfg.targetSubBaseFilter
        ? { targetSubBaseFilter: relationCfg.targetSubBaseFilter }
        : {}),
    };
    field = { ...field, typeConfig: next };
  }

  function handleRelationInverseFieldChange(ev: CustomEvent<string>) {
    const inverseFieldName = ev.detail.trim();
    if (!relationCfg?.targetProjectId) return;
    const next = { ...(field.typeConfig ?? {}) } as {
      relation?: RelationFieldConfig;
    };
    next.relation = {
      targetProjectId: relationCfg.targetProjectId,
      ...(relationCfg.displayField ? { displayField: relationCfg.displayField } : {}),
      ...(inverseFieldName ? { inverseFieldName } : {}),
      ...(relationCfg.targetSubBaseFilter
        ? { targetSubBaseFilter: relationCfg.targetSubBaseFilter }
        : {}),
    };
    field = { ...field, typeConfig: next };
  }

  // R5-010 — Sub-base scope editor. Stores a FilterDefinition inline on
  // the relation config. Edited as JSON in an advanced textarea; data
  // layer (crossProjectResolver / crossProjectRollup) honors the filter
  // when resolving targets.
  let subBaseFilterDraft = "";
  let subBaseFilterError = "";
  $: subBaseFilterDraft = relationCfg?.targetSubBaseFilter
    ? JSON.stringify(relationCfg.targetSubBaseFilter, null, 2)
    : "";

  function handleSubBaseFilterBlur(ev: Event) {
    const raw = (ev.target as HTMLTextAreaElement).value.trim();
    if (!relationCfg?.targetProjectId) return;
    const next = { ...(field.typeConfig ?? {}) } as {
      relation?: RelationFieldConfig;
    };
    if (!raw) {
      subBaseFilterError = "";
      next.relation = {
        targetProjectId: relationCfg.targetProjectId,
        ...(relationCfg.displayField
          ? { displayField: relationCfg.displayField }
          : {}),
        ...(relationCfg.inverseFieldName ? { inverseFieldName: relationCfg.inverseFieldName } : {}),
      };
      field = { ...field, typeConfig: next };
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !Array.isArray(parsed.conditions)
      ) {
        subBaseFilterError = "Expected { conditions: [...] }";
        return;
      }
      subBaseFilterError = "";
      next.relation = {
        targetProjectId: relationCfg.targetProjectId,
        ...(relationCfg.displayField
          ? { displayField: relationCfg.displayField }
          : {}),
        ...(relationCfg.inverseFieldName ? { inverseFieldName: relationCfg.inverseFieldName } : {}),
        targetSubBaseFilter: parsed,
      };
      field = { ...field, typeConfig: next };
    } catch (e) {
      subBaseFilterError = (e as Error).message;
    }
  }

  // ── Rollup sub-panel ─────────────────────────────────────
  // Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.5a — Rollup chains
  // through an existing Relation field of the *same* project to fetch and
  // aggregate values from the target project. The chain is exposed in
  // user terms: pick the relation column → resolve target project → pick
  // the field on the target → pick aggregation.
  $: rollupCfg = (field.typeConfig as { rollup?: RollupFieldConfig })?.rollup;

  $: relationFieldsOnThisProject = existingFields.filter(
    (f) =>
      f.type === DataFieldType.Relation &&
      Boolean(
        (f.typeConfig as { relation?: RelationFieldConfig })?.relation
          ?.targetProjectId
      )
  );

  $: rollupRelationOptions = [
    { label: $i18n.t("modals.field.configure.rollup.no-relation"), value: "" },
    ...relationFieldsOnThisProject.map((f) => ({ label: f.name, value: f.name })),
  ];

  $: rollupResolvedTargetProjectId = (() => {
    if (rollupCfg?.targetProjectId) return rollupCfg.targetProjectId;
    if (!rollupCfg?.relationField) return "";
    const rf = relationFieldsOnThisProject.find(
      (f) => f.name === rollupCfg.relationField
    );
    return (
      (rf?.typeConfig as { relation?: RelationFieldConfig })?.relation
        ?.targetProjectId ?? ""
    );
  })();

  $: rollupTargetProject = effectiveProjects.find(
    (p) => p.id === rollupResolvedTargetProjectId
  );

  $: rollupTargetFieldOptions = (() => {
    const fc = rollupTargetProject?.fieldConfig as
      | Record<string, unknown>
      | undefined;
    const candidates = fc ? Object.keys(fc) : [];
    return [
      { label: $i18n.t("modals.field.configure.rollup.no-target-field"), value: "" },
      ...candidates.map((name) => ({ label: name, value: name })),
    ];
  })();

  // NPLAN-C3 — full function set matching aggregate.ts + rollupMode taxonomy
  const ROLLUP_FUNCTIONS: Array<{ fn: import("src/lib/engine/aggregate").RollupFunction; label: string }> = [
    // Show
    { fn: "show_original", label: "Show original" },
    { fn: "show_unique",   label: "Show unique values" },
    // Count
    { fn: "count_total",   label: "Count all" },
    { fn: "count_values",  label: "Count values" },
    { fn: "count_unique",  label: "Count unique" },
    { fn: "count_empty",   label: "Count empty" },
    { fn: "count",         label: "Count non-empty" },
    // Percent
    { fn: "percent_empty",     label: "Percent empty" },
    { fn: "percent_not_empty", label: "Percent not empty" },
    { fn: "percent_true",      label: "Percent checked" },
    // Numeric
    { fn: "sum",    label: "Sum" },
    { fn: "avg",    label: "Average" },
    { fn: "min",    label: "Min" },
    { fn: "max",    label: "Max" },
    { fn: "median", label: "Median" },
    { fn: "range",  label: "Range" },
    // Text concat
    { fn: "concat",        label: "Concatenate" },
    { fn: "concat_unique", label: "Concatenate unique" },
  ];

  $: rollupFunctionOptions = ROLLUP_FUNCTIONS.map(({ fn, label }) => ({
    label: $i18n.t(`modals.field.configure.rollup.functions.${fn}`, { defaultValue: label }),
    value: fn,
  }));

  function patchRollup(patch: Partial<RollupFieldConfig>) {
    const base: RollupFieldConfig = rollupCfg ?? {
      relationField: "",
      targetField: "",
      function: "count",
    };
    const merged = { ...base, ...patch };
    // Strip empty optional override so config stays minimal.
    if (!merged.targetProjectId) {
      delete (merged as { targetProjectId?: string }).targetProjectId;
    }
    if (!merged.separator) {
      delete (merged as { separator?: string }).separator;
    }
    const nextTypeConfig = { ...(field.typeConfig ?? {}) } as {
      rollup?: RollupFieldConfig;
    };
    nextTypeConfig.rollup = merged;
    field = { ...field, typeConfig: nextTypeConfig };
  }

  function handleRollupRelationFieldChange(ev: CustomEvent<string>) {
    const relationField = ev.detail;
    if (!relationField) {
      // User cleared selection → wipe whole rollup config.
      const next = { ...(field.typeConfig ?? {}) } as {
        rollup?: RollupFieldConfig;
      };
      delete next.rollup;
      field = { ...field, typeConfig: next };
      return;
    }
    patchRollup({ relationField });
  }

  function handleRollupTargetFieldChange(ev: CustomEvent<string>) {
    patchRollup({ targetField: ev.detail });
  }

  function handleRollupFunctionChange(ev: CustomEvent<string>) {
    patchRollup({ function: ev.detail as RollupFieldConfig["function"] });
  }

  function handleRollupSeparatorChange(ev: CustomEvent<string>) {
    patchRollup({ separator: ev.detail });
  }

  $: options = dataFieldTypeOptions((key) => $i18n.t(key));
</script>

<ModalLayout {title}>
  <ModalContent>
    <SettingItem name={$i18n.t("modals.field.configure.name.name")}>
      <TextInput
        readonly={!editable}
        value={field.name}
        error={!!fieldNameError}
        helperText={fieldNameError}
        on:input={handleNameChange}
      />
    </SettingItem>
    <SettingItem
      name={$i18n.t("modals.field.configure.type.name")}
      description={$i18n.t("modals.field.configure.type.description")}
    >
      <Select
        value={field.type}
        {options}
        on:change={handleTypeChange}
      />
    </SettingItem>
    {#if field.type === DataFieldType.String && !field.repeated && !field.identifier}
      <SettingItem
        name={$i18n.t("modals.field.configure.options.name")}
        description={$i18n.t("modals.field.configure.options.description")}
        vertical
      >
        <MultiTextInput
          options={field.typeConfig?.options ?? []}
          onChange={handleOptionsChange}
        />
      </SettingItem>
      <SettingItem
        name={$i18n.t("modals.field.configure.rich-text.name")}
        description={$i18n.t("modals.field.configure.rich-text.description")}
      >
        <Switch
          checked={field.typeConfig?.richText ?? false}
          on:check={handleRichTextChange}
        />
      </SettingItem>
      <SettingItem
        name={$i18n.t("modals.field.configure.file-links.name", { defaultValue: "File links" })}
        description={$i18n.t("modals.field.configure.file-links.description", { defaultValue: "Render [[wiki-link]] values as clickable file chips" })}
      >
        <Switch
          checked={field.typeConfig?.fileLinks ?? false}
          on:check={handleFileLinksChange}
        />
      </SettingItem>
    {/if}
    {#if field.type === DataFieldType.String && field.repeated && !field.identifier}
      <SettingItem
        name={$i18n.t("modals.field.configure.rich-text.name")}
        description={$i18n.t("modals.field.configure.rich-text.description")}
      >
        <Switch
          checked={field.typeConfig?.richText ?? false}
          on:check={handleRichTextChange}
        />
      </SettingItem>
    {/if}
    {#if field.type === DataFieldType.Date && !field.repeated}
      <SettingItem
        name={$i18n.t("modals.field.configure.time.name")}
        description={$i18n.t("modals.field.configure.time.description")}
      >
        <Switch
          checked={field.typeConfig?.time ?? false}
          on:check={handleTimeChange}
        />
      </SettingItem>
    {/if}

    <!-- NPLAN-C1 — Status semantic groups (Select / Status fields only) -->
    {#if (field.type === DataFieldType.Select || field.type === DataFieldType.Status) && optionsWithBuckets.length > 0}
      <SettingItem
        name={$i18n.t("modals.field.configure.status-groups.name", {
          defaultValue: "Semantic groups",
        })}
        description={$i18n.t("modals.field.configure.status-groups.description", {
          defaultValue:
            "Assign options to Board semantic columns (To Do / In Progress / Done)",
        })}
        vertical
      >
        <div class="ppp-status-groups">
          {#each optionsWithBuckets as { opt, bucket } (opt)}
            <div class="ppp-status-groups-row">
              <span class="ppp-status-groups-label">{opt}</span>
              <Select
                value={bucket}
                options={[
                  { label: "—", value: "" },
                  {
                    label: $i18n.t("views.board.status-groups.todo", {
                      defaultValue: "To Do",
                    }),
                    value: "todo",
                  },
                  {
                    label: $i18n.t("views.board.status-groups.in-progress", {
                      defaultValue: "In Progress",
                    }),
                    value: "inProgress",
                  },
                  {
                    label: $i18n.t("views.board.status-groups.complete", {
                      defaultValue: "Done",
                    }),
                    value: "complete",
                  },
                ]}
                on:change={(e) => handleStatusGroupChange(opt, e.detail)}
              />
            </div>
          {/each}
        </div>
      </SettingItem>
    {/if}

    <!-- Stage A.9 — Relation sub-panel -->
    {#if field.type === DataFieldType.Relation && !field.identifier}
      <SettingItem
        name={$i18n.t("modals.field.configure.relation.target-project.name")}
        description={$i18n.t(
          "modals.field.configure.relation.target-project.description"
        )}
      >
        {#if availableProjects.length === 0}
          <TextInput
            value={relationCfg?.targetProjectId ?? ""}
            placeholder={$i18n.t(
              "modals.field.configure.relation.target-project.placeholder"
            )}
            on:input={(ev) =>
              handleRelationProjectChange(
                new CustomEvent("change", { detail: ev.detail })
              )}
          />
        {:else}
          <Select
            value={relationCfg?.targetProjectId ?? ""}
            options={projectOptions}
            allowEmpty
            placeholder={$i18n.t(
              "modals.field.configure.relation.target-project.placeholder"
            )}
            on:change={handleRelationProjectChange}
          />
        {/if}
      </SettingItem>
      {#if relationCfg?.targetProjectId}
        <SettingItem
          name={$i18n.t("modals.field.configure.relation.display-field.name")}
          description={$i18n.t(
            "modals.field.configure.relation.display-field.description"
          )}
        >
          <TextInput
            value={relationCfg?.displayField ?? ""}
            placeholder={$i18n.t(
              "modals.field.configure.relation.display-field.placeholder"
            )}
            on:input={handleRelationDisplayFieldChange}
          />
        </SettingItem>
        <!-- NPLAN-C2 — inverse field name for two-way write-back -->
        <SettingItem
          name={$i18n.t("modals.field.configure.relation.inverse-field.name", {
            defaultValue: "Inverse field name",
          })}
          description={$i18n.t(
            "modals.field.configure.relation.inverse-field.description",
            {
              defaultValue:
                "Field name on the target note that will mirror this relation (two-way write-back). Leave blank to disable.",
            }
          )}
        >
          <TextInput
            value={relationCfg?.inverseFieldName ?? ""}
            placeholder={$i18n.t(
              "modals.field.configure.relation.inverse-field.placeholder",
              { defaultValue: "e.g. backlinks" }
            )}
            on:input={handleRelationInverseFieldChange}
          />
        </SettingItem>
        <SettingItem
          name={$i18n.t("modals.field.configure.relation.sub-base-scope.name", {
            defaultValue: "Sub-base scope (advanced)",
          })}
          description={$i18n.t(
            "modals.field.configure.relation.sub-base-scope.description",
            {
              defaultValue:
                "JSON FilterDefinition; only target records passing this filter are surfaced. Leave empty for full project scope.",
            }
          )}
        >
          <div class="ppp-subbase-scope">
            <textarea
              class="ppp-subbase-scope-input"
              rows="4"
              spellcheck="false"
              value={subBaseFilterDraft}
              placeholder={'{ "conjunction": "and", "conditions": [] }'}
              on:blur={handleSubBaseFilterBlur}
            ></textarea>
            {#if subBaseFilterError}
              <p class="ppp-subbase-scope-error">{subBaseFilterError}</p>
            {/if}
          </div>
        </SettingItem>
      {/if}
    {/if}

    <!-- Stage A.9 — Rollup sub-panel -->
    {#if field.type === DataFieldType.Rollup && !field.identifier}
      <SettingItem
        name={$i18n.t("modals.field.configure.rollup.relation-field.name")}
        description={$i18n.t(
          "modals.field.configure.rollup.relation-field.description"
        )}
      >
        {#if relationFieldsOnThisProject.length === 0}
          <p class="ppp-rollup-empty">
            {$i18n.t("modals.field.configure.rollup.no-relations-warning")}
          </p>
        {:else}
          <Select
            value={rollupCfg?.relationField ?? ""}
            options={rollupRelationOptions}
            allowEmpty
            on:change={handleRollupRelationFieldChange}
          />
        {/if}
      </SettingItem>
      {#if rollupCfg?.relationField && rollupResolvedTargetProjectId}
        <SettingItem
          name={$i18n.t("modals.field.configure.rollup.target-field.name")}
          description={rollupTargetProject
            ? $i18n.t(
                "modals.field.configure.rollup.target-field.description-with-project",
                { project: rollupTargetProject.name }
              )
            : $i18n.t(
                "modals.field.configure.rollup.target-field.description"
              )}
        >
          {#if rollupTargetFieldOptions.length > 1}
            <Select
              value={rollupCfg?.targetField ?? ""}
              options={rollupTargetFieldOptions}
              allowEmpty
              on:change={handleRollupTargetFieldChange}
            />
          {:else}
            <TextInput
              value={rollupCfg?.targetField ?? ""}
              placeholder={$i18n.t(
                "modals.field.configure.rollup.target-field.placeholder"
              )}
              on:input={handleRollupTargetFieldChange}
            />
          {/if}
        </SettingItem>
        <SettingItem
          name={$i18n.t("modals.field.configure.rollup.function.name")}
          description={$i18n.t(
            "modals.field.configure.rollup.function.description"
          )}
        >
          <Select
            value={rollupCfg?.function ?? "count"}
            options={rollupFunctionOptions}
            on:change={handleRollupFunctionChange}
          />
        </SettingItem>
        {#if rollupCfg?.function === "concat" || rollupCfg?.function === "concat_unique"}
          <SettingItem
            name={$i18n.t("modals.field.configure.rollup.separator.name")}
            description={$i18n.t(
              "modals.field.configure.rollup.separator.description"
            )}
          >
            <TextInput
              value={rollupCfg?.separator ?? ", "}
              on:input={handleRollupSeparatorChange}
            />
          </SettingItem>
        {/if}
      {/if}
    {/if}

    <!-- #077 — Formula sub-panel -->
    {#if field.type === DataFieldType.Formula && !field.identifier}
      <SettingItem
        name={$i18n.t("modals.field.configure.formula.name", { defaultValue: "Formula" })}
        description={$i18n.t("modals.field.configure.formula.description", {
          defaultValue: "Compute this field's value from other fields and functions.",
        })}
        vertical
      >
        <FormulaEditor
          expression={formulaExpression}
          fields={formulaFieldNames}
          placeholder={$i18n.t("modals.field.configure.formula.placeholder", {
            defaultValue: 'e.g. ROUND(price * quantity, 2)',
          })}
          on:change={handleFormulaChange}
        />
      </SettingItem>
    {/if}

    <!-- NPLAN-A2 — UniqueId sub-panel -->
    {#if field.type === DataFieldType.UniqueId && !field.identifier}
      <SettingItem
        name={$i18n.t("modals.field.configure.uniqueid.prefix.name", { defaultValue: "ID prefix" })}
        description={$i18n.t("modals.field.configure.uniqueid.prefix.description", { defaultValue: 'Optional prefix for generated IDs (e.g. "TASK-"). Counter is appended automatically.' })}
      >
        <TextInput
          value={uniqueIdPrefixValue}
          placeholder="e.g. TASK-"
          on:input={handleUniqueIdPrefixChange}
        />
      </SettingItem>
    {/if}
  </ModalContent>
  <ModalButtonGroup>
    <Button
      variant="primary"
      disabled={!!fieldNameError}
      on:click={() => {
        // uniquify options items and omit empty
        if (field?.typeConfig && field.typeConfig?.options) {
          const options = field.typeConfig.options;
          field = {
            ...field,
            typeConfig: {
              ...field.typeConfig,
              options: [...new Set(options)].filter((v) => v !== ""),
            },
          };
        }

        onSave(field);
      }}>{$i18n.t("modals.field.configure.save")}</Button
    >
  </ModalButtonGroup>
</ModalLayout>

<style>
  .ppp-rollup-empty {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller, 0.75rem);
  }
  .ppp-status-groups {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 100%;
  }
  .ppp-status-groups-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .ppp-status-groups-label {
    flex: 1;
    font-size: var(--font-ui-small);
    color: var(--text-normal);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ppp-subbase-scope {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 100%;
  }
  .ppp-subbase-scope-input {
    width: 100%;
    font-family: var(--font-monospace, monospace);
    font-size: var(--font-ui-smaller, 0.75rem);
    padding: 0.25rem 0.5rem;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-primary);
    color: var(--text-normal);
    resize: vertical;
  }
  .ppp-subbase-scope-error {
    margin: 0;
    color: var(--text-error);
    font-size: var(--font-ui-smaller, 0.75rem);
  }
</style>
