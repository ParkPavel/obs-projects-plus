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
//
// i3-dash: entry points are the «Properties of «project»…» item of a block
// menu that reads this project (layout/blockProperties.ts) and the command
// palette (dashboardCommands.ts). The toolbar button is gone: it did not say
// whose properties it edited. The dialog and its flows are unchanged.
//
// i3-final: the schema dialog stays open while a field is created,
// configured or deleted — those dialogs open over it — and its list refreshes
// in place after the write (and again when the canvas frame catches up, via
// `refresh`), with focus back on the edited row.

import type { App } from "obsidian";
import { Notice } from "obsidian";
import { noticeFor } from "src/lib/errors/errorText";

/** #202 — the codes this module raises. Words live in the registry. */
const ADD_FIELD_FAILED = "PPP-401";
const REOPEN_SCHEMA_FAILED = "PPP-402";
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
import { declaredPropertyType, isEmptyFieldValue } from "src/lib/relations/declaredFieldTypes";

export interface SchemaControllerDeps {
  readonly app: App;
  readonly api: ViewApi;
  /**
   * #158 — live projection, not a captured id: the canvas that owns this
   * controller can be retargeted to a different project without being
   * recreated, and every write below must land on whichever project is on
   * screen at write time, not the one that was on screen when this
   * controller was built.
   */
  readonly getProjectId: () => ProjectId;
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
   * i3-final: the project's fields changed (the canvas calls this when its
   * frame does). An open schema dialog shows them in place.
   */
  refresh(): void;
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
  /**
   * i3-final: the row that takes focus once the list shows the last write —
   * `present` waits for the name to appear (add, rename), `absent` for it to
   * go (delete, focus then moves to the row now at `index`).
   */
  let pendingFocus: { name: string; index: number; expect: "present" | "absent" } | null = null;

  function schemaIsOpen(): boolean {
    return alive && schemaModal?.isOpen === true;
  }

  /** i3-final: put the live fields into the open dialog; focus follows the edit. */
  function showFields(): void {
    if (!schemaIsOpen() || !schemaModal) return;
    const fields = deps.getFields();
    const want = pendingFocus;
    const present = want !== null && fields.some((f) => f.name === want.name);
    if (want && present === (want.expect === "present")) {
      pendingFocus = null;
      schemaModal.setFields(fields, { name: want.name, index: want.index });
    } else {
      schemaModal.setFields(fields);
    }
  }

  /**
   * i3-final: after a write made from the dialog — it stayed open under the
   * field dialog, so its list refreshes in place (now, and again when the
   * frame catches up through `refresh`). With no dialog open (an add from the
   * command palette) the schema opens, as before.
   */
  function afterWrite(focus: { name: string; expect: "present" | "absent"; index?: number }): void {
    if (!alive) return;
    if (!schemaIsOpen()) {
      reopenSchema();
      return;
    }
    pendingFocus = {
      name: focus.name,
      expect: focus.expect,
      index: focus.index ?? deps.getFields().findIndex((f) => f.name === focus.name),
    };
    tick()
      .then(showFields)
      .catch((err) => console.warn("[Projects+] schema refresh failed", err));
  }
  const relationSetup = createRelationSetupController({
    app: deps.app, api: deps.api, getProjectId: deps.getProjectId, getFrame: () => ({ fields: deps.getFields(), records: deps.getRecords() as never }),
    getProjects: deps.getProjects, t: deps.t,
  });

  /**
   * `alsoKeep` — fields written in the same dialog that the live frame may not
   * list yet: `updateFieldConfig` prunes every config whose field is not in
   * the list, and would drop the relation a rollup was just created with (B5).
   */
  function persistFieldTypeConfig(field: DataField, alsoKeep: readonly string[] = []) {
    if (!field.typeConfig) return;
    settings.updateFieldConfig(
      deps.getProjectId(),
      field.name,
      [...deps.getFields().map((f) => f.name), ...alsoKeep],
      field.typeConfig
    );
  }

  function openCreateField() {
    const createdHere: string[] = [];
    const createModal = new CreateFieldModal(
      deps.app,
      deps.getFields(),
      // M03 (C13): the modal waits for this answer. `false` keeps it open with
      // the draft; a partial write (some notes not written) counts as failed so
      // the person can retry — addField leaves existing values unchanged.
      async (field, value) => {
        try {
          const outcome = await deps.api.addField(field, value);
          // i2-safety: nothing was written into the notes, so the base's
          // settings carry the property — with its type, or the frame would
          // not list it and the next config write would prune it.
          const type = isEmptyFieldValue(value) ? declaredPropertyType(field) : undefined;
          persistFieldTypeConfig(type ? { ...field, typeConfig: { ...field.typeConfig, type } } : field, createdHere);
          if (outcome && outcome.failed.length + outcome.missing.length > 0) return false;
          afterWrite({ name: field.name, expect: "present" });
          return true;
        } catch (err) {
          new Notice(noticeFor(ADD_FIELD_FAILED));
          console.warn("[Projects+] addField failed", err);
          return false;
        }
      },
      deps.getProjects(),
      deps.getProjectId(),
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
      // M03 (C8): the count the writer will actually touch, not the view's rows.
      deps.api.fieldWriteTargets().length,
      {
        ...(deps.api.resolveExternalFrame
          ? { resolveFrame: (projectId: string) => deps.api.resolveExternalFrame!(projectId) }
          : {}),
        // B5 — the relation a new rollup reads through, created first and on
        // the same write path as any field; a partial write stops the rollup.
        onCreateRelation: async (relation: DataField) => {
          try {
            const outcome = await deps.api.addField(relation, []);
            persistFieldTypeConfig(relation, createdHere);
            createdHere.push(relation.name);
            return !(outcome && outcome.failed.length + outcome.missing.length > 0);
          } catch (err) {
            console.warn("[Projects+] addField (relation) failed", err);
            return false;
          }
        },
      }
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
            settings.deleteFieldConfig(deps.getProjectId(), field.name);
          } else {
            await deps.api.updateField(next);
          }
        }
        persistFieldTypeConfig(next);
        afterWrite({ name: next.name, expect: "present" });
      },
      deps.getProjects(),
      deps.getProjectId(),
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
    const index = deps.getFields().findIndex((f) => f.name === field.name);
    new ConfirmDialogModal(
      deps.app,
      deps.t("modals.schema.delete-confirm.title"),
      deps.t("modals.schema.delete-confirm.message", { name: field.name }),
      deps.t("modals.schema.delete-confirm.cta"),
      async () => {
        // #144 — same reason as the rename path: the outcome of a write across
        // every note is reported before the schema claims the field is gone.
        await deps.api.deleteField(field.name);
        settings.deleteFieldConfig(deps.getProjectId(), field.name);
        afterWrite({ name: field.name, expect: "absent", index });
      }
    ).open();
  }

  // i3-final: the schema dialog no longer closes for an edit — the field
  // dialogs open over it and the list refreshes in place (afterWrite).
  function openSchema() {
    if (!alive) return;
    if (schemaIsOpen()) {
      showFields();
      return;
    }
    pendingFocus = null;
    schemaModal = new SchemaModal(
      deps.app,
      deps.t("modals.schema.title"),
      deps.getFields(),
      deps.getProjects(),
      deps.getProjectId(),
      (field) => {
        openConfigureField(field);
      },
      (field) => {
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
        openCreateField();
      },
      (field) => {
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
        new Notice(noticeFor(REOPEN_SCHEMA_FAILED));
        console.warn("[Projects+] reopenSchema failed", err);
      });
  }

  return {
    openSchema,
    openCreateField,
    refresh: showFields,
    dispose() {
      alive = false;
      pendingFocus = null;
      schemaModal?.close();
      schemaModal = null;
    },
  };
}
