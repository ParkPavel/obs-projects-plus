<script lang="ts">
  import { Button, ModalButtonGroup, Typography } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { sanitizeHtml } from "src/lib/helpers/sanitizeHtml";
  import {
    STARTER_PROFILE_DISPLAY,
    STARTER_PROFILE_IDS,
    StarterProfileWriteError,
    type StarterProfileId,
  } from "./starterProfiles";

  import TabContainer from "./TabContainer.svelte";

  export let onCreate: () => void;
  export let onTry: () => void;
  /**
   * Scene 7 — the primary path. Resolves once the profile (folders +
   * template + project) is written and registered; rejects (with the
   * write's `StarterProfileWriteError` when it is one) without touching
   * anything, so this component knows to keep the modal open and say why.
   */
  export let onProfile: (profileId: StarterProfileId) => Promise<void>;

  let busy = false;
  let errorMessage = "";

  $: t = $i18n.t;
  /** Translate + sanitize for safe {@html} usage */
  const ts = (key: string) => sanitizeHtml(t(key));
  $: tabProjects = t("onboarding.tab-projects-view");
  $: tabCommand = t("onboarding.tab-command-palette");
  $: tabExplorer = t("onboarding.tab-file-explorer");

  /** Focuses the first profile button as soon as it is created — Svelte
   * actions run once, right after the node is attached, which is the
   * moment the modal wants the keyboard's initial focus. */
  function autofocusFirst(node: HTMLButtonElement, isFirst: boolean) {
    if (isFirst) node.focus();
    return {};
  }

  async function handleProfile(profileId: StarterProfileId) {
    if (busy) return;
    busy = true;
    errorMessage = "";
    try {
      await onProfile(profileId);
      // Success closes the modal from `onboardingModal.ts` — nothing left
      // to do here, and this component may unmount right after.
    } catch (error) {
      busy = false;
      errorMessage =
        error instanceof StarterProfileWriteError
          ? t("onboarding.profiles.error-path", {
              defaultValue:
                'Не удалось создать файлы профиля: «{{path}}». Ничего не сохранено — попробуйте ещё раз.',
              path: error.path,
            })
          : t("onboarding.profiles.error-generic", {
              defaultValue: "Не удалось создать профиль. Попробуйте ещё раз.",
            });
    }
  }
</script>

<div class="center">
  <Typography variant="h1">{t("onboarding.title")}</Typography>
  <Typography variant="body">
    {t("onboarding.profiles.intro", {
      defaultValue: "Выберите, с чего начать — через минуту здесь появится ваша первая запись.",
    })}
  </Typography>

  <div
    class="ppp-onboarding-profiles"
    role="group"
    aria-label={t("onboarding.profiles.group-label", { defaultValue: "Готовые профили" })}
  >
    {#each STARTER_PROFILE_IDS as profileId, index (profileId)}
      {@const display = STARTER_PROFILE_DISPLAY[profileId]}
      <button
        type="button"
        class="ppp-onboarding-profile"
        disabled={busy}
        use:autofocusFirst={index === 0}
        on:click={() => handleProfile(profileId)}
      >
        <span class="ppp-onboarding-profile-name">{display.name}</span>
        <span class="ppp-onboarding-profile-example">{display.example}</span>
      </button>
    {/each}
  </div>

  {#if busy}
    <p aria-live="polite" class="ppp-onboarding-status">
      {t("onboarding.profiles.busy", { defaultValue: "Создаём профиль…" })}
    </p>
  {/if}

  {#if errorMessage}
    <p role="alert" class="ppp-onboarding-error">{errorMessage}</p>
  {/if}

  <details class="ppp-onboarding-secondary">
    <summary>{t("onboarding.other-ways-summary", { defaultValue: "Другой способ" })}</summary>

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
      style={"color: var(--text-muted); margin-top: 2.8125rem; font-size: var(--font-ui-smaller);"}
    >
      <strong>Psst! 👋</strong> {t("onboarding.hint")}
    </p>
    <TabContainer
      options={[tabProjects, tabCommand, tabExplorer]}
      let:selected
    >
      {#if selected === tabExplorer}
        <ol>
          <li>{@html ts("onboarding.file-explorer-step1")}</li>
          <li>{@html ts("onboarding.file-explorer-step2")}</li>
        </ol>
      {:else if selected === tabCommand}
        <ol>
          <li>{@html ts("onboarding.command-palette-step1")}</li>
          <li>{@html ts("onboarding.command-palette-step2")}</li>
          <li>{@html ts("onboarding.command-palette-step3")}</li>
        </ol>
      {:else}
        <ol>
          <li>{@html ts("onboarding.projects-view-step1")}</li>
          <li>{@html ts("onboarding.projects-view-step2")}</li>
        </ol>
      {/if}
    </TabContainer>
  </details>
</div>

<style>
  .ppp-onboarding-profiles {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0.75rem 0;
  }

  .ppp-onboarding-profile {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.125rem;
    padding: 0.625rem 0.875rem;
    border-radius: var(--radius-s);
    border: var(--border-width) solid var(--background-modifier-border);
    background-color: var(--background-primary-alt);
    cursor: pointer;
    text-align: left;
  }

  .ppp-onboarding-profile:hover:not(:disabled) {
    border-color: var(--interactive-accent);
  }

  .ppp-onboarding-profile:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .ppp-onboarding-profile-name {
    font-weight: var(--font-medium);
  }

  .ppp-onboarding-profile-example {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
  }

  .ppp-onboarding-error {
    color: var(--text-error);
  }

  .ppp-onboarding-secondary {
    margin-top: 1rem;
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
