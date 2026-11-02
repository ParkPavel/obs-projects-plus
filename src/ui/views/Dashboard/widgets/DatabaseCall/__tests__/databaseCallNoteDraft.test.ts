import * as fs from "fs";
import * as path from "path";

const block = fs.readFileSync(path.resolve(__dirname, "../DatabaseCallBlock.svelte"), "utf8");

describe("first record creation in a database block", () => {
  it("opens the shared inline draft from both creation actions", () => {
    expect(block).toContain('import NoteDraft from "src/ui/components/NoteDraft.svelte";');
    expect(block).toMatch(/else openFirstRecordDraft\(\);/);
    expect(block).toMatch(/on:click=\{openFirstRecordDraft\}/);
    expect(block).toMatch(/\{:else if effectiveFrame\.records\.length === 0 && firstRecordDraftOpen && project\}\s*<div class="ppp-dbc-first-record-draft">\s*<NoteDraft/);
    expect(block).not.toContain("CreateNoteModal");
  });

  it("keeps the existing record and template write path and waits for success", () => {
    expect(block).toMatch(/async function saveFirstRecord\([\s\S]*?targetProject: ProjectDefinition[\s\S]*?\): Promise<void> \{\s*await api\.addRecord\(createDataRecord\(name, targetProject\), fields, templatePath\);\s*firstRecordDraftOpen = false;/);
  });
});
