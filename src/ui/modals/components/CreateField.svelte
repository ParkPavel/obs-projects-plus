<script lang="ts">
  import {
    Button,
    ModalButtonGroup,
    ModalContent,
    ModalLayout,
    Select,
    SettingItem,
    TextInput,
    NumberInput,
    Switch,
    Icon,
  } from "obsidian-svelte";
  import FormulaEditor from "src/ui/components/FormulaEditor/FormulaEditor.svelte";
  import { isEmptyFieldValue } from "src/lib/relations/declaredFieldTypes";
  import { baseRefOptions } from "src/lib/relations/baseRef";
  import {
    FIELD_TYPE_GROUPS,
    ROLLUP_QUICK_FUNCTIONS,
    defaultRollupFunction,
    newRelationFieldName,
    rollupExample,
  } from "./createFieldFlow";
  import { TagsInput } from "src/ui/components/TagsInput";
  import MultiTextInput from "src/ui/components/MultiTextInput/MultiTextInput.svelte";
  import dayjs from "dayjs";
  import { toNumber } from "src/lib/engine/numeric";
  import {
    DataFieldType,
    type Optional,
    type DataField,
    type DataValue,
    type DataFrame,
  } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import {
    aggregationLabel,
    ROLLUP_PICKER_ORDER,
  } from "src/lib/dashboard-engine/aggregationOptions";
  import { settings as settingsStore } from "src/lib/stores/settings";
  import { onMount } from "svelte";
  import DateInput from "src/ui/components/DateInput.svelte";
  import DatetimeInput from "src/ui/components/DatetimeInput.svelte";
  import { dataFieldTypeOptions } from "./dataFieldTypeOptions";
  import type { ProjectDefinition } from "src/settings/settings";
  import type {
    RelationFieldConfig,
    RollupFieldConfig,
  } from "src/settings/base/settings";
  import type { RollupFunction } from "src/lib/engine/aggregate";
  import { isRelationCompanionField } from "src/lib/engine/crossProjectResolver";
  import {
    applyRollupSource,
    rollupFunctionIsPositional,
    rollupSources,
    rollupSourceValue,
  } from "src/lib/rollup/rollupSources";

  export let existingFields: DataField[];
  export let defaultName: string;
  /**
   * Stage A.10 — sibling projects forwarded so the new-field modal can
   * resolve a Relation target inline without forcing the user into a
   * second Configure round-trip. Empty array silently disables the
   * inline picker (degraded but functional).
   */
  export let availableProjects: ProjectDefinition[] = [];
  /** Identifier of the project the new field belongs to. */
  export let currentProjectId: string = "";
  export let onSetupRelation: ((field: DataField) => void) | undefined = undefined;
  /**
   * B5 — reads another project's records, so pickers list its real properties
   * and the rollup shows an example on three of its records. Absent: the
   * pickers fall back to typing a name and no example is shown.
   */
  export let resolveFrame: ((projectId: string) => Promise<DataFrame | null>) | undefined = undefined;
  /**
   * B5 — creates the relation a new rollup reads through, before the rollup
   * itself. `false` (or a throw) stops the create and keeps the draft. Absent:
   * the rollup step offers only relations that already exist.
   */
  export let onCreateRelation: ((field: DataField) => Promise<boolean>) | undefined = undefined;
  let inputRef: HTMLInputElement;

  export let field: DataField = {
    name: defaultName,
    type: DataFieldType.String,
    repeated: false,
    derived: false,
    identifier: false,
  };

  let value: Optional<DataValue> = ""; // text, number and boolean
  let listValue: string = "[]";
  let dateValue: Optional<Date> = new Date();

  /**
   * Resolves to `false` (or throws) when the write did not happen; the form
   * then stays open with the draft so the person can retry. M03 (C03/C13).
   */
  export let onCreate: (
    field: DataField,
    value: Optional<DataValue>
  ) => void | boolean | Promise<void | boolean>;
  /**
   * #144 — number of notes this create will write to. The modal closed on click
   * without ever stating that the write touches every note in the project;
   * Vision scene 2 asks for that sentence, with the count, before the write.
   */
  export let recordCount = 0;

  // Derived / linked types write nothing into frontmatter on creation
  // (`isStageANoDefault` passes null), so the consequence line would be a lie
  // for them.
  // i2-safety: only a real default goes into the notes (ViewApi.addField skips
  // an empty one), so the line below says which of the two happens.
  $: writesToNotes = recordCount > 0 && hasDefault(field, value, listValue, dateValue);

  /** The arguments only make the statement above re-run when they change. */
  function hasDefault(..._deps: unknown[]): boolean {
    return !isEmptyFieldValue(normalizedSubmission()[1]);
  }

  $: fieldNameError = validateFieldName(field.name);

  function safeParseList(json: string): string[] {
    try { return JSON.parse(json); } catch { return []; }
  }

  function validateFieldName(fieldName: string) {
    if (fieldName.trim() === "") {
      return $i18n.t("modals.field.create.empty-name-error");
    }

    if (existingFields.findIndex((field) => field.name === fieldName) !== -1) {
      return $i18n.t("modals.field.create.existing-name-error");
    }

    // The engine puts its resolved-relation columns under this prefix and the
    // product hides them; a property a user names that way would vanish from
    // their own table. The namespace is reserved rather than the hiding made
    // cleverer — a name nobody can see is worse than a name they cannot use.
    if (isRelationCompanionField(fieldName.trim())) {
      return $i18n.t("modals.field.create.reserved-name-error", {
        defaultValue: "Names starting with __resolved__ are reserved for the plugin's own columns.",
      });
    }

    return "";
  }

  type ConversionFn =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- type conversion matrix accepts/returns heterogeneous field types
    (v: any) => any;

  type Conversions = Partial<Record<DataFieldType, Partial<Record<DataFieldType, ConversionFn>>>>;

  const conversions: Conversions = {
    [DataFieldType.String]: {
      [DataFieldType.String]: (v: string) => v,
      [DataFieldType.Number]: (v: number) => v.toString(),
      [DataFieldType.Boolean]: (v: boolean) => v.toString(),
      [DataFieldType.Date]: (v: string) => v.toString(),
      [DataFieldType.List]: (v: Array<string>) => v.toString(),
      [DataFieldType.Unknown]: () => null,
    },
    [DataFieldType.Number]: {
      // #180a — Class A, and the most destructive one: this table CONVERTS
      // stored values when the user retypes a field, so `parseInt` wrote 12
      // back to disk for "12abc" and truncated "1.5" to 1. `toNumber` returns
      // null, which is the same "cannot convert" answer Unknown already gives.
      [DataFieldType.String]: (v: string) => toNumber(v),
      [DataFieldType.Number]: (v: number) => v,
      [DataFieldType.Boolean]: (v: boolean) => (v ? 1 : 0),
      [DataFieldType.Date]: (v: string) => dayjs(v).toDate().getTime(),
      [DataFieldType.List]: (v: Array<string>) => toNumber(v.toString()),
      [DataFieldType.Unknown]: () => null,
    },
    [DataFieldType.Boolean]: {
      [DataFieldType.String]: (v: string) => !!v,
      [DataFieldType.Number]: (v: number) => !!v,
      [DataFieldType.Boolean]: (v: boolean) => v,
      [DataFieldType.Date]: (v: string) => !!v,
      [DataFieldType.List]: (v: Array<string>) => !!v.toString(),
      [DataFieldType.Unknown]: () => null,
    },
    [DataFieldType.Date]: {
      [DataFieldType.String]: (v: string) => dayjs(v).format("YYYY-MM-DD"),
      [DataFieldType.Number]: (v: number) => dayjs(v).format("YYYY-MM-DD"),
      [DataFieldType.Boolean]: () => dayjs().format("YYYY-MM-DD"),
      [DataFieldType.Date]: (v: string) => v,
      [DataFieldType.List]: (v: Array<string>) =>
        dayjs(v.toString()).format("YYYY-MM-DD"),
      [DataFieldType.Unknown]: () => null,
    },
    [DataFieldType.List]: {
      [DataFieldType.String]: (v: string) => [v],
      [DataFieldType.Number]: (v: number) => [v],
      [DataFieldType.Boolean]: (v: boolean) => [v],
      [DataFieldType.Date]: (v: string) => [v],
      [DataFieldType.List]: (v: Array<string>) => v,
      [DataFieldType.Unknown]: () => null,
    },
    [DataFieldType.Unknown]: {
      [DataFieldType.String]: () => null,
      [DataFieldType.Number]: () => null,
      [DataFieldType.Boolean]: () => null,
      [DataFieldType.Date]: () => null,
      [DataFieldType.List]: () => null,
      [DataFieldType.Unknown]: () => null,
    },
  };

  function convert(
    origValue: Optional<DataValue>,
    from: DataFieldType,
    to: DataFieldType
  ) {
    if (origValue === undefined || origValue === null) {
      return null;
    }

    // list and date uses separated values to avoid conversion runs into chaos
    if (
      to === DataFieldType.List ||
      to === DataFieldType.Date ||
      from === DataFieldType.List ||
      from === DataFieldType.Date
    ) {
      return origValue;
    }

    const converter = conversions[to]?.[from];
    return converter ? converter(origValue) : origValue;
  }

  function selectType(to: DataFieldType) {
    const from = field.type;
    if (to !== DataFieldType.Rollup) pendingRelation = null;
    if (to === DataFieldType.List) {
      field = {
        ...field,
        type: to,
        repeated: true,
      };
    } else {
      value = convert(value, from, to);
      field = {
        ...field,
        type: to,
        repeated: false,
      };
    }
  }

  function handleOptionsChange(textOptions: string[]) {
    field = {
      ...field,
      typeConfig: {
        ...field.typeConfig,
        options: textOptions,
      },
    };
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

  // -- Stage A.10 — inline Relation / Rollup config -------------
  // Without these branches a freshly-created Relation/Rollup field is
  // persisted with an empty `typeConfig`, forcing the user into a second
  // Configure round-trip and (for Rollup) writing `""` into every record's
  // frontmatter. Schema-modal already exposes the same primitives — here
  // we mirror the minimum so the new-field flow is one-stop-shop.
  $: relationCfg = (field.typeConfig as { relation?: RelationFieldConfig })
    ?.relation;
  $: rollupCfg = (field.typeConfig as { rollup?: RollupFieldConfig })?.rollup;
  // Fallback to the live `settings` store when the modal was instantiated
  // before settings finished hydrating (or when a caller forgot to forward
  // the prop). Empty `availableProjects` would otherwise leave the Relation
  // target picker silently empty.
  $: effectiveProjects =
    availableProjects.length > 0 ? availableProjects : $settingsStore.projects;
  $: projectOptions = [
    { label: $i18n.t("modals.field.configure.relation.no-project"), value: "" },
    // D19: a project's own sources are bases too («Кабинет · Активные клиенты»).
    ...baseRefOptions(effectiveProjects).map((o) => ({
      label:
        o.value === currentProjectId
          ? `${o.label} ${$i18n.t("modals.field.configure.relation.this-project-suffix")}`
          : o.label,
      value: o.value,
    })),
  ];
  $: relationFieldsOnThisProject = existingFields.filter(
    (f) => f.type === DataFieldType.Relation && !isRelationCompanionField(f.name)
  );
  // 3.6.0 — one picker for where a rollup reads from: this project's
  // relations, then every relation elsewhere that links HERE (a backlink
  // rollup: "visits of this client" without a visits field on the client).
  $: rollupSourceList = rollupSources(
    relationFieldsOnThisProject.map((f) => f.name),
    effectiveProjects,
    currentProjectId
  );

  // B5 — a rollup on a project with no relation yet does not send the person
  // away: every other project is offered as "New relation to …", created
  // together with the rollup on submit.
  const CREATE_PREFIX = "create:";
  let pendingRelation: { name: string; targetProjectId: string; projectName: string } | null = null;
  $: createRelationOptions = onCreateRelation
    ? baseRefOptions(effectiveProjects)
        .filter((o) => o.value !== currentProjectId)
        .map((o) => ({
          label: $i18n.t("modals.field.create.flow.create-relation-option", {
            defaultValue: "New relation to {{project}}",
            project: o.label,
          }),
          value: CREATE_PREFIX + o.value,
        }))
    : [];
  $: rollupRelationOptions = [
    { label: $i18n.t("modals.field.configure.rollup.no-relation"), value: "" },
    ...(pendingRelation
      ? [{ label: pendingRelation.name, value: CREATE_PREFIX + pendingRelation.targetProjectId }]
      : []),
    ...rollupSourceList.map((s) => ({
      label:
        s.kind === "forward"
          ? s.relationField
          : $i18n.t("modals.field.configure.rollup.backlink-option", {
              project: s.projectName,
              field: s.relationField,
            }),
      value: s.value,
    })),
    ...createRelationOptions.filter((o) => o.value !== CREATE_PREFIX + (pendingRelation?.targetProjectId ?? "")),
  ];
  $: rollupPickerValue = pendingRelation
    ? CREATE_PREFIX + pendingRelation.targetProjectId
    : rollupSourceValue(rollupCfg);

  /** The project a rollup aggregates: the backlink's, the new relation's, or the forward relation's target. */
  function rollupTargetProject(cfg: RollupFieldConfig | undefined): string {
    if (!cfg) return "";
    if (cfg.backlink) return cfg.backlink.projectId;
    if (pendingRelation && cfg.relationField === pendingRelation.name) return pendingRelation.targetProjectId;
    const own = effectiveProjects.find((p) => p.id === currentProjectId)?.fieldConfig?.[cfg.relationField]?.relation;
    const declared = (existingFields.find((f) => f.name === cfg.relationField)?.typeConfig as
      | { relation?: RelationFieldConfig }
      | undefined)?.relation;
    return own?.targetProjectId ?? declared?.targetProjectId ?? "";
  }

  // Target project's frame: properties for the pickers, records for the example.
  let targetFrame: DataFrame | null = null;
  let loadedFrameFor = "";
  $: targetProjectId =
    field.type === DataFieldType.Rollup
      ? rollupTargetProject(rollupCfg)
      : field.type === DataFieldType.Relation
        ? relationCfg?.targetProjectId ?? ""
        : "";
  $: void loadTargetFrame(targetProjectId);
  async function loadTargetFrame(projectId: string): Promise<void> {
    if (projectId === loadedFrameFor) return;
    loadedFrameFor = projectId;
    targetFrame = null;
    if (!projectId || !resolveFrame) return;
    try {
      const frame = await resolveFrame(projectId);
      if (loadedFrameFor === projectId) targetFrame = frame ?? null;
    } catch {
      targetFrame = null;
    }
  }
  $: targetFieldOptions = targetFrame
    ? [
        { label: $i18n.t("modals.field.create.flow.choose-property", { defaultValue: "Choose a property…" }), value: "" },
        ...targetFrame.fields
          .filter((f) => !isRelationCompanionField(f.name))
          .map((f) => ({ label: f.name, value: f.name })),
      ]
    : [];
  $: example =
    targetFrame && rollupCfg?.targetField
      ? rollupExample(targetFrame.records, rollupCfg.targetField, rollupCfg.function ?? "count", rollupCfg.separator)
      : null;
  $: exampleText = example
    ? $i18n.t("modals.field.create.flow.example", {
        defaultValue: "Example on {{n}} records: {{values}} → {{result}}",
        n: example.records,
        values: example.values.map((v) => (v === null || v === undefined || v === "" ? "—" : String(v))).join(", "),
        result: example.result.formattedValue || "—",
      })
    : "";

  let functionTouched = false;
  function handleRollupTargetField(name: string) {
    const chosen = targetFrame?.fields.find((f) => f.name === name);
    // The calculation follows the property until the person picks one.
    patchRollup(
      !functionTouched && chosen
        ? { targetField: name, function: defaultRollupFunction(chosen) }
        : { targetField: name }
    );
  }
  // #180d/T5: the default label came from the raw stored name, so this picker
  // showed `count_total` where every other surface showed "Count all".
  $: rollupFunctionOptions = [
    ...ROLLUP_QUICK_FUNCTIONS,
    ...ROLLUP_PICKER_ORDER.filter((fn) => !ROLLUP_QUICK_FUNCTIONS.includes(fn)),
  ].map((fn) => ({
    label: aggregationLabel(fn, (key, defaultValue) => $i18n.t(key, { defaultValue })),
    value: fn,
  }));

  function patchRelation(patch: Partial<RelationFieldConfig>) {
    const current: Partial<RelationFieldConfig> = relationCfg ?? {
      targetProjectId: "",
    };
    const merged: Partial<RelationFieldConfig> = { ...current, ...patch };
    if (!merged.targetProjectId) {
      const { relation: _omit, ...rest } = (field.typeConfig ?? {}) as {
        relation?: RelationFieldConfig;
        [k: string]: unknown;
      };
      void _omit;
      field = { ...field, typeConfig: rest };
      return;
    }
    field = {
      ...field,
      typeConfig: {
        ...field.typeConfig,
        relation: merged as RelationFieldConfig,
      },
    };
  }

  function patchRollup(patch: Partial<RollupFieldConfig>) {
    const current: Partial<RollupFieldConfig> = rollupCfg ?? {
      relationField: "",
      targetField: "",
      function: "count",
    };
    const merged = { ...current, ...patch };
    if (
      patch.function &&
      patch.function !== "concat" &&
      patch.function !== "concat_unique"
    ) {
      delete merged.separator;
    }
    if (!merged.orderBy) delete merged.orderBy;
    field = {
      ...field,
      typeConfig: {
        ...field.typeConfig,
        rollup: merged as RollupFieldConfig,
      },
    };
  }

  function handleDisplayFieldChange(e: CustomEvent<string>) {
    const v = e.detail;
    if (v) {
      patchRelation({ displayField: v });
    } else if (relationCfg?.targetProjectId) {
      // Strip displayField when cleared so exactOptionalPropertyTypes stays
      // satisfied and downstream resolver falls back to file basename.
      const { displayField: _omit, ...rest } = relationCfg;
      void _omit;
      field = {
        ...field,
        typeConfig: {
          ...field.typeConfig,
          relation: rest,
        },
      };
    }
  }

  function handleRollupSourceChange(e: CustomEvent<string>) {
    if (e.detail.startsWith(CREATE_PREFIX)) {
      const projectId = e.detail.slice(CREATE_PREFIX.length);
      const target = baseRefOptions(effectiveProjects).find((o) => o.value === projectId);
      if (!target) return;
      const name = newRelationFieldName(target.label, [...existingFields.map((f) => f.name), field.name]);
      pendingRelation = { name, targetProjectId: projectId, projectName: target.label };
      const base: RollupFieldConfig = rollupCfg ?? { relationField: "", targetField: "", function: "count" };
      const { backlink: _b, ...rest } = base;
      void _b;
      field = { ...field, typeConfig: { ...field.typeConfig, rollup: { ...rest, relationField: name } } };
      return;
    }
    pendingRelation = null;
    const next = applyRollupSource(rollupCfg, e.detail);
    if (!next) {
      const { rollup: _omit, ...rest } = (field.typeConfig ?? {}) as {
        rollup?: RollupFieldConfig;
        [k: string]: unknown;
      };
      void _omit;
      field = { ...field, typeConfig: rest };
      return;
    }
    field = { ...field, typeConfig: { ...field.typeConfig, rollup: next } };
  }

  function handleRollupFunctionChange(e: CustomEvent<string>) {
    functionTouched = true;
    patchRollup({ function: e.detail as RollupFunction });
  }

  /**
   * M03 (C16): the one submission both Enter and the Create button go through.
   * Enter used to hand the raw draft to the writer, so a derived type wrote an
   * empty literal into every note and a date was not formatted.
   */
  function normalizedSubmission(): [DataField, Optional<DataValue>] {
    if (field.repeated) {
      return [{ ...field, type: DataFieldType.String }, safeParseList(listValue)];
    }
    if (isStageANoDefault(field.type)) {
      // Stage A.10 — derived / pickable types do not own a literal
      // default. Passing null prevents `dataApi.addField` from writing
      // an empty string into every record's frontmatter on creation.
      return [field, null];
    }
    if (field.type === DataFieldType.Date) {
      // If no date(time) value specified still add today's date / current time
      return [
        field,
        dayjs(dateValue ?? "").format(field.typeConfig?.time ? "YYYY-MM-DDTHH:mm" : "YYYY-MM-DD"),
      ];
    }
    if (
      (field.type === DataFieldType.String ||
        field.type === DataFieldType.Select ||
        field.type === DataFieldType.Status) &&
      field.typeConfig?.options
    ) {
      // uniquify options items and omit empty
      const options = [...new Set(field.typeConfig.options)].filter((v) => v !== "");
      return [{ ...field, typeConfig: { ...field.typeConfig, options } }, value];
    }
    return [field, value];
  }

  // The form stays open until the write answers: a failure keeps the draft
  // and says so here, instead of a Notice behind an already closed modal.
  let pending = false;
  let submitError = "";

  async function submit(): Promise<void> {
    if (pending || fieldNameError) return;
    pending = true;
    submitError = "";
    const [submittedField, submittedValue] = normalizedSubmission();
    try {
      if (pendingRelation && submittedField.type === DataFieldType.Rollup && onCreateRelation) {
        if (!(await createPendingRelation(onCreateRelation, pendingRelation))) return;
      }
      const outcome = await onCreate(submittedField, submittedValue);
      if (outcome === false) submitError = createFailedText();
    } catch {
      submitError = createFailedText();
    } finally {
      pending = false;
    }
  }

  async function createPendingRelation(
    create: (field: DataField) => Promise<boolean>,
    pending: { name: string; targetProjectId: string }
  ): Promise<boolean> {
    const relation: DataField = {
      name: pending.name,
      type: DataFieldType.Relation,
      repeated: true,
      identifier: false,
      derived: false,
      typeConfig: { relation: { targetProjectId: pending.targetProjectId } },
    };
    let made = false;
    try {
      made = await create(relation);
    } catch {
      made = false;
    }
    if (!made) {
      submitError = $i18n.t("modals.field.create.flow.relation-failed", {
        defaultValue: "The relation was not created, so the property was not added. Try again.",
      });
      return false;
    }
    // Created: from now on it is an ordinary relation of this project, so a
    // retry after a failed rollup write does not create it twice.
    existingFields = [...existingFields, relation];
    pendingRelation = null;
    return true;
  }

  function createFailedText(): string {
    return $i18n.t("modals.field.create.write-failed", {
      defaultValue: "The field was not added to every note. Your entries are kept — try again.",
    });
  }

  function isStageANoDefault(t: DataFieldType): boolean {
    return (
      t === DataFieldType.Formula ||
      t === DataFieldType.Relation ||
      t === DataFieldType.Rollup
    );
  }

  // The grouped picker below shows every type the registry lists.
  const typeCount = dataFieldTypeOptions((key) => key).length;
  void typeCount;

  $: formulaFieldNames = existingFields.map((f) => f.name);
  function handleFormulaChange(ev: CustomEvent<string>) {
    const expr = ev.detail;
    const { formula: _f, ...rest } = (field.typeConfig ?? {}) as { formula?: string } & Record<string, unknown>;
    void _f;
    field = { ...field, typeConfig: expr ? { ...rest, formula: expr } : rest };
  }

  onMount(() => {
    if (inputRef) inputRef.select();
  });
</script>

<ModalLayout title={$i18n.t("modals.field.create.title")}>
  <ModalContent>
    <SettingItem
      name={$i18n.t("modals.field.create.name.name")}
      description={$i18n.t("modals.field.create.name.description") ?? ""}
    >
      <TextInput
        bind:ref={inputRef}
        value={field.name}
        on:input={(event) => (field = { ...field, name: event.detail })}
        autoFocus
        error={!!fieldNameError}
        helperText={fieldNameError}
        on:keydown={(ev) => {
          if (ev.key === "Enter" && !fieldNameError) {
            ev.preventDefault();
            void submit();
          }
        }}
      />
    </SettingItem>

    <!-- B5 — types as in Notion: two groups of icon tiles, one tap each. -->
    <div class="ppp-create-field-types">
      {#each FIELD_TYPE_GROUPS as group (group.id)}
        <div class="ppp-create-field-type-group" role="radiogroup" aria-label={group.id === "basic"
            ? $i18n.t("modals.field.create.flow.group-basic", { defaultValue: "Basic" })
            : $i18n.t("modals.field.create.flow.group-linked", { defaultValue: "Relations and computations" })}>
          <div class="ppp-create-field-type-group-title">
            {group.id === "basic"
              ? $i18n.t("modals.field.create.flow.group-basic", { defaultValue: "Basic" })
              : $i18n.t("modals.field.create.flow.group-linked", { defaultValue: "Relations and computations" })}
          </div>
          <div class="ppp-create-field-type-grid">
            {#each group.types as choice (choice.value)}
              <button
                type="button"
                role="radio"
                aria-checked={field.type === choice.value}
                class="ppp-create-field-type"
                class:is-active={field.type === choice.value}
                data-type={choice.value}
                on:click={() => selectType(choice.value)}
              >
                <Icon name={choice.icon} />
                <span>{$i18n.t(choice.labelKey)}</span>
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
    {#if field.type === DataFieldType.Formula}
      <SettingItem
        name={$i18n.t("modals.field.create.flow.formula-name", { defaultValue: "Formula" })}
        description={$i18n.t("modals.field.create.flow.formula-description", {
          defaultValue: "Type a field or function name — hints appear as you type.",
        })}
        vertical
      >
        <FormulaEditor
          expression={(field.typeConfig?.formula ?? "")}
          fields={formulaFieldNames}
          rows={3}
          on:change={handleFormulaChange}
        />
      </SettingItem>
    {/if}

    <SettingItem
      name={$i18n.t("modals.field.create.default.name")}
      description={$i18n.t("modals.field.create.default.description")}
    >
      {#if isStageANoDefault(field.type)}
        <span class="ppp-create-field-stagea-note">
          {$i18n.t("modals.field.create.no-default-stage-a")}
        </span>
      {:else if field.type === DataFieldType.List}
        <TagsInput
          value={safeParseList(listValue)}
          on:change={(event) => {
            listValue = event.detail;
          }}
        />
      {:else if field.type === DataFieldType.String}
        <TextInput
          value={value?.toString() ?? ""}
          on:input={(event) => (value = event.detail)}
          on:keydown={(ev) => {
            if (ev.key === "Enter" && !fieldNameError) {
              ev.preventDefault();
              void submit();
            }
          }}
        />
      {:else if field.type === DataFieldType.Number}
        <NumberInput
          bind:ref={inputRef}
          value={toNumber(value)}
          on:input={(event) => (value = event.detail)}
          on:keydown={(ev) => {
            if (ev.key === "Enter" && !fieldNameError) {
              ev.preventDefault();
              void submit();
            }
          }}
        />
      {:else if field.type === DataFieldType.Date}
        {#if field.typeConfig?.time}
          <DatetimeInput
            value={dateValue ?? new Date()}
            on:input={({ detail: value }) => {
              dateValue = value;
            }}
          />
        {:else}
          <DateInput
            value={dateValue ?? new Date()}
            on:input={({ detail: value }) => {
              dateValue = value;
            }}
          />
        {/if}
      {:else if field.type === DataFieldType.Boolean}
        <Switch
          checked={value ? true : false}
          on:check={(ev) => {
            value = ev.detail;
          }}
        />
      {/if}
    </SettingItem>
    {#if !field.repeated && (field.type === DataFieldType.String || field.type === DataFieldType.Select || field.type === DataFieldType.Status)}
      <SettingItem
        name={$i18n.t("modals.field.create.options.name")}
        description={$i18n.t("modals.field.create.options.description")}
        vertical
      >
        <MultiTextInput
          options={field.typeConfig?.options ?? []}
          onChange={handleOptionsChange}
        />
      </SettingItem>
      {#if field.type === DataFieldType.String}
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
    {/if}
    {#if !field.repeated && field.type === DataFieldType.Date}
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
    {#if field.type === DataFieldType.Relation}
      <SettingItem
        name={$i18n.t("modals.field.configure.relation.target-project.name")}
        description={$i18n.t(
          "modals.field.configure.relation.target-project.description"
        )}
      >
        <Select
          value={relationCfg?.targetProjectId ?? ""}
          options={projectOptions}
          on:change={(e) => patchRelation({ targetProjectId: e.detail })}
        />
      </SettingItem>
      {#if relationCfg?.targetProjectId}
        <SettingItem
          name={$i18n.t("modals.field.configure.relation.display-field.name")}
          description={$i18n.t(
            "modals.field.configure.relation.display-field.description"
          )}
        >
          {#if targetFieldOptions.length > 0}
            <Select
              value={relationCfg?.displayField ?? ""}
              options={targetFieldOptions}
              on:change={handleDisplayFieldChange}
            />
          {:else}
            <TextInput
              value={relationCfg?.displayField ?? ""}
              placeholder={$i18n.t(
                "modals.field.configure.relation.display-field.placeholder"
              )}
              on:input={handleDisplayFieldChange}
            />
          {/if}
        </SettingItem>
      {/if}
      {#if onSetupRelation}
        <div class="ppp-setup-relation-cta">
          <button type="button" class="mod-cta" on:click={() => onSetupRelation?.(field)}>
            {$i18n.t("relation-setup.open", { defaultValue: "Link database…" })}
          </button>
        </div>
      {/if}
    {/if}
    {#if field.type === DataFieldType.Rollup}
      {#if rollupSourceList.length === 0 && createRelationOptions.length === 0}
        <p class="ppp-create-field-stagea-note">
          {$i18n.t("modals.field.configure.rollup.no-relations-warning")}
        </p>
      {:else}
        <SettingItem
          name={$i18n.t("modals.field.configure.rollup.relation-field.name")}
          description={$i18n.t(
            "modals.field.configure.rollup.relation-field.description"
          )}
        >
          <Select
            value={rollupPickerValue}
            options={rollupRelationOptions}
            on:change={handleRollupSourceChange}
          />
        </SettingItem>
        {#if pendingRelation}
          <p class="ppp-create-field-stagea-note" data-testid="pending-relation">
            {$i18n.t("modals.field.create.flow.new-relation-note", {
              defaultValue: "Also creates the relation '{{name}}' to {{project}}.",
              name: pendingRelation.name,
              project: pendingRelation.projectName,
            })}
          </p>
        {/if}
        {#if rollupCfg?.relationField || rollupCfg?.backlink}
          <SettingItem
            name={$i18n.t("modals.field.configure.rollup.target-field.name")}
            description={$i18n.t(
              "modals.field.configure.rollup.target-field.description"
            )}
          >
            {#if targetFieldOptions.length > 0}
              <Select
                value={rollupCfg?.targetField ?? ""}
                options={targetFieldOptions}
                on:change={(e) => handleRollupTargetField(e.detail)}
              />
            {:else}
              <TextInput
                value={rollupCfg?.targetField ?? ""}
                placeholder={$i18n.t(
                  "modals.field.configure.rollup.target-field.placeholder"
                )}
                on:input={(e) => patchRollup({ targetField: e.detail })}
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
          {#if exampleText}
            <p class="ppp-create-field-example" role="status" data-testid="rollup-example" data-result={example?.result.formattedValue ?? ""}>{exampleText}</p>
          {:else if targetFrame && targetFrame.records.length === 0}
            <p class="ppp-create-field-stagea-note">
              {$i18n.t("modals.field.create.flow.example-empty", {
                defaultValue: "The linked project has no records yet — the example appears once it does.",
              })}
            </p>
          {/if}
          {#if rollupFunctionIsPositional(rollupCfg?.function)}
            <SettingItem
              name={$i18n.t("modals.field.configure.rollup.order-by.name")}
              description={$i18n.t("modals.field.configure.rollup.order-by.description")}
            >
              <TextInput
                value={rollupCfg?.orderBy ?? ""}
                placeholder={$i18n.t("modals.field.configure.rollup.order-by.placeholder")}
                on:input={(e) => patchRollup({ orderBy: e.detail })}
              />
            </SettingItem>
          {/if}
          {#if rollupCfg?.function === "concat" || rollupCfg?.function === "concat_unique"}
            <SettingItem
              name={$i18n.t("modals.field.configure.rollup.separator.name")}
              description={$i18n.t(
                "modals.field.configure.rollup.separator.description"
              )}
            >
              <TextInput
                value={rollupCfg?.separator ?? ", "}
                on:input={(e) => patchRollup({ separator: e.detail })}
              />
            </SettingItem>
          {/if}
        {/if}
      {/if}
    {/if}
  </ModalContent>
  <ModalButtonGroup>
    {#if writesToNotes}
      <p class="ppp-create-field-consequence" role="status">
        {$i18n.t("modals.field.create.bulk-write-notice", {
          defaultValue: "Writes the default value of '{{field}}' to {{count}} notes of the base.",
          field: field.name,
          count: recordCount,
        })}
      </p>
    {:else}
      <p class="ppp-create-field-consequence" role="status">
        {$i18n.t("modals.field.create.declared-notice", {
          defaultValue: "'{{field}}' is added to the base. Notes are not changed until you fill in a value.",
          field: field.name,
        })}
      </p>
    {/if}
    {#if submitError}
      <p class="ppp-create-field-error" role="alert">{submitError}</p>
    {/if}
    <Button
      variant={"primary"}
      disabled={!!fieldNameError || pending}
      on:click={() => void submit()}
    >
      {$i18n.t("modals.field.create.create")}
    </Button>
  </ModalButtonGroup>
</ModalLayout>

<style>
  .ppp-create-field-consequence {
    margin: 0 var(--size-4-2) 0 0;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    line-height: var(--line-height-tight);
    flex: 1;
  }

  .ppp-create-field-stagea-note {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller, 0.75rem);
    line-height: 1.4;
  }
  .ppp-create-field-types {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-2);
    padding: var(--size-4-2) 0;
  }
  .ppp-create-field-type-group-title {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    margin-bottom: var(--size-4-1);
  }
  .ppp-create-field-type-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(8em, 1fr));
    gap: var(--size-4-1);
  }
  .ppp-create-field-type {
    display: flex;
    align-items: center;
    gap: var(--size-4-2);
    justify-content: flex-start;
    min-width: 0;
  }
  .ppp-create-field-type span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ppp-create-field-type.is-active {
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
  }
  .ppp-create-field-example {
    margin: 0;
    color: var(--text-normal);
    font-size: var(--font-ui-smaller);
    font-variant-numeric: tabular-nums;
  }
  .ppp-setup-relation-cta {
    display: flex;
    justify-content: flex-end;
  }
</style>
