import * as fs from "fs";
import * as path from "path";

const block = fs.readFileSync(path.resolve(__dirname, "../DatabaseCallBlock.svelte"), "utf8");

describe("first record creation in a database block", () => {
  it("opens the shared inline draft from both creation actions", () => {
    expect(block).toContain('import NoteDraft from "src/ui/components/NoteDraft.svelte";');
    expect(block).toMatch(/else openFirstRecordDraft\(\);/);
    expect(block).toMatch(/on:click=\{openFirstRecordDraft\}/);
    expect(block).not.toContain("CreateNoteModal");
  });

  // Persistence acknowledgement, failure/retry and create values are exercised
  // through the actual form in creationContext.test.ts, not source spelling.
});
