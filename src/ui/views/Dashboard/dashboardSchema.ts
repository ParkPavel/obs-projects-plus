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
import { createRelationSetupController } from "./relationSetupController";

export interface SchemaControllerDeps {
  readonly app: App;
  readonly api: ViewApi;
  readonly projectId: ProjectId;
  /** Live projection — read on every modal open so newly-added fields surface. */
  readonly getFields: () => DataField[];
  /**
   * Live projection of the records the schema write would touch. Used for the
   * bulk-write consequence line (#144) and for the relation preview, which
   * counted matches against an empty record list before (#150).
   */
  readonly getRecords: () => ReadonlyArray<{ readonly id: string }>;
  /** Live projection of all projects (for cross-project relation pickers). */
  readonly getProjects: () => ProjectDefinition[];
  /** Translator. Receives optional fallback via `defaultValue` opts. */
  readonly t: (key: string, opts?: { defaultValue?: string; [k: string]: unknown }) => string;
}

export interface SchemaController {
  openSchema(): void;
  openCreateField(): void;
  /**
   * CV-2 (2026-08-28) — the schema writes became awaited in #144, which
   * introduced a gap the synchronous version could not have: the user closes
   * the dashboard while a bulk field write is in flight, the write finishes,
   * and the callback reopens a modal belonging to a view that no longer exists.
   * The canvas calls this on destroy.
   */
  dispose(): void;
}

export function createSchemaController(deps: SchemaControllerDeps): SchemaController {
  let schemaModal: SchemaModal | null = null;
  /** False once the owning view is gone; nothing may open after that. */
  let alive = true;
  const relationSetup = createRelationSetupController({
    app: deps.app, api: deps.api, projectId: deps.projectId, getFrame: () => ({ fields: deps.getFields(), records: deps.getRecords() as never }),
    getProjects: deps.getProjects, t: deps.t,
  });

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
    const createModal = new CreateFieldModal(
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
      deps.projectId,
      (f) => {
        createModal.close();
        const displayField = f.typeConfig?.relation?.displayField;
        void relationSetup.open({
          fieldName: f.name,
          targetProjectId: (f.typeConfig?.relation?.targetProjectId ?? ""),
          createSourceField: true,
          ...(displayField !== undefined ? { displayField } : {}),
        });
      },
      deps.getRecords().length
    );
    createModal.open();
  }

  function openConfigureField(field: DataField) {
    const configModal = new ConfigureFieldModal(
      deps.app,
      deps.t("modals.field.configure.title"),
      field,
      deps.getFields().filter((f) => f.name !== field.name),
      !field.derived && !field.identifier,
      async (next) => {
        // #144 — these writes touch every note in the project. Awaiting them
        // means a partial failure is reported by `ViewApi` before the schema
        // modal reopens claiming the rename went through.
        if (!field.derived && !field.identifier) {
          if (next.name !== field.name) {
            await deps.api.updateField(next, field.name);
            settings.deleteFieldConfig(deps.projectId, field.name);
          } else {
            await deps.api.updateField(next);
          }
        }
        persistFieldTypeConfig(next);
        reopenSchema();
      },
      deps.getProjects(),
      deps.projectId,
      (f) => {
        configModal.close();
        const displayField = f.typeConfig?.relation?.displayField;
        void relationSetup.open({
          fieldName: f.name,
          targetProjectId: (f.typeConfig?.relation?.targetProjectId ?? ""),
          createSourceField: false,
          ...(displayField !== undefined ? { displayField } : {}),
        });
      }
    );
    configModal.open();
  }

  function openDeleteField(field: DataField) {
    new ConfirmDialogModal(
      deps.app,
      deps.t("modals.schema.delete-confirm.title"),
      deps.t("modals.schema.delete-confirm.message", { name: field.name }),
      deps.t("modals.schema.delete-confirm.cta"),
      async () => {
        // #144 — same reason as the rename path: the outcome of a write across
        // every note is reported before the schema claims the field is gone.
        await deps.api.deleteField(field.name);
        settings.deleteFieldConfig(deps.projectId, field.name);
        reopenSchema();
      }
    ).open();
  }

  function openSchema() {
    if (!alive) return;
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
      (field) => {
        schemaModal?.close();
        // #150 — this entry point used to drop `displayField` and the inverse
        // name: the wizard opened without them, and saving from here wrote a
        // config that had silently lost both. The other two entry points
        // already carried `displayField`; this one is now level with them.
        const relation = field.typeConfig?.relation;
        void relationSetup.open({
          fieldName: field.name,
          targetProjectId: relation?.targetProjectId ?? "",
          createSourceField: false,
          ...(relation?.displayField !== undefined ? { displayField: relation.displayField } : {}),
          ...(relation?.inverseFieldName
            ? { inverse: { enabled: true, fieldName: relation.inverseFieldName } }
            : {}),
        });
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
    if (!alive) return;
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

  return {
    openSchema,
    openCreateField,
    dispose() {
      alive = false;
      schemaModal?.close();
      schemaModal = null;
    },
  };
}
