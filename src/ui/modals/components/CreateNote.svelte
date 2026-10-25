<script lang="ts">
  import { normalizePath, TFile } from "obsidian";
  import {
    Button,
    ModalButtonGroup,
    ModalContent,
    ModalLayout,
    Select,
    SettingItem,
    TextInput,
  } from "obsidian-svelte";

  import { isValidPath } from "src/lib/obsidian";
  import { i18n } from "src/lib/stores/i18n";
  import { app } from "src/lib/stores/obsidian";
  import { settings } from "src/lib/stores/settings";
  import type { ProjectDefinition } from "src/settings/settings";
  import { onMount } from "svelte";

  let inputRef: HTMLInputElement;

  export let name: string;
  export let project: ProjectDefinition;
  /** w4-p03: the project is picked only from the general command. */
  export let chooseProject = false;
  export let onSave: (
    name: string,
    templatePath: string,
    project: ProjectDefinition
  ) => void | Promise<unknown>;

  let templatePath = project.templates.at(0) ?? "";

  $: nameError = validateName(name);

  // w4-p02 (F14): the form waits for the write. While it runs the button is
  // off (a second press does not create a second note); a refusal is shown
  // here and the typed name and choices stay for another try.
  let saving = false;
  let saveError = "";

  async function submit() {
    if (saving || nameError) return;
    saving = true;
    saveError = "";
    try {
      await onSave(name, templatePath, project);
    } catch (error) {
      saveError = $i18n.t("modals.note.create.save-error", {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      saving = false;
    }
  }

  // Explicit reactive statement for project options to ensure Select component
  // properly detects changes when projects are updated or added
  $: projectOptions = $settings.projects.map((proj) => ({
    label: proj.name,
    value: proj.id,
  }));

  // Explicit reactive statement for template options for the same reason
  $: templateOptions = project.templates.map((path) => ({
    label: path,
    value: path,
  }));

  function getNewNotesFolder(project: ProjectDefinition) {
    if (project.newNotesFolder) {
      return project.newNotesFolder;
    }

    if (project.dataSource.kind === "folder") {
      return project.dataSource.config.path;
    }

    if (
      project.dataSource.kind === "native-query" &&
      project.dataSource.config.from.kind === "folder"
    ) {
      return project.dataSource.config.from.path;
    }

    return "";
  }

  function validateName(name: string) {
    if (name.trim() === "") {
      return $i18n.t("modals.note.create.empty-name-error");
    }

    const existingFile = $app.vault.getAbstractFileByPath(
      normalizePath(getNewNotesFolder(project) + "/" + name + ".md")
    );

    if (existingFile instanceof TFile) {
      return $i18n.t("modals.note.create.name-taken-error");
    }

    if (!isValidPath(name)) {
      return $i18n.t("modals.project.defaultName.invalid");
    }

    if (name.startsWith(".")) {
      return $i18n.t("modals.note.create.dot-start-error");
    }

    return "";
  }

  onMount(() => {
    if (inputRef) inputRef.select();
  });
</script>

<ModalLayout title={$i18n.t("modals.note.create.title")}>
  <ModalContent>
    <SettingItem
      name={$i18n.t("modals.note.create.name.name")}
      description={$i18n.t("modals.note.create.name.description") ?? ""}
    >
      <TextInput
        bind:ref={inputRef}
        value={name}
        on:input={({ detail: value }) => (name = value)}
        autoFocus
        error={!!nameError || !!saveError}
        helperText={nameError || saveError}
        on:keydown={(ev) => {
          if (ev.key === "Enter" && !nameError) {
            ev.preventDefault();
            void submit();
          }
        }}
      />
    </SettingItem>

    {#if chooseProject}
      <SettingItem
        name={$i18n.t("modals.note.create.project.name")}
        description={$i18n.t("modals.note.create.project.description") ?? ""}
      >
        <Select
          value={project.id}
          on:change={({ detail: id }) => {
            const res = $settings.projects.find((w) => w.id === id);
            if (res) {
              project = res;
            }
          }}
          options={projectOptions}
        />
      </SettingItem>
    {/if}

    {#if project.templates.length}
      <SettingItem
        name={$i18n.t("modals.note.create.templatePath.name")}
        description={$i18n.t("modals.note.create.templatePath.description") ??
          ""}
      >
        <Select
          value={templatePath}
          on:change={({ detail: value }) => (templatePath = value)}
          options={templateOptions}
          placeholder={$i18n.t("modals.note.create.templatePath.none") ?? ""}
          allowEmpty
        />
      </SettingItem>
    {/if}
  </ModalContent>
  <ModalButtonGroup>
    <Button
      variant={"primary"}
      disabled={!!nameError || saving}
      on:click={() => void submit()}
    >
      {saving ? $i18n.t("modals.note.create.creating") : $i18n.t("modals.note.create.create")}
    </Button>
  </ModalButtonGroup>
</ModalLayout>
