<script lang="ts">
  /**
   * NPLAN-V7.1 — Settings panel for `database-call` widgets.
   *
   * Lets the user pick an independent data source (any sibling project)
   * instead of inheriting the canvas's parent frame. Opened via the widget
   * header cog button; rendered inline (not modal) per invariant §10.
   */
  import { createEventDispatcher } from "svelte";
  import { emitCommand } from "src/lib/stores/commandBus";
  import { i18n } from "src/lib/stores/i18n";
  import WidgetConfigShell from "../_shared/WidgetConfigShell.svelte";
  import DataScopeField from "../DataScopeField.svelte";
  import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";
  import type { WidgetSourceConfig, LinkedSelectionConfig } from "../../types";
  import type { LegacyLinkedSelectionStatus } from "src/lib/relations/relationContract";

  export let sourceConfig: WidgetSourceConfig | undefined = undefined;
  export let availableSources: Array<{ id: string; name: string }> = [];
  /**
   * #184: the sources of THIS project — a different dimension from
   * `availableSources`, which lists sibling projects. Two dimensions, two
   * selects: merging them would make "project X" and "the second source of the
   * project I am in" indistinguishable by kind.
   *
   * Sources stored before #170 have no `id` and are absent here, because there
   * is nothing to point at. The hint says so rather than leaving the user to
   * wonder where their second folder went.
   */
  export let projectSources: ReadonlyArray<{ id: string; label: string }> = [];
  /** True when the project holds a source that cannot be addressed (no id). */
  export let hasUnaddressableSource = false;
  export let availableWidgets: Array<{ id: string; title: string }> = [];
  export let fields: DataField[] = [];
  export let linkedSelection: LinkedSelectionConfig | undefined = undefined;
  export let linkedSelectionValidation: LegacyLinkedSelectionStatus | undefined = undefined;

  const dispatch = createEventDispatcher<{
    change: WidgetSourceConfig;
    close: void;
    linkedSelectionChange: LinkedSelectionConfig | undefined;
  }>();

  $: currentProjectId = sourceConfig?.projectId ?? "";
  $: currentLinkedId = linkedSelection?.sourceWidgetId ?? "";
  $: currentRelationField = linkedSelection?.relationField ?? "";
  // E2: only Relation-type fields are valid for the linked-selection filter.
  $: relationFields = fields.filter((f) => f.type === DataFieldType.Relation);
  // E8: show inline hint when validation indicates a problem.
  // #151 — `invalid-field` was missing from this list, so deleting the Relation
  // property a block filters through left the panel looking correctly
  // configured while the block silently fell back to the plain selection.
  $: showRelationHint =
    linkedSelectionValidation === "missing-relation" ||
    linkedSelectionValidation === "wrong-target-project" ||
    linkedSelectionValidation === "invalid-field";

  function handleSourceChange(e: Event) {
    const projectId = (e.currentTarget as HTMLSelectElement).value;
    // #184: `sourceId` names a source of THIS project and means nothing in
    // another one, so switching project drops it. That is correct, and it is
    // why the second select only appears while this one is on "this view".
    dispatch("change", { projectId });
  }

  function handleProjectSourceChange(e: CustomEvent<string>) {
    const sourceId = e.detail;
    // An empty value is "the whole project", and it removes the key rather
    // than storing "" — an absent `sourceId` is what every config written
    // before #184 has, and the two must stay the same thing.
    dispatch("change", sourceId ? { projectId: "", sourceId } : { projectId: "" });
  }

  function handleLinkedBlockChange(e: Event) {
    const id = (e.currentTarget as HTMLSelectElement).value;
    if (!id) { dispatch("linkedSelectionChange", undefined); return; }
    dispatch("linkedSelectionChange", { sourceWidgetId: id, relationField: "" });
  }

  function handleRelationFieldChange(e: Event) {
    const field = (e.currentTarget as HTMLSelectElement).value;
    if (!currentLinkedId) return;
    dispatch("linkedSelectionChange", { sourceWidgetId: currentLinkedId, relationField: field });
  }
</script>

<WidgetConfigShell
  title={$i18n.t("views.dashboard.database-call.settings.title", {
    defaultValue: "Data Source",
  })}
  subtitle={$i18n.t("views.dashboard.database-call.settings.subtitle", {
    defaultValue: "Load data from a different project instead of the current view.",
  })}
  on:close={() => dispatch("close")}
>
  <div class="ppp-cfg-list">
    <div class="ppp-cfg-item">
      <label class="ppp-cfg-field">
        {$i18n.t("views.dashboard.database-call.settings.source", {
          defaultValue: "Source project",
        })}
        <select value={currentProjectId} on:change={handleSourceChange}>
          <option value="">
            {$i18n.t("views.dashboard.database-call.settings.source-inherit", {
              defaultValue: "This view's data (default)",
            })}
          </option>
          {#each availableSources as src (src.id)}
            <option value={src.id}>{src.name}</option>
          {/each}
        </select>
        <span class="ppp-cfg-hint">{$i18n.t("views.dashboard.database-call.settings.source-hint", { defaultValue: "By default the block shows this view's records. Pick another project to show its data instead." })}</span>
      </label>
    </div>
    {#if currentProjectId === ""}
      <!--
        Only while the block reads THIS view. With another project selected a
        `sourceId` is ignored downstream by construction, and a select that
        stores something nothing reads is a visible promise with no effect.
        #194 moved the selector itself into `DataScopeField`, which renders
        nothing when the project has no source to pick — the same condition
        this `{#if}` used to spell out.
      -->
      <DataScopeField
        sourceId={sourceConfig?.sourceId}
        {projectSources}
        {hasUnaddressableSource}
        on:change={handleProjectSourceChange}
      />
    {/if}
    <div class="ppp-cfg-item">
      <label class="ppp-cfg-field">
        {$i18n.t("views.dashboard.database-call.settings.link-to", { defaultValue: "Link to block" })}
        <select value={currentLinkedId} on:change={handleLinkedBlockChange}>
          <option value="">{$i18n.t("views.dashboard.database-call.settings.standalone", { defaultValue: "No link — show all records" })}</option>
          {#each availableWidgets as w (w.id)}
            <option value={w.id}>{w.title || w.id}</option>
          {/each}
        </select>
        <span class="ppp-cfg-hint">{$i18n.t("views.dashboard.database-call.settings.link-hint", { defaultValue: "Without a link the block shows all records. With a link it shows only records related to the chosen block." })}</span>
      </label>
    </div>
    {#if currentLinkedId}
    <div class="ppp-cfg-item">
      <label class="ppp-cfg-field">
        {$i18n.t("views.dashboard.database-call.settings.relation-field", { defaultValue: "Filter by field" })}
        <select value={currentRelationField} on:change={handleRelationFieldChange}>
          <option value="">— {$i18n.t("views.dashboard.database-call.settings.select-field", { defaultValue: "select field" })} —</option>
          {#each relationFields as f (f.name)}
            <option value={f.name}>{f.name}</option>
          {/each}
        </select>
      </label>
      {#if showRelationHint}
        <!--
          #188. The message was correct and the user still read the screen as
          broken, so the fix is reach rather than wording: it now ends where the
          work is done instead of naming a place the reader has to go find. The
          button goes through the same command bus the palette uses, so there is
          one way to open the schema editor and not two.
        -->
        <span class="ppp-cfg-hint ppp-cfg-hint--warn">
          {$i18n.t("views.dashboard.database-call.settings.relation-missing-hint", {
            defaultValue: "No Relation field points at the linked block's project — add one to filter by it.",
          })}
          <button class="ppp-dbc-settings__hint-action" on:click={() => emitCommand("open-schema")}>
            {$i18n.t("views.dashboard.database-call.settings.relation-open-schema", {
              defaultValue: "Open schema editor",
            })}
          </button>
        </span>
      {/if}
    </div>
    {/if}
  </div>
</WidgetConfigShell>

<style>
  .ppp-dbc-settings__hint-action {
    /* `em`, not `rem`: the hint sizes with the panel it lives in, and this
       component renders inside a widget (R0.16). */
    margin-left: 0.4em;
    padding: 0;
    border: none;
    background: none;
    color: var(--text-accent);
    font: inherit;
    cursor: pointer;
    text-decoration: underline;
  }

  /*
    `.ppp-cfg-field`, `.ppp-cfg-field select`, `.ppp-cfg-hint` and
    `.ppp-cfg-hint--warn` MOVED to `WidgetConfigShell` in #194 — they are the
    shared form primitives this panel and `DataScopeField` both render, and a
    scoped rule cannot cross that boundary.
  */
</style>
