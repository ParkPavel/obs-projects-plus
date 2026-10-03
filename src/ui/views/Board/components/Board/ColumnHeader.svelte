<script lang="ts">
  import { MarkdownRenderer } from "obsidian";
  import { app } from "src/lib/stores/obsidian";
  import { markdownOwner } from "src/lib/markdownOwner";
  // Rendered Markdown lives as long as this component (not the last opened view).
  const owner = markdownOwner();
  import { i18n } from "src/lib/stores/i18n";
  import { getContext } from "svelte";
  import { TextInput } from "obsidian-svelte";
  import IconButton from "src/ui/components/IconButton/IconButton.svelte";
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
    MarkdownRenderer.render($app, value, node, sourcePath, owner);

    return {
      update(newValue: string) {
        node.empty();
        MarkdownRenderer.render($app, newValue, node, sourcePath, owner);
      },
    };
  }

  export let onColumnMenu: (event: MouseEvent) => void;

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
  /** #C4 — see BoardView.svelte; blocks the dblclick-to-rename shortcut too. */
  export let dataReadOnly: boolean = false;
  export let pinned: boolean = false;
  export let persisted: boolean = false;
  export let onColumnPin: () => void;
  export let onColumnPersist: () => void;
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
  class:projects--board--column--header-collapsed={collapse}
  on:dblclick={() => {
    if (!collapse && !dataReadOnly) editing = true;
  }}
>
  <!-- cards-g1: the leading cell for the column's drag grip (Board, via BoardColumn). -->
  <slot name="grip" />
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
        tooltip={collapse ? $i18n.t('components.board.column.expand') : $i18n.t('components.board.column.collapse')}
        onClick={onColumnCollapse}
      />
      {#if !collapse}
        <IconButton
          icon={pinned ? "pin-off" : "pin"}
          size="sm"
          tooltip={pinned ? $i18n.t('components.board.column.unpin') : $i18n.t('components.board.column.pin')}
          onClick={onColumnPin}
        />
        <IconButton
          icon={persisted ? "bookmark-minus" : "bookmark-plus"}
          size="sm"
          tooltip={persisted ? $i18n.t('components.board.column.unpersist') : $i18n.t('components.board.column.persist')}
          onClick={onColumnPersist}
        />
        <IconButton
          icon="more-vertical"
          size="sm"
          tooltip={$i18n.t('common.menu')}
          onClick={(event) => {
            onColumnMenu(event);
          }}
        />
      {/if}
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
    white-space: nowrap;
  }

  /* cards-g1: with a leading grip cell the row has three items; the actions
     still end the row instead of `space-between` centring the title. */
  .right {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    margin-left: auto;
  }

  .actions {
    display: inline-flex;
    gap: 0.25rem;
    margin-left: 0.375rem;
    transition: opacity 150ms ease;
  }

  .actions :global(.clickable-icon) {
    color: var(--text-muted);
    transition: color 150ms ease;
  }

  /* ios-t1: the actions rest dimmed and brighten under the mouse only where a
     mouse exists; keyboard focus still brightens them there. */
  @media (hover: hover) and (pointer: fine) {
    .actions {
      opacity: 0.3;
    }

    .projects--board--column--header:hover .actions,
    .projects--board--column--header:focus-within .actions {
      opacity: 1;
    }

    .actions :global(.clickable-icon:hover) {
      color: var(--interactive-accent);
    }
  }

  .collapse {
    max-height: 1.5rem;
    overflow-y: hidden;
  }

  /* ios-t1: on touch the four actions are shown in full and each gets its own
     finger-sized slot. They no longer fit beside the title in a column, so
     they take a second row of the header, right-aligned, and the title keeps
     the whole first row (wrapping rather than being squeezed to nothing). A
     collapsed column is a 3rem rotated strip holding one action, so it keeps
     its single row — only the slot size applies there. */
  @media (pointer: coarse) {
    .projects--board--column--header:not(.projects--board--column--header-collapsed) {
      flex-wrap: wrap;
      row-gap: 0.25em;
      white-space: normal;
    }

    /* cards-g1: the title fills the first row beside the grip cell (the whole
       row in a pinned column); the actions still wrap to the second. */
    .projects--board--column--header:not(.projects--board--column--header-collapsed) > span {
      flex: 1 1 0;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .projects--board--column--header:not(.projects--board--column--header-collapsed) .right {
      flex: 1 0 100%;
      justify-content: flex-end;
    }

    .actions {
      opacity: 1;
      gap: 0;
    }

    .actions :global(.clickable-icon) {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: var(--ppp-touch-target-min);
      min-height: var(--ppp-touch-target-min);
    }
  }
</style>
