<script lang="ts">
  import { Button, ModalButtonGroup, Typography } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import {
    STARTER_PROFILE_DISPLAY,
    STARTER_PROFILE_IDS,
    StarterProfileRegistrationError,
    StarterProfileWriteError,
    type StarterProfileId,
  } from "./starterProfiles";

  import TabContainer from "./TabContainer.svelte";
  import InlineTranslatedText from "./InlineTranslatedText.svelte";

  export let onCreate: () => void;
  export let onTry: () => void;
  /**
   * Scene 7 — the primary path. Resolves once the profile (folders +
   * template + project) is written and registered. On failure it rejects —
   * with `StarterProfileWriteError` for a write, `StarterProfileRegistrationError`
   * for a registration — and the vault is NOT necessarily back as it was:
   * a target that materialized before its step rejected, or a path taken
   * over by something else, is kept rather than deleted, and the error
   * names those paths in `leftovers`. This component keeps the modal open
   * and says which case it was, including what was left behind.
   */
  export let onProfile: (profileId: StarterProfileId) => Promise<void>;

  let busy = false;
  let errorMessage = "";

  $: t = $i18n.t;
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
      if (error instanceof StarterProfileWriteError) {
        errorMessage =
          error.leftovers.length === 0
            ? t("onboarding.profiles.error-path", {
                defaultValue:
                  'Не удалось создать файлы профиля: «{{path}}». Ничего не сохранено — попробуйте ещё раз.',
                path: error.path,
              })
            : t("onboarding.profiles.error-path-leftover", {
                defaultValue:
                  'Не удалось создать файлы профиля: «{{path}}». В хранилище остались пути, которые не получилось убрать автоматически: {{leftovers}}. Проверьте их перед следующей попыткой и удаляйте только то, что действительно создано профилем: по такому пути могло оказаться и что-то постороннее.',
                path: error.path,
                leftovers: error.leftovers.map((p) => `«${p}»`).join(", "),
              });
      } else if (error instanceof StarterProfileRegistrationError && error.registered) {
        errorMessage = t("onboarding.profiles.error-registered", {
          defaultValue:
            'Файлы профиля созданы, но настройки могли не сохраниться. Перезапустите Obsidian и проверьте, есть ли проект в списке; файлы профиля остаются в хранилище.',
        });
      } else if (
        error instanceof StarterProfileRegistrationError &&
        error.leftovers.length > 0
      ) {
        // Registration did not land AND rollback could not remove everything:
        // the next attempt would start beside files nobody mentioned.
        errorMessage = t("onboarding.profiles.error-registration-leftover", {
          defaultValue:
            'Не удалось создать профиль. В хранилище остались пути, которые не получилось убрать автоматически: {{leftovers}}. Проверьте их перед следующей попыткой и удаляйте только то, что действительно создано профилем: по такому пути могло оказаться и что-то постороннее.',
          leftovers: error.leftovers.map((p) => `«${p}»`).join(", "),
        });
      } else {
        errorMessage = t("onboarding.profiles.error-generic", {
          defaultValue: "Не удалось создать профиль. Попробуйте ещё раз.",
        });
      }
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
    <summary
      aria-disabled={busy}
      tabindex={busy ? -1 : 0}
      on:click={(event) => {
        if (busy) event.preventDefault();
      }}
      >{t("onboarding.other-ways-summary", { defaultValue: "Другой способ" })}</summary
    >

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

    <Typography variant="body">
      {t("onboarding.explore")}
    </Typography>

    <ModalButtonGroup>
      <Button variant="primary" disabled={busy} on:click={() => !busy && onCreate()}>
        {t("onboarding.create-new")}
      </Button>
      <Button
        variant="default"
        disabled={busy}
        tooltip={t("onboarding.try-demo-tooltip")}
        on:click={() => !busy && onTry()}
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

  .ppp-onboarding-secondary summary[aria-disabled="true"] {
    opacity: 0.6;
    cursor: default;
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
