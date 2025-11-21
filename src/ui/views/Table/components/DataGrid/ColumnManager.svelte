<script lang="ts">
  import { produce } from "immer";
  import { Menu } from "obsidian";
  import { i18n } from "src/lib/stores/i18n";
  import type { GridColDef } from "./dataGrid";
  import { Button } from "obsidian-svelte";

  export let columns: GridColDef[];
  export let readonly: boolean;

  export let onColumnResize: (field: string, width: number) => void;
  export let onColumnSort: (fields: string[]) => void;
  export let onColumnConfigure: (column: GridColDef, editable: boolean) => void;
  export let onColumnDelete: (field: string) => void;
  export let onColumnHide: (column: GridColDef) => void;
  export let onColumnPin: (column: GridColDef) => void;
  export let onColumnInsert: (
    anchor: string, // anchor field name
    direction: number // 1 for right, 0 for left insert (keep the place and push back others)
  ) => void;

  $: t = $i18n.t;

  /**
   * ColumnManager - handles all column-related operations and menu creation
   * Separates column logic from DataGrid for better maintainability
   */
  export class ColumnManager {
    /**
     * Creates a context menu for a specific column
     */
    static createColumnMenu(
      column: GridColDef,
      readonly: boolean,
      t: any,
      onColumnConfigure: (column: GridColDef, editable: boolean) => void,
      onColumnInsert: (anchor: string, direction: number) => void,
      onColumnPin: (column: GridColDef) => void,
      onColumnHide: (column: GridColDef) => void,
      onColumnDelete: (field: string) => void
    ): Menu {
      const editable = !!column.editable && !readonly;
      const menu = new Menu();

      // Configure column
      menu.addItem((item) => {
        item
          .setTitle(t("components.data-grid.column.configure"))
          .setIcon("settings")
          .onClick(() => onColumnConfigure(column, editable));
      });

      if (!readonly) {
        // Insert column to the left
        menu.addItem((item) => {
          item
            .setTitle(t("components.data-grid.column.insert-left"))
            .setIcon("arrow-left")
            .onClick(() => {
              onColumnInsert(column.field, 0);
            });
        });

        // Insert column to the right
        menu.addItem((item) => {
          item
            .setTitle(t("components.data-grid.column.insert-right"))
            .setIcon("arrow-right")
            .onClick(() => {
              onColumnInsert(column.field, 1);
            });
        });
      }

      menu.addSeparator();

      // Pin/unpin column
      menu.addItem((item) => {
        item
          .setTitle(
            column.pinned
              ? t("components.data-grid.column.unpin")
              : t("components.data-grid.column.pin")
          )
          .setIcon(column.pinned ? "pin-off" : "pin")
          .onClick(() => onColumnPin(column));
      });

      // Hide column
      menu.addItem((item) => {
        item
          .setTitle(t("components.data-grid.column.hide"))
          .setIcon("eye-off")
          .onClick(() => {
            onColumnHide(column);
          });
      });

      // Delete column (if editable)
      if (editable) {
        menu.addItem((item) => {
          item
            .setTitle(t("components.data-grid.column.delete"))
            .setIcon("trash")
            .setWarning(true)
            .onClick(() => onColumnDelete(column.field));
        });
      }

      return menu;
    }

    /**
     * Filters columns by visibility (not hidden)
     */
    static getVisibleColumns(columns: GridColDef[]): GridColDef[] {
      return columns.filter((column) => !column.hide);
    }

    /**
     * Handles column order changes and triggers sorting callback
     */
    static handleColumnOrder(
      columns: GridColDef[],
      onColumnSort: (fields: string[]) => void
    ): void {
      onColumnSort(columns.map((col) => col.field));
    }

    /**
     * Creates a column menu button component
     */
    static createColumnMenuButton(
      column: GridColDef,
      readonly: boolean,
      t: any,
      handlers: {
        onColumnConfigure: (column: GridColDef, editable: boolean) => void;
        onColumnInsert: (anchor: string, direction: number) => void;
        onColumnPin: (column: GridColDef) => void;
        onColumnHide: (column: GridColDef) => void;
        onColumnDelete: (field: string) => void;
      }
    ) {
      const editable = !!column.editable && !readonly;
      const menu = ColumnManager.createColumnMenu(
        column,
        readonly,
        t,
        handlers.onColumnConfigure,
        handlers.onColumnInsert,
        handlers.onColumnPin,
        handlers.onColumnHide,
        handlers.onColumnDelete
      );

      return menu;
    }
  }
</script>

<div class="column-manager">
  <!-- Column operations will be integrated into GridHeader -->
  <!-- This component provides the logic, the UI is handled by GridHeader -->
</div>

<style>
  .column-manager {
    /* Layout handled by parent DataGrid */
  }
</style>