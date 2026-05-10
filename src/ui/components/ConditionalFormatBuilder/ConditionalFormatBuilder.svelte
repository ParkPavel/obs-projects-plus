<script lang="ts">
  /**
   * Dashboard V2 (DG-3 / S3.3) — conditional format builder.
   *
   * Visual rule list: add/remove + drag-to-reorder (DG-3) + inline editing.
   * Each rule edits field, operator, value, background/text colors, bold/italic.
   */
  import { createEventDispatcher, onDestroy } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { SlideInPanel } from "src/ui/components/SlideInPanel";
  import type { DataField } from "src/lib/dataframe/dataframe";
  import type { FilterOperator } from "src/settings/base/settings";
  import type { ConditionalFormat, ConditionalFormatRule } from "src/ui/views/Dashboard/types";
  import { i18n } from "src/lib/stores/i18n";
  import {
    makePopover,
    destroyPopover,
    getPopoverEl,
  } from "src/ui/components/popoverDropdown";
  import {
    getFieldIcon,
    getOperatorsForField,
    getOperatorLabel,
    operatorNeedsValue,
  } from "src/ui/components/Navigation/SettingsMenu/tabs/filterHelpers";

  export let open: boolean;
  export let formats: ConditionalFormat[];
  export let fields: DataField[];

  const dispatch = createEventDispatcher<{
    save: ConditionalFormat[];
    close: void;
  }>();

  let editedFormats: ConditionalFormat[] = [];

  $: if (open) {
    editedFormats = formats.map((f) => ({
      ...f,
      conditions: f.conditions.map((c) => ({ ...c, style: { ...c.style } })),
    }));
  }

  // ── Mutation helpers ──────────────────────────────────────────
  function updateFormat(id: string, patch: Partial<ConditionalFormat>) {
    editedFormats = editedFormats.map((f) => (f.id === id ? { ...f, ...patch } : f));
  }

  function updateRule(id: string, ruleIdx: number, patch: Partial<ConditionalFormatRule>) {
    editedFormats = editedFormats.map((f) => {
      if (f.id !== id) return f;
      const conditions = f.conditions.map((c, i) =>
        i === ruleIdx ? { ...c, ...patch, style: { ...c.style, ...(patch.style ?? {}) } } : c
      );
      return { ...f, conditions };
    });
  }

  function addRule() {
    const newFormat: ConditionalFormat = {
      id: `cf-${Date.now()}`,
      field: fields[0]?.name ?? "",
      conditions: [
        {
          operator: "eq" as FilterOperator,
          value: "",
          style: { backgroundColor: "#e3f2fd", textColor: "#1565c0" },
        },
      ],
    };
    editedFormats = [...editedFormats, newFormat];
  }

  function removeRule(id: string) {
    editedFormats = editedFormats.filter((f) => f.id !== id);
  }

  function handleSave() {
    dispatch("save", editedFormats);
    dispatch("close");
  }

  function handleClose() {
    dispatch("close");
  }

  // ── DG-3: drag-to-reorder rules ───────────────────────────────
  let dragIndex: number | null = null;
  let dragOverIndex: number | null = null;

  function onDragStart(index: number, e: DragEvent) {
    dragIndex = index;
    e.dataTransfer!.effectAllowed = "move";
  }

  function onDragOver(index: number, e: DragEvent) {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
    dragOverIndex = index;
  }

  function onDrop(index: number, e: DragEvent) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) { dragIndex = null; dragOverIndex = null; return; }
    const arr = [...editedFormats];
    const [moved] = arr.splice(dragIndex, 1);
    arr.splice(index, 0, moved!);
    dragIndex = null;
    dragOverIndex = null;
    editedFormats = arr;
  }

  function onDragEnd() {
    dragIndex = null;
    dragOverIndex = null;
  }

  // ── Inline popovers for field / operator selection ────────────
  function openFieldPop(format: ConditionalFormat, anchor: HTMLElement) {
    makePopover(
      anchor,
      fields.map((f) => ({
        label: f.name,
        icon: getFieldIcon(f.type),
        selected: f.name === format.field,
        handler: () => {
          updateFormat(format.id, { field: f.name });
          // Reset operator to first valid for new field type
          const ops = getOperatorsForField(f.type);
          const cond = format.conditions[0];
          if (cond && !ops.includes(cond.operator)) {
            updateRule(format.id, 0, { operator: ops[0] ?? ("eq" as FilterOperator) });
          }
        },
      })),
      true,
    );
  }

  function openOpPop(format: ConditionalFormat, anchor: HTMLElement) {
    const field = fields.find((f) => f.name === format.field);
    const ops = getOperatorsForField(field?.type ?? "string");
    const cond = format.conditions[0];
    makePopover(
      anchor,
      ops.map((op) => ({
        label: getOperatorLabel(op),
        selected: op === cond?.operator,
        handler: () => {
          updateRule(format.id, 0, {
            operator: op,
            value: operatorNeedsValue(op) ? (cond?.value ?? "") : "",
          });
        },
      })),
    );
  }

  function handleWindowMousedown(e: MouseEvent) {
    const el = getPopoverEl();
    if (el && !el.contains(e.target as Node)) destroyPopover();
  }

  onDestroy(() => destroyPopover());
</script>

<svelte:window on:mousedown={handleWindowMousedown} />

<SlideInPanel
  {open}
  title={$i18n.t("views.dashboard.conditional-format.title", {
    defaultValue: "Conditional Formatting",
  })}
  width="28rem"
  on:close={handleClose}
>
  <div class="ppp-cf-builder">
    <div class="ppp-cf-builder-hint">
      {$i18n.t("views.dashboard.conditional-format.hint", {
        defaultValue:
          "Apply styles to cells based on their values. Rules are evaluated top-to-bottom.",
      })}
    </div>

    <!-- Rule list -->
    {#if editedFormats.length === 0}
      <div class="ppp-cf-builder-empty">
        <span>{$i18n.t("views.dashboard.conditional-format.no-rules", {
          defaultValue: "No formatting rules"
        })}</span>
      </div>
    {:else}
      <div class="ppp-cf-builder-list">
        {#each editedFormats as format, i (format.id)}
          {@const cond = format.conditions[0]}
          <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
          <div class="ppp-cf-builder-rule"
            class:ppp-cf-builder-rule--drag-over={dragOverIndex === i && dragIndex !== null && dragIndex !== i}
            draggable="true"
            on:dragstart={(e) => onDragStart(i, e)}
            on:dragover={(e) => onDragOver(i, e)}
            on:drop={(e) => onDrop(i, e)}
            on:dragend={onDragEnd}
          >
            <!-- Header row: drag + label + remove -->
            <div class="ppp-cf-builder-rule-header">
              <button class="ppp-cf-builder-rule-drag clickable-icon" type="button" tabindex="-1" aria-label="Drag to reorder">
                <Icon name="grip-vertical" size="sm" />
              </button>
              <span class="ppp-cf-builder-rule-label">
                {$i18n.t("views.dashboard.conditional-format.rule-n", { n: i + 1, defaultValue: `Rule ${i + 1}` })}
              </span>
              <button
                class="ppp-cf-builder-rule-remove clickable-icon"
                type="button"
                on:click={() => removeRule(format.id)}
                aria-label="Remove rule"
              >✕</button>
            </div>

            <!-- Condition row: field + operator + value -->
            <div class="ppp-cf-rule-condition">
              <button class="ppp-cf-chip ppp-cf-chip--field" type="button"
                on:click={(e) => openFieldPop(format, e.currentTarget)}>
                <span class="ppp-cf-chip-icon"><Icon name={getFieldIcon(fields.find(f => f.name === format.field)?.type ?? 'string')} size="sm" /></span>
                <span class="ppp-cf-chip-label">{format.field || $i18n.t('common.field')}</span>
                <span class="ppp-cf-chip-chevron"><Icon name="chevron-down" size="xs" /></span>
              </button>

              {#if cond}
                <button class="ppp-cf-chip ppp-cf-chip--op" type="button"
                  on:click={(e) => openOpPop(format, e.currentTarget)}>
                  <span class="ppp-cf-chip-label">{getOperatorLabel(cond.operator)}</span>
                  <span class="ppp-cf-chip-chevron"><Icon name="chevron-down" size="xs" /></span>
                </button>

                {#if operatorNeedsValue(cond.operator)}
                  <input
                    class="ppp-cf-value-input"
                    type="text"
                    value={cond.value ?? ""}
                    placeholder={$i18n.t("common.value-placeholder")}
                    on:input={(e) => updateRule(format.id, 0, { value: (e.target as HTMLInputElement).value })}
                  />
                {:else}
                  <span class="ppp-cf-no-value">—</span>
                {/if}
              {/if}
            </div>

            <!-- Style row: colors + bold/italic -->
            {#if cond}
              <div class="ppp-cf-rule-style">
                <label class="ppp-cf-color-swatch" title={$i18n.t("views.dashboard.conditional-format.bg-color", { defaultValue: "Background color" })}>
                  <input type="color" class="ppp-cf-color-input"
                    value={cond.style.backgroundColor ?? "#ffffff"}
                    on:input={(e) => updateRule(format.id, 0, { style: { backgroundColor: (e.target as HTMLInputElement).value } })}
                  />
                  <span class="ppp-cf-color-dot" style:background={cond.style.backgroundColor ?? "transparent"}></span>
                  <span class="ppp-cf-color-label">BG</span>
                </label>

                <label class="ppp-cf-color-swatch" title={$i18n.t("views.dashboard.conditional-format.text-color", { defaultValue: "Text color" })}>
                  <input type="color" class="ppp-cf-color-input"
                    value={cond.style.textColor ?? "#000000"}
                    on:input={(e) => updateRule(format.id, 0, { style: { textColor: (e.target as HTMLInputElement).value } })}
                  />
                  <span class="ppp-cf-color-dot" style:background={cond.style.textColor ?? "transparent"}></span>
                  <span class="ppp-cf-color-label" style:color={cond.style.textColor}>A</span>
                </label>

                <button
                  class="ppp-cf-style-btn"
                  class:ppp-cf-style-btn--active={cond.style.bold}
                  type="button"
                  title={$i18n.t("views.dashboard.conditional-format.bold", { defaultValue: "Bold" })}
                  on:click={() => updateRule(format.id, 0, { style: { bold: !cond.style.bold } })}
                ><b>B</b></button>

                <button
                  class="ppp-cf-style-btn"
                  class:ppp-cf-style-btn--active={cond.style.italic}
                  type="button"
                  title={$i18n.t("views.dashboard.conditional-format.italic", { defaultValue: "Italic" })}
                  on:click={() => updateRule(format.id, 0, { style: { italic: !cond.style.italic } })}
                ><i>I</i></button>

                <!-- Live preview -->
                <span
                  class="ppp-cf-builder-rule-sample"
                  style:background-color={cond.style.backgroundColor}
                  style:color={cond.style.textColor}
                  style:font-weight={cond.style.bold ? "700" : "400"}
                  style:font-style={cond.style.italic ? "italic" : "normal"}
                >
                  {$i18n.t("views.dashboard.conditional-format.preview-text", { defaultValue: "Sample" })}
                </span>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    <!-- Add button -->
    <button class="ppp-cf-builder-add-btn" type="button" on:click={addRule}>
      + {$i18n.t("views.dashboard.conditional-format.add-rule", {
        defaultValue: "Add rule"
      })}
    </button>

    <!-- Actions -->
    <div class="ppp-cf-builder-actions">
      <button
        class="ppp-cf-builder-btn ppp-cf-builder-btn--primary"
        on:click={handleSave}
      >
        {$i18n.t("common.save", { defaultValue: "Save" })}
      </button>
      <button class="ppp-cf-builder-btn" on:click={handleClose}>
        {$i18n.t("common.cancel", { defaultValue: "Cancel" })}
      </button>
    </div>
  </div>
</SlideInPanel>

<style>
  .ppp-cf-builder {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .ppp-cf-builder-hint {
    font-size: var(--font-ui-smaller, 0.8125rem);
    color: var(--text-muted);
    padding: 0.75rem;
    background: var(--background-secondary);
    border-radius: var(--radius-s, 0.25rem);
  }

  .ppp-cf-builder-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    color: var(--text-faint);
    font-style: italic;
  }

  .ppp-cf-builder-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .ppp-cf-builder-rule {
    padding: 0.625rem 0.75rem;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-primary);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    cursor: default;
  }

  .ppp-cf-builder-rule--drag-over {
    border-top: 0.125rem solid var(--interactive-accent);
    background: rgba(var(--interactive-accent-rgb, 72, 54, 153), 0.04);
  }

  .ppp-cf-builder-rule-header {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .ppp-cf-builder-rule-drag {
    flex-shrink: 0;
    width: 1.25rem;
    height: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--text-faint);
    cursor: grab;
    opacity: 0;
    transition: opacity 100ms ease;
    padding: 0;
    border-radius: var(--radius-s, 0.25rem);
  }

  .ppp-cf-builder-rule:hover .ppp-cf-builder-rule-drag { opacity: 0.5; }
  .ppp-cf-builder-rule-drag:active { cursor: grabbing; opacity: 1; }

  .ppp-cf-builder-rule-label {
    flex: 1;
    font-size: var(--font-ui-small, 0.875rem);
    font-weight: 600;
    color: var(--text-normal);
  }

  .ppp-cf-builder-rule-remove {
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;
    font-size: 0.875rem;
  }

  .ppp-cf-builder-rule-remove:hover {
    color: var(--text-error);
    background: var(--background-modifier-hover);
  }

  /* ── Condition row ── */
  .ppp-cf-rule-condition {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem;
  }

  .ppp-cf-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    height: 1.5rem;
    padding: 0 0.5rem;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: 0.375rem;
    background: var(--background-secondary);
    color: var(--text-normal);
    cursor: pointer;
    font-size: 0.75rem;
    font-family: var(--font-interface);
    white-space: nowrap;
    transition: border-color 100ms ease;
  }

  .ppp-cf-chip:hover { border-color: var(--interactive-accent); }
  .ppp-cf-chip-icon { display: inline-flex; align-items: center; color: var(--text-muted); flex-shrink: 0; }
  .ppp-cf-chip-label { max-width: 6rem; overflow: hidden; text-overflow: ellipsis; }
  .ppp-cf-chip--field .ppp-cf-chip-label { font-weight: 500; }
  .ppp-cf-chip-chevron { display: inline-flex; align-items: center; color: var(--text-faint); }

  .ppp-cf-value-input {
    flex: 1;
    min-width: 4rem;
    height: 1.5rem;
    padding: 0 0.375rem;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: 0.375rem;
    background: var(--background-secondary);
    color: var(--text-normal);
    font-size: 0.75rem;
    font-family: var(--font-interface);
    outline: none;
    box-sizing: border-box;
  }

  .ppp-cf-value-input:focus { border-color: var(--interactive-accent); }
  .ppp-cf-value-input::placeholder { color: var(--text-faint); }
  .ppp-cf-no-value { font-size: 0.75rem; color: var(--text-faint); font-style: italic; padding: 0 0.25rem; }

  /* ── Style row ── */
  .ppp-cf-rule-style {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  .ppp-cf-color-swatch {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    height: 1.5rem;
    padding: 0 0.375rem;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: 0.375rem;
    background: var(--background-secondary);
    cursor: pointer;
    font-size: 0.75rem;
    color: var(--text-muted);
    transition: border-color 100ms ease;
  }

  .ppp-cf-color-swatch:hover { border-color: var(--interactive-accent); }

  .ppp-cf-color-input {
    position: absolute;
    width: 0;
    height: 0;
    opacity: 0;
    pointer-events: none;
  }

  .ppp-cf-color-dot {
    display: inline-block;
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    border: 0.0625rem solid rgba(0,0,0,0.15);
    flex-shrink: 0;
  }

  .ppp-cf-color-label { font-size: 0.6875rem; user-select: none; }

  .ppp-cf-style-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: 0.375rem;
    background: var(--background-secondary);
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.8125rem;
    transition: border-color 100ms ease, background 100ms ease;
    padding: 0;
  }

  .ppp-cf-style-btn:hover { border-color: var(--interactive-accent); color: var(--text-normal); }
  .ppp-cf-style-btn--active {
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .ppp-cf-builder-rule-sample {
    margin-left: auto;
    padding: 0.125rem 0.625rem;
    border-radius: var(--radius-s, 0.25rem);
    font-size: 0.75rem;
  }

  /* ── Add / Actions ── */
  .ppp-cf-builder-add-btn {
    padding: 0.5rem 1rem;
    border: 0.0625rem dashed var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    font-size: var(--font-ui-small, 0.875rem);
    transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
  }

  .ppp-cf-builder-add-btn:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
    color: var(--text-normal);
  }

  .ppp-cf-builder-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 0.0625rem solid var(--background-modifier-border);
  }

  .ppp-cf-builder-btn {
    flex: 1;
    padding: 0.5rem 1rem;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    font-size: var(--font-ui-small, 0.875rem);
    transition: background 120ms ease, color 120ms ease;
  }

  .ppp-cf-builder-btn:hover { background: var(--background-modifier-hover); }

  .ppp-cf-builder-btn--primary {
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .ppp-cf-builder-btn--primary:hover {
    background: var(--interactive-accent-hover);
    border-color: var(--interactive-accent-hover);
  }
</style>
