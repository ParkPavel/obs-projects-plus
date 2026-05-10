// src/ui/views/Dashboard/dashboardSchema.ts
//
// R5-013 — Schema controller extracted from DashboardCanvas.svelte.
// Encapsulates the modal flow for the Database/Dashboard view's schema
// management surface (open schema → create / configure / delete field →
// reopen schema). DashboardCanvas now consumes a single
// `createSchemaController(deps).openSchema()` entry point.
//
// Why a TS factory and not a Svelte child component: the modal lifecycle
// is imperative (opens, calls back, closes) and has no rendered output.
// A factory keeps the component thin and testable in isolation while
// preserving the live-projection semantics callers had inline (latest
// fields/projects are read at modal-open time via closures).

import type { App } from "obsidian";
import { Notice } from "obsidian";
import { tick } from "svelte";

import type { DataField } from "src/lib/dataframe/dataframe";
import type { ViewApi } from "src/lib/viewApi";
import type { ProjectDefinition, ProjectId } from "src/settings/settings";
import { settings } from "src/lib/stores/settings";

import { CreateFieldModal } from "src/ui/modals/createFieldModal";
import { ConfigureFieldModal } from "src/ui/modals/configureField";
import { SchemaModal } from "src/ui/modals/schemaModal";
import { ConfirmDialogModal } from "src/ui/modals/confirmDialog";

export interface SchemaControllerDeps {
  readonly app: App;
  readonly api: ViewApi;
  readonly projectId: ProjectId;
  /** Live projection — read on every modal open so newly-added fields surface. */
  readonly getFields: () => DataField[];
  /** Live projection of all projects (for cross-project relation pickers). */
  readonly getProjects: () => ProjectDefinition[];
  /** Translator. Receives optional fallback via `defaultValue` opts. */
  readonly t: (key: string, opts?: { defaultValue?: string; [k: string]: unknown }) => string;
}

export interface SchemaController {
  openSchema(): void;
  openCreateField(): void;
}

export function createSchemaController(deps: SchemaControllerDeps): SchemaController {
  let schemaModal: SchemaModal | null = null;

  function persistFieldTypeConfig(field: DataField) {
    if (!field.typeConfig) return;
    settings.updateFieldConfig(
      deps.projectId,
      field.name,
      deps.getFields().map((f) => f.name),
      field.typeConfig
    );
  }

  function openCreateField() {
    new CreateFieldModal(
      deps.app,
      deps.getFields(),
      async (field, value) => {
        try {
          await deps.api.addField(field, value);
          persistFieldTypeConfig(field);
          reopenSchema();
        } catch (err) {
          new Notice(
            deps.t("views.dashboard.canvas.error-add-field", {
              defaultValue: "Failed to add field. Please try again.",
            })
          );
          // eslint-disable-next-line no-console
          console.warn("[obs-projects-plus] addField failed", err);
        }
      },
      deps.getProjects(),
      deps.projectId
    ).open();
  }

  function openConfigureField(field: DataField) {
    new ConfigureFieldModal(
      deps.app,
      deps.t("modals.field.configure.title"),
      field,
      deps.getFields().filter((f) => f.name !== field.name),
      !field.derived && !field.identifier,
      (next) => {
        if (!field.derived && !field.identifier) {
          if (next.name !== field.name) {
            deps.api.updateField(next, field.name);
            settings.deleteFieldConfig(deps.projectId, field.name);
          } else {
            deps.api.updateField(next);
          }
        }
        persistFieldTypeConfig(next);
        reopenSchema();
      },
      deps.getProjects(),
      deps.projectId
    ).open();
  }

  function openDeleteField(field: DataField) {
    new ConfirmDialogModal(
      deps.app,
      deps.t("modals.schema.delete-confirm.title"),
      deps.t("modals.schema.delete-confirm.message", { name: field.name }),
      deps.t("modals.schema.delete-confirm.cta"),
      () => {
        deps.api.deleteField(field.name);
        settings.deleteFieldConfig(deps.projectId, field.name);
        reopenSchema();
      }
    ).open();
  }

  function openSchema() {
    schemaModal = new SchemaModal(
      deps.app,
      deps.t("modals.schema.title"),
      deps.getFields(),
      deps.getProjects(),
      deps.projectId,
      (field) => {
        schemaModal?.close();
        openConfigureField(field);
      },
      () => {
        schemaModal?.close();
        openCreateField();
      },
      (field) => {
        schemaModal?.close();
        openDeleteField(field);
      }
    );
    schemaModal.open();
  }

  function reopenSchema() {
    // Re-open on the next tick so the user remains anchored in the schema
    // flow after editing or adding a field — keeps task continuity (no
    // jarring jump back to an empty canvas).
    tick()
      .then(() => openSchema())
      .catch((err) => {
        new Notice(
          deps.t("views.dashboard.canvas.error-reopen-schema", {
            defaultValue: "Failed to reopen schema.",
          })
        );
        // eslint-disable-next-line no-console
        console.warn("[obs-projects-plus] reopenSchema failed", err);
      });
  }

  return { openSchema, openCreateField };
}
