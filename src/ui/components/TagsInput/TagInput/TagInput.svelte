<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import TextField from "src/ui/components/fields/TextField.svelte";
  import { isImeKey } from "src/ui/components/fields/draftController";
  import { i18n } from "src/lib/stores/i18n";
  export let value: string;
  let field: TextField;
  let draftLength = value.length + 1;
  $: draftLength = value.length + 1;
  export function focus(): void { field?.focus(); }

  const dispatch = createEventDispatcher<{
    input: string;
    submit: string;
    focus: FocusEvent;
    escape: void;
    navigatePrev: void;
  }>();
  function commit(event: CustomEvent<{ value: string }>): void {
    const draft = event.detail.value;
    if (!draft || draft === value) { dispatch("escape"); return; }
    dispatch("submit", draft);
    field.reset("");
    draftLength = 1;
  }
  function navigate(event: KeyboardEvent): void {
    if (field.isComposing() || isImeKey(event)) return;
    const input = event.target as HTMLInputElement;
    if (!input.value && ["ArrowLeft", "ArrowUp", "Backspace"].includes(event.key)) {
      event.preventDefault();
      dispatch("navigatePrev");
    }
  }
</script>

<TextField
  bind:this={field}
  {value}
  commitUnchanged
  inputClass="ppp-tag-input"
  ariaLabel={$i18n.t("data-types.list")}
  style="width: {draftLength}ch"
  on:click={(event) => event.stopPropagation()}
  on:focus={(event) => {
    if (value) field.select();
    dispatch("focus", event);
  }}
  on:keydown={navigate}
  on:input={({ detail }) => { draftLength = Math.max(1, detail.length + 1); dispatch("input", detail); }}
  on:commit={commit}
  on:cancel={() => { draftLength = value.length + 1; dispatch("escape"); }}
/>

<style>
  :global(.ppp-tag-input) {
    min-width: 1ch;
    max-width: 100%;
    box-sizing: border-box;

    cursor: text;
    font-family: var(--font-interface);
    color: var(--text-normal);
    background-color: transparent;
    border: none;
    padding: 0;
    box-shadow: none;
    overflow-x: auto;
    white-space: nowrap;
  }
</style>
