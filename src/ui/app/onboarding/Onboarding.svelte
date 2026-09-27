<script lang="ts">
  import { Button, ModalButtonGroup, Typography } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";

  import TabContainer from "./TabContainer.svelte";
  import InlineTranslatedText from "./InlineTranslatedText.svelte";

  export let onCreate: () => void;
  /**
   * 3.6.1 — the primary path: the three linked demo projects. Resolves once
   * they are written and registered (the modal then closes); `false` keeps
   * the window open with a message.
   */
  export let onTry: () => Promise<boolean>;

  let busy = false;
  let failed = false;

  $: t = $i18n.t;
  $: tabProjects = t("onboarding.tab-projects-view");
  $: tabCommand = t("onboarding.tab-command-palette");
  $: tabExplorer = t("onboarding.tab-file-explorer");

  /** Keyboard focus starts on the demo, the path the window recommends. */
  function autofocus(node: HTMLButtonElement) {
    node.focus();
    return {};
  }

  async function handleDemo() {
    if (busy) return;
    busy = true;
    failed = false;
    const ok = await onTry();
    if (!ok) {
      busy = false;
      failed = true;
    }
  }
</script>

<div class="center">
  <Typography variant="h1">{t("onboarding.title")}</Typography>
  <Typography variant="body">{t("onboarding.intro")}</Typography>

  <button type="button" class="ppp-onboarding-demo" disabled={busy} use:autofocus on:click={handleDemo}>
    <span class="ppp-onboarding-demo-title">{t("onboarding.demo.title")}</span>
    <span class="ppp-onboarding-demo-summary">{t("onboarding.demo.summary")}</span>
  </button>

  {#if busy}
    <p aria-live="polite" class="ppp-onboarding-status">{t("onboarding.demo.busy")}</p>
  {/if}
  {#if failed}
    <p role="alert" class="ppp-onboarding-error">{t("onboarding.demo.error")}</p>
  {/if}

  <ModalButtonGroup>
    <Button variant="default" disabled={busy} on:click={() => !busy && onCreate()}>
      {t("onboarding.create-new")}
    </Button>
  </ModalButtonGroup>

  <details class="ppp-onboarding-secondary">
    <summary>{t("onboarding.other-ways-summary")}</summary>

    <Typography variant="body">
      <InlineTranslatedText text={t("onboarding.description")} />
    </Typography>

    <pre><code
        >---
status: Backlog
due: 2023-01-01
published: false
---

# My blog post</code
      ></pre>

    <p class="ppp-onboarding-hint">
      <strong>{t("onboarding.psst")}</strong> {t("onboarding.hint")}
    </p>
    <TabContainer options={[tabProjects, tabCommand, tabExplorer]} let:selected>
      {#if selected === tabExplorer}
        <ol>
          <li><InlineTranslatedText text={t("onboarding.file-explorer-step1")} /></li>
          <li><InlineTranslatedText text={t("onboarding.file-explorer-step2")} /></li>
        </ol>
      {:else if selected === tabCommand}
        <ol>
          <li><InlineTranslatedText text={t("onboarding.command-palette-step1")} /></li>
          <li><InlineTranslatedText text={t("onboarding.command-palette-step2")} /></li>
          <li><InlineTranslatedText text={t("onboarding.command-palette-step3")} /></li>
        </ol>
      {:else}
        <ol>
          <li><InlineTranslatedText text={t("onboarding.projects-view-step1")} /></li>
          <li><InlineTranslatedText text={t("onboarding.projects-view-step2")} /></li>
        </ol>
      {/if}
    </TabContainer>
  </details>
</div>

<style>
  /* The demo card: a real block with its own height, so the title and the
     summary wrap inside it at any width (the profile cards it replaces let
     their text run over the border). */
  .ppp-onboarding-demo {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
    width: 100%;
    height: auto;
    margin: 0.75rem 0;
    padding: 0.875rem 1rem;
    border-radius: var(--radius-m);
    border: var(--border-width) solid var(--interactive-accent);
    background-color: var(--background-primary-alt);
    text-align: left;
    white-space: normal;
    cursor: pointer;
  }

  .ppp-onboarding-demo:hover:not(:disabled) {
    background-color: var(--background-modifier-hover);
  }

  .ppp-onboarding-demo:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .ppp-onboarding-demo-title {
    font-size: var(--font-ui-medium);
    font-weight: var(--font-semibold);
    color: var(--text-normal);
  }

  .ppp-onboarding-demo-summary {
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    line-height: var(--line-height-normal);
  }

  .ppp-onboarding-error {
    color: var(--text-error);
  }

  .ppp-onboarding-secondary {
    margin-top: 1rem;
  }

  .ppp-onboarding-hint {
    color: var(--text-muted);
    margin-top: 1rem;
    font-size: var(--font-ui-smaller);
  }

  pre {
    background-color: var(--background-primary-alt);
    border-radius: var(--radius-s);
    padding: 0.5rem;
  }
  ol {
    margin: 0;
    padding: 0 1.375rem;
  }
</style>
