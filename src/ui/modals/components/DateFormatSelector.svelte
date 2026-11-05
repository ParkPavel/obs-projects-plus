<script lang="ts">
  import { i18n } from "src/lib/stores/i18n";
  /**
   * DateFormatSelector.svelte
   * 
   * UI component for selecting date format configuration.
   * Provides preset dropdown, custom format input, live preview, and time toggle.
   */
  import dayjs from "dayjs";
  import { Switch, SettingItem } from "obsidian-svelte";
  import SelectField from "src/ui/components/fields/SelectField.svelte";
  import ValueSuggestField from "src/ui/components/fields/ValueSuggestField.svelte";
  import type { DateFormatConfig, DateFormatPreset } from "src/settings/v3/settings";
  import { DATE_FORMAT_PRESETS } from "src/settings/v3/settings";

  export let dateFormat: DateFormatConfig | undefined = undefined;
  export let onChange: (config: DateFormatConfig | undefined) => void;
  let customField: ValueSuggestField | undefined;
  export function commitForNavigation(): boolean {
    if (!dateFormat || currentPreset !== "custom") return true;
    return isValidFormat && (customField?.commitForNavigation() ?? true);
  }

  // Preset options
  $: presetOptions = [
    { label: "ISO 8601 (YYYY-MM-DD)", value: "iso" },
    { label: "US (MM/DD/YYYY)", value: "us" },
    { label: "EU (DD.MM.YYYY)", value: "eu" },
    { label: "UK (DD/MM/YYYY)", value: "uk" },
    { label: "Japan (YYYY年MM月DD日)", value: "japan" },
    { label: $i18n.t("modals.date-format.custom.name"), value: "custom" },
  ];

  // Current state
  $: currentPreset = dateFormat?.preset ?? "iso";
  $: customFormat = (currentPreset === "custom" ? dateFormat?.writeFormat : "") ?? "";
  $: includeTime = dateFormat?.includeTime ?? false;

  // Live preview
  $: previewDate = dayjs();
  $: previewFormatted = (() => {
    try {
      const format = currentPreset === "custom" && customFormat 
        ? customFormat 
        : DATE_FORMAT_PRESETS[currentPreset as DateFormatPreset].writeFormat;
      const result = previewDate.format(format);
      if (includeTime) {
        return result + " " + previewDate.format("HH:mm");
      }
      return result;
    } catch (e) {
      return $i18n.t("modals.date-format.invalid");
    }
  })();

  // Validation
  $: isValidFormat = (() => {
    if (currentPreset !== "custom") return true;
    if (!customFormat) return false;
    try {
      previewDate.format(customFormat);
      return true;
    } catch {
      return false;
    }
  })();

  function handlePresetChange({ detail: value }: CustomEvent<string>) {
    const preset = value as DateFormatPreset;
    
    if (preset === "custom") {
      // Switch to custom mode
      onChange({
        writeFormat: customFormat || "YYYY-MM-DD",
        includeTime,
        preset: "custom",
      });
    } else {
      // Use preset
      const presetConfig = DATE_FORMAT_PRESETS[preset];
      onChange({
        ...presetConfig,
        includeTime,
      });
    }
  }

  function handleCustomFormatChange({ detail: value }: CustomEvent<string>) {
    if (currentPreset !== "custom") return;
    
    onChange({
      writeFormat: value,
      includeTime,
      preset: "custom",
    });
  }

  function handleTimeToggle({ detail: checked }: CustomEvent<boolean>) {
    if (!dateFormat) {
      onChange({
        ...DATE_FORMAT_PRESETS.iso,
        includeTime: checked,
      });
    } else {
      onChange({
        ...dateFormat,
        includeTime: checked,
      });
    }
  }

  function handleDisable() {
    onChange(undefined);
  }
</script>

<SettingItem
  name={$i18n.t("modals.date-format.name")}
  description={$i18n.t("modals.date-format.desc")}
>
  <Switch
    checked={!!dateFormat}
    on:check={({ detail: enabled }) => {
      if (enabled) {
        onChange({ ...DATE_FORMAT_PRESETS.iso, includeTime: false });
      } else {
        handleDisable();
      }
    }}
  />
</SettingItem>

{#if dateFormat}
  <SettingItem
    name={$i18n.t("modals.date-format.preset.name")}
    description={$i18n.t("modals.date-format.preset.desc")}
  >
    <SelectField
      tooltip={$i18n.t("modals.date-format.preset.name")}
      value={currentPreset}
      options={presetOptions}
      on:change={handlePresetChange}
    />
  </SettingItem>

  {#if currentPreset === "custom"}
    <SettingItem
      name={$i18n.t("modals.date-format.custom.name")}
      description={$i18n.t("modals.date-format.custom.desc")}
      vertical
    >
      <ValueSuggestField
        bind:this={customField}
        ariaLabel={$i18n.t("modals.date-format.custom.name")}
        value={customFormat}
        on:input={handleCustomFormatChange}
        error={!isValidFormat}
        helperText={!isValidFormat ? $i18n.t("modals.date-format.invalid") : ""}
        placeholder="YYYY-MM-DD"
      />
    </SettingItem>
  {/if}

  <SettingItem
    name={$i18n.t("modals.date-format.include-time.name")}
    description={$i18n.t("modals.date-format.include-time.desc")}
  >
    <Switch
      checked={includeTime}
      on:check={handleTimeToggle}
    />
  </SettingItem>

  <SettingItem
    name={$i18n.t("modals.date-format.preview.name")}
    description={$i18n.t("modals.date-format.preview.desc")}
  >
    <div class="preview-text" class:error={!isValidFormat}>
      {previewFormatted}
    </div>
  </SettingItem>
{/if}

<style>
  .preview-text {
    font-family: var(--font-monospace);
    font-size: var(--font-ui-small);
    color: var(--text-accent);
    padding: 0.5rem 0.75rem;
    background: var(--background-modifier-border);
    border-radius: 0.25rem;
    min-width: 12.5rem;
    text-align: center;
  }

  .preview-text.error {
    color: var(--text-error);
  }
</style>
