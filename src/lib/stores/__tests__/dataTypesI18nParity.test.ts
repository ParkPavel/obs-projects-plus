/**
 * i18n parity test for Stage A field-type labels (R-10 mitigation).
 *
 * Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.5a — every Stage A
 * `data-types.*` key must exist in all four supported locales.
 */
import { describe, expect, it } from "@jest/globals";

import en from "../translations/en.json";
import ru from "../translations/ru.json";
import uk from "../translations/uk.json";
import zhCN from "../translations/zh-CN.json";

type Bundle = { translation: { "data-types": Record<string, string> } };

const STAGE_A_KEYS = [
  "string",
  "number",
  "boolean",
  "date",
  "datetime",
  "list",
  "tags",
  "aliases",
  "select",
  "status",
  "formula",
  "relation",
  "rollup",
  "unknown",
] as const;

describe("data-types i18n parity (Stage A)", () => {
  const locales: Array<readonly [string, Bundle]> = [
    ["en", en as Bundle],
    ["ru", ru as Bundle],
    ["uk", uk as Bundle],
    ["zh-CN", zhCN as Bundle],
  ];

  for (const [name, bundle] of locales) {
    it(`${name}: defines every Stage A key with a non-empty value`, () => {
      const dt = bundle.translation["data-types"];
      for (const key of STAGE_A_KEYS) {
        const value = dt[key];
        expect(value).toBeDefined();
        expect(typeof value).toBe("string");
        expect((value as string).length).toBeGreaterThan(0);
      }
    });
  }
});
