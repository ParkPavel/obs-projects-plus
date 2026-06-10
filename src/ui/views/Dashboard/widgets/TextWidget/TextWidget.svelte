<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import { MarkdownRenderer } from "obsidian";
  import { app, view } from "src/lib/stores/obsidian";

  export let config: Record<string, unknown>;
  export let readonly: boolean = false;

  const dispatch = createEventDispatcher<{ change: Record<string, unknown> }>();

  $: content = typeof config?.["content"] === "string" ? config["content"] : "";
  let editing = false;
  let editValue = "";
  let textareaEl: HTMLTextAreaElement;

  async function startEdit() {
    if (readonly) return;
    editValue = content;
    editing = true;
    await tick();
    textareaEl?.focus();
  }

  function commitEdit() {
    editing = false;
    dispatch("change", { ...config, content: editValue });
  }

  function cancelEdit() {
    editing = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
    if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); commitEdit(); }
  }

  function useMarkdown(node: HTMLElement, text: string) {
    const sourcePath = "";
    MarkdownRenderer.render($app, text || "", node, sourcePath, $view);
    return {
      update(newText: string) {
        node.empty();
        MarkdownRenderer.render($app, newText || "", node, sourcePath, $view);
      },
    };
  }
</script>

<div class="ppp-text-widget">
  {#if editing}
    <div class="ppp-text-widget__edit">
      <textarea
        bind:this={textareaEl}
        bind:value={editValue}
        class="ppp-text-widget__textarea"
        on:keydown={handleKeydown}
        rows={6}
        placeholder="Enter Markdown…"
      />
      <div class="ppp-text-widget__actions">
        <button class="ppp-text-widget__btn ppp-text-widget__btn--save" on:click={commitEdit}>Save</button>
        <button class="ppp-text-widget__btn" on:click={cancelEdit}>Cancel</button>
      </div>
    </div>
  {:else}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-interactive-supports-focus -->
    <div
      class="ppp-text-widget__preview"
      class:ppp-text-widget__preview--empty={!content}
      class:ppp-text-widget__preview--editable={!readonly}
      role={readonly ? undefined : "button"}
      tabindex={readonly ? undefined : 0}
      on:click={startEdit}
      on:keypress={(e) => { if (e.key === "Enter" || e.key === " ") startEdit(); }}
      use:useMarkdown={content}
    />
  {/if}
</div>

<style>
  .ppp-text-widget {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  /* ── Preview ── */
  .ppp-text-widget__preview {
    flex: 1;
    padding: 0.75rem;
    overflow-y: auto;
    min-height: 2rem;
  }

  .ppp-text-widget__preview--editable {
    cursor: text;
  }

  .ppp-text-widget__preview--editable:hover {
    background: var(--background-modifier-hover);
    border-radius: 0.25rem;
  }

  .ppp-text-widget__preview--empty::before {
    content: "Click to add text…";
    color: var(--text-faint);
    font-style: italic;
    font-size: 0.875rem;
  }

  /* Markdown rendered content */
  .ppp-text-widget__preview :global(p:first-child) { margin-top: 0; }
  .ppp-text-widget__preview :global(p:last-child)  { margin-bottom: 0; }
  .ppp-text-widget__preview :global(h1),
  .ppp-text-widget__preview :global(h2),
  .ppp-text-widget__preview :global(h3) { margin-top: 0.5rem; }

  /* ── Edit ── */
  .ppp-text-widget__edit {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.5rem;
  }

  .ppp-text-widget__textarea {
    flex: 1;
    width: 100%;
    resize: vertical;
    font-family: var(--font-monospace);
    font-size: 0.8125rem;
    line-height: 1.5;
    padding: 0.5rem;
    border: 1px solid var(--interactive-accent);
    border-radius: 0.25rem;
    background: var(--background-primary);
    color: var(--text-normal);
    box-sizing: border-box;
  }

  .ppp-text-widget__textarea:focus {
    outline: 0.125rem solid var(--interactive-accent);
    outline-offset: 1px;
  }

  .ppp-text-widget__actions {
    display: flex;
    gap: 0.375rem;
    justify-content: flex-end;
  }

  .ppp-text-widget__btn {
    padding: 0.25rem 0.75rem;
    border-radius: 0.25rem;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    font-size: 0.8125rem;
    font-family: var(--font-interface);
    transition: border-color 100ms ease;
  }

  .ppp-text-widget__btn:hover {
    border-color: var(--interactive-accent);
  }

  .ppp-text-widget__btn--save {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .ppp-text-widget__btn--save:hover {
    opacity: 0.9;
  }
</style>
