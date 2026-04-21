<script lang="ts">
  import dayjs from "dayjs";
  import {
    Button,
    Callout,
    FileAutocomplete,
    Icon,
    ModalButtonGroup,
    ModalContent,
    ModalLayout,
    Select,
    SettingItem,
    Switch,
    TextArea,
    TextInput,
    Typography,
  } from "obsidian-svelte";

  import { FileListInput } from "src/ui/components/FileListInput";
  import { Accordion, AccordionItem } from "src/ui/components/Accordion";
  import DateFormatSelector from "./DateFormatSelector.svelte";
  import { notEmpty } from "src/lib/helpers";
  import { getFoldersInFolder, isValidPath } from "src/lib/obsidian";
  import { capabilities } from "src/lib/stores/capabilities";
  import { i18n } from "src/lib/stores/i18n";
  import { app } from "src/lib/stores/obsidian";
  import { settings } from "src/lib/stores/settings";
  import { interpolateTemplate } from "src/lib/templates/interpolate";
  import { getAPI, isPluginEnabled } from "obsidian-dataview";
  import type { ProjectDefinition } from "src/settings/settings";
  import type { AgendaCustomList } from "src/settings/v3/settings";

  export let title: string;
  export let cta: string;
  export let onSave: (project: ProjectDefinition) => void;
  export let project: ProjectDefinition;

  let originalName = project.name;

  $: projects = $settings.projects;

  $: defaultName = interpolateTemplate(project.defaultName ?? "", {
    date: (format) => dayjs().format(format || "YYYY-MM-DD"),
    time: (format) => dayjs().format(format || "HH:mm"),
  });

  $: ({ name } = project);
  $: nameError = validateName(name);

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

  function handleDataSourceChange({ detail: value }: CustomEvent<string>) {
    switch (value) {
      case "folder":
        project = {
          ...project,
          dataSource: {
            kind: "folder",
            config: { path: "", recursive: false },
          },
        };
        break;
      case "tag":
        project = {
          ...project,
          dataSource: { kind: "tag", config: { tag: "", hierarchy: false } },
        };
        break;
      case "dataview":
        project = {
          ...project,
          dataSource: { kind: "dataview", config: { query: "" } },
        };
        break;
    }
  }

  function validateName(name: string) {
    if (name === originalName) {
      return "";
    }

    if (name.trim() === "") {
      return $i18n.t("modals.project.create.empty-name-error");
    }

    if (projects.find((project) => project.name === name)) {
      return $i18n.t("modals.project.create.existing-name-error");
    }

    return "";
  }
  
  // ── Dataview query validation ──────────────────────────────
  let dvPreviewStatus: "idle" | "loading" | "success" | "error" = "idle";
  let dvPreviewMessage = "";
  let dvPreviewTimer: ReturnType<typeof setTimeout> | undefined;

  function validateDataviewQuery(query: string) {
    clearTimeout(dvPreviewTimer);
    if (!query.trim()) {
      dvPreviewStatus = "idle";
      dvPreviewMessage = "";
      return;
    }
    dvPreviewStatus = "loading";
    dvPreviewMessage = $i18n.t("modals.project.dataview.validating");
    dvPreviewTimer = setTimeout(() => runDataviewPreview(query), 600);
  }

  async function runDataviewPreview(query: string) {
    try {
      if (!isPluginEnabled($app)) {
        dvPreviewStatus = "error";
        dvPreviewMessage = $i18n.t("errors.missingDataview.message");
        return;
      }
      const api = getAPI($app);
      if (!api) {
        dvPreviewStatus = "error";
        dvPreviewMessage = $i18n.t("errors.missingDataview.message");
        return;
      }
      const result = await api.query(query, undefined, { forceId: true });
      if (!result?.successful) {
        dvPreviewStatus = "error";
        dvPreviewMessage = $i18n.t("modals.project.dataview.query-error");
        return;
      }
      const type = result.value.type;
      if (type === "table") {
        const count = (result.value as { values: unknown[] }).values?.length ?? 0;
        dvPreviewStatus = "success";
        dvPreviewMessage = $i18n.t("modals.project.dataview.preview-table", { count });
      } else if (type === "list") {
        const count = (result.value as { values: unknown[] }).values?.length ?? 0;
        dvPreviewStatus = "success";
        dvPreviewMessage = $i18n.t("modals.project.dataview.preview-list", { count });
      } else if (type === "task") {
        const count = (result.value as { values: unknown[] }).values?.length ?? 0;
        dvPreviewStatus = "success";
        dvPreviewMessage = $i18n.t("modals.project.dataview.preview-task", { count });
      } else {
        dvPreviewStatus = "error";
        dvPreviewMessage = $i18n.t("modals.project.dataview.unsupported-type", { type });
      }
    } catch {
      dvPreviewStatus = "error";
      dvPreviewMessage = $i18n.t("modals.project.dataview.query-error");
    }
  }

  import { onDestroy } from "svelte";
  import type { DataSource as DataSourceConfig } from "src/settings/v3/settings";
  onDestroy(() => clearTimeout(dvPreviewTimer));

  // ── Multi-source management ────────────────────────────────
  function addAdditionalSource() {
    const sources = [...(project.additionalSources ?? [])];
    sources.push({ kind: "folder", config: { path: "", recursive: false } });
    project = { ...project, additionalSources: sources };
  }

  function removeAdditionalSource(index: number) {
    const sources = [...(project.additionalSources ?? [])];
    sources.splice(index, 1);
    project = { ...project, additionalSources: sources };
  }

  function updateAdditionalSource(index: number, kind: string) {
    const sources = [...(project.additionalSources ?? [])];
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
    sources[index] = newSrc;
    project = { ...project, additionalSources: sources };
  }

  function updateAdditionalSourceConfig(index: number, config: Record<string, unknown>) {
    const sources = [...(project.additionalSources ?? [])];
    const current = sources[index];
    if (!current) return;
    sources[index] = { ...current, config: { ...current.config, ...config } } as DataSourceConfig;
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

<ModalLayout {title}>
  <ModalContent>
    <SettingItem
      name={$i18n.t("modals.project.name.name")}
      description={$i18n.t("modals.project.name.description") ?? ""}
    >
      <TextInput
        value={project.name}
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
      <Select
        value={project.dataSource.kind}
        options={dataSourceOptions}
        on:change={handleDataSourceChange}
      />
    </SettingItem>

    {#if project.dataSource.kind === "folder"}
      <SettingItem
        name={$i18n.t("modals.project.path.name")}
        description={$i18n.t("modals.project.path.description") ?? ""}
        vertical
      >
        <FileAutocomplete
          files={getFoldersInFolder($app.vault.getRoot())}
          value={project.dataSource.config.path}
          on:change={({ detail: path }) => {
            if (project.dataSource.kind === "folder") {
              project = {
                ...project,
                dataSource: {
                  kind: project.dataSource.kind,
                  config: { ...project.dataSource.config, path },
                },
              };
            }
          }}
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
          checked={project.dataSource.config.recursive}
          on:check={({ detail: recursive }) => {
            if (project.dataSource.kind === "folder") {
              project = {
                ...project,
                dataSource: {
                  kind: project.dataSource.kind,
                  config: { ...project.dataSource.config, recursive },
                },
              };
            }
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
        <TextInput
          placeholder="#tag"
          value={project.dataSource.config.tag ?? ""}
          on:input={({ detail: rawTag }) => {
            if (project.dataSource.kind === "tag") {
              // Normalize: ensure tag always has exactly one leading #
              const tag = rawTag.trim()
                ? (rawTag.trim().startsWith("#") ? rawTag.trim() : "#" + rawTag.trim())
                : "";
              project = {
                ...project,
                dataSource: {
                  kind: project.dataSource.kind,
                  config: { ...project.dataSource.config, tag },
                },
              };
            }
          }}
          width="100%"
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
              project = {
                ...project,
                dataSource: {
                  kind: project.dataSource.kind,
                  config: { ...project.dataSource.config, hierarchy },
                },
              };
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
          <TextArea
            placeholder={`TABLE status AS "Status" FROM "Work"`}
            value={project.dataSource.config.query ?? ""}
            on:input={({ detail: query }) => {
              if (project.dataSource.kind === "dataview") {
                project = {
                  ...project,
                  dataSource: {
                    kind: project.dataSource.kind,
                    config: { ...project.dataSource.config, query },
                  },
                };
                validateDataviewQuery(query);
              }
            }}
            rows={6}
            width="100%"
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

    <Accordion>
      <AccordionItem>
        <div slot="header" class="setting-item-info" style:margin-top="8px">
          <div class="setting-item-name">
            {$i18n.t("modals.project.additional-sources.name")}
          </div>
        </div>
        <div class="ppp-additional-sources">
          {#each project.additionalSources ?? [] as src, i}
            <div class="ppp-additional-source-row">
              <Select
                value={src.kind}
                options={dataSourceOptions}
                on:change={({ detail: kind }) => updateAdditionalSource(i, kind)}
              />
              {#if src.kind === "folder"}
                <TextInput
                  value={src.config.path}
                  placeholder="folder/path"
                  on:input={({ detail: path }) => updateAdditionalSourceConfig(i, { path, recursive: src.config.recursive ?? false })}
                />
              {:else if src.kind === "tag"}
                <TextInput
                  value={src.config.tag}
                  placeholder="#tag"
                  on:input={({ detail: tag }) => updateAdditionalSourceConfig(i, { tag, hierarchy: src.config.hierarchy ?? false })}
                />
              {:else if src.kind === "dataview"}
                <TextInput
                  value={src.config.query}
                  placeholder="TABLE ..."
                  on:input={({ detail: query }) => updateAdditionalSourceConfig(i, { query })}
                />
              {/if}
              <Button variant="plain" on:click={() => removeAdditionalSource(i)}>
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
        <div slot="header" class="setting-item-info" style:margin-top="8px">
          <div class="setting-item-name">
            {$i18n.t("modals.project.more-settings.name")}
          </div>
        </div>
        <SettingItem
          name={$i18n.t("modals.project.newNotesFolder.name")}
          description={$i18n.t("modals.project.newNotesFolder.description") ??
            ""}
        >
          <FileAutocomplete
            files={getFoldersInFolder($app.vault.getRoot())}
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
          <TextInput
            value={project.defaultName ?? ""}
            on:input={({ detail: defaultName }) =>
              (project = { ...project, defaultName })}
            width="100%"
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
          <Select
            value={project.agenda?.mode ?? "standard"}
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
            name="Custom Lists"
            description="Manage your custom agenda lists. Lists are created in the Calendar view."
          >
            <div class="custom-lists-preview">
              {#if customLists.length === 0}
                <div class="empty-state">
                  <p>No custom lists yet</p>
                  <small>Create lists in the Calendar view agenda sidebar</small>
                </div>
              {:else}
                <div class="lists-container">
                  {#each customLists as list, index (list.id)}
                    <div class="list-item">
                      <div class="list-icon">
                        {#if list.icon.type === 'emoji'}
                          <span class="emoji">{list.icon.value}</span>
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
                          title="Move up"
                        >
                          <Icon name="chevron-up" size="xs" />
                        </button>
                        <button 
                          class="action-btn" 
                          on:click={() => moveListDown(index)}
                          disabled={index === customLists.length - 1}
                          title="Move down"
                        >
                          <Icon name="chevron-down" size="xs" />
                        </button>
                        <button 
                          class="action-btn delete-btn" 
                          on:click={() => removeList(index)}
                          title="Delete"
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
  </ModalContent>
  <ModalButtonGroup>
    <Button
      variant="primary"
      disabled={!!nameError}
      on:click={() => {
        onSave({
          ...project,
          templates: project.templates?.filter(notEmpty) ?? [],
        });
      }}>{cta}</Button
    >
  </ModalButtonGroup>
</ModalLayout>

<style>
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
</style>
