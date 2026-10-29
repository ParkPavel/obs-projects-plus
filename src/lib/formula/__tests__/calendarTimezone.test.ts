import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

// A fresh Node process is needed: changing TZ inside jsdom does not select
// another native Date timezone. Exercise the actual public API in each zone.
const worker = String.raw`
const esbuild = require("esbuild"), vm = require("node:vm");
const built = esbuild.buildSync({
  absWorkingDir: process.cwd(),
  stdin: { contents: 'export {evaluateFormulaWithError} from "src/lib/formula/extendedEvaluator";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, platform: "node", format: "cjs", write: false,
  external: ["src/lib/stores/i18n"], logLevel: "silent"
});
const moduleBox = { exports: {} };
vm.runInNewContext(built.outputFiles[0].text, {
  module: moduleBox, exports: moduleBox.exports, Date,
  require(name) {
    if (name !== "src/lib/stores/i18n") throw new Error("Unexpected host dependency");
    return {i18n: {subscribe(fn) {fn({t: key => key}); return () => {};}}};
  }
});
const record = {id: "synthetic.md", values: {}};
const sources = [
  'WORKDAYS("2011-12-29","2011-12-31")',
  'WORKDAYS("2011-12-28","2012-01-03")',
  'WORKDAYS("2011-12-31","2011-12-29")',
  'WORKDAYS("2026-03-06","2026-03-09")',
  'WORKDAYS("2026-10-30","2026-11-02")'
];
const results = sources.map(source => {
  const result = moduleBox.exports.evaluateFormulaWithError(source, record);
  return { ...result, negativeZero: Object.is(result.value, -0) };
});
process.stdout.write(JSON.stringify(results));
`;

test.each([
  ["Asia/Irkutsk", 1, 4],
  ["America/New_York", 1, 4],
  ["Pacific/Apia", 0, 3],
] as const)("compatibility calendar retains its actual local-date behavior in %s", (zone, first, second) => {
  const results: unknown = JSON.parse(execFileSync(process.execPath, ["-e", worker], {
    cwd: resolve(__dirname, "../../../.."), env: { ...process.env, TZ: zone },
    encoding: "utf8", timeout: 15_000,
  }));
  expect(results).toEqual([
    { value: first, negativeZero: false }, { value: second, negativeZero: false },
    { value: 0, negativeZero: true }, { value: 1, negativeZero: false },
    { value: 1, negativeZero: false },
  ]);
});
