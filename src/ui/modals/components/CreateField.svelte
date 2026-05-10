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
    // DateInput,
    // DatetimeInput,
    Switch,
  } from "obsidian-svelte";
  import { TagsInput } from "src/ui/components/TagsInput";
  import MultiTextInput from "src/ui/components/MultiTextInput/MultiTextInput.svelte";
  import dayjs from "dayjs";
  import {
    DataFieldType,
    type Optional,
    type DataField,
    type DataValue,
  } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
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

  export let existingFields: DataField[];
  export let defaultName: string;
  /**
   * Stage A.10 � sibling projects forwarded so the new-field modal can
   * resolve a Relation target inline without forcing the user into a
   * second Configure round-trip. Empty array silently disables the
   * inline picker (degraded but functional).
   */
  export let availableProjects: ProjectDefinition[] = [];
  /** Identifier of the project the new field belongs to. */
  export let currentProjectId: string = "";
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

  export let onCreate: (field: DataField, value: Optional<DataValue>) => void;

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
      [DataFieldType.String]: (v: string) => parseInt(v),
      [DataFieldType.Number]: (v: number) => v,
      [DataFieldType.Boolean]: (v: boolean) => (v ? 1 : 0),
      [DataFieldType.Date]: (v: string) => dayjs(v).toDate().getTime(),
      [DataFieldType.List]: (v: Array<string>) => parseInt(v.toString()),
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

  function handleTypeChange(event: CustomEvent<string>) {
    const from = field.type;
    const to = event.detail as DataFieldType;
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

  function handleTimeChange({ detail: time }: CustomEvent<boolean>) {
    field = {
      ...field,
      typeConfig: {
        ...field.typeConfig,
        time,
      },
    };
  }

  // -- Stage A.10 � inline Relation / Rollup config -------------
  // Without these branches a freshly-created Relation/Rollup field is
  // persisted with an empty `typeConfig`, forcing the user into a second
  // Configure round-trip and (for Rollup) writing `""` into every record's
  // frontmatter. Schema-modal already exposes the same primitives � here
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
    ...effectiveProjects.map((p) => ({
      label:
        p.id === currentProjectId
          ? `${p.name} ${$i18n.t("modals.field.configure.relation.this-project-suffix")}`
          : p.name,
      value: p.id,
    })),
  ];
  $: relationFieldsOnThisProject = existingFields.filter(
    (f) => f.type === DataFieldType.Relation
  );
  $: rollupRelationOptions = [
    { label: $i18n.t("modals.field.configure.rollup.no-relation"), value: "" },
    ...relationFieldsOnThisProject.map((f) => ({ label: f.name, value: f.name })),
  ];
  const ROLLUP_FUNCTIONS: RollupFunction[] = [
    "count",
    "count_values",
    "count_unique",
    "sum",
    "avg",
    "min",
    "max",
    "median",
    "range",
    "percent_true",
    "concat",
    "concat_unique",
  ];
  $: rollupFunctionOptions = ROLLUP_FUNCTIONS.map((fn) => ({
    label: $i18n.t(`modals.field.configure.rollup.functions.${fn}`, {
      defaultValue: fn,
    }),
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

  function handleRollupFunctionChange(e: CustomEvent<string>) {
    patchRollup({ function: e.detail as RollupFunction });
  }

  function isStageANoDefault(t: DataFieldType): boolean {
    return (
      t === DataFieldType.Formula ||
      t === DataFieldType.Relation ||
      t === DataFieldType.Rollup
    );
  }

  const options = dataFieldTypeOptions((key) => $i18n.t(key));

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
            onCreate(field, value);
          }
        }}
      />
    </SettingItem>

    <SettingItem
      name={$i18n.t("modals.field.create.type.name")}
      description={$i18n.t("modals.field.create.type.description")}
    >
      <Select value={field.type} {options} on:change={handleTypeChange} />
    </SettingItem>

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
              onCreate(field, value);
            }
          }}
        />
      {:else if field.type === DataFieldType.Number}
        <NumberInput
          bind:ref={inputRef}
          value={parseInt((value ?? "").toString())}
          on:input={(event) => (value = event.detail)}
          on:keydown={(ev) => {
            if (ev.key === "Enter" && !fieldNameError) {
              ev.preventDefault();
              onCreate(field, value);
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
          <TextInput
            value={relationCfg?.displayField ?? ""}
            placeholder={$i18n.t(
              "modals.field.configure.relation.display-field.placeholder"
            )}
            on:input={handleDisplayFieldChange}
          />
        </SettingItem>
      {/if}
    {/if}
    {#if field.type === DataFieldType.Rollup}
      {#if relationFieldsOnThisProject.length === 0}
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
            value={rollupCfg?.relationField ?? ""}
            options={rollupRelationOptions}
            on:change={(e) => patchRollup({ relationField: e.detail })}
          />
        </SettingItem>
        {#if rollupCfg?.relationField}
          <SettingItem
            name={$i18n.t("modals.field.configure.rollup.target-field.name")}
            description={$i18n.t(
              "modals.field.configure.rollup.target-field.description"
            )}
          >
            <TextInput
              value={rollupCfg?.targetField ?? ""}
              placeholder={$i18n.t(
                "modals.field.configure.rollup.target-field.placeholder"
              )}
              on:input={(e) => patchRollup({ targetField: e.detail })}
            />
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
                on:input={(e) => patchRollup({ separator: e.detail })}
              />
            </SettingItem>
          {/if}
        {/if}
      {/if}
    {/if}
  </ModalContent>
  <ModalButtonGroup>
    <Button
      variant={"primary"}
      disabled={!!fieldNameError}
      on:click={() => {
        if (field.repeated) {
          onCreate(
            { ...field, type: DataFieldType.String },
            safeParseList(listValue)
          );
        } else if (isStageANoDefault(field.type)) {
          // Stage A.10 � derived / pickable types do not own a literal
          // default. Passing null prevents `dataApi.addField` from writing
          // an empty string into every record's frontmatter on creation.
          onCreate(field, null);
        } else if (field.type === DataFieldType.Date) {
          onCreate(
            field,
            // If no date(time) value specified still add today's date / current time
            dayjs(dateValue ?? "").format(
              field.typeConfig?.time ? "YYYY-MM-DDTHH:mm" : "YYYY-MM-DD"
            )
          );
        } else if (
          field.type === DataFieldType.String ||
          field.type === DataFieldType.Select ||
          field.type === DataFieldType.Status
        ) {
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
          onCreate(field, value);
        } else {
          onCreate(field, value);
        }
      }}
    >
      {$i18n.t("modals.field.create.create")}
    </Button>
  </ModalButtonGroup>
</ModalLayout>

<style>
  .ppp-create-field-stagea-note {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller, 0.75rem);
    line-height: 1.4;
  }
</style>
