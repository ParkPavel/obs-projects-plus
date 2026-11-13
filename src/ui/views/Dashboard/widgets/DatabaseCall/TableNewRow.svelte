<script lang="ts">
  /** F2.3 inline record creation at the table body's end. */
  import { createEventDispatcher, onDestroy, tick } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import TextField from "src/ui/components/fields/TextField.svelte";
  import { createTableNewRowDraft } from "./tableNewRowDraft";
  import { onCellRetry } from "./tableEditing";

  /** Counter catches header signals raised before this lazy row is mounted. */
  export let openSignal = 0;
  export let contextKey = "";
  export let save: ((name: string) => void | Promise<void>) | undefined = undefined;

  const dispatch = createEventDispatcher<{ create: string }>();

  let input: TextField | undefined;
  let seenOpenSignal = 0;
  let focused = 0, alive = true;
  const draft = createTableNewRowDraft(
    name => { if (save) return save(name); dispatch("create", name); },
    error => $i18n.t("modals.note.create.save-error", { message: error instanceof Error ? error.message : String(error) }),
  );
  onDestroy(() => { alive = false; draft.destroy(); });
  $: draft.context(contextKey);
  const retry = onCellRetry(() => input?.retryCommit());
  $: retry($draft.retry);

  $: if (openSignal > seenOpenSignal) {
    seenOpenSignal = openSignal;
    draft.open();
  }
  async function focus(version: number) {
    await tick();
    if (alive && $draft.active && $draft.focus === version) input?.focus();
  }
  $: if ($draft.focus !== focused) { focused = $draft.focus; void focus(focused); }
</script>

<div class="ppp-t2-newrow">
  {#if $draft.active}
    {#key $draft.generation}<TextField
      bind:this={input} value={$draft.name} readOnly={$draft.saving} error={!!$draft.error} commitUnchanged
      inputClass="ppp-t2-newrow-input"
      placeholder={$i18n.t("views.dashboard.table-v2.new-name", { defaultValue: "Note name…" })}
      ariaLabel={$i18n.t("views.dashboard.table-v2.new-name", { defaultValue: "Note name…" })}
      on:input={(event) => draft.input(event.detail)} on:cancel={draft.cancel}
      on:commit={(event) => { void draft.commit(event.detail.reason === "enter"); }}
    />{/key}
    {#if $draft.error}<span role="alert">{$draft.error}</span>{/if}
  {:else}
    <button class="ppp-t2-newrow-btn" disabled={$draft.saving} on:click={draft.open}>
      + {$i18n.t("views.dashboard.table-v2.new", { defaultValue: "New" })}
    </button>
  {/if}
</div>

<style>
  .ppp-t2-newrow {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    min-height: 2.25rem;
    padding: 0 0.5rem;
  }

  .ppp-t2-newrow-btn {
    align-self: flex-start;
    border: none;
    background: transparent;
    color: var(--text-faint);
    font-size: var(--font-ui-small);
    cursor: pointer;
    padding: 0.25rem 0;
  }

  @media (hover: hover) and (pointer: fine) { .ppp-t2-newrow-btn:hover { color: var(--text-muted); } }

  .ppp-t2-newrow :global(.ppp-t2-newrow-input) {
    width: 100%;
    max-width: 20rem;
    height: 1.75rem;
    min-height: var(--ppp-touch-target-min);
    font-size: var(--font-ui-small);
  }
  .ppp-t2-newrow > span[role="alert"] { color: var(--text-error); font-size: var(--font-ui-smaller); overflow-wrap: anywhere; }
</style>
