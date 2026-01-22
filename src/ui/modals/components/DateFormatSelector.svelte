<script lang="ts">
  /**
   * DateFormatSelector.svelte
   * 
   * UI component for selecting date format configuration.
   * Provides preset dropdown, custom format input, live preview, and time toggle.
   */
  import dayjs from "dayjs";
  import { Select, TextInput, Switch, SettingItem } from "obsidian-svelte";
  import type { DateFormatConfig, DateFormatPreset } from "src/settings/v3/settings";
  import { DATE_FORMAT_PRESETS } from "src/settings/v3/settings";

  export let dateFormat: DateFormatConfig | undefined = undefined;
  export let onChange: (config: DateFormatConfig | undefined) => void;

  // Preset options
  const presetOptions = [
    { label: "ISO 8601 (YYYY-MM-DD)", value: "iso" },
    { label: "US (MM/DD/YYYY)", value: "us" },
    { label: "EU (DD.MM.YYYY)", value: "eu" },
    { label: "UK (DD/MM/YYYY)", value: "uk" },
    { label: "Japan (YYYY年MM月DD日)", value: "japan" },
    { label: "Custom", value: "custom" },
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
      return "Invalid format";
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
  name="Date Format"
  description="Choose how dates are formatted when creating or editing notes"
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
    name="Format Preset"
    description="Select a predefined format or choose Custom"
  >
    <Select
      value={currentPreset}
      options={presetOptions}
      on:change={handlePresetChange}
    />
  </SettingItem>

  {#if currentPreset === "custom"}
    <SettingItem
      name="Custom Format"
      description="Enter a dayjs format string (e.g., DD-MMM-YYYY)"
      vertical
    >
      <TextInput
        value={customFormat}
        on:input={handleCustomFormatChange}
        error={!isValidFormat}
        helperText={!isValidFormat ? "Invalid format string" : ""}
        placeholder="YYYY-MM-DD"
        width="100%"
      />
    </SettingItem>
  {/if}

  <SettingItem
    name="Include Time"
    description="Append HH:mm time to the date format"
  >
    <Switch
      checked={includeTime}
      on:check={handleTimeToggle}
    />
  </SettingItem>

  <SettingItem
    name="Preview"
    description="How today's date will be formatted"
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
    padding: 8px 12px;
    background: var(--background-modifier-border);
    border-radius: 4px;
    min-width: 200px;
    text-align: center;
  }

  .preview-text.error {
    color: var(--text-error);
  }
</style>
