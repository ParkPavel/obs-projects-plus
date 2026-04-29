const transformer = require("../../scripts/jest/svelte-ts-transformer.cjs");

describe("svelte-ts-transformer", () => {
  test("preserves runtime imports while stripping type-only imports from svelte scripts", () => {
    const source = `
<script lang="ts">
  import type {
    DataFrame,
    DataRecord,
  } from "src/lib/dataframe/dataframe";
  import { writable, type Writable } from "svelte/store";
  import { isMobile } from "src/lib/stores/ui";

  export let frame: DataFrame;
  const projectStore: Writable<string> = writable("demo");
  $: layoutMode = $isMobile ? "stack" : "free";
</script>

<div>{layoutMode}</div>`;

    const result = transformer.process(source, "TransformerFixture.svelte");

    expect(result.code).toContain('const { writable } = require("svelte/store");');
    expect(result.code).toContain('const { isMobile } = require("src/lib/stores/ui");');
    expect(result.code).not.toContain('src/lib/dataframe/dataframe');
    expect(result.code).not.toContain('DataRecord');
    expect(result.code).not.toContain('from;');
  });
});