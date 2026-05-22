<script lang="ts">
  import { getAPI, isPluginEnabled, type DataviewApi } from "obsidian-dataview";
  import { Callout, Loading, Typography } from "obsidian-svelte";
  import {
    createDataSource,
    type DataSource,
    type DataSourceUnavailableReason,
  } from "../../lib/datasources";
  import { dataFrame, dataSource } from "src/lib/stores/dataframe";
  import { fileSystem } from "src/lib/stores/fileSystem";
  import { i18n } from "src/lib/stores/i18n";
  import { app } from "src/lib/stores/obsidian";
  import { settings } from "src/lib/stores/settings";
  import type { ProjectDefinition } from "src/settings/settings";
  import type { DataSource as DataSourceType } from "src/settings/v3/settings";
  import { mergeDataFrames } from "src/lib/datasources/mergeFrames";

  export let project: ProjectDefinition;

  // These shenanigans prevent queries to run when any of the views change.
  // Even if an object didn't change, reassigning it still causes an update.
  $: disassembedProject = disassemble(project);

  // Strings are different though. Even if you reassign a string value, it won't
  // trigger an update if it's the same string.
  $: projectAsText = JSON.stringify(disassembedProject);

  // This only runs if the JSON representation of a project (without views) has
  // changed.
  $: reassembledProject = reassemble(projectAsText);

  // Setting a new data source causes the query to run.
  let unavailableReason: DataSourceUnavailableReason | undefined;
  $: {
    const resolved = resolvePrimary(reassembledProject);
    if (resolved.kind === "ok") {
      unavailableReason = undefined;
      dataSource.set(resolved.source);
    } else {
      unavailableReason = resolved.reason;
      dataSource.set(undefined);
    }
  }

  function disassemble(
    project: ProjectDefinition
  ): Omit<ProjectDefinition, "views" | "agenda"> {
    // Strip views AND agenda — neither affects data queries.
    // agenda is purely display metadata (list order, filter rules, mode).
    // Without this, any agenda change (list reorder, filter edit) triggers
    // a full data re-query → {#await} remounts the View = "plugin reload".
    const { views: _, agenda: _a, ...foo } = project;
    return foo;
  }

  function reassemble(text: string): ProjectDefinition {
    try {
      const res: Omit<ProjectDefinition, "views" | "agenda"> = JSON.parse(text);
      return { ...res, views: [] };
    } catch {
      // Fallback: return last known good project to avoid crashing the plugin
      return { ...project, views: [] };
    }
  }

  let querying: Promise<void>;

  $: {
    // Perform a full refresh of the data frame whenever the data source changes.
    // Live updates are handled by registerFileEvents in main.ts
    querying = (async () => {
      if ($dataSource) {
        const primaryFrame = await $dataSource.queryAll();

        // Multi-source merge: if additionalSources configured, query and merge
        const extraSources = reassembledProject.additionalSources;
        if (extraSources && extraSources.length > 0) {
          const resolvedSources = extraSources
            .map((src) => resolveDataSourceFromConfig(src, reassembledProject))
            .filter((ds): ds is DataSource => ds !== null);
          const extraFrames = await Promise.all(
            resolvedSources.map((ds) => ds.queryAll())
          );
          dataFrame.set(mergeDataFrames([primaryFrame, ...extraFrames]));
        } else {
          dataFrame.set(primaryFrame);
        }
      }
    })();
  }

  function getDataviewAPI(): DataviewApi | undefined {
    if (!isPluginEnabled($app)) return undefined;
    return getAPI($app) ?? undefined;
  }

  type PrimaryResolution =
    | { kind: "ok"; source: DataSource }
    | { kind: "unavailable"; reason: DataSourceUnavailableReason };

  function resolvePrimary(project: ProjectDefinition): PrimaryResolution {
    const resolution = createDataSource(project, {
      fileSystem: $fileSystem,
      preferences: $settings.preferences,
      dataviewApi: getDataviewAPI(),
    });
    if (resolution.kind === "unavailable") {
      return { kind: "unavailable", reason: resolution.reason };
    }
    return { kind: "ok", source: resolution.source };
  }

  /**
   * Resolve a DataSource instance from a raw DataSource config object.
   * Used for additional sources in multi-source merge. Returns `null` when
   * the source's backend is unavailable so the merge skips it instead of
   * failing the whole frame.
   */
  function resolveDataSourceFromConfig(
    src: DataSourceType,
    proj: ProjectDefinition
  ): DataSource | null {
    const overrideProject = { ...proj, dataSource: src } as ProjectDefinition;
    const resolution = createDataSource(overrideProject, {
      fileSystem: $fileSystem,
      preferences: $settings.preferences,
      dataviewApi: getDataviewAPI(),
    });
    return resolution.kind === "ok" ? resolution.source : null;
  }

  const wait = () => new Promise((res) => setTimeout(res, 500));
</script>

{#if unavailableReason === "dataview-unavailable"}
  <div style="padding: var(--size-4-3)">
    <Callout
      title={$i18n.t("errors.missingDataview.title")}
      icon="zap"
      variant="warning"
    >
      <Typography variant="body">
        {$i18n.t("errors.missingDataview.message")}
      </Typography>
    </Callout>
  </div>
{:else}
  {#await querying}
    {#await wait() then}
      <Loading />
    {/await}
  {:then}
    <slot frame={$dataFrame} source={$dataSource} />
  {:catch error}
    <div style="padding: var(--size-4-3)">
      <Callout title={error.name} icon="zap" variant="danger">
        <Typography variant="body">{error.message}</Typography>
      </Callout>
    </div>
  {/await}
{/if}
