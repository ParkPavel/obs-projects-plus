<script lang="ts">
  import { Menu } from "obsidian";
  import { produce } from "immer";
  import { i18n } from "src/lib/stores/i18n";
  import type { GridColDef, GridRowId, GridRowModel } from "./dataGrid";

  export let readonly: boolean;
  export let colorModel: (rowId: string) => string | null;

  // Row operation handlers
  export let onRowAdd: () => void;
  export let onRowDelete: (rowId: GridRowId) => void;
  export let onRowEdit: (rowId: GridRowId, row: GridRowModel) => void;
  export let onRowChange: (rowId: GridRowId, row: GridRowModel) => void;

  $: t = $i18n.t;

  /**
   * RowManager - handles all row-related operations and menu creation
   * Separates row logic from DataGrid for better maintainability
   */
  export class RowManager {
    /**
     * Creates a context menu for a specific row
     */
    static createRowMenu(
      rowId: GridRowId,
      row: GridRowModel,
      readonly: boolean,
      t: any,
      onRowEdit: (rowId: GridRowId, row: GridRowModel) => void,
      onRowDelete: (rowId: GridRowId) => void
    ): Menu {
      const menu = new Menu();

      // Edit row
      menu.addItem((item) => {
        item
          .setTitle(t("components.data-grid.row.edit"))
          .setIcon("edit")
          .onClick(() => onRowEdit(rowId, row));
      });

      if (!readonly) {
        menu.addSeparator();

        // Delete row
        menu.addItem((item) => {
          item
            .setTitle(t("components.data-grid.row.delete"))
            .setIcon("trash")
            .setWarning(true)
            .onClick(() => onRowDelete(rowId));
        });
      }

      return menu;
    }

    /**
     * Creates a context menu for a specific cell
     */
    static createCellMenu(
      rowId: GridRowId,
      row: GridRowModel,
      column: GridColDef,
      onRowChange: (rowId: GridRowId, row: GridRowModel) => void
    ): Menu {
      const menu = new Menu();

      // Only provide clear option for editable columns
      if (column.editable) {
        menu.addItem((item) => {
          item
            .setTitle("Clear cell")
            .setIcon("x")
            .onClick(() => {
              onRowChange(
                rowId,
                produce(row, (draft) => {
                  draft[column.field] = undefined;
                  return draft;
                })
              );
            });
        });
      }

      return menu;
    }

    /**
     * Validates row data before operations
     */
    static validateRowOperation(
      operation: 'add' | 'delete' | 'edit',
      row?: GridRowModel
    ): { valid: boolean; error?: string } {
      switch (operation) {
        case 'add':
          return { valid: true };
        
        case 'delete':
          return row ? { valid: true } : { valid: false, error: 'Row data required' };
        
        case 'edit':
          return row ? { valid: true } : { valid: false, error: 'Row data required' };
        
        default:
          return { valid: false, error: 'Unknown operation' };
      }
    }
  }
</script>

<div class="row-manager">
  <!-- Row operations will be integrated into GridRow and footer -->
  <!-- This component provides the logic, the UI is handled by parent components -->
</div>

<style>
  .row-manager {
    /* Layout handled by parent DataGrid */
  }
</style>