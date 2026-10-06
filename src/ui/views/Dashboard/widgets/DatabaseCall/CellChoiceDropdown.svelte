<script lang="ts">
  /**
   * CellChoiceDropdown — F2.2 (TABLE_V2_CANON §3). Select/Status in-place
   * editor: a text input with a suggestion listbox. Option creation UX (colored
   * "Create …" row) lands with the header property editor in F2.4.
   *
   * stab-forms: the input and list are the shared ComboField. An IME candidate's
   * Enter no longer commits, and there is no delayed blur commit that could land
   * after a pick: Enter, a pick and blur commit once, Escape cancels. A blur that
   * changed nothing is still reported, so the cell leaves edit mode.
   */
  import { createEventDispatcher } from "svelte";
  import ComboField from "src/ui/components/fields/ComboField.svelte";

  export let draft: string;
  export let options: string[] = [];

  const dispatch = createEventDispatcher<{
    commit: string;
    cancel: void;
  }>();

  // The text the editor opened with; the field owns every edit after that and
  // reports it through `draft`, so the parent's bound draft never feeds back in.
  const initial = draft;

  $: choices = options.map((o) => ({ id: o, label: o }));
</script>

<div class="ppp-t2-choice">
  <ComboField
    value={initial}
    options={choices}
    allowCustom
    commitUnchanged
    focusOnMount
    inputClass="ppp-t2-choice-input"
    optionClass="ppp-t2-choice-item"
    on:draftChange={(e) => (draft = e.detail)}
    on:commit={(e) => dispatch("commit", e.detail.value)}
    on:cancel={() => dispatch("cancel")}
  />
</div>

<style>
  .ppp-t2-choice {
    width: 100%;
    position: relative;
  }

  .ppp-t2-choice :global(.ppp-t2-choice-input) {
    width: 100%;
    min-width: 0;
    border: none;
    background: transparent;
    box-shadow: none;
    font-size: var(--font-ui-small);
    color: var(--text-normal);
    outline: none;
    padding: 0;
  }
</style>
