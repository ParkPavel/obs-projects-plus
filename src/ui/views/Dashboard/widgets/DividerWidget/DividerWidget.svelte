<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";

  export let config: Record<string, unknown>;
  export let readonly: boolean = false;

  const dispatch = createEventDispatcher<{ change: Record<string, unknown> }>();

  $: label = typeof config?.label === "string" ? config.label : "";
  let editing = false;
  let editValue = "";
  let inputEl: HTMLInputElement;

  async function startEdit() {
    if (readonly) return;
    editValue = label;
    editing = true;
    await tick();
    inputEl?.select();
  }

  function commitEdit() {
    editing = false;
    dispatch("change", { ...config, label: editValue });
  }

  function cancelEdit() {
    editing = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
    if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
  }
</script>

<div class="ppp-divider-widget">
  {#if label || !readonly}
    <div class="ppp-divider-widget__line-row">
      <div class="ppp-divider-widget__line" />
      {#if editing}
        <input
          bind:this={inputEl}
          bind:value={editValue}
          class="ppp-divider-widget__input"
          on:keydown={handleKeydown}
          on:blur={commitEdit}
          placeholder="Divider label…"
        />
      {:else}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-interactive-supports-focus -->
        <span
          class="ppp-divider-widget__label"
          class:ppp-divider-widget__label--empty={!label}
          class:ppp-divider-widget__label--editable={!readonly}
          role={readonly ? undefined : "button"}
          tabindex={readonly ? undefined : 0}
          on:click={startEdit}
          on:keypress={(e) => { if (e.key === "Enter" || e.key === " ") startEdit(); }}
        >
          {label || (readonly ? "" : "+ Add label")}
        </span>
      {/if}
      <div class="ppp-divider-widget__line" />
    </div>
  {:else}
    <div class="ppp-divider-widget__line ppp-divider-widget__line--full" />
  {/if}
</div>

<style>
  .ppp-divider-widget {
    display: flex;
    align-items: center;
    height: 100%;
    padding: 0 0.5rem;
  }

  .ppp-divider-widget__line-row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    width: 100%;
  }

  .ppp-divider-widget__line {
    flex: 1;
    height: 1px;
    background: var(--background-modifier-border);
  }

  .ppp-divider-widget__line--full {
    width: 100%;
  }

  .ppp-divider-widget__label {
    flex-shrink: 0;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-muted);
    white-space: nowrap;
    user-select: none;
    padding: 0 0.125rem;
  }

  .ppp-divider-widget__label--editable {
    cursor: text;
  }

  .ppp-divider-widget__label--editable:hover {
    color: var(--text-normal);
  }

  .ppp-divider-widget__label--empty {
    color: var(--text-faint);
    font-style: italic;
    font-weight: 400;
  }

  .ppp-divider-widget__input {
    flex-shrink: 0;
    width: 8rem;
    font-size: 0.75rem;
    font-weight: 500;
    text-align: center;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--interactive-accent);
    color: var(--text-normal);
    padding: 0 0.25rem;
    font-family: var(--font-interface);
    outline: none;
  }
</style>
