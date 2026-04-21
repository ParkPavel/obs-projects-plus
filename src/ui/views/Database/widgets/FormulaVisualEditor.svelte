<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { FormulaNode as FNode } from "src/lib/helpers/formulaParser";
  import { parseFormula } from "src/lib/helpers/formulaParser";
  import { serializeNode, getFunctionCategory } from "../engine/formulaSerializer";
  import { getFormulaFunctions } from "../engine/formulaEngine";
  import { i18n } from "src/lib/stores/i18n";
  import FormulaNode from "./FormulaNode.svelte";

  export let expression: string = "";
  export let fields: string[] = [];

  const dispatch = createEventDispatcher<{ change: string }>();

  const allFunctions = getFormulaFunctions();

  // Group functions by category for the palette
  const categories = [
    { key: "logic", label: "Logic", fns: allFunctions.filter((f) => getFunctionCategory(f) === "logic") },
    { key: "math", label: "Math", fns: allFunctions.filter((f) => getFunctionCategory(f) === "math") },
    { key: "string", label: "String", fns: allFunctions.filter((f) => getFunctionCategory(f) === "string") },
    { key: "date", label: "Date", fns: allFunctions.filter((f) => getFunctionCategory(f) === "date") },
    { key: "comparison", label: "Compare", fns: allFunctions.filter((f) => getFunctionCategory(f) === "comparison") },
    { key: "conversion", label: "Convert", fns: allFunctions.filter((f) => getFunctionCategory(f) === "conversion") },
  ].filter((c) => c.fns.length > 0);

  let ast: FNode | null = null;
  let parseError = false;
  let showPalette = false;
  let paletteInsertPath: number[] | null = null; // Path in AST to insert at
  let editingLiteral: { path: number[]; value: string } | null = null;

  // Parse expression into AST
  $: {
    if (expression.trim()) {
      try {
        ast = parseFormula(expression);
        parseError = false;
      } catch {
        ast = null;
        parseError = true;
      }
    } else {
      ast = null;
      parseError = false;
    }
  }

  function emitChange(node: FNode) {
    const newExpr = serializeNode(node);
    dispatch("change", newExpr);
  }

  // Insert a function call at a particular path (or root if no path)
  function insertFunction(fnName: string) {
    const newNode: FNode = {
      type: "function",
      name: fnName,
      args: [],
    };

    if (!ast) {
      emitChange(newNode);
    } else if (paletteInsertPath !== null) {
      const updated = insertAtPath(ast, paletteInsertPath, newNode);
      if (updated) emitChange(updated);
    } else {
      // Wrap existing expression as first arg of new function
      emitChange({ type: "function", name: fnName, args: [ast] });
    }
    showPalette = false;
    paletteInsertPath = null;
  }

  function insertField(fieldName: string) {
    const newNode: FNode = { type: "field", name: fieldName };

    if (!ast) {
      emitChange(newNode);
    } else if (paletteInsertPath !== null) {
      const updated = insertAtPath(ast, paletteInsertPath, newNode);
      if (updated) emitChange(updated);
    } else {
      emitChange(newNode);
    }
    showPalette = false;
    paletteInsertPath = null;
  }

  function insertLiteral(value: string | number) {
    const newNode: FNode = {
      type: "literal",
      value: typeof value === "string" ? value : value,
    };

    if (!ast) {
      emitChange(newNode);
    } else if (paletteInsertPath !== null) {
      const updated = insertAtPath(ast, paletteInsertPath, newNode);
      if (updated) emitChange(updated);
    }
    showPalette = false;
    paletteInsertPath = null;
  }

  const VISUAL_OPERATORS = [
    { symbol: "+", label: "+ add" },
    { symbol: "-", label: "− sub" },
    { symbol: "*", label: "× mul" },
    { symbol: "/", label: "÷ div" },
    { symbol: "=", label: "= eq" },
    { symbol: "!=", label: "≠ neq" },
    { symbol: ">", label: "> gt" },
    { symbol: "<", label: "< lt" },
    { symbol: ">=", label: "≥ gte" },
    { symbol: "<=", label: "≤ lte" },
  ];

  function insertOperator(op: string) {
    const placeholder: FNode = { type: "literal", value: "" };
    let leftNode: FNode;
    try {
      leftNode = ast ? structuredClone(ast) as FNode : { ...placeholder };
    } catch {
      leftNode = JSON.parse(JSON.stringify(ast ?? placeholder)) as FNode;
    }
    const newNode: FNode = {
      type: "operator",
      operator: op,
      left: leftNode,
      right: { ...placeholder },
    };
    emitChange(newNode);
    showPalette = false;
    paletteInsertPath = null;
  }

  // Navigate AST by path and insert a node as a new arg at the target function
  function insertAtPath(root: FNode, path: number[], node: FNode): FNode | null {
    if (path.length === 0) {
      return node;
    }

    const clone = structuredClone(root) as FNode;
    let current = clone;

    for (let i = 0; i < path.length - 1; i++) {
      const idx = path[i]!;
      if (current.type === "function" && current.args[idx]) {
        current = current.args[idx]!;
      } else {
        return null;
      }
    }

    if (current.type === "function") {
      current.args.push(node);
    }
    return clone;
  }

  function removeNode(path: number[]) {
    if (!ast || path.length === 0) {
      // Remove root
      dispatch("change", "");
      return;
    }
    const clone = structuredClone(ast) as FNode;
    let parent = clone;
    for (let i = 0; i < path.length - 1; i++) {
      const idx = path[i]!;
      if (parent.type === "function" && parent.args[idx]) {
        parent = parent.args[idx]!;
      } else {
        return;
      }
    }
    if (parent.type === "function") {
      const removeIdx = path[path.length - 1]!;
      parent.args.splice(removeIdx, 1);
    }
    emitChange(clone);
  }

  function updateLiteral(path: number[], value: string) {
    if (!ast) return;
    const clone = structuredClone(ast) as FNode;
    let current = clone;

    for (let i = 0; i < path.length; i++) {
      const idx = path[i]!;
      if (current.type === "function" && current.args[idx]) {
        current = current.args[idx]!;
      } else {
        return;
      }
    }

    if (current.type === "literal") {
      const num = Number(value);
      if (!isNaN(num) && value.trim() !== "") {
        current.value = num;
      } else if (value === "true") {
        current.value = true;
      } else if (value === "false") {
        current.value = false;
      } else {
        current.value = value;
      }
    }
    emitChange(clone);
    editingLiteral = null;
  }

  function openPalette(path: number[] | null) {
    paletteInsertPath = path;
    showPalette = true;
  }
</script>

<div class="ppp-visual-editor">
  <!-- Formula block tree -->
  <div class="ppp-visual-canvas">
    {#if ast}
      <div class="ppp-vblock-tree">
        <FormulaNode
          node={ast}
          path={[]}
          {editingLiteral}
          onRemove={removeNode}
          onOpenPalette={openPalette}
          onEditLiteral={(p, v) => { editingLiteral = { path: p, value: v }; }}
          onCommitLiteral={updateLiteral}
        />
      </div>
    {:else if parseError}
      <div class="ppp-visual-error">{$i18n.t("views.database.formula.visual-parse-error")}</div>
    {:else}
      <button class="ppp-visual-empty" on:click={() => openPalette(null)}>
        {$i18n.t("views.database.formula.visual-empty")}
      </button>
    {/if}
  </div>

  <!-- Function / Field palette -->
  {#if showPalette}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="ppp-palette-overlay" on:click={() => { showPalette = false; }}>
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <div
        class="ppp-palette"
        on:click|stopPropagation
        on:keydown={(e) => { if (e.key === "Escape") showPalette = false; }}
        role="dialog"
        aria-modal="true"
        aria-label={$i18n.t("views.database.formula.palette", { defaultValue: "Formula palette" })}
      >
        <!-- Functions by category -->
        {#each categories as cat}
          <div class="ppp-palette-section">
            <div class="ppp-palette-section-title">{cat.label}</div>
            <div class="ppp-palette-chips">
              {#each cat.fns as fn}
                <button class="ppp-palette-chip ppp-vblock--{cat.key}" on:click={() => insertFunction(fn)}>
                  {fn}
                </button>
              {/each}
            </div>
          </div>
        {/each}

        <!-- Operators -->
        <div class="ppp-palette-section">
          <div class="ppp-palette-section-title">{$i18n.t("views.database.formula.operators", { defaultValue: "Operators" })}</div>
          <div class="ppp-palette-chips">
            {#each VISUAL_OPERATORS as op}
              <button class="ppp-palette-chip ppp-palette-chip--operator" on:click={() => insertOperator(op.symbol)}>
                {op.label}
              </button>
            {/each}
          </div>
        </div>

        <!-- Fields -->
        {#if fields.length > 0}
          <div class="ppp-palette-section">
            <div class="ppp-palette-section-title">{$i18n.t("views.database.formula.fields", { defaultValue: "Fields" })}</div>
            <div class="ppp-palette-chips">
              {#each fields as f}
                <button class="ppp-palette-chip ppp-palette-chip--field" on:click={() => insertField(f)}>
                  {f}
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Literal input -->
        <div class="ppp-palette-section">
          <div class="ppp-palette-section-title">{$i18n.t("views.database.formula.value", { defaultValue: "Value" })}</div>
          <div class="ppp-palette-literal-row">
            <input
              class="ppp-palette-literal-input"
              type="text"
              placeholder={$i18n.t("views.database.formula.enter-value", { defaultValue: "Enter value..." })}
              on:keydown={(e) => {
                if (e.key === "Enter") {
                  const val = e.currentTarget.value;
                  if (val.trim()) insertLiteral(val.trim());
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .ppp-visual-editor {
    position: relative;
    min-height: 4rem;
  }

  .ppp-visual-canvas {
    padding: 0.5rem;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 4px);
    min-height: 3.5rem;
  }

  .ppp-visual-error {
    color: var(--text-error);
    font-size: var(--font-ui-smaller);
    padding: 0.5rem;
  }

  .ppp-visual-empty {
    display: block;
    width: 100%;
    padding: 0.75rem;
    background: none;
    border: 2px dashed var(--background-modifier-border);
    border-radius: var(--radius-s, 4px);
    color: var(--text-faint);
    cursor: pointer;
    font-size: var(--font-ui-small);
    text-align: center;
  }

  .ppp-visual-empty:hover {
    border-color: var(--interactive-accent);
    color: var(--text-muted);
  }

  /* Block tree — :global because FormulaNode renders inside child component */
  .ppp-vblock-tree :global(.ppp-vblock) {
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 4px);
    padding: 0.25rem 0.375rem;
    background: var(--background-primary);
  }

  .ppp-vblock-tree :global(.ppp-vblock--nested) {
    margin-top: 0.125rem;
  }

  .ppp-vblock-tree :global(.ppp-vblock-header) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
  }

  .ppp-vblock-tree :global(.ppp-vblock-name) {
    font-family: var(--font-monospace);
    font-size: var(--font-ui-smaller);
    font-weight: 600;
  }

  /* Category colors */
  .ppp-vblock-tree :global(.ppp-vblock--logic) { border-left: 3px solid #e67e22; }
  .ppp-vblock-tree :global(.ppp-vblock--logic .ppp-vblock-name) { color: #e67e22; }

  .ppp-vblock-tree :global(.ppp-vblock--math) { border-left: 3px solid #3498db; }
  .ppp-vblock-tree :global(.ppp-vblock--math .ppp-vblock-name) { color: #3498db; }

  .ppp-vblock-tree :global(.ppp-vblock--string) { border-left: 3px solid #27ae60; }
  .ppp-vblock-tree :global(.ppp-vblock--string .ppp-vblock-name) { color: #27ae60; }

  .ppp-vblock-tree :global(.ppp-vblock--date) { border-left: 3px solid #8e44ad; }
  .ppp-vblock-tree :global(.ppp-vblock--date .ppp-vblock-name) { color: #8e44ad; }

  .ppp-vblock-tree :global(.ppp-vblock--comparison) { border-left: 3px solid #16a085; }
  .ppp-vblock-tree :global(.ppp-vblock--comparison .ppp-vblock-name) { color: #16a085; }

  .ppp-vblock-tree :global(.ppp-vblock--conversion) { border-left: 3px solid #7f8c8d; }
  .ppp-vblock-tree :global(.ppp-vblock--conversion .ppp-vblock-name) { color: #7f8c8d; }

  .ppp-vblock-tree :global(.ppp-vblock-args) {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: center;
    padding: 0.125rem 0;
  }

  .ppp-vblock-tree :global(.ppp-vblock-arg) {
    display: inline-flex;
  }

  .ppp-vblock-tree :global(.ppp-vblock-chip) {
    display: inline-flex;
    align-items: center;
    gap: 0.125rem;
    padding: 0.125rem 0.375rem;
    border-radius: 10px;
    font-family: var(--font-monospace);
    font-size: var(--font-ui-smaller);
    cursor: pointer;
    border: none;
  }

  .ppp-vblock-tree :global(.ppp-vblock-chip--field) {
    background: var(--background-modifier-hover);
    color: var(--text-accent);
  }

  .ppp-vblock-tree :global(.ppp-vblock-chip--literal) {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
    cursor: text;
  }

  .ppp-vblock-tree :global(.ppp-vblock-chip--column_ref) {
    background: var(--background-modifier-hover);
    color: var(--text-accent);
    font-style: italic;
  }

  .ppp-vblock-tree :global(.ppp-vblock-chip--function),
  .ppp-vblock-tree :global(.ppp-vblock-chip--operator) {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .ppp-vblock-tree :global(.ppp-vblock-chip-remove),
  .ppp-vblock-tree :global(.ppp-vblock-remove) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
    padding: 0;
    border: none;
    background: none;
    color: var(--text-faint);
    cursor: pointer;
    font-size: 0.75rem;
    border-radius: 50%;
    line-height: 1;
  }

  .ppp-vblock-tree :global(.ppp-vblock-chip-remove:hover),
  .ppp-vblock-tree :global(.ppp-vblock-remove:hover) {
    color: var(--text-error);
    background: var(--background-modifier-hover);
  }

  .ppp-vblock-tree :global(.ppp-vblock-add) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    padding: 0;
    border: 1px dashed var(--background-modifier-border);
    border-radius: 50%;
    background: none;
    color: var(--text-faint);
    cursor: pointer;
    font-size: 0.75rem;
    line-height: 1;
  }

  .ppp-vblock-tree :global(.ppp-vblock-add:hover) {
    border-color: var(--interactive-accent);
    color: var(--interactive-accent);
  }

  .ppp-vblock-tree :global(.ppp-vblock--operator) {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
  }

  .ppp-vblock-tree :global(.ppp-vblock-op) {
    font-family: var(--font-monospace);
    font-weight: 700;
    color: var(--text-muted);
  }

  .ppp-vblock-tree :global(.ppp-vblock-literal-input) {
    width: 5rem;
    padding: 0.125rem 0.25rem;
    border: 1px solid var(--interactive-accent);
    border-radius: 10px;
    font-family: var(--font-monospace);
    font-size: var(--font-ui-smaller);
    background: var(--background-primary);
    color: var(--text-normal);
    outline: none;
  }

  /* Palette overlay */
  .ppp-palette-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ppp-palette {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m, 6px);
    box-shadow: var(--shadow-s, 0 4px 12px rgba(0,0,0,0.2));
    padding: 0.75rem;
    max-width: 28rem;
    max-height: 24rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .ppp-palette-section-title {
    font-size: var(--font-ui-smaller);
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .ppp-palette-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .ppp-palette-chip {
    padding: 0.125rem 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    background: var(--background-primary);
    cursor: pointer;
    font-family: var(--font-monospace);
    font-size: 0.6875rem;
    color: var(--text-normal);
  }

  .ppp-palette-chip:hover {
    background: var(--background-modifier-hover);
  }

  .ppp-palette-chip--field {
    color: var(--text-accent);
    border-color: var(--text-accent);
  }

  .ppp-palette-chip--operator {
    color: #c0392b;
    border-color: #c0392b;
    font-weight: 600;
    font-family: var(--font-monospace);
  }

  .ppp-palette-literal-row {
    display: flex;
    gap: 0.5rem;
  }

  .ppp-palette-literal-input {
    flex: 1;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 4px);
    font-family: var(--font-monospace);
    font-size: var(--font-ui-smaller);
    background: var(--background-primary);
    color: var(--text-normal);
  }

  .ppp-palette-literal-input:focus {
    border-color: var(--interactive-accent);
    outline: none;
  }
</style>
