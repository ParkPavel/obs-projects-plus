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
      await deps.api.addField(field, []);
      fields = [...fields, field];
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
      (draft) => { void save(draft).then(() => new Notice(deps.t("relation-setup.saved", { defaultValue: "Relation saved." }))).catch((error: unknown) => new Notice(error instanceof Error ? error.message : "Relation could not be saved.")); },
      (draft) => { void refreshPreview(source, draft, modal); }
    );
    modal.open();
    await refreshPreview(source, initial, modal);
  }
  return { open, save };
}
