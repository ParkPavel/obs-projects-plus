<script lang="ts">
  import { GridCell } from "..";
  import type { GridColDef } from "../../dataGrid";
  import { TextInput } from "obsidian-svelte";
  import { app } from "src/lib/stores/obsidian";
  import type { Optional } from "src/lib/dataframe/dataframe";
  import { getContext } from "svelte";
  import { copyToClipboard, readFromClipboard } from "src/lib/helpers/clipboard";

  export let value: Optional<string>;
  export let onChange: (value: Optional<string>) => void;
  export let column: GridColDef;
  export let rowindex: number;
  export let colindex: number;
  export let selected: boolean;

  const sourcePath = getContext<string>("sourcePath") ?? "";

  let edit = false;
  let isDragOver = false;

  interface WikiLink { target: string; display: string; raw: string; }

  function parseWikiLinks(str: string): WikiLink[] {
    const re = /\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g;
    const out: WikiLink[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(str)) !== null) {
      out.push({ target: m[1].trim(), display: (m[2] ?? m[1]).trim(), raw: m[0] });
    }
    return out;
  }

  $: chips = parseWikiLinks(value ?? "");

  function openLink(target: string) {
    $app.workspace.openLinkText(target, sourcePath, false);
  }

  function removeLink(raw: string) {
    const next = (value ?? "").replace(raw, "").replace(/\s{2,}/g, " ").trim() || null;
    onChange(next);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "link";
    isDragOver = true;
  }

  function handleDragLeave() {
    isDragOver = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragOver = false;
    const text = e.dataTransfer?.getData("text/plain") ?? "";
    if (!text.trim()) return;
    // Strip .md extension and wrap as wiki-link
    const target = text.trim().replace(/\.md$/, "");
    const link = `[[${target}]]`;
    const next = value ? `${value} ${link}` : link;
    onChange(next);
  }
</script>

<GridCell
  bind:edit
  bind:selected
  {column}
  {rowindex}
  {colindex}
  on:mousedown
  on:navigate
  onCopy={() => copyToClipboard(value ?? "")}
  onCut={() => { copyToClipboard(value ?? ""); onChange(null); }}
  onPaste={async () => { onChange(await readFromClipboard()); }}
>
  <svelte:fragment slot="read">
    <div
      class="ppp-file-chips"
      class:ppp-file-chips--dragover={isDragOver}
      on:dragover={handleDragOver}
      on:dragleave={handleDragLeave}
      on:drop={handleDrop}
    >
      {#if chips.length > 0}
        {#each chips as chip}
          <span class="ppp-file-chip">
            <span
              class="ppp-file-chip__label"
              role="button"
              tabindex="-1"
              on:click|stopPropagation={() => openLink(chip.target)}
              on:keydown={(e) => { if (e.key === "Enter") { e.stopPropagation(); openLink(chip.target); } }}
            >{chip.display}</span>
            <button
              class="ppp-file-chip__remove"
              tabindex="-1"
              aria-label="Remove link"
              on:click|stopPropagation={() => removeLink(chip.raw)}
            >×</button>
          </span>
        {/each}
      {:else}
        <span class="ppp-file-chips__empty">{value ?? ""}</span>
      {/if}
    </div>
  </svelte:fragment>
  <svelte:fragment slot="edit">
    <TextInput
      autoFocus
      value={value || ""}
      embed
      width="100%"
      on:input={({ detail }) => (value = detail)}
      on:blur={(event) => {
        if (
          event.currentTarget instanceof HTMLInputElement &&
          event.relatedTarget instanceof HTMLDivElement &&
          !event.relatedTarget.contains(event.currentTarget)
        ) {
          selected = false;
          edit = false;
        }
        onChange(value);
      }}
    />
  </svelte:fragment>
</GridCell>

<style>
  .ppp-file-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    padding: 0.25rem 0.375rem;
    width: 100%;
    align-items: center;
  }

  .ppp-file-chip {
    display: inline-flex;
    align-items: center;
    background: var(--background-modifier-hover);
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    font-size: var(--font-ui-smaller);
    line-height: 1.4;
    max-width: 10rem;
    overflow: hidden;
    flex-shrink: 0;
  }

  .ppp-file-chip__label {
    padding: 0.125rem 0.25rem;
    cursor: pointer;
    color: var(--link-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    user-select: none;
  }

  .ppp-file-chip__label:hover {
    text-decoration: underline;
  }

  .ppp-file-chip__remove {
    padding: 0 0.25rem;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-muted);
    font-size: var(--font-ui-small);
    line-height: 1.4;
    flex-shrink: 0;
  }

  .ppp-file-chip__remove:hover {
    color: var(--text-error);
  }

  .ppp-file-chips__empty {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ppp-file-chips--dragover {
    outline: 0.125rem dashed var(--interactive-accent);
    outline-offset: -0.0625rem;
    background: rgba(var(--interactive-accent-rgb, 122, 104, 238), 0.06);
    border-radius: var(--radius-s, 0.25rem);
  }
</style>
