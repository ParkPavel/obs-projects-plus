<script lang="ts">
  /**
   * The «Data scope» panel every data block gets (#194).
   *
   * `DataScopeField` in a shell of its own, mounted by `WidgetHost` for every
   * type that has a data scope EXCEPT `database-call`, which already carries
   * the same field inside its own settings panel.
   *
   * It has its own shell rather than a section inside each type's panel for two
   * reasons. `data-table` has no panel at all — its display settings live in
   * the column context menu — so a section would have had nowhere to go, and
   * this is the whole ticket for that type. And a slot cannot be passed through
   * the `svelte:component` the host mounts panels with in Svelte 3, so the
   * section would have had to be written into six files instead of one.
   *
   * The subtitle is doing work, not decoration. On a `data-table` a cog now
   * appears where there was none, and its own settings are still in the column
   * menu: two doors into different rooms. The panel has to say which room this
   * is, or the user reads the second door as the first one being broken.
   */
  import { i18n } from "src/lib/stores/i18n";
  import type { SourceOption } from "src/lib/datasources/namedSource";
  import WidgetConfigShell from "./_shared/WidgetConfigShell.svelte";
  import DataScopeField from "./DataScopeField.svelte";

  export let sourceId: string | undefined = undefined;
  export let projectSources: ReadonlyArray<SourceOption> = [];
  export let hasUnaddressableSource = false;
</script>

<WidgetConfigShell
  title={$i18n.t("views.dashboard.widget.data-scope.title", { defaultValue: "Data scope" })}
  subtitle={$i18n.t("views.dashboard.widget.data-scope.subtitle", {
    defaultValue: "Which records this block is about. How it displays them is set elsewhere.",
  })}
  on:close
>
  <div class="ppp-cfg-list">
    {#if projectSources.length > 0 || sourceId}
      <DataScopeField {sourceId} {projectSources} {hasUnaddressableSource} on:change />
    {:else}
      <!--
        The cog must never open an empty box. A project with one source has
        nothing to narrow to, and saying so is a different message from the
        select being missing.
      -->
      <span class="ppp-cfg-hint">
        {$i18n.t("views.dashboard.widget.data-scope.single", {
          defaultValue: "This project gathers records from a single source, so there is nothing to narrow to yet.",
        })}
        {#if hasUnaddressableSource}
          {$i18n.t("views.dashboard.widget.data-scope.unnamed", { defaultValue: "Sources added before naming was introduced cannot be picked — open the project and give them a name." })}
        {/if}
      </span>
    {/if}
  </div>
</WidgetConfigShell>
