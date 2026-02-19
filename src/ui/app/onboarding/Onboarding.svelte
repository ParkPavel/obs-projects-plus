<script lang="ts">
  import { Button, ModalButtonGroup, Typography } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";

  import TabContainer from "./TabContainer.svelte";

  export let onCreate: () => void;
  export let onTry: () => void;

  $: t = $i18n.t;
  $: tabProjects = t("onboarding.tab-projects-view");
  $: tabCommand = t("onboarding.tab-command-palette");
  $: tabExplorer = t("onboarding.tab-file-explorer");
</script>

<div class="center">
  <Typography variant="h1">{t("onboarding.title")}</Typography>
  <Typography variant="body">
    {t("onboarding.description").split("<a>")[0]}<a href="https://help.obsidian.md/Editing+and+formatting/Properties">{t("onboarding.front-matter-link")}</a>{t("onboarding.description").split("</a>")[1] || ""}
  </Typography>

  <pre><code
      >---
status: Backlog
due: 2023-01-01
published: false
---

# My blog post</code
    ></pre>

  <Typography variant="body">
    {t("onboarding.explore")}
  </Typography>

  <ModalButtonGroup>
    <Button variant="primary" on:click={() => onCreate()}>
      {t("onboarding.create-new")}
    </Button>
    <Button
      variant="default"
      tooltip={t("onboarding.try-demo-tooltip")}
      on:click={() => onTry()}
    >
      {t("onboarding.try-demo")}
    </Button>
  </ModalButtonGroup>
  <p
    style={"color: var(--text-muted); margin-top: 45px; font-size: var(--font-ui-smaller);"}
  >
    <strong>Psst! 👋</strong> {t("onboarding.hint")}
  </p>
  <TabContainer
    options={[tabProjects, tabCommand, tabExplorer]}
    let:selected
  >
    {#if selected === tabExplorer}
      <ol>
        <li>{@html t("onboarding.file-explorer-step1")}</li>
        <li>{@html t("onboarding.file-explorer-step2")}</li>
      </ol>
    {:else if selected === tabCommand}
      <ol>
        <li>{@html t("onboarding.command-palette-step1")}</li>
        <li>{@html t("onboarding.command-palette-step2")}</li>
        <li>{@html t("onboarding.command-palette-step3")}</li>
      </ol>
    {:else}
      <ol>
        <li>{@html t("onboarding.projects-view-step1")}</li>
        <li>{@html t("onboarding.projects-view-step2")}</li>
      </ol>
    {/if}
  </TabContainer>
</div>

<style>
  pre {
    background-color: var(--background-primary-alt);
    border-radius: var(--radius-s);
    padding: 8px;
  }
  ol {
    margin: 0;
    padding: 0 22px;
  }
</style>
