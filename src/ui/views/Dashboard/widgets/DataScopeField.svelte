<script lang="ts">
  /**
   * «Data scope» — which of this project's sources a block reads (#194).
   *
   * MOVED out of `DatabaseCallSettings`, not copied. One selector, two
   * mountings: the `database-call` panel keeps it where it has always been, and
   * `WidgetHost` mounts the same component for every other type that derives
   * what it shows from the frame (`hasDataScope`). A copy would have given one
   * stored key two writers, which is the shape this project has been burned on
   * before — and it would have duplicated the `rem` these rules carry, which
   * R0.16 counts. The rules moved with it, into `WidgetConfigShell`'s shared
   * form primitives, so the count did not move either.
   *
   * It emits the raw select value and stores nothing itself. "" means the whole
   * project, and turning that into a config is `applyDataScope`'s job: an empty
   * scope REMOVES the key rather than storing `""`, because an absent `sourceId`
   * is what every config written before #170 has and the two must stay one
   * thing.
   */
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import type { SourceOption } from "src/lib/datasources/namedSource";

  export let sourceId: string | undefined = undefined;
  /**
   * The sources of this project that a config can point at.
   *
   * Sources stored before #170 carry no `id` and are absent here, because there
   * is nothing to reference. `hasUnaddressableSource` is what lets the hint say
   * so rather than leaving the user to wonder where their second folder went.
   */
  export let projectSources: ReadonlyArray<SourceOption> = [];
  export let hasUnaddressableSource = false;

  const dispatch = createEventDispatcher<{ change: string }>();

  $: current = sourceId ?? "";
  /**
   * The stored value is ALWAYS an option, even when the source it names is
   * gone. A `<select>` whose value matches no option renders as its first one,
   * so without this a chart pointed at a deleted source would show "All
   * sources" while storing something else — the config invisible in exactly
   * the surface built to make it visible.
   */
  $: options = ((): ReadonlyArray<SourceOption & { missing: boolean }> => {
    const live = projectSources.map((s) => ({ ...s, missing: false }));
    // `sourceLabel` has nothing to read for a source that is gone, so the id
    // stands in for its own name — the same fallback `resolveNamedSource` uses.
    return current && !live.some((s) => s.id === current)
      ? [...live, { id: current, label: current, missing: true }]
      : live;
  })();

  function handleChange(e: Event) {
    dispatch("change", (e.currentTarget as HTMLSelectElement).value);
  }
</script>

{#if options.length > 0}
  <div class="ppp-cfg-item">
    <label class="ppp-cfg-field">
      {$i18n.t("views.dashboard.widget.data-scope.label", { defaultValue: "Which source" })}
      <select value={current} on:change={handleChange}>
        <option value="">
          {$i18n.t("views.dashboard.widget.data-scope.all", { defaultValue: "All sources, within this view" })}
        </option>
        {#each options as src (src.id)}
          <option value={src.id}
            >{src.missing
              ? $i18n.t("views.dashboard.widget.data-scope.missing", { defaultValue: "{{id}} — no longer in this project", id: src.id })
              : src.label}</option
          >
        {/each}
      </select>
      <span class="ppp-cfg-hint">
        {$i18n.t("views.dashboard.widget.data-scope.hint", { defaultValue: "A project can gather records from several sources. This block can show just one of them, within what the view already shows." })}
        {#if hasUnaddressableSource}
          {$i18n.t("views.dashboard.widget.data-scope.unnamed", { defaultValue: "Sources added before naming was introduced cannot be picked — open the project and give them a name." })}
        {/if}
      </span>
    </label>
  </div>
{/if}
