<script lang="ts">
  import { onMount } from "svelte";
  import TextField from "src/ui/components/fields/TextField.svelte";
  import { i18n } from "src/lib/stores/i18n";

  export let initialName: string;
  export let existingNames: string[] = [];
  export let onCommit: (name: string) => void;
  export let onCancel: () => void;
  export let onReady: () => void = () => {};
  let name = initialName;
  let field: TextField;
  let settled = false;
  $: duplicate = existingNames.includes(name.trim());
  function valid(value: string): boolean {
    return value.trim().length > 0 && !existingNames.includes(value.trim());
  }
  function commit(value: string): void {
    if (settled || !valid(value)) return;
    settled = true;
    onCommit(value.trim());
  }
  function cancel(): void {
    if (settled) return;
    settled = true;
    onCancel();
  }
  onMount(() => { onReady(); field.select(); });
</script>

<div class="view-name-draft" data-ppp-field-tools>
  <TextField bind:this={field} value={initialName}
    ariaLabel={$i18n.t("modals.view.create.name.name")}
    validate={valid} error={duplicate} commitUnchanged={true}
    on:input={(event) => (name = event.detail)}
    on:commit={(event) => commit(event.detail.value)} on:cancel={cancel} />
  <button type="button" aria-label={$i18n.t("common.save")}
    on:pointerdown|preventDefault on:mousedown|preventDefault on:click={() => commit(name)}>✓</button>
  <button type="button" aria-label={$i18n.t("common.cancel")}
    on:pointerdown|preventDefault on:mousedown|preventDefault on:click={cancel}>✕</button>
  {#if duplicate}<span role="alert">{$i18n.t("modals.view.create.existing-name-error")}</span>{/if}
</div>

<style>
  .view-name-draft { display: flex; align-items: center; gap: 0.25rem; flex: 0 0 auto; }
  .view-name-draft :global(input) { width: 12rem; }
  button { padding: 0.25rem 0.5rem; }
  [role="alert"] { color: var(--text-error); font-size: var(--font-ui-small); }
</style>
