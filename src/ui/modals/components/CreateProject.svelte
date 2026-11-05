<script lang="ts">
  import dayjs from "dayjs";
  import { v4 as uuidv4 } from "uuid";
  import {
    Button,
    Callout,
    Icon,
    ModalButtonGroup,
    ModalContent,
    ModalLayout,
    SettingItem,
    Switch,
    Typography,
  } from "obsidian-svelte";

  import { FileListInput } from "src/ui/components/FileListInput";
  import ValueSuggestField from "src/ui/components/fields/ValueSuggestField.svelte";
  import TextField from "src/ui/components/fields/TextField.svelte";
  import SelectField from "src/ui/components/fields/SelectField.svelte";
  import NumberField from "src/ui/components/fields/NumberField.svelte";
  import PathSuggestField from "src/ui/components/fields/PathSuggestField.svelte";
  import { vaultPathSource } from "src/lib/suggestions/vaultPaths";
  import { ProjectRows } from "./projectRows";
  import { Accordion, AccordionItem } from "src/ui/components/Accordion";
  import DateFormatSelector from "./DateFormatSelector.svelte";
  import { notEmpty } from "src/lib/helpers";
  import { isValidPath } from "src/lib/obsidian";
  import { capabilities } from "src/lib/stores/capabilities";
  import { i18n } from "src/lib/stores/i18n";
  import { app } from "src/lib/stores/obsidian";
  import { settings } from "src/lib/stores/settings";
  import { interpolateTemplate } from "src/lib/templates/interpolate";
  import { agendaEmoji } from "src/ui/views/Calendar/agenda/agendaEmoji";
  import { getAPI, isPluginEnabled } from "src/lib/datasources/dataview/host";
  import type { ProjectDefinition } from "src/settings/settings";
  import type {
    AgendaCustomList,
    DataSource,
    NativeQueryDataSource,
  } from "src/settings/v3/settings";
  import {
    getFilterOperatorType,
    type FilterCondition,
    type FilterOperator,
  } from "src/settings/base/settings";

  export let title: string;
  export let cta: string;
  export let onSave: (project: ProjectDefinition) => void;
  export let project: ProjectDefinition;

  let originalName = project.name;
  let projectOwner = project.id;
  let formEl: HTMLDivElement;
  let limitField: NumberField | undefined;
  let folderField: PathSuggestField | undefined;
  let newNotesFolderField: PathSuggestField | undefined;
  let templateFields: FileListInput | undefined;
  let excludedFields: FileListInput | undefined;
  let queryField: TextField | undefined;
  let dateFormatField: DateFormatSelector | undefined;
  let queryBaseline = "";
  let additionalPathFields: Record<string, PathSuggestField | null | undefined> = {};
  const sourceRows = new ProjectRows<DataSourceConfig>();
  const conditionRows = new ProjectRows<FilterCondition>();
  $: additionalRows = sourceRows.sync(project.id, project.additionalSources ?? []);
  $: conditionEntries = conditionRows.sync(project.id, project.dataSource.kind === "native-query" ? project.dataSource.config.where?.conditions ?? [] : []);
  const composing = new Set<Node>();
  $: if (project.id !== projectOwner) {
    projectOwner = project.id;
    originalName = project.name;
    composing.clear();
  }
  $: pathSource = vaultPathSource($app);

  function trackComposition(event: CompositionEvent, active: boolean) {
    const target = event.target as Node | null;
    if (!target) return;
    if (active) composing.add(target); else composing.delete(target);
  }

  function submit() {
    for (const target of composing) {
      if (!target.isConnected || !formEl?.contains(target)) composing.delete(target);
    }
    if (composing.size || nameError) return;
    if (project.dataSource.kind === "native-query" && !limitField?.commitForNavigation()) return;
    if ([folderField, newNotesFolderField, templateFields, excludedFields, queryField, dateFormatField, ...Object.values(additionalPathFields)].some(field => field && !field.commitForNavigation())) return;
    onSave({ ...project, templates: project.templates?.filter(notEmpty) ?? [] });
  }

  $: projects = $settings.projects;

  $: defaultName = interpolateTemplate(project.defaultName ?? "", {
    date: (format) => dayjs().format(format || "YYYY-MM-DD"),
    time: (format) => dayjs().format(format || "HH:mm"),
  });

  $: ({ name } = project);
  $: nameError = validateName(name, originalName, projects);

  const dataSourceOptions = [
    { label: $i18n.t("datasources.folder"), value: "folder" },
    { label: $i18n.t("datasources.tag"), value: "tag" },
  ];

  if ($capabilities.dataview) {
    dataSourceOptions.push({
      label: $i18n.t("datasources.dataview"),
      value: "dataview",
    });
  }

  // Primary datasource select also offers native-query (#048). Additional
  // sources keep the folder/tag/dataview trio — the merge path doesn't
  // support nested query sources.
  const primaryDataSourceOptions = [
    ...dataSourceOptions,
    { label: $i18n.t("datasources.native-query"), value: "native-query" },
  ];

  /**
   * Replace the primary source, KEEPING its identity (#184).
   *
   * The primary source had no `id` at all, which made it the one source of a
   * project a block could never be pointed at: `projectSourceOptions` can only
   * offer what a config can name. It also made every project report "some
   * sources cannot be picked", including brand-new ones where that was untrue.
   *
   * The id survives a change of kind for the same reason it does for the
   * additional sources: a block pointing here means "this project's primary
   * source", and swapping a folder for a tag has not made it a different one.
   */
  function setPrimarySource(next: DataSource) {
    const previous = project.dataSource as { id?: string; name?: string } | undefined;
    project = {
      ...project,
      dataSource: {
        ...next,
        id: previous?.id ?? uuidv4(),
        ...(previous?.name ? { name: previous.name } : {}),
      } as DataSource,
    };
  }

  /**
   * Edit the primary source's CONFIG without losing what identifies it.
   *
   * Every one of these used to rebuild `{ kind, config }` from scratch, so
   * typing a path or toggling "include subfolders" silently dropped the `id`
   * — and with it the ability of any block to point at this source. The vault
   * run on 2026-09-04 caught it: a project created and configured through this
   * modal reached `data.json` with no id at all, and its picker was empty.
   *
   * Minting an id when there is none is deliberate: a project stored before
   * #170 becomes addressable the first time its source is touched, without a
   * migration that rewrites vaults nobody asked us to touch.
   */
  function patchPrimaryConfig(config: Record<string, unknown>) {
    const current = project.dataSource as DataSource & { id?: string };
    project = {
      ...project,
      dataSource: {
        ...current,
        id: current.id ?? uuidv4(),
        config: { ...current.config, ...config },
      } as DataSource,
    };
  }

  function handleDataSourceChange({ detail: value }: CustomEvent<string>) {
    switch (value) {
      case "folder":
        setPrimarySource({ kind: "folder", config: { path: "", recursive: false } });
        break;
      case "tag":
        setPrimarySource({ kind: "tag", config: { tag: "", hierarchy: false } });
        break;
      case "dataview":
        setPrimarySource({ kind: "dataview", config: { query: "" } });
        break;
      case "native-query":
        setPrimarySource({
          kind: "native-query",
          config: {
            from: { kind: "folder", path: "", recursive: false },
            where: { conjunction: "and", conditions: [] },
          },
        });
        break;
    }
  }

  // ── native-query config helpers (#048) ─────────────────────
  type NativeQueryConfig = NativeQueryDataSource["config"];

  const NQ_OPERATORS: FilterOperator[] = [
    "is",
    "is-not",
    "contains",
    "not-contains",
    "starts-with",
    "ends-with",
    "is-empty",
    "is-not-empty",
    "eq",
    "neq",
    "lt",
    "gt",
    "lte",
    "gte",
    "is-checked",
    "is-not-checked",
  ];

  $: nqOperatorOptions = NQ_OPERATORS.map((op) => ({
    label: $i18n.t(`modals.project.native-query.operators.${op}`),
    value: op,
  }));

  function nqSetConfig(config: NativeQueryConfig) {
    const current = project.dataSource as DataSource & { id?: string };
    project = {
      ...project,
      dataSource: { ...current, kind: "native-query", id: current.id ?? uuidv4(), config } as DataSource,
    };
  }

  function nqSetFromKind(kind: string) {
    if (project.dataSource.kind !== "native-query") return;
    const config = project.dataSource.config;
    nqSetConfig({
      ...config,
      from:
        kind === "tag"
          ? { kind: "tag", tag: "", hierarchy: false }
          : { kind: "folder", path: "", recursive: false },
    });
  }

  function nqUpdateFrom(patch: Record<string, unknown>) {
    if (project.dataSource.kind !== "native-query") return;
    const config = project.dataSource.config;
    nqSetConfig({
      ...config,
      from: { ...config.from, ...patch } as NativeQueryConfig["from"],
    });
  }

  function nqSetConditions(conditions: FilterCondition[]) {
    if (project.dataSource.kind !== "native-query") return;
    const config = project.dataSource.config;
    nqSetConfig({
      ...config,
      where: {
        conjunction: config.where?.conjunction ?? "and",
        conditions,
      },
    });
  }

  function nqAddCondition() {
    if (project.dataSource.kind !== "native-query") return;
    const conditions = project.dataSource.config.where?.conditions ?? [];
    nqSetConditions([
      ...conditions,
      { field: "", operator: "is", enabled: true },
    ]);
  }

  function nqUpdateCondition(rowId: number, patch: Partial<FilterCondition>) {
    if (project.dataSource.kind !== "native-query") return;
    const conditions = [
      ...(project.dataSource.config.where?.conditions ?? []),
    ];
    const index = conditionRows.index(project.id, conditions, rowId);
    const current = conditions[index];
    if (!current) return;
    const next = { ...current, ...patch };
    if (getFilterOperatorType(next.operator) === "unary") {
      delete next.value;
    }
    conditions[index] = next;
    conditionRows.replace(rowId, next);
    nqSetConditions(conditions);
  }

  function nqSetConditionOperator(rowId: number, op: string) {
    if ((NQ_OPERATORS as string[]).includes(op)) {
      nqUpdateCondition(rowId, { operator: op as FilterOperator });
    }
  }

  function nqRemoveCondition(rowId: number) {
    if (project.dataSource.kind !== "native-query") return;
    const conditions = [
      ...(project.dataSource.config.where?.conditions ?? []),
    ];
    const index = conditionRows.index(project.id, conditions, rowId);
    if (index < 0) return;
    conditions.splice(index, 1);
    nqSetConditions(conditions);
  }

  function nqSetLimit(parsed: number | null) {
    if (project.dataSource.kind !== "native-query") return;
    const config = project.dataSource.config;
    if (parsed !== null && parsed > 0) {
      nqSetConfig({ ...config, limit: parsed });
    } else {
      const { limit, ...rest } = config;
      nqSetConfig(rest);
    }
  }

  function validateName(name: string, baseline: string, available: readonly ProjectDefinition[]) {
    if (name.trim() === "") {
      return $i18n.t("modals.project.create.empty-name-error");
    }

    if (name === baseline) {
      return "";
    }

    if (available.find((project) => project.name === name)) {
      return $i18n.t("modals.project.create.existing-name-error");
    }

    return "";
  }
  
  // ── Dataview query validation ──────────────────────────────
  let dvPreviewStatus: "idle" | "loading" | "success" | "error" = "idle";
  let dvPreviewMessage = "";
  let dvPreviewTimer: number | undefined;
  let previewVersion = 0, alive = true;
  let previewContext = {id: project.id, kind: project.dataSource.kind, query: project.dataSource.kind === "dataview" ? project.dataSource.config.query ?? "" : "", owner: $app};
  $: syncPreviewContext(project.id, project.dataSource.kind, project.dataSource.kind === "dataview" ? project.dataSource.config.query ?? "" : "", $app);

  function syncPreviewContext(id: string, kind: DataSource["kind"], query: string, owner: typeof previewContext.owner) {
    if (previewContext.id === id && previewContext.kind === kind && previewContext.query === query && previewContext.owner === owner) return;
    previewContext = {id, kind, query, owner};
    window.clearTimeout(dvPreviewTimer); previewVersion++;
    dvPreviewStatus = "idle"; dvPreviewMessage = "";
  }

  function validateDataviewQuery(query: string) {
    syncPreviewContext(project.id, project.dataSource.kind, query, $app);
    window.clearTimeout(dvPreviewTimer);
    const version = ++previewVersion, context = previewContext;
    if (!query.trim()) {
      dvPreviewStatus = "idle";
      dvPreviewMessage = "";
      return;
    }
    dvPreviewStatus = "loading";
    dvPreviewMessage = $i18n.t("modals.project.dataview.validating");
    dvPreviewTimer = window.setTimeout(() => runDataviewPreview(query, version, context), 600);
  }

  async function runDataviewPreview(query: string, version: number, context: typeof previewContext) {
    const current = () => alive && version === previewVersion && project.id === context.id && $app === context.owner && project.dataSource.kind === "dataview" && project.dataSource.config.query === query;
    if (!current()) return;
    try {
      if (!isPluginEnabled(context.owner)) {
        dvPreviewStatus = "error";
        dvPreviewMessage = $i18n.t("errors.missingDataview.message");
        return;
      }
      const api = getAPI(context.owner);
      if (!api) {
        dvPreviewStatus = "error";
        dvPreviewMessage = $i18n.t("errors.missingDataview.message");
        return;
      }
      const result = await api.query(query, undefined, { forceId: true });
      if (!current()) return;
      if (!result?.successful) {
        dvPreviewStatus = "error";
        dvPreviewMessage = $i18n.t("modals.project.dataview.query-error");
        return;
      }
      const type = result.value.type;
      if (type === "table") {
        const count = result.value.values?.length ?? 0;
        dvPreviewStatus = "success";
        dvPreviewMessage = $i18n.t("modals.project.dataview.preview-table", { count });
      } else if (type === "list") {
        const count = result.value.values?.length ?? 0;
        dvPreviewStatus = "success";
        dvPreviewMessage = $i18n.t("modals.project.dataview.preview-list", { count });
      } else if (type === "task") {
        const count = result.value.values?.length ?? 0;
        dvPreviewStatus = "success";
        dvPreviewMessage = $i18n.t("modals.project.dataview.preview-task", { count });
      } else {
        dvPreviewStatus = "error";
        dvPreviewMessage = $i18n.t("modals.project.dataview.unsupported-type", { type });
      }
    } catch {
      if (!current()) return;
      dvPreviewStatus = "error";
      dvPreviewMessage = $i18n.t("modals.project.dataview.query-error");
    }
  }

  import { onDestroy } from "svelte";
  import type { DataSource as DataSourceConfig } from "src/settings/v3/settings";
  onDestroy(() => { alive = false; previewVersion++; window.clearTimeout(dvPreviewTimer); });

  // ── Multi-source management ────────────────────────────────
  /**
   * #170 step 1 gave sources an `id` and a `name`; this is what fills them.
   *
   * Without an id nothing can address a source, so the whole point of the step
   * — a block pointing at one source instead of the merge — was unreachable
   * until here. The id is assigned once, at creation, and never shown: it is
   * what a block stores, so renaming must not break the reference.
   */
  function addAdditionalSource() {
    const sources = [...(project.additionalSources ?? [])];
    sources.push({ id: uuidv4(), kind: "folder", config: { path: "", recursive: false } });
    project = { ...project, additionalSources: sources };
  }

  /** The label, which is the user's and may change freely. */
  function renameAdditionalSource(rowId: number, name: string) {
    const sources = [...(project.additionalSources ?? [])];
    const index = sourceRows.index(project.id, sources, rowId);
    const current = sources[index];
    if (!current) return;
    const trimmed = name.trim();
    sources[index] = (trimmed ? { ...current, name: trimmed } : (({ name: _drop, ...rest }) => rest)(current)) as DataSourceConfig;
    sourceRows.replace(rowId, sources[index]!);
    project = { ...project, additionalSources: sources };
  }

  function removeAdditionalSource(rowId: number) {
    const sources = [...(project.additionalSources ?? [])];
    const index = sourceRows.index(project.id, sources, rowId);
    if (index < 0) return;
    sources.splice(index, 1);
    project = { ...project, additionalSources: sources };
  }

  function updateAdditionalSource(rowId: number, kind: string) {
    const sources = [...(project.additionalSources ?? [])];
    const index = sourceRows.index(project.id, sources, rowId);
    if (index < 0) return;
    let newSrc: DataSourceConfig;
    switch (kind) {
      case "tag":
        newSrc = { kind: "tag", config: { tag: "", hierarchy: false } };
        break;
      case "dataview":
        newSrc = { kind: "dataview", config: { query: "" } };
        break;
      default:
        newSrc = { kind: "folder", config: { path: "", recursive: false } };
    }
    // The identity survives a change of kind: a block pointing at this source
    // is pointing at "the second source of this project", and the user
    // changing a folder to a tag has not made it a different one.
    const previous = sources[index] as { id?: string; name?: string } | undefined;
    sources[index] = {
      ...newSrc,
      id: previous?.id ?? uuidv4(),
      ...(previous?.name ? { name: previous.name } : {}),
    } as DataSourceConfig;
    sourceRows.replace(rowId, sources[index]!);
    project = { ...project, additionalSources: sources };
  }

  function updateAdditionalSourceConfig(rowId: number, config: Record<string, unknown>) {
    const sources = [...(project.additionalSources ?? [])];
    const index = sourceRows.index(project.id, sources, rowId);
    const current = sources[index];
    if (!current) return;
    sources[index] = { ...current, config: { ...current.config, ...config } } as DataSourceConfig;
    sourceRows.replace(rowId, sources[index]!);
    project = { ...project, additionalSources: sources };
  }

  // Agenda mode handler (v3.1.0+)
  function handleAgendaModeChange(mode: string) {
    const validMode = mode === 'custom' ? 'custom' : 'standard';
    const currentAgenda = project.agenda ?? { mode: 'standard', standard: { inheritCalendarFilters: true } };
    project = { 
      ...project, 
      agenda: { ...currentAgenda, mode: validMode }
    };
  }
  
  function handleAgendaInheritFiltersChange(inheritCalendarFilters: boolean) {
    const currentAgenda = project.agenda ?? { mode: 'standard' };
    project = { 
      ...project, 
      agenda: { 
        ...currentAgenda, 
        mode: 'standard',
        standard: { inheritCalendarFilters }
      }
    };
  }
  
  // Custom list management
  function moveListUp(index: number) {
    if (index === 0) return;
    const lists = [...(project.agenda?.custom?.lists ?? [])];
    [lists[index - 1]!, lists[index]!] = [lists[index]!, lists[index - 1]!];
    // Update order property - create new objects
    const updatedLists = lists.map((list, i) => ({
      ...list,
      order: i,
    }));
    updateCustomLists(updatedLists);
  }
  
  function moveListDown(index: number) {
    const lists = project.agenda?.custom?.lists ?? [];
    if (index === lists.length - 1) return;
    const updated = [...lists];
    [updated[index + 1]!, updated[index]!] = [updated[index]!, updated[index + 1]!];
    // Update order property - create new objects
    const updatedLists = updated.map((list, i) => ({
      ...list,
      order: i,
    }));
    updateCustomLists(updatedLists);
  }
  
  function removeList(index: number) {
    const lists = [...(project.agenda?.custom?.lists ?? [])];
    lists.splice(index, 1);
    // Update order property - create new objects
    const updatedLists = lists.map((list, i) => ({
      ...list,
      order: i,
    }));
    updateCustomLists(updatedLists);
  }
  
  function updateCustomLists(lists: AgendaCustomList[]) {
    project = {
      ...project,
      agenda: {
        ...project.agenda,
        mode: 'custom',
        custom: {
          ...(project.agenda?.custom ?? {}),
          lists,
        },
      },
    };
  }
  
  $: customLists = project.agenda?.custom?.lists ?? [];
  
  /**
   * Count filters in an AgendaCustomList (v3.1.0+ compatible)
   * Supports both legacy format (filters[]) and new format (filterGroup/filterFormula)
   */
  function getFilterCount(list: AgendaCustomList): number {
    // Legacy format migration compatibility
    // @ts-expect-error: Old format may still exist during migration
    if (list.filters && Array.isArray(list.filters)) {
      // @ts-expect-error: Old format compatibility
      return list.filters.length;
    }
    
    // New v3.1.0 format
    if (list.filterMode === 'advanced') {
      // Formula mode: count as 1 filter if formula exists
      return list.filterFormula && list.filterFormula.trim() ? 1 : 0;
    }
    
    // Visual mode: recursively count filters in group
    if (list.filterGroup) {
      return countFiltersInGroup(list.filterGroup);
    }
    
    return 0;
  }
  
  /**
   * Recursively count filters in a filter group
   */
  function countFiltersInGroup(group: any): number {
    let count = group.filters?.length ?? 0;
    if (group.groups && Array.isArray(group.groups)) {
      for (const nestedGroup of group.groups) {
        count += countFiltersInGroup(nestedGroup);
      }
    }
    return count;
  }
</script>

{#key project.id}
<ModalLayout {title}>
  <ModalContent>
    <div bind:this={formEl} on:compositionstart|capture={(event) => trackComposition(event, true)} on:compositionend|capture={(event) => trackComposition(event, false)}>
    <SettingItem
      name={$i18n.t("modals.project.name.name")}
      description={$i18n.t("modals.project.name.description") ?? ""}
    >
      <ValueSuggestField
        value={project.name}
        ariaLabel={$i18n.t("modals.project.name.name")}
        on:input={({ detail: name }) => (project = { ...project, name })}
        autoFocus
        error={!!nameError}
        helperText={nameError}
      />
    </SettingItem>
    <SettingItem
      name={$i18n.t("modals.project.default.name")}
      description={$i18n.t("modals.project.default.description") ?? ""}
    >
      <Switch
        checked={project.isDefault ?? false}
        on:check={({ detail: isDefault }) =>
          (project = { ...project, isDefault })}
      />
    </SettingItem>

    <SettingItem
      name={$i18n.t("modals.project.datasource.name")}
      description={$i18n.t("modals.project.datasource.description")}
    >
      <SelectField
        value={project.dataSource.kind}
        contextKey={`${project.id}:primary-kind`}
        tooltip={$i18n.t("modals.project.datasource.name")}
        options={primaryDataSourceOptions}
        on:change={handleDataSourceChange}
      />
    </SettingItem>

    {#if project.dataSource.kind === "folder"}
      <SettingItem
        name={$i18n.t("modals.project.path.name")}
        description={$i18n.t("modals.project.path.description") ?? ""}
        vertical
      >
        <PathSuggestField
          bind:this={folderField}
          files={$pathSource.folders}
          contextKey={`${project.id}:primary-folder`}
          ariaLabel={$i18n.t("modals.project.path.name")}
          value={project.dataSource.config.path}
          on:change={({ detail: path }) => {
            if (project.dataSource.kind === "folder") patchPrimaryConfig({ path });
          }}
          getLabel={(file) => file.path}
          placeholder={"/"}
          width="100%"
        />
        <p class="ppp-create-project-consequence" role="status">
          {#if !project.dataSource.config.path}
            {$i18n.t("modals.project.path.consequence-root", {
              defaultValue:
                "An empty path means the whole vault: every note becomes a record of this project.",
            })}
          {:else}
            {$i18n.t("modals.project.path.consequence", {
              defaultValue:
                "Reads the notes already in '{{path}}'. The folder is not created and no notes are written — the project is a view over files that exist.",
              path: project.dataSource.config.path,
            })}
          {/if}
        </p>
      </SettingItem>

      <SettingItem
        name={$i18n.t("modals.project.recursive.name")}
        description={$i18n.t("modals.project.recursive.description") ?? ""}
      >
        <Switch
          checked={project.dataSource.config.recursive}
          on:check={({ detail: recursive }) => {
            if (project.dataSource.kind === "folder") patchPrimaryConfig({ recursive });
          }}
        />
      </SettingItem>
    {/if}

    {#if project.dataSource.kind === "tag"}
      <SettingItem
        name={$i18n.t("modals.project.tag.name")}
        description={$i18n.t("modals.project.tag.description") ?? ""}
        vertical
      >
        <ValueSuggestField
          placeholder="#tag"
          ariaLabel={$i18n.t("modals.project.tag.name")}
          value={project.dataSource.config.tag ?? ""}
          on:input={({ detail: rawTag }) => {
            if (project.dataSource.kind === "tag") {
              // Normalize: ensure tag always has exactly one leading #
              const tag = rawTag.trim()
                ? (rawTag.trim().startsWith("#") ? rawTag.trim() : "#" + rawTag.trim())
                : "";
              patchPrimaryConfig({ tag });
            }
          }}
        />
      </SettingItem>

      <SettingItem
        name={$i18n.t("modals.project.hierarchy.name")}
        description={$i18n.t("modals.project.hierarchy.description")}
      >
        <Switch
          checked={project.dataSource.config.hierarchy}
          on:check={({ detail: hierarchy }) => {
            if (project.dataSource.kind === "tag") {
              patchPrimaryConfig({ hierarchy });
            }
          }}
        />
      </SettingItem>
    {/if}

    {#if project.dataSource.kind === "dataview"}
      {#if $capabilities.dataview}
        <SettingItem
          name={$i18n.t("modals.project.query.name")}
          description={$i18n.t("modals.project.query.description") ?? ""}
          vertical
        >
          <TextField
            bind:this={queryField}
            multiline
            ariaLabel={$i18n.t("modals.project.query.name")}
            placeholder={`TABLE status AS "Status" FROM "Work"`}
            value={project.dataSource.config.query ?? ""}
            on:focus={() => { if (project.dataSource.kind === "dataview") queryBaseline = project.dataSource.config.query ?? ""; }}
            on:commit={({detail}) => { queryBaseline = detail.value; }}
            on:cancel={() => { if (project.dataSource.kind === "dataview") { patchPrimaryConfig({query: queryBaseline}); validateDataviewQuery(queryBaseline); } }}
            on:input={({ detail: query }) => {
              if (project.dataSource.kind === "dataview") {
                patchPrimaryConfig({ query });
                validateDataviewQuery(query);
              }
            }}
            rows={6}
          />
          {#if dvPreviewStatus !== "idle"}
            <div
              class="ppp-dv-preview"
              class:ppp-dv-preview--loading={dvPreviewStatus === "loading"}
              class:ppp-dv-preview--success={dvPreviewStatus === "success"}
              class:ppp-dv-preview--error={dvPreviewStatus === "error"}
            >
              {#if dvPreviewStatus === "loading"}
                <Icon name="loader" />
              {:else if dvPreviewStatus === "success"}
                <Icon name="check-circle" />
              {:else}
                <Icon name="alert-triangle" />
              {/if}
              <span>{dvPreviewMessage}</span>
            </div>
          {/if}
        </SettingItem>
      {:else}
        <Callout
          title={$i18n.t("modals.project.dataview.error.title")}
          icon="zap"
          variant="danger"
        >
          <Typography variant="body">
            {$i18n.t("modals.project.dataview.error.message")}
          </Typography>
        </Callout>
      {/if}
    {/if}

    {#if project.dataSource.kind === "native-query"}
      <SettingItem
        name={$i18n.t("modals.project.native-query.from.name")}
        description={$i18n.t("modals.project.native-query.from.description") ??
          ""}
      >
        <SelectField
          value={project.dataSource.config.from.kind}
          contextKey={`${project.id}:query-from-kind`}
          tooltip={$i18n.t("modals.project.native-query.from.name")}
          options={[
            { label: $i18n.t("datasources.folder"), value: "folder" },
            { label: $i18n.t("datasources.tag"), value: "tag" },
          ]}
          on:change={({ detail: kind }) => nqSetFromKind(kind)}
        />
      </SettingItem>

      {#if project.dataSource.config.from.kind === "folder"}
        <SettingItem
          name={$i18n.t("modals.project.path.name")}
          description={$i18n.t("modals.project.path.description") ?? ""}
          vertical
        >
          <PathSuggestField
            bind:this={folderField}
            files={$pathSource.folders}
            contextKey={`${project.id}:query-folder`}
            ariaLabel={$i18n.t("modals.project.path.name")}
            value={project.dataSource.config.from.path}
            on:change={({ detail: path }) => nqUpdateFrom({ path })}
            getLabel={(file) => file.path}
            placeholder={"/"}
            width="100%"
          />
        </SettingItem>
        <SettingItem
          name={$i18n.t("modals.project.recursive.name")}
          description={$i18n.t("modals.project.recursive.description") ?? ""}
        >
          <Switch
            checked={project.dataSource.config.from.recursive}
            on:check={({ detail: recursive }) => nqUpdateFrom({ recursive })}
          />
        </SettingItem>
      {:else}
        <SettingItem
          name={$i18n.t("modals.project.tag.name")}
          description={$i18n.t("modals.project.tag.description") ?? ""}
          vertical
        >
          <ValueSuggestField
            placeholder="#tag"
            ariaLabel={$i18n.t("modals.project.tag.name")}
            value={project.dataSource.config.from.tag ?? ""}
            on:input={({ detail: rawTag }) => {
              const tag = rawTag.trim()
                ? rawTag.trim().startsWith("#")
                  ? rawTag.trim()
                  : "#" + rawTag.trim()
                : "";
              nqUpdateFrom({ tag });
            }}
          />
        </SettingItem>
        <SettingItem
          name={$i18n.t("modals.project.hierarchy.name")}
          description={$i18n.t("modals.project.hierarchy.description")}
        >
          <Switch
            checked={project.dataSource.config.from.hierarchy}
            on:check={({ detail: hierarchy }) => nqUpdateFrom({ hierarchy })}
          />
        </SettingItem>
      {/if}

      <SettingItem
        name={$i18n.t("modals.project.native-query.where.name")}
        description={$i18n.t(
          "modals.project.native-query.where.description"
        ) ?? ""}
        vertical
      >
        <div class="ppp-nq-conditions">
          {#each conditionEntries as {id: rowId, value: condition} (rowId)}
            <div class="ppp-nq-condition-row">
              <ValueSuggestField
                value={condition.field}
                ariaLabel={$i18n.t("modals.project.native-query.where.field-placeholder")}
                placeholder={$i18n.t(
                  "modals.project.native-query.where.field-placeholder"
                )}
                on:input={({ detail: field }) =>
                  nqUpdateCondition(rowId, { field })}
              />
              <SelectField
                contextKey={`${project.id}:condition:${rowId}`}
                tooltip={$i18n.t(`modals.project.native-query.operators.${condition.operator}`)}
                value={condition.operator}
                options={nqOperatorOptions}
                on:change={({ detail: operator }) =>
                  nqSetConditionOperator(rowId, operator)}
              />
              {#if getFilterOperatorType(condition.operator) !== "unary"}
                <ValueSuggestField
                  value={condition.value ?? ""}
                  ariaLabel={$i18n.t("modals.project.native-query.where.value-placeholder")}
                  placeholder={$i18n.t(
                    "modals.project.native-query.where.value-placeholder"
                  )}
                  on:input={({ detail: value }) =>
                    nqUpdateCondition(rowId, { value })}
                />
              {/if}
              <Button variant="plain" on:click={() => nqRemoveCondition(rowId)}>
                <Icon name="x" />
              </Button>
            </div>
          {/each}
          <Button variant="plain" on:click={nqAddCondition}>
            <Icon name="plus" />
            {$i18n.t("modals.project.native-query.where.add")}
          </Button>
        </div>
      </SettingItem>

      <SettingItem
        name={$i18n.t("modals.project.native-query.limit.name")}
        description={$i18n.t("modals.project.native-query.limit.description") ??
          ""}
      >
        <NumberField
          bind:this={limitField}
          value={project.dataSource.config.limit ?? null}
          ariaLabel={$i18n.t("modals.project.native-query.limit.name")}
          allowEmpty integer min={0} preserveInvalidOnBlur
          placeholder="∞"
          on:commit={({ detail }) => nqSetLimit(detail)}
        />
      </SettingItem>
    {/if}

    <Accordion>
      <AccordionItem>
        <div slot="header" class="setting-item-info" style:margin-top="0.5rem">
          <div class="setting-item-name">
            {$i18n.t("modals.project.additional-sources.name")}
          </div>
        </div>
        <div class="ppp-additional-sources">
          {#each additionalRows as {id: rowId, value: src} (rowId)}
            <div class="ppp-additional-source-row">
              <ValueSuggestField
                value={src.name ?? ""}
                ariaLabel={$i18n.t("modals.project.additional-sources.name")}
                placeholder={$i18n.t("modals.project.additional-sources.name-placeholder", {
                  defaultValue: "Name (optional)",
                })}
                on:input={({ detail: name }) => renameAdditionalSource(rowId, name)}
              />
              <SelectField
                contextKey={`${project.id}:source:${rowId}`}
                tooltip={$i18n.t("modals.project.datasource.name")}
                value={src.kind}
                options={dataSourceOptions}
                on:change={({ detail: kind }) => updateAdditionalSource(rowId, kind)}
              />
              {#if src.kind === "folder"}
                <PathSuggestField
                  bind:this={additionalPathFields[String(rowId)]}
                  ariaLabel={$i18n.t("modals.project.path.name")}
                  files={$pathSource.folders}
                  contextKey={`${project.id}:additional-folder:${rowId}`}
                  value={src.config.path}
                  placeholder="folder/path"
                  on:change={({ detail: path }) => updateAdditionalSourceConfig(rowId, { path, recursive: src.config.recursive ?? false })}
                />
              {:else if src.kind === "tag"}
                <ValueSuggestField
                  value={src.config.tag}
                  ariaLabel={$i18n.t("modals.project.tag.name")}
                  placeholder="#tag"
                  on:input={({ detail: tag }) => updateAdditionalSourceConfig(rowId, { tag, hierarchy: src.config.hierarchy ?? false })}
                />
              {:else if src.kind === "dataview"}
                <ValueSuggestField
                  value={src.config.query}
                  ariaLabel={$i18n.t("modals.project.query.name")}
                  placeholder="TABLE ..."
                  on:input={({ detail: query }) => updateAdditionalSourceConfig(rowId, { query })}
                />
              {/if}
              <Button variant="plain" on:click={() => removeAdditionalSource(rowId)}>
                <Icon name="x" />
              </Button>
            </div>
          {/each}
          <Button variant="plain" on:click={addAdditionalSource}>
            <Icon name="plus" />
            {$i18n.t("modals.project.additional-sources.add")}
          </Button>
        </div>
      </AccordionItem>
    </Accordion>

    <Accordion>
      <AccordionItem>
        <div slot="header" class="setting-item-info" style:margin-top="0.5rem">
          <div class="setting-item-name">
            {$i18n.t("modals.project.more-settings.name")}
          </div>
        </div>
        <SettingItem
          name={$i18n.t("modals.project.newNotesFolder.name")}
          description={$i18n.t("modals.project.newNotesFolder.description") ??
            ""}
        >
          <PathSuggestField
            bind:this={newNotesFolderField}
            files={$pathSource.folders}
            contextKey={`${project.id}:new-notes-folder`}
            ariaLabel={$i18n.t("modals.project.newNotesFolder.name")}
            value={project.newNotesFolder}
            placeholder={project.dataSource.kind === "folder"
              ? project.dataSource.config.path
              : "/"}
            on:change={({ detail: newNotesFolder }) => {
              project = {
                ...project,
                newNotesFolder,
              };
            }}
            getLabel={(file) => file.path}
          />
        </SettingItem>

        <SettingItem
          name={$i18n.t("modals.project.defaultName.name")}
          description={$i18n.t("modals.project.defaultName.description") ?? ""}
          vertical
        >
          <ValueSuggestField
            value={project.defaultName ?? ""}
            ariaLabel={$i18n.t("modals.project.defaultName.name")}
            on:input={({ detail: defaultName }) =>
              (project = { ...project, defaultName })}
          />
          <small>
            {defaultName}
          </small>
          {#if !isValidPath(defaultName)}
            <small class="error"
              >{$i18n.t("modals.project.defaultName.invalid")}</small
            >
          {/if}
        </SettingItem>

        <SettingItem
          name={$i18n.t("modals.project.templates.name")}
          description={$i18n.t("modals.project.templates.description") ?? ""}
          vertical
        >
          <FileListInput
            bind:this={templateFields}
            contextKey={`${project.id}:templates`}
            buttonText={$i18n.t("modals.project.templates.add")}
            paths={project.templates ?? []}
            onPathsChange={(templates) => (project = { ...project, templates })}
          />
        </SettingItem>

        <SettingItem
          name={$i18n.t("modals.project.exclude.name")}
          description={$i18n.t("modals.project.exclude.description") ?? ""}
          vertical
        >
          <FileListInput
            bind:this={excludedFields}
            contextKey={`${project.id}:excluded-notes`}
            buttonText={$i18n.t("modals.project.exclude.add")}
            paths={project.excludedNotes ?? []}
            onPathsChange={(excludedNotes) =>
              (project = { ...project, excludedNotes })}
          />
        </SettingItem>

        <SettingItem
          name={$i18n.t("modals.project.autosave.name")}
          description={$i18n.t("modals.project.autosave.description") ?? ""}
        >
          <Switch
            checked={project.autosave ?? true}
            on:check={({ detail: autosave }) =>
              (project = { ...project, autosave })}
          />
        </SettingItem>

        <!-- Agenda Mode Settings (v3.1.0+) -->
        <SettingItem
          name={$i18n.t("modals.project.agenda.name")}
          description={$i18n.t("modals.project.agenda.description") ?? ""}
        >
          <SelectField
            value={project.agenda?.mode ?? "standard"}
            contextKey={`${project.id}:agenda-mode`}
            tooltip={$i18n.t("modals.project.agenda.name")}
            options={[
              { label: $i18n.t("modals.project.agenda.modes.standard"), value: "standard" },
              { label: $i18n.t("modals.project.agenda.modes.custom"), value: "custom" }
            ]}
            on:change={({ detail: mode }) => handleAgendaModeChange(mode)}
          />
        </SettingItem>

        {#if (project.agenda?.mode ?? 'standard') === 'standard'}
          <SettingItem
            name={$i18n.t("modals.project.agenda.inherit-filters.name")}
            description={$i18n.t("modals.project.agenda.inherit-filters.description") ?? ""}
          >
            <Switch
              checked={project.agenda?.standard?.inheritCalendarFilters ?? true}
              on:check={({ detail: checked }) => handleAgendaInheritFiltersChange(checked)}
            />
          </SettingItem>
        {:else if (project.agenda?.mode ?? 'standard') === 'custom'}
          <SettingItem
            name={$i18n.t("modals.project.agenda-custom-lists.name")}
            description={$i18n.t("modals.project.agenda-custom-lists.desc")}
          >
            <div class="custom-lists-preview">
              {#if customLists.length === 0}
                <div class="empty-state">
                  <p>{$i18n.t("modals.create-project.no-custom-lists")}</p>
                  <small>{$i18n.t("modals.create-project.create-lists-hint")}</small>
                </div>
              {:else}
                <div class="lists-container">
                  {#each customLists as list, index (list.id)}
                    <div class="list-item">
                      <div class="list-icon">
                        {#if list.icon.type === 'emoji'}
                          <span class="emoji">{agendaEmoji(list.icon.value)}</span>
                        {:else}
                          <Icon name={list.icon.value} size="sm" />
                        {/if}
                      </div>
                      <div class="list-info">
                        <div class="list-name">{list.name}</div>
                        <div class="list-filters">{getFilterCount(list)} filter{getFilterCount(list) !== 1 ? 's' : ''}</div>
                      </div>
                      <div class="list-actions">
                        <button 
                          class="action-btn" 
                          on:click={() => moveListUp(index)}
                          disabled={index === 0}
                          title={$i18n.t("common.move-up")}
                        >
                          <Icon name="chevron-up" size="xs" />
                        </button>
                        <button 
                          class="action-btn" 
                          on:click={() => moveListDown(index)}
                          disabled={index === customLists.length - 1}
                          title={$i18n.t("common.move-down")}
                        >
                          <Icon name="chevron-down" size="xs" />
                        </button>
                        <button 
                          class="action-btn delete-btn" 
                          on:click={() => removeList(index)}
                          title={$i18n.t("common.delete")}
                        >
                          <Icon name="trash-2" size="xs" />
                        </button>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </SettingItem>
        {/if}

        <DateFormatSelector
          bind:this={dateFormatField}
          dateFormat={project.dateFormat}
          onChange={(newDateFormat) => {
            if (newDateFormat === undefined) {
              // Remove the property when undefined (for exactOptionalPropertyTypes)
              const { dateFormat, ...rest } = project;
              project = rest;
            } else {
              project = { ...project, dateFormat: newDateFormat };
            }
          }}
        />
      </AccordionItem>
    </Accordion>
    </div>
  </ModalContent>
  <ModalButtonGroup>
    <Button
      variant="primary"
      disabled={!!nameError}
      on:click={submit}>{cta}</Button
    >
  </ModalButtonGroup>
</ModalLayout>
{/key}

<style>
  .ppp-create-project-consequence {
    margin: var(--size-2-2) 0 0 0;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    line-height: var(--line-height-tight);
  }

  small {
    font-size: var(--font-ui-smaller);
    color: var(--text-accent);
    font-weight: var(--font-semibold);
  }
  .error {
    color: var(--text-error);
  }
  
  /* Custom Lists Preview */
  .custom-lists-preview {
    width: 100%;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    background: var(--background-primary);
  }
  
  .empty-state {
    padding: 1.5rem;
    text-align: center;
    color: var(--text-muted);
  }
  
  .empty-state p {
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
  }
  
  .empty-state small {
    color: var(--text-faint);
  }
  
  .lists-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
  }
  
  .list-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.75rem;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--background-secondary);
  }
  
  .list-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    flex-shrink: 0;
  }
  
  .list-icon .emoji {
    font-size: 1.25rem;
    line-height: 1;
  }
  
  .list-info {
    flex: 1;
    min-width: 0;
  }
  
  .list-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-normal);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .list-filters {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  
  .list-actions {
    display: flex;
    gap: 0.25rem;
  }
  
  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    border: none;
    border-radius: var(--radius-s);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .action-btn:hover:not(:disabled) {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
  
  .action-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  .action-btn.delete-btn:hover:not(:disabled) {
    color: var(--text-error);
  }

  .ppp-dv-preview {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-top: 0.375rem;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-s, 0.25rem);
    font-size: var(--font-ui-small);
  }

  .ppp-dv-preview--loading {
    color: var(--text-muted);
  }

  .ppp-dv-preview--success {
    color: var(--text-success, hsl(120, 50%, 45%));
    background: var(--background-modifier-success, hsla(120, 50%, 45%, 0.08));
  }

  .ppp-dv-preview--error {
    color: var(--text-error, hsl(0, 50%, 50%));
    background: var(--background-modifier-error, hsla(0, 50%, 50%, 0.08));
  }

  .ppp-additional-sources {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .ppp-additional-source-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .ppp-additional-source-row :global(select) {
    min-width: 6rem;
  }

  .ppp-additional-source-row :global(input) {
    flex: 1;
  }

  .ppp-nq-conditions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }

  .ppp-nq-condition-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .ppp-nq-condition-row :global(select) {
    min-width: 7rem;
  }

  .ppp-nq-condition-row :global(input) {
    flex: 1;
    min-width: 0;
  }
</style>
