<script lang="ts">
  import type { ProjectViewProps } from "src/customViewApi";
  import { createDataRecord } from "src/lib/dataApi";
  import type {
    DataField,
    DataFrame,
    DataRecord,
  } from "src/lib/dataframe/dataframe";
  import { updateRecordValues } from "src/lib/datasources/helpers";
  import { notUndefined } from "src/lib/helpers";
  import { i18n } from "src/lib/stores/i18n";
  import { app } from "src/lib/stores/obsidian";
  import { activateRecord } from "src/lib/record/openRecord";
  import { Notice } from "obsidian";
  import type { ViewApi } from "src/lib/viewApi";
  import type { ProjectDefinition } from "src/settings/settings";
  import { CreateNoteModal } from "src/ui/modals/createNoteModal";
  import {
    getRecordColorContext,
    sortRecordsContext,
  } from "src/ui/views/helpers";
  import BoardOptionsProvider from "./BoardOptionsProvider.svelte";
  import { getColumns, getFieldByName } from "./board";
  import { Board } from "./components";
  import type {
    OnRecordAdd,
    OnRecordClick,
    OnRecordCheck,
    OnRecordUpdate,
    OnSortColumns,
    OnColumnAdd,
    OnColumnDelete,
    OnColumnCollapse,
    OnColumnPin,
    OnColumnPersist,
    OnColumnRename,
  } from "./components/Board/types";
  import { isBoardFrozen, type BoardConfig } from "./types";
  import {
    CARD_FRAME_OVERRIDE_CAP,
    normalizeCardFrames,
    withOverride,
    type CardFrame,
  } from "src/ui/components/SharedCard/cardFrames";
  import { settings } from "src/lib/stores/settings";
  import type { FilterCondition } from "src/settings/settings";
  import { getFilterValuesFromConditions } from "src/lib/helpers";

  export let project: ProjectDefinition;
  export let frame: DataFrame;
  export let readonly: boolean;
  /**
   * #C4 — set only by DatabaseCallBlock for a block reading an EXTERNAL
   * project (`dataReadOnly={sourceReadOnly}`). Separate from `readonly`,
   * which a standalone board keeps meaning "no creating notes": Board never
   * checked `readonly` for editing, checking off or reordering a card, so
   * folding the block's data-write ban into `readonly` (#139) would have
   * changed what `readonly` means for every other Board on the vault.
   */
  export let dataReadOnly: boolean = false;
  export let api: ViewApi;
  export let getRecordColor: ProjectViewProps["getRecordColor"];
  export let sortRecords: ProjectViewProps["sortRecords"];
  export let getRecord: ProjectViewProps["getRecord"];

  export let config: BoardConfig | undefined;
  export let onConfigChange: (cfg: BoardConfig) => void;

  export let hasSort: boolean;
  export let hasFilter: boolean;
  export let filterConditions: FilterCondition[] = [];

  $: ({ fields, records } = frame);
  $: orderSyncField =
    (config?.orderSyncField && getFieldByName(fields, config.orderSyncField)) ||
    undefined;

  // FIX-3: Track groupByField changes to reset persistedStatuses
  let prevGroupByField: string | undefined;

  $: {
    const currentGroupBy = config?.groupByField;
    if (prevGroupByField !== undefined && currentGroupBy !== prevGroupByField) {
      // groupByField changed — persistedStatuses are from old field, reset
      const { persistedStatuses: _, ...restConfig } = config ?? {};
      saveConfig(restConfig);
    }
    prevGroupByField = currentGroupBy;
  }

  getRecordColorContext.set(getRecordColor);
  sortRecordsContext.set((records) =>
    hasSort ? sortRecords(records) : [...records]
  );

  /**
   * B10 — a tap on a card opens the record in the peek, like the gallery and
   * the calendar (decision 2026-10-14 in `openRecord.ts`); the card handles
   * Shift/Ctrl itself. A read-only source opens a read-only peek.
   */
  const handleRecordClick: OnRecordClick = (record) => {
    void activateRecord({ id: record.id, readonly: dataReadOnly || readonly }, undefined, { app: $app });
  };

  /**
   * The card's pencil. i3-close: it opens the note's properties block in the
   * peek — the editor the calendar uses too — instead of the older
   * EditNoteModal, which showed a different, partial set of fields. The peek
   * is read-only only on read-only DATA (#C4), as the editor was: a Dataview
   * board's generic `readonly` never stopped editing a card's note.
   */
  const handleRecordEdit: OnRecordClick = (record) => {
    void activateRecord({ id: record.id, readonly: dataReadOnly }, undefined, { app: $app });
  };

  const handleRecordCheck =
    (checkField: string): OnRecordCheck =>
    (record, checked) => {
      if (dataReadOnly) return;
      api.updateRecord(
        updateRecordValues(record, {
          [checkField]: checked,
        }),
        fields
      );
    };

  const handleRecordUpdate =
    (groupByField: DataField | undefined): OnRecordUpdate =>
    (record, { id: column, records }, trigger) => {
      if (dataReadOnly) return;
      // Update record groupByField
      if (trigger === "addToColumn" && groupByField?.name) {
        record = updateRecordValues(record, {
          [groupByField.name]:
            column === $i18n.t("views.board.no-status") ? null : column,
        });
      }

      // If sort or filter is active, get records from settings hand
      // and insert record in correct position or remove it
      let isConfigRecordsLoaded = false;
      if (hasSort || hasFilter) {
        const configRecords = config?.columns?.[column]?.records
          ?.map((r) => getRecord(r))
          .filter(notUndefined);

        if (configRecords) {
          const configRecordIndex = configRecords.findIndex(
            (r) => r.id === record.id
          );
          const isRecordInConfig = configRecordIndex !== -1;

          if (
            isRecordInConfig &&
            (trigger === "removeFromColumn" || !hasSort)
          ) {
            configRecords.splice(configRecordIndex, 1);
          }

          if (trigger === "addToColumn") {
            if (hasSort) {
              // Sort is active, insert record at end of column if it's
              // not already in the config, else keep position
              if (!isRecordInConfig) {
                configRecords.push(record);
              }
            } else if (hasFilter) {
              // If filter is active insert record in correct position
              // relative to records before or after it
              const index = records.findIndex((r) => r.id === record.id);
              const before = records[index - 1];
              const after = records[index + 1];
              let position: number = -1;

              if (before) {
                const beforeIndex = configRecords.findIndex(
                  (r) => r.id === before.id
                );
                if (beforeIndex !== -1) position = beforeIndex + 1;
              }
              if (after && position === -1) {
                position = configRecords.findIndex((r) => r.id === after.id);
              }
              if (position === -1) {
                position = configRecords.length;
              }

              configRecords.splice(position, 0, record);
            }
          }

          records = [
            ...configRecords,
            // In case the config is out of sync, insert any
            // remaining records at the end
            ...records.filter(
              (r1) =>
                r1.id !== record.id &&
                !configRecords.find((r2) => r2.id === r1.id)
            ),
          ];
          isConfigRecordsLoaded = true;
        }
      }

      saveConfig({
        ...config,
        columns: {
          ...config?.columns,
          [column]: {
            ...config?.columns?.[column],
            records: records.map((r) => r.id),
          },
        },
      });

      // If record was removed from column, there is no need to update
      // the groupBy or orderSync fields, since order is preserved on removal
      // and the groupBy field is set on adding the record to the other column
      if (trigger !== "removeFromColumn") {
        const recordsToUpdate: DataRecord[] = [];

        // If a sync field is defined, update it according to the order. Only
        // update if no sort is active or records are loaded from the config,
        // since they are sorted correctly according to custom order
        const orderSyncFieldName = orderSyncField?.name;
        if (orderSyncFieldName && (isConfigRecordsLoaded || !hasSort)) {
          records.forEach((r, i) => {
            const recordToUpdate =
              r.id === record.id
                ? record
                : r.values[orderSyncFieldName] !== i && r;
            if (recordToUpdate) {
              recordsToUpdate.push(
                updateRecordValues(recordToUpdate, {
                  [orderSyncFieldName]: i,
                })
              );
            }
          });
        } else {
          recordsToUpdate.push(record);
        }

        api.updateRecords(recordsToUpdate, fields);
      }
    };

  const handleRecordAdd =
    (field: DataField | undefined): OnRecordAdd =>
    (column: string) => {
      new CreateNoteModal($app, project, (name, templatePath) => {
        const filterValues = getFilterValuesFromConditions(filterConditions, field?.name);
        return api.addRecord(
          createDataRecord(
            name,
            project,
            {
              ...filterValues,
              ...(field
                ? {
                    [field.name]:
                      column !== $i18n.t("views.board.no-status")
                        ? column
                        : undefined,
                  }
                : {}),
            }
          ),
          fields,
          templatePath
        );
      }).open();
    };

  const handleSortColumns =
    (field: DataField | undefined): OnSortColumns =>
    (columns) => {
      if (dataReadOnly) return;
      if (field?.name && field?.typeConfig && field.typeConfig?.options) {
        settings.updateFieldConfig(
          project.id,
          field?.name,
          fields.map((f) => f.name),
          {
            ...field.typeConfig,
            options: [...field.typeConfig.options].sort(
              (a, b) => columns.indexOf(a) - columns.indexOf(b)
            ),
          }
        );
      }
      saveConfig({
        ...config,
        columns: Object.fromEntries(
          columns.map((column, i) => [
            column,
            { ...config?.columns?.[column], weight: i },
          ])
        ),
      });
    };

  const handleColumnAdd =
    (field: DataField | undefined): OnColumnAdd =>
    (columns, name) => {
      if (!field) return;

      settings.updateFieldConfig(
        project.id,
        field.name,
        fields.map((f) => f.name),
        {
          ...field?.typeConfig,
          options: [...(field.typeConfig?.options ?? []), name],
        }
      );

      saveConfig({
        ...config,
        persistedStatuses: [...new Set([...(config?.persistedStatuses ?? []), name])],
        columns: Object.fromEntries(
          [...columns, name].map((column, i) => {
            return [column, { ...config?.columns?.[column], weight: i }];
          })
        ),
      });
    };

  const handleColumnDelete =
    (field: DataField | undefined): OnColumnDelete =>
    async (columns, name, records) => {
      if (dataReadOnly) return;
      if (!field) return;

      const newRecords = records.map((record) =>
        updateRecordValues(record, {
          [field.name]: null,
        })
      );

      await api.updateRecords(newRecords, fields);

      if (field.typeConfig && field.typeConfig.options) {
        let options = [...field.typeConfig.options];
        settings.updateFieldConfig(
          project.id,
          field.name,
          fields.map((f) => f.name),
          {
            ...field.typeConfig,
            options: options.filter((v) => v !== name),
          }
        );
      }

      saveConfig({
        ...config,
        persistedStatuses: (config?.persistedStatuses ?? []).filter(s => s !== name),
        columns: Object.fromEntries(
          columns
            .filter((v) => v !== name)
            .map((column, i) => {
              return [column, { ...config?.columns?.[column], weight: i }];
            })
        ),
      });
    };

  const handleColumnRename =
    (field: DataField | undefined): OnColumnRename =>
    async (columns, oldName, newName, records) => {
      if (dataReadOnly) return;
      if (!field) return;

      const newRecords = records.map((record) =>
        updateRecordValues(record, {
          [field.name]: newName,
        })
      );
      await api.updateRecords(newRecords, fields);

      if (field?.typeConfig && field.typeConfig?.options) {
        const options = [...field.typeConfig?.options];
        if (options.includes(oldName)) {
          options.splice(options.indexOf(oldName), 1, newName);
          settings.updateFieldConfig(
            project.id,
            field.name,
            fields.map((f) => f.name),
            {
              ...field.typeConfig,
              options,
            }
          );
        }
      }

      saveConfig({
        ...config,
        persistedStatuses: (config?.persistedStatuses ?? []).map(s => s === oldName ? newName : s),
        columns: Object.fromEntries(
          columns.map((column, i) => {
            return [
              column === oldName ? newName : column,
              { ...config?.columns?.[column], weight: i },
            ];
          })
        ),
      });
    };

  const toggleColumnCollapse = (): OnColumnCollapse => (name) => {
    saveConfig({
      ...config,
      columns: {
        ...config?.columns,
        [name]: {
          ...config?.columns?.[name],
          collapse: !config?.columns?.[name]?.collapse,
        },
      },
    });
  };

  // i3-board: a pin is a view setting (config.columns[name].pinned). The
  // status field's options are its values, not a pin list; they stay as
  // they are. Pinning also keeps the column when it empties, as before.
  const toggleColumnPin = (): OnColumnPin => (_columns, name) => {
    const pinned = config?.columns?.[name]?.pinned === true;
    const current = config?.persistedStatuses ?? [];
    saveConfig({
      ...config,
      persistedStatuses: pinned || current.includes(name) ? current : [...current, name],
      columns: {
        ...config?.columns,
        [name]: { ...config?.columns?.[name], pinned: !pinned },
      },
    });
  };

  function saveConfig(cfg: BoardConfig) {
    config = cfg;
    onConfigChange(cfg);
  }

  // cards-g5: saved card frames. A resize commits one card's override here,
  // once, through `saveConfig`; a further NEW override past the cap is refused
  // with a notice and nothing is evicted.
  $: cardFrames = normalizeCardFrames(config);

  function handleCardFrameChange(recordId: string, next: CardFrame | undefined) {
    const patch = withOverride(config, recordId, next);
    if (!patch) {
      new Notice($i18n.t("settings-menu.view-config.card-frames.cap-reached", { limit: CARD_FRAME_OVERRIDE_CAP }));
      return;
    }
    saveConfig({ ...config, ...patch });
  }

  const handleColumnPersist: OnColumnPersist = (name) => {
    const current = config?.persistedStatuses ?? [];
    const isPersisted = current.includes(name);
    saveConfig({
      ...config,
      persistedStatuses: isPersisted
        ? current.filter(s => s !== name)
        : [...current, name],
    });
  };

  // FIX-3: Initialize persistedStatuses on first render
  $: {
    const groupByFieldForInit = fields.find(f => config?.groupByField === f.name);
    if (config?.persistedStatuses === undefined && groupByFieldForInit) {
      const initialColumns = getColumns(records, config?.columns ?? {}, groupByFieldForInit, orderSyncField, !hasSort);
      saveConfig({
        ...config,
        persistedStatuses: initialColumns.map(c => c.id),
      });
    }
  }
</script>

<!--
  @component

  BoardView is the main board component that gets mounted inside the project view.
-->
<BoardOptionsProvider
  {frame}
  config={config ?? {}}
  onConfigChange={saveConfig}
  let:columnWidth
  let:groupMode
  let:groupByField
  let:checkField
  let:includeFields
  let:customHeader
  let:iconField
  let:thumbnailLayout
  let:coverField
>
  <Board
    columns={getColumns(
      records,
      config?.columns ?? {},
      groupByField,
      orderSyncField,
      !hasSort,
      config?.persistedStatuses,
      groupMode === "semantic"
    ).map((c) => (isBoardFrozen(config) ? { ...c, pinned: true } : c))}
    {columnWidth}
    zoom={config?.boardZoom ?? 1}
    onZoomChange={(z) => saveConfig({ ...config, boardZoom: z })}
    checkField={fields.find((field) => field.name === config?.checkField)?.name}
    includeFields={fields.filter((field) => includeFields.includes(field.name))}
    customHeader={fields.find((field) => field.name === customHeader)}
    iconField={fields.find((field) => field.name === iconField)}
    {thumbnailLayout}
    coverField={fields.find((field) => field.name === coverField)}
    {cardFrames}
    onCardFrameChange={handleCardFrameChange}
    onRecordClick={handleRecordClick}
    onRecordEdit={handleRecordEdit}
    onRecordCheck={handleRecordCheck(checkField)}
    onRecordAdd={handleRecordAdd(groupByField)}
    onRecordUpdate={handleRecordUpdate(groupByField)}
    onColumnAdd={handleColumnAdd(groupByField)}
    onColumnDelete={handleColumnDelete(groupByField)}
    onColumnRename={handleColumnRename(groupByField)}
    onColumnCollapse={toggleColumnCollapse()}
    onColumnPin={toggleColumnPin()}
    onColumnPersist={handleColumnPersist}
    onSortColumns={handleSortColumns(groupByField)}
    {readonly}
    {dataReadOnly}
    validateStatusField={() => {
      if (groupByField?.derived) return "derived-status-field";
      if (!groupByField) return "no-status-field";
      return "";
    }}
    richText={groupByField?.typeConfig?.richText ?? false}
  />
</BoardOptionsProvider>
