<script lang="ts">
  import { getAPI, isPluginEnabled, type DataviewApi } from "obsidian-dataview";
  import { Callout, Loading, Typography } from "obsidian-svelte";
  import {
    createDataSource,
    type DataSource,
    type DataSourceUnavailableReason,
  } from "../../lib/datasources";
  import { dataFrame, dataSource, frameParts } from "src/lib/stores/dataframe";
  import { isAcquirable } from "src/lib/datasources/derivedSource";
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
          const pairs = extraSources
            // #170 step 2: a derived source has no vault query to run — it
            // narrows records the project already has, at axis A of the
            // consuming view. Excluding it here is explicit rather than
            // accidental: it would otherwise fall through `createDataSource`
            // to "unresolvable" and be dropped, which works until someone adds
            // a default branch.
            .filter((src) => isAcquirable(src))
            .map((src) => ({ src, ds: resolveDataSourceFromConfig(src, reassembledProject) }))
            .filter((p): p is { src: typeof extraSources[number]; ds: DataSource } => p.ds !== null);
          const extraFrames = await Promise.all(pairs.map(({ ds }) => ds.queryAll()));
          // #170 step 1: the merge stays the project's frame, and provenance is
          // kept beside it. A block that names one source looks the frame up
          // here rather than querying again — acquisition happens once, and a
          // block that names nothing is served the merge exactly as before.
          frameParts.set([
            { id: (reassembledProject.dataSource as { id?: string }).id, frame: primaryFrame },
            ...pairs.map(({ src, ds: _ds }, i) => ({
              id: (src as { id?: string }).id,
              frame: extraFrames[i]!,
            })),
          ]);
          dataFrame.set(mergeDataFrames([primaryFrame, ...extraFrames]));
        } else {
          frameParts.set([
            { id: (reassembledProject.dataSource as { id?: string }).id, frame: primaryFrame },
          ]);
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
