<script lang="ts">
  import { produce } from "immer";
  import {
    ModalContent,
    ModalLayout,
    NumberInput,
    Select,
    SettingItem,
  } from "obsidian-svelte";
  import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import { fieldToSelectableValue } from "../../helpers";
  import { getFieldsByType } from "../board";
  import type { BoardConfig } from "../types";

  export let config: BoardConfig;
  export let fields: DataField[];
  export let onSave: (config: BoardConfig) => void;

  let columnWidthValue = config.columnWidth ?? null;
  $: groupMode = config.groupMode ?? "values";

  $: headerField = config.headerField ?? "";

  $: orderSyncField = config.orderSyncField ?? "";
  $: validOrderSyncFields = getFieldsByType(fields, DataFieldType.Number);

  const updateConfig = <T extends keyof BoardConfig>(
    key: T,
    value: BoardConfig[T] | null
  ) =>
    onSave(
      produce(config, (draft) => {
        const { [key]: _, ...rest } = draft;
        return value ? { ...rest, [key]: value } : rest;
      })
    );

  function handleGroupModeChange(event: CustomEvent<string>) {
    groupMode = event.detail as "values" | "semantic";
    updateConfig("groupMode", groupMode === "values" ? null : groupMode);
  }
</script>

<ModalLayout title={$i18n.t("views.board.settings.name")}>
  <ModalContent>
    <SettingItem
      name={$i18n.t("views.board.settings.column-width.name")}
      description={$i18n.t("views.board.settings.column-width.description")}
    >
      <NumberInput
        placeholder="270"
        bind:value={columnWidthValue}
        on:blur={() => updateConfig("columnWidth", columnWidthValue)}
      />
    </SettingItem>
    <SettingItem
      name={$i18n.t("views.board.settings.custom-header.name")}
      description={$i18n.t("views.board.settings.custom-header.description")}
    >
      <Select
        value={headerField ?? ""}
        options={fields.map(fieldToSelectableValue)}
        placeholder={$i18n.t("views.board.fields.none") ?? ""}
        allowEmpty
        on:change={(event) => {
          headerField = event.detail;
          updateConfig("headerField", headerField);
        }}
      />
    </SettingItem>
    <SettingItem
      name={$i18n.t("views.board.settings.order-sync-field.name")}
      description={$i18n.t("views.board.settings.order-sync-field.description")}
    >
      <Select
        value={orderSyncField ?? ""}
        options={validOrderSyncFields.map(fieldToSelectableValue)}
        placeholder={$i18n.t("views.board.fields.none") ?? ""}
        allowEmpty
        on:change={(event) => {
          orderSyncField = event.detail;
          updateConfig("orderSyncField", orderSyncField);
        }}
      />
    </SettingItem>
    <SettingItem
      name={$i18n.t("views.board.settings.group-mode.name", { defaultValue: "Column grouping" })}
      description={$i18n.t("views.board.settings.group-mode.description", { defaultValue: "Values: one column per unique value. Semantic: group by status category (requires status groups configured on the field)." })}
    >
      <Select
        value={groupMode}
        options={[
          { label: $i18n.t("views.board.settings.group-mode.values", { defaultValue: "Values" }), value: "values" },
          { label: $i18n.t("views.board.settings.group-mode.semantic", { defaultValue: "Semantic groups" }), value: "semantic" },
        ]}
        on:change={handleGroupModeChange}
      />
    </SettingItem>
  </ModalContent>
</ModalLayout>