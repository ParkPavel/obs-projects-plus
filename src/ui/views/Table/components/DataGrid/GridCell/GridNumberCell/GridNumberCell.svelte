<script lang="ts">
  import GridCell from "../GridCell.svelte";
  import NumberLabel from "./NumberLabel.svelte";
  import NumberInput from "./NumberInput.svelte";
  import { isNumber, type Optional } from "src/lib/dataframe/dataframe";
  import type { GridColDef } from "../../dataGrid";

  import { copyToClipboard, readFromClipboard } from "src/lib/helpers/clipboard";
  import { parseCellInput } from "src/lib/database/cellEditor";
  import { Notice } from "obsidian";
  import { i18n } from "src/lib/stores/i18n";

  export let value: Optional<number>;
  export let onChange: (value: Optional<number>) => void;
  export let column: GridColDef;
  export let rowindex: number;
  export let colindex: number;
  export let selected: boolean;

  let edit: boolean = false;

  // R2.1c — route paste through cellEditor.parseCellInput so pasting
  // garbage text no longer silently writes `NaN` to frontmatter.
  // Empty / whitespace clears the cell, parity with Visualizer.
  async function handlePaste() {
    const text = await readFromClipboard();
    const result = parseCellInput(text, "number");
    if (!result.ok) {
      new Notice($i18n.t(result.error.i18nKey));
      return;
    }
    onChange(result.value as Optional<number>);
  }
</script>

<GridCell
  bind:edit
  bind:selected
  {column}
  on:mousedown
  on:navigate
  {rowindex}
  {colindex}
  onCopy={() => {
    copyToClipboard(value?.toString() || "");
  }}
  onCut={() => {
    copyToClipboard(value?.toString() || "");
    onChange(null);
  }}
  onPaste={handlePaste}
>
  <svelte:fragment slot="read">
    {#if isNumber(value)}
      <NumberLabel {value} />
    {/if}
  </svelte:fragment>
  <NumberInput
    slot="edit"
    on:blur={(event) => {
      if (
        event.currentTarget instanceof HTMLInputElement &&
        event.relatedTarget instanceof HTMLDivElement &&
        !event.relatedTarget.contains(event.currentTarget)
      ) {
        selected = false;
        edit = false;
      }
    }}
    value={value ?? 0}
    onChange={(value) => {
      onChange(value);
    }}
  />
</GridCell>
