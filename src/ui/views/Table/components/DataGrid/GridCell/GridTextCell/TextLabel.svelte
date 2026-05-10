<script lang="ts">
  import { MarkdownRenderer } from "obsidian";
  import { app, view } from "src/lib/stores/obsidian";
  import { handleHoverLink } from "src/ui/views/helpers";
  import { getContext } from "svelte";
  import { detectLinkable } from "src/lib/helpers/linkable";

  export let value: string;
  export let richText: boolean = false;

  const sourcePath = getContext<string>("sourcePath") ?? "";

  $: linkable = !richText ? detectLinkable(value) : null;

  function useMarkdown(node: HTMLElement, value: string) {
    MarkdownRenderer.render($app, value, node, sourcePath, $view);

    return {
      update(newValue: string) {
        node.empty();
        MarkdownRenderer.render($app, newValue, node, sourcePath, $view);
      },
    };
  }

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
</script>

{#if richText}
  <div
    use:useMarkdown={value}
    on:click={handleClick}
    on:mouseover={(event) => {
      handleHoverLink(event, sourcePath);
    }}
    on:focus
    on:keypress
  />
{:else if linkable}
  <div>
    <a
      class="ppp-linkable"
      href={linkable.href}
      target={linkable.kind === "url" ? "_blank" : undefined}
      rel={linkable.kind === "url" ? "noopener noreferrer" : undefined}
      on:click|stopPropagation
      on:mousedown|stopPropagation
    >
      {value}
    </a>
  </div>
{:else}
  <div>
    {value}
  </div>
{/if}

<style>
  div {
    padding: 0.375rem;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  div :global(p:first-child) {
    margin-top: 0;
  }

  div :global(p:last-child) {
    margin-bottom: 0;
  }

  .ppp-linkable {
    color: var(--link-color);
    text-decoration: none;
  }
  .ppp-linkable:hover {
    text-decoration: underline;
  }
</style>
