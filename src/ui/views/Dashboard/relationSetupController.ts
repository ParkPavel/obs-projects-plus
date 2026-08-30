import type { App } from "obsidian";
import { Notice } from "obsidian";
import { DataFieldType, type DataField, type DataFrame } from "src/lib/dataframe/dataframe";
import type { ViewApi } from "src/lib/viewApi";
import { previewRelationSetup, summarizeRelationPreview, toRelationFieldConfig, validateRelationSetupDraft, type RelationSetupDraft } from "src/lib/relations/relationSetup";
import { settings } from "src/lib/stores/settings";
import type { ProjectDefinition, ProjectId } from "src/settings/settings";
import { RelationSetupModal } from "src/ui/modals/relationSetupModal";

export type RelationSetupControllerDeps = {
  readonly app: App;
  readonly api: ViewApi;
  readonly projectId: ProjectId;
  readonly getFrame: () => DataFrame;
  readonly getProjects: () => readonly ProjectDefinition[];
  readonly t: (key: string, options?: { defaultValue?: string }) => string;
};

export function createRelationSetupController(deps: RelationSetupControllerDeps) {
  async function save(draft: RelationSetupDraft): Promise<void> {
    const source = deps.getFrame();
    const valid = validateRelationSetupDraft(draft, source.fields);
    if (!valid.valid) throw new Error(valid.message);
    const config = toRelationFieldConfig(draft);
    let fields = source.fields;
    if (draft.createSourceField) {
      const field: DataField = { name: draft.fieldName.trim(), type: DataFieldType.Relation, repeated: true, identifier: false, derived: false, typeConfig: { relation: config } };
      // #150 — `addField` reports a partial write instead of throwing (#144), and
      // the wizard used to answer "Relation saved." to it regardless. The
      // relation IS saved in that case, but some notes did not get the property,
      // and saying only the first half is how a half-written vault looks healthy.
      const outcome = await deps.api.addField(field, []);
      fields = [...fields, field];
      const unwritten = outcome.failed.length + outcome.missing.length;
      if (unwritten > 0) {
        settings.updateFieldConfig(deps.projectId, draft.fieldName.trim(), fields.map((f) => f.name), { relation: config });
        throw new Error(
          deps.t("relation-setup.saved-partial", {
            defaultValue: `Relation saved, but the property could not be added to ${unwritten} note(s). See the console.`,
          })
        );
      }
    }
    settings.updateFieldConfig(deps.projectId, draft.fieldName.trim(), fields.map((field) => field.name), { relation: config });
  }
  async function refreshPreview(source: DataFrame, draft: RelationSetupDraft, modal: RelationSetupModal): Promise<void> {
    if (!draft.targetProjectId.trim()) { modal.setSummary(undefined); return; }
    const target = await deps.api.resolveExternalFrame?.(draft.targetProjectId);
    if (!target) { modal.setSummary(undefined); return; }
    modal.setSummary(summarizeRelationPreview(previewRelationSetup(source, draft.fieldName, target, draft.displayField)));
  }
  async function open(initial: RelationSetupDraft): Promise<void> {
    const source = deps.getFrame();
    const modal = new RelationSetupModal(
      deps.app, deps.getProjects(), initial, undefined,
      (draft) => {
        // #150 — the wizard used to stay open after a successful save while a
        // Notice said "Relation saved.", so the only signal that anything had
        // happened was a message next to a form that still looked unsubmitted.
        // It now closes on success and reports failure inside itself.
        modal.setError("");
        modal.setBusy(true);
        void save(draft)
          .then(() => {
            modal.close();
            new Notice(deps.t("relation-setup.saved", { defaultValue: "Relation saved." }));
          })
          .catch((error: unknown) => {
            modal.setBusy(false);
            modal.setError(
              error instanceof Error ? error.message : "Relation could not be saved."
            );
          });
      },
      (draft) => { void refreshPreview(source, draft, modal); }
    );
    modal.open();
    await refreshPreview(source, initial, modal);
  }
  return { open, save };
}
