/**
 * The table footer and the Stats card picker show the aggregation vocabulary
 * in the user's language: the footer printed the raw identifier ("count
 * total"), the picker's hover text was the English consequence.
 */

import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";

// Echo the key and its English default so a translated string is observable.
jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return {
    i18n: writable({
      t: (key: string, options?: { defaultValue?: string }) => `${key}|${options?.defaultValue ?? ""}`,
    }),
  };
});

const { DataFieldType } = require("src/lib/dataframe/dataframe");
const TableFooter = require("../TableFooter.svelte").default;
const StatsConfig = require("../../Stats/StatsConfig.svelte").default;

const amount = { name: "amount", type: DataFieldType.Number, repeated: false, identifier: false, derived: false };

describe("aggregation vocabulary on the surfaces", () => {
  test("the table footer names its calculation through the vocabulary", () => {
    const { container } = render(TableFooter, {
      props: {
        columns: [{ field: amount }],
        aggregations: { amount: { function: "count_total", value: 3, formattedValue: "3" } },
      },
    });
    const fn = container.querySelector(".ppp-t2-footer-fn");
    expect(fn?.textContent).toMatch(/^views\.dashboard\.agg\.count_total\|/);
  });

  test("the Stats card picker explains each option through the vocabulary", () => {
    const { container } = render(StatsConfig, {
      props: {
        config: { cards: [{ id: "a", label: "A", field: "amount", aggregation: "sum" }], columns: 3 },
        fields: [amount],
      },
    });
    const options = Array.from(container.querySelectorAll("option[title]"));
    expect(options.length).toBeGreaterThan(3);
    for (const option of options) {
      expect(option.getAttribute("title")).toMatch(/^views\.dashboard\.agg-consequence\.[a-z_]+\|/);
    }
  });
});
