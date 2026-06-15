<script lang="ts">
  /**
   * TableNewRow — F2.3 (TABLE_V2_CANON §1/§3). Inline record creation at the
   * body end: «+ New» → name input; Enter commits and chains the next one,
   * Esc dismisses, blur commits once.
   */
  import { createEventDispatcher, tick } from "svelte";
  import { i18n } from "src/lib/stores/i18n";

  const dispatch = createEventDispatcher<{ create: string }>();

  let active = false;
  let name = "";
  let inputEl: HTMLInputElement | null = null;

  async function open() {
    active = true;
    await tick();
    inputEl?.focus();
  }

  function commit(keepOpen: boolean) {
    const trimmed = name.trim();
    if (trimmed) dispatch("create", trimmed);
    name = "";
    active = keepOpen && !!trimmed;
    if (active) void tick().then(() => inputEl?.focus());
  }
</script>

<div class="ppp-t2-newrow">
  {#if active}
    <input
      bind:this={inputEl}
      class="ppp-t2-newrow-input"
      type="text"
      bind:value={name}
      placeholder={$i18n.t("views.dashboard.table-v2.new-name", { defaultValue: "Note name…" })}
      on:keydown={(e) => {
        if (e.key === "Enter") commit(true);
        else if (e.key === "Escape") { name = ""; active = false; }
      }}
      on:blur={() => commit(false)}
    />
  {:else}
    <button class="ppp-t2-newrow-btn" on:click={open}>
      + {$i18n.t("views.dashboard.table-v2.new", { defaultValue: "New" })}
    </button>
  {/if}
</div>

<style>
  .ppp-t2-newrow {
    display: flex;
    align-items: center;
    min-height: 2.25rem;
    padding: 0 0.5rem;
  }

  .ppp-t2-newrow-btn {
    border: none;
    background: transparent;
    color: var(--text-faint);
    font-size: var(--font-ui-small);
    cursor: pointer;
    padding: 0.25rem 0;
  }

  .ppp-t2-newrow-btn:hover {
    color: var(--text-muted);
  }

  .ppp-t2-newrow-input {
    width: 100%;
    max-width: 20rem;
    height: 1.75rem;
    font-size: var(--font-ui-small);
  }
</style>
