<script lang="ts">
  /**
   * FormulaNode — recursive visual block for a FormulaNode AST.
   * Uses <svelte:self> to render nested function calls, operators, and arrays
   * to unlimited depth.
   */
  import type { FormulaNode as FNode } from "src/lib/helpers/formulaParser";
  import { getFunctionCategory } from "../engine/formulaSerializer";

  export let node: FNode;
  export let path: number[];
  export let editingLiteral: { path: number[]; value: string } | null = null;
  export let onRemove: (path: number[]) => void;
  export let onOpenPalette: (path: number[]) => void;
  export let onEditLiteral: (path: number[], value: string) => void;
  export let onCommitLiteral: (path: number[], value: string) => void;

  function nodeLabel(n: FNode): string {
    switch (n.type) {
      case "function": return n.name;
      case "field": return n.name;
      case "column_ref": return `@${n.name}`;
      case "literal":
        if (n.value === null) return "null";
        if (typeof n.value === "string") return `"${n.value}"`;
        return String(n.value);
      case "operator": return n.operator;
      case "array": return `[${n.items.length}]`;
      default: return "?";
    }
  }

  function getCategoryClass(fnName: string): string {
    return `ppp-vblock--${getFunctionCategory(fnName)}`;
  }

  function pathEquals(a: number[], b: number[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }

  $: isEditingThis = node.type === "literal" && editingLiteral !== null && pathEquals(editingLiteral.path, path);
</script>

{#if node.type === "function"}
  <div class="ppp-vblock ppp-vblock--fn {getCategoryClass(node.name)}" class:ppp-vblock--nested={path.length > 0}>
    <div class="ppp-vblock-header">
      <span class="ppp-vblock-name">{node.name}</span>
      <button class="ppp-vblock-remove" on:click={() => onRemove(path)}>×</button>
    </div>
    <div class="ppp-vblock-args">
      {#each node.args as arg, i}
        <div class="ppp-vblock-arg">
          <svelte:self
            node={arg}
            path={[...path, i]}
            {editingLiteral}
            {onRemove}
            {onOpenPalette}
            {onEditLiteral}
            {onCommitLiteral}
          />
        </div>
      {/each}
      <button class="ppp-vblock-add" on:click={() => onOpenPalette(path)}>+</button>
    </div>
  </div>
{:else if node.type === "operator"}
  <div class="ppp-vblock ppp-vblock--operator" class:ppp-vblock--nested={path.length > 0}>
    <svelte:self
      node={node.left}
      path={[...path, 0]}
      {editingLiteral}
      {onRemove}
      {onOpenPalette}
      {onEditLiteral}
      {onCommitLiteral}
    />
    <span class="ppp-vblock-op">{node.operator}</span>
    <svelte:self
      node={node.right}
      path={[...path, 1]}
      {editingLiteral}
      {onRemove}
      {onOpenPalette}
      {onEditLiteral}
      {onCommitLiteral}
    />
    <button class="ppp-vblock-remove" on:click={() => onRemove(path)}>×</button>
  </div>
{:else if node.type === "array"}
  <div class="ppp-vblock ppp-vblock--array" class:ppp-vblock--nested={path.length > 0}>
    {#each node.items as item, i}
      <div class="ppp-vblock-arg">
        <svelte:self
          node={item}
          path={[...path, i]}
          {editingLiteral}
          {onRemove}
          {onOpenPalette}
          {onEditLiteral}
          {onCommitLiteral}
        />
      </div>
    {/each}
    <button class="ppp-vblock-remove" on:click={() => onRemove(path)}>×</button>
  </div>
{:else if isEditingThis}
  <input
    class="ppp-vblock-literal-input"
    value={editingLiteral?.value ?? ""}
    on:blur={(e) => onCommitLiteral(path, e.currentTarget.value)}
    on:keydown={(e) => { if (e.key === "Enter") onCommitLiteral(path, e.currentTarget.value); }}
  />
{:else}
  <!-- Terminal nodes: field, literal, column_ref -->
  <span
    class="ppp-vblock-chip ppp-vblock-chip--{node.type}"
    on:click={() => {
      if (node.type === "literal") onEditLiteral(path, String(node.value ?? ""));
    }}
    on:keydown={(e) => {
      if (e.key === "Enter" && node.type === "literal") onEditLiteral(path, String(node.value ?? ""));
    }}
    role="button"
    tabindex="0"
  >
    {nodeLabel(node)}
    <button class="ppp-vblock-chip-remove" on:click|stopPropagation={() => onRemove(path)}>×</button>
  </span>
{/if}
