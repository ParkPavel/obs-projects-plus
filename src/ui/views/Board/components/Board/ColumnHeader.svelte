<script lang="ts">
  import { MarkdownRenderer, Menu } from "obsidian";
  import { app, view } from "src/lib/stores/obsidian";
  import { getContext } from "svelte";
  import { TextInput, IconButton } from "obsidian-svelte";
  import { Flair } from "src/ui/components/Flair";
  import { handleHoverLink } from "src/ui/views/helpers";

  export let value: string;
  export let count: number;
  export let checkedCount: number;
  export let checkField: string | undefined;
  export let collapse: boolean = false;
  export let richText: boolean = false;
  const sourcePath = getContext<string>("sourcePath") ?? "";

  function useMarkdown(node: HTMLElement, value: string) {
    MarkdownRenderer.render($app, value, node, sourcePath, $view);

    return {
      update(newValue: string) {
        node.empty();
        MarkdownRenderer.render($app, newValue, node, sourcePath, $view);
      },
    };
  }

  export let onColumnMenu: () => Menu;

  function handleClick(event: MouseEvent) {
    const targetEl = event.target as HTMLElement;
    const closestAnchor =
      targetEl.tagName === "A" ? targetEl : targetEl.closest("a");

    if (!closestAnchor) {
      return;
    }

    event.stopPropagation();

    if (closestAnchor.hasClass("internal-link")) {
      event.preventDefault();

      const href = closestAnchor.getAttr("href");
      const newLeaf = false;

      if (href) {
        $app.workspace.openLinkText(href, sourcePath, newLeaf);
      }
    }
  }

  export let onValidate: (value: string) => boolean;
  export let onColumnRename: (value: string) => void;
  export let editing: boolean = false;
  export let pinned: boolean = false;
  export let onColumnPin: () => void;
  export let onColumnCollapse: () => void;

  let inputRef: HTMLInputElement;
  $: if (editing && inputRef) {
    inputRef.focus();
    inputRef.select();
  }
  let fallback: string = value;
  function rollback() {
    value = fallback;
  }
  $: error = !onValidate(value);
</script>

<div
  class="projects--board--column--header"
  on:dblclick={() => {
    editing = true;
  }}
>
  {#if editing}
    <TextInput
      noPadding
      embed
      bind:ref={inputRef}
      bind:value
      on:keydown={(event) => {
        if (event.key === "Enter") {
          editing = false;

          if (fallback == value) {
            return;
          }

          if (!error) {
            fallback = value;

            onColumnRename(value);
          } else {
            rollback();
          }
        }
        if (event.key === "Escape") {
          editing = false;
          rollback();
        }
      }}
      on:blur={() => {
        editing = false;

        if (fallback == value) {
          return;
        }

        if (!error) {
          fallback = value;
          onColumnRename(value);
        } else {
          rollback();
        }
      }}
    />
  {:else if richText}
    <span
      class:collapse
      use:useMarkdown={value}
      on:mouseover={(event) => handleHoverLink(event, "")}
      on:focus
      on:click={handleClick}
      on:keypress
    />
  {:else}
    <span class:collapse>
      {value}
    </span>
  {/if}
  <div class="right">
    {#if collapse || checkField}
      <Flair variant="primary">
        {checkField ? `${checkedCount}/${count}` : count}
      </Flair>
    {/if}
    <div class="actions">
      <IconButton
        icon={collapse ? "chevrons-left-right" : "chevrons-right-left"}
        size="sm"
        tooltip={collapse ? "Развернуть" : "Свернуть"}
        onClick={onColumnCollapse}
      />
      <IconButton
        icon={pinned ? "pin-off" : "pin"}
        size="sm"
        tooltip={pinned ? "Открепить" : "Закрепить"}
        onClick={onColumnPin}
      />
      <IconButton
        icon="more-vertical"
        size="sm"
        tooltip="Меню"
        onClick={(event) => {
          onColumnMenu().showAtMouseEvent(event);
        }}
      />
    </div>
  </div>
</div>

<style>
  span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  span :global(p:first-child) {
    margin-top: 0;
  }

  span :global(p:last-child) {
    margin-bottom: 0;
  }

  .projects--board--column--header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .right {
    display: flex;
    align-items: center;
  }

  .actions {
    display: none;
    gap: 4px;
    margin-left: 6px;
  }

  .projects--board--column--header:hover .actions,
  .projects--board--column--header:focus-within .actions {
    display: inline-flex;
  }

  .collapse {
    max-height: 24px;
    overflow-y: auto;
  }
</style>
