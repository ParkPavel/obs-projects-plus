<script lang="ts">
  import { produce } from "immer";
  import {
    SettingItem,
    NumberInput,
    ModalLayout,
    ModalContent,
  } from "obsidian-svelte";
  import type { GalleryConfig } from "../types";
  import { i18n } from "src/lib/stores/i18n";

  export let config: GalleryConfig;
  export let onSave: (config: GalleryConfig) => void;

  let cardWidthValue = config.cardWidth ?? null;

  const SIZE_PRESETS: Array<{ labelKey: string; defaultLabel: string; width: number }> = [
    { labelKey: "views.gallery.settings.card-size.small",  defaultLabel: "S", width: 180 },
    { labelKey: "views.gallery.settings.card-size.medium", defaultLabel: "M", width: 300 },
    { labelKey: "views.gallery.settings.card-size.large",  defaultLabel: "L", width: 440 },
  ];

  function applyPreset(width: number) {
    cardWidthValue = width;
    onSave(produce(config, (draft) => {
      const { cardWidth: _omit, ...rest } = draft;
      void _omit;
      return { ...rest, cardWidth: width };
    }));
  }

  function handleCustomBlur() {
    onSave(produce(config, (draft) => {
      const { cardWidth: _omit, ...rest } = draft;
      void _omit;
      if (!cardWidthValue) return rest;
      return { ...rest, cardWidth: cardWidthValue };
    }));
  }
</script>

<ModalLayout title={$i18n.t("views.gallery.settings.name")}>
  <ModalContent>
    <SettingItem
      name={$i18n.t("views.gallery.settings.card-width.name")}
      description={$i18n.t("views.gallery.settings.card-width.description")}
    >
      <div class="ppp-gallery-size-row">
        <div class="ppp-gallery-presets" role="group" aria-label={$i18n.t("views.gallery.settings.card-size.group", { defaultValue: "Card size presets" })}>
          {#each SIZE_PRESETS as preset}
            <button
              class="ppp-gallery-preset-btn"
              class:ppp-gallery-preset-btn--active={cardWidthValue === preset.width}
              on:click={() => applyPreset(preset.width)}
              title="{$i18n.t(preset.labelKey, { defaultValue: preset.defaultLabel })} ({preset.width}px)"
            >
              {$i18n.t(preset.labelKey, { defaultValue: preset.defaultLabel })}
            </button>
          {/each}
        </div>
        <NumberInput
          placeholder="300"
          bind:value={cardWidthValue}
          on:blur={handleCustomBlur}
        />
      </div>
    </SettingItem>
  </ModalContent>
</ModalLayout>

<style>
  .ppp-gallery-size-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .ppp-gallery-presets {
    display: flex;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    overflow: hidden;
  }

  .ppp-gallery-preset-btn {
    padding: 0.25rem 0.625rem;
    font-size: var(--font-ui-small);
    font-weight: 500;
    background: var(--background-primary);
    border: none;
    border-right: 0.0625rem solid var(--background-modifier-border);
    color: var(--text-muted);
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
    line-height: 1.4;
  }

  .ppp-gallery-preset-btn:last-child {
    border-right: none;
  }

  .ppp-gallery-preset-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .ppp-gallery-preset-btn--active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .ppp-gallery-preset-btn--active:hover {
    background: var(--interactive-accent-hover, var(--interactive-accent));
    color: var(--text-on-accent);
  }

  .ppp-gallery-preset-btn:focus-visible {
    outline: 0.125rem solid var(--interactive-accent);
    outline-offset: -0.125rem;
  }
</style>
