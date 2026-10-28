import { readdirSync, readFileSync } from "fs";
import { join, resolve } from "path";
import ts from "typescript";
import type { App } from "obsidian";
import type { DataviewApi } from "./api";
import { getAPI, isPluginEnabled } from "./host";

const api = (): DataviewApi => ({
  settings: { tableIdColumnName: "File" },
  query: jest.fn(async (): ReturnType<DataviewApi["query"]> => ({ successful: true, value: { type: "list", values: [] } })),
});
const asApp = (host: unknown) => host as App;
afterEach(() => { delete (window as Window & { DataviewAPI?: unknown }).DataviewAPI; });

test("reads the requested app and its enabled flag independently", async () => {
  const local = api(), other = api();
  Object.assign(window, { DataviewAPI: other });
  const enabled = new Set(["dataview"]);
  const app = asApp({ plugins: { enabledPlugins: enabled, plugins: { dataview: { api: local } } } });
  expect(getAPI(app)).toBe(local);
  expect(isPluginEnabled(app)).toBe(true);
  await getAPI(app)!.query('TABLE FROM "Projects"', "origin.md", { forceId: true });
  expect(local.query).toHaveBeenCalledWith('TABLE FROM "Projects"', "origin.md", { forceId: true });
  expect(other.query).not.toHaveBeenCalled();
  enabled.delete("dataview");
  expect(isPluginEnabled(app)).toBe(false);
  expect(getAPI(app)).toBe(local); // SDK accessor itself does not gate on enabled
});

test("an app without Dataview cannot pick up the global window API", () => {
  const global = api(); Object.assign(window, { DataviewAPI: global });
  const app = asApp({ plugins: { enabledPlugins: new Set(["dataview"]), plugins: {} } });
  expect(isPluginEnabled(app)).toBe(true); // enabled but still loading
  expect(getAPI(app)).toBeUndefined();
  expect(getAPI()).toBe(global);
});

test("reads live plugin replacement instead of caching an API across reloads", () => {
  const plugin = { api: api() };
  const app = asApp({ plugins: { plugins: { dataview: plugin } } });
  const before = getAPI(app);
  plugin.api = api();
  expect(getAPI(app)).toBe(plugin.api);
  expect(getAPI(app)).not.toBe(before);
});

test("missing host state is unavailable, without importing or enabling a plugin", () => {
  expect(isPluginEnabled()).toBe(false);
  expect(isPluginEnabled(asApp({}))).toBe(false);
  expect(getAPI(asApp({}))).toBeUndefined();
  expect(getAPI()).toBeUndefined();
});

test("product code never imports the Dataview SDK at runtime", () => {
  const root = resolve(__dirname, "../../..");
  const violations: string[] = [];
  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name);
      if (/__tests__|__mocks__/.test(file)) continue;
      if (entry.isDirectory()) { walk(file); continue; }
      if (!/\.(ts|svelte)$/.test(file) || /\.test\.|\.d\.ts$/.test(file)) continue;
      const source = readFileSync(file, "utf8");
      const script = file.endsWith(".svelte") ? /<script\b[^>]*>([\s\S]*?)<\/script>/.exec(source)?.[1] ?? "" : source;
      const ast = ts.createSourceFile(file, script, ts.ScriptTarget.Latest, true);
      function visit(node: ts.Node): void {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "obsidian-dataview" && !node.importClause?.isTypeOnly) violations.push(file);
        if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "obsidian-dataview" && !node.isTypeOnly) violations.push(file);
        if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(ast) === "require") && node.arguments.some(a => ts.isStringLiteral(a) && a.text === "obsidian-dataview")) violations.push(file);
        ts.forEachChild(node, visit);
      }
      visit(ast);
    }
  }
  walk(root);
  expect(violations).toEqual([]);
});
