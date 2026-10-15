import fs from "fs";
import path from "path";
import ts from "typescript";
import vm from "vm";
import { DEFAULT_PROJECT } from "src/settings/settings";

type Project = import("src/settings/settings").ProjectDefinition;
type List = import("src/settings/v3/settings").AgendaCustomList;
const list: List = { id: "mine", name: "My list", icon: { type: "emoji", value: "📋" }, filterMode: "visual", order: 0 };

// Execute the actual handlers without mounting the unrelated calendar engine.
// Extract syntax, never reproduce their implementation in the test harness.
const source = fs.readFileSync(path.resolve(__dirname, "../CalendarView.svelte"), "utf8");
const script = source.slice(source.indexOf(">") + 1, source.indexOf("</script>"));
const ast = ts.createSourceFile("agenda.ts", script, ts.ScriptTarget.Latest, true);

function runHandler(name: string, latest: Project, detail: unknown): Project {
  const node = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  if (!node) throw new Error(`Missing production handler: ${name}`);
  const compiled = ts.transpileModule(node.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  let saved: Project | undefined;
  vm.runInNewContext(`let project; let _agendaGuard = false; ${compiled}; ${name}({ detail });`, {
    getLatestProject: () => latest,
    settings: { updateProject: (next: Project) => { saved = next; } },
    setTimeout: (callback: () => void) => callback(),
    detail,
  }, { timeout: 1000 });
  if (!saved) throw new Error("Handler did not persist its project");
  return saved;
}

describe("Agenda list persistence", () => {
  it("creating the first list keeps the initial custom mode after reload", () => {
    const initial = { ...DEFAULT_PROJECT, id: "agenda", name: "Agenda" };
    const saved = runHandler("handleAgendaSaveList", initial, { list });
    expect(saved.agenda?.mode).toBe("custom");
    expect(saved.agenda?.custom?.lists).toEqual([list]);
  });

  it.each(["handleAgendaDeleteList", "handleAgendaReorderLists"])("%s uses the same default mode as the sidebar", name => {
    const initial = { ...DEFAULT_PROJECT, id: "agenda", name: "Agenda", agenda: { custom: { lists: [list] } } } as unknown as Project;
    const saved = runHandler(name, initial, { listId: list.id, lists: [list] });
    expect(saved.agenda?.mode).toBe("custom");
  });

  it.each(["standard", "custom"] as const)("editing a list preserves the explicitly chosen %s mode and latest settings", mode => {
    const latest = { ...DEFAULT_PROJECT, id: "agenda", name: "Latest settings", agenda: { mode, standard: { inheritCalendarFilters: false }, custom: { lists: [list] } } };
    const changed = { ...list, name: "Edited" };
    const saved = runHandler("handleAgendaSaveList", latest, { list: changed });
    expect(saved.name).toBe(latest.name);
    expect(saved.agenda?.mode).toBe(mode);
    expect(saved.agenda?.standard?.inheritCalendarFilters).toBe(false);
    expect(saved.agenda?.custom?.lists).toEqual([changed]);
    expect(latest.agenda.custom.lists).toEqual([list]);
  });
});
