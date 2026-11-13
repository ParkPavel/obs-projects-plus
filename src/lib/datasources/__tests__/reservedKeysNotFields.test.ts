/**
 * i2-schema (D09): `pp_overlay` and `pp_types` — the plugin's own frontmatter
 * — showed up in every field picker, because `detectFields` turned every key
 * into a field and only the note's property block filtered them out.
 */
import { detectFields } from "src/lib/datasources/helpers";

it("the plugin's own keys and Obsidian's $-keys are not fields of the base", () => {
  const fields = detectFields([
    { id: "a.md", values: { name: "a", status: "todo", pp_overlay: "{}", pp_types: "{}", $lock: true } },
    { id: "b.md", values: { name: "b", price: 3 } },
  ]);
  expect(fields.map((f) => f.name).sort()).toEqual(["name", "price", "status"]);
});
