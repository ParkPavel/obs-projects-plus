<script lang="ts">
  import { i18n } from "src/lib/stores/i18n";
  import { produce } from "immer";
  import { Callout, SettingItem, Typography, Switch } from "obsidian-svelte";
  import type {
    ProjectDefinition,
    ProjectsPluginPreferences,
  } from "src/settings/settings";

  export let preferences: ProjectsPluginPreferences;
  export let projects: ProjectDefinition[];
  export let save: (prefs: ProjectsPluginPreferences) => void;
</script>

{#if !projects.length}
  <Callout title={$i18n.t("common.info")} icon="info" variant="info">
    <Typography variant="body">{$i18n.t("settings.no-project-yet")}</Typography>
  </Callout>
{:else}
  {#each projects as project}
    <SettingItem name={`${project.name}`} description={$i18n.t("settings.commands.project")}>
      <Switch
        checked={!!preferences.commands.find(
          (command) => command.project == project.id && !command.view
        )}
        on:check={({ detail }) => {
          save(
            produce(preferences, (draft) => {
              if (detail) {
                draft.commands.push({
                  project: project.id,
                });
              } else {
                draft.commands = draft.commands.filter(
                  (command) =>
                    !(command.project === project.id && !command.view)
                );
              }
            })
          );
        }}
      />
    </SettingItem>
    {#each project.views as view}
      <SettingItem name={`${project.name}: ${view.name}`} description={$i18n.t("settings.commands.view")}>
        <Switch
          checked={!!preferences.commands.find(
            (command) =>
              command.project == project.id && command.view === view.id
          )}
          on:check={({ detail }) => {
            save(
              produce(preferences, (draft) => {
                if (detail) {
                  draft.commands.push({
                    project: project.id,
                    view: view.id,
                  });
                } else {
                  draft.commands = draft.commands.filter(
                    (command) =>
                      !(
                        command.project === project.id &&
                        command.view === view.id
                      )
                  );
                }
              })
            );
          }}
        />
      </SettingItem>
    {/each}
  {/each}
{/if}
