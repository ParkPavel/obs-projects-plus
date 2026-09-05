<script lang="ts">
  /**
   * WidgetContent — what a block shows, and the reasons it shows something else.
   *
   * Three fallbacks, in the order a reader meets them: a type that has content
   * but is not configured yet (the wizard), a retired legacy type (the
   * placeholder and its conversion), and a type with no content component at
   * all. The host used to hold this chain inline.
   *
   * It moved out for the reason `hostFrames.ts` and `renderContext.ts` did, and
   * the reason is a measurement rather than taste: `WidgetHost.svelte` stood at
   * 229 lines against a ceiling of 230 (R0.6), and #194 needed about ten. A
   * ceiling may only be lowered, so the room had to be freed before it could be
   * spent — and this chain is the part of the host that is about ONE widget's
   * body rather than about routing, which makes it the honest thing to lift.
   *
   * Event wiring stays a forward: every listener the host attached to the
   * content component it attaches here, and Svelte's bare `on:name` passes them
   * through untouched. The one exception is `convert`, which needs
   * `convertLegacyWidget` to say what the patch IS — so it is resolved here and
   * re-emitted as `patch`, rather than making the host import the migration
   * table for a single expression.
   */
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import type { WidgetDefinition } from "../types";
  import type { ContentEntry, WidgetRenderContext } from "./widgetComponentRegistry";
  import { convertLegacyWidget, isRetiredLegacyType } from "./legacyMigration";
  import { hostSourceNotice } from "./dataScope";
  import EmptyState from "src/ui/components/EmptyState/EmptyState.svelte";
  import WidgetSetupWizard from "./WidgetSetupWizard.svelte";
  import LegacyWidgetPlaceholder from "./LegacyWidgetPlaceholder.svelte";

  export let widget: WidgetDefinition;
  export let ctx: WidgetRenderContext;
  export let entry: ContentEntry | undefined = undefined;
  export let readonly: boolean;

  const dispatch = createEventDispatcher<{ patch: Partial<WidgetDefinition> }>();

  $: renderable = entry ? (entry.canRender?.(ctx) ?? true) : false;
  /**
   * #194. A named source that cannot be resolved makes `hostFrames` fall back
   * to the whole project, and until this line the explanation reached only the
   * two types that render through `DatabaseCallBlock`. A chart therefore drew
   * the project's numbers with nothing to say they were not its source's —
   * plausible and wrong, which is worse than empty. Ahead of the wizard on
   * purpose: a broken source is a configuration fault, and "not configured yet"
   * would send the user to fix the wrong thing.
   */
  $: sourceNotice = hostSourceNotice(widget.type, ctx.namedSource);

  function handleConvert() {
    const patch = convertLegacyWidget(widget);
    if (patch) dispatch("patch", patch);
  }
</script>

{#if sourceNotice}
  <EmptyState
    icon={sourceNotice.icon}
    title={$i18n.t(sourceNotice.key, { defaultValue: sourceNotice.fallback, ...sourceNotice.vars })}
    hint={sourceNotice.hint ?? ""}
  />
{:else if entry && renderable}
  <svelte:component
    this={entry.component}
    {...entry.props(ctx)}
    on:configChange
    on:change
    on:filter
    on:fieldPresetsChange
    on:openPipeline
    on:clearPipeline
  />
{:else if entry?.wizard}
  <WidgetSetupWizard
    icon={entry.wizard.icon}
    message={$i18n.t(entry.wizard.messageKey, { defaultValue: entry.wizard.messageDefault })}
    on:configure
  />
{:else if isRetiredLegacyType(widget.type)}
  <LegacyWidgetPlaceholder
    widgetType={widget.type}
    convertible={convertLegacyWidget(widget) !== null}
    {readonly}
    on:convert={handleConvert}
  />
{:else}
  <div class="ppp-widget-placeholder">
    {$i18n.t("views.dashboard.widget.not-configured", { type: widget.type })}
  </div>
{/if}
