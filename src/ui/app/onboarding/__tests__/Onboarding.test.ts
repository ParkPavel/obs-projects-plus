/**
 * P1 — onboarding markup no longer reaches the DOM through {@html}.
 *
 * v3.0.7 put presentational markup (`<strong>`, `<a>`) directly into
 * translation strings, and `Onboarding.svelte` rendered them through
 * `{@html sanitizeHtml(t(key))}`. The replacement design has translators
 * write plain `**bold**` / `[text](properties)` markers; the component
 * parses those into real DOM nodes and never assigns an HTML string to
 * the DOM. This test mocks the i18n store directly (the real store is
 * itself stubbed for Jest, see `src/__mocks__/svelte-i18next.js`, and
 * ignores the JSON bundles) so it can supply markup and observe what the
 * rendered component actually attaches to the tree.
 */

import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";

const TRANSLATIONS: Record<string, string> = {
  "onboarding.tab-projects-view": "Projects view",
  "onboarding.tab-command-palette": "Command palette",
  "onboarding.tab-file-explorer": "File explorer",
  "onboarding.projects-view-step1":
    "In the top-right corner of the **Projects Plus** view, click **New**.",
  "onboarding.projects-view-step2": "Click **New project**.",
};

const ATTACK_KEY = "onboarding.projects-view-step1";
const ATTACK_PAYLOAD =
  '<img src=x onerror="alert(1)"><script>alert(1)</script><strong onclick="alert(1)">click me</strong>';

jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return {
    i18n: writable({
      t: (key: string, options?: { defaultValue?: string }) =>
        (global as unknown as { __ONBOARDING_TRANSLATIONS__: Record<string, string> })
          .__ONBOARDING_TRANSLATIONS__?.[key] ??
        options?.defaultValue ??
        key,
    }),
  };
});

import Onboarding from "../Onboarding.svelte";

describe("Onboarding — translation markup renders as real DOM nodes, never as HTML (P1)", () => {
  beforeEach(() => {
    (global as unknown as { __ONBOARDING_TRANSLATIONS__: Record<string, string> })
      .__ONBOARDING_TRANSLATIONS__ = TRANSLATIONS;
  });

  it("renders **bold** markers from the initially selected Projects tab as real <strong> elements", () => {
    const { container } = render(Onboarding, {
      props: { onCreate: jest.fn(), onTry: jest.fn(), onProfile: jest.fn() },
    });

    const strongTexts = Array.from(container.querySelectorAll("strong")).map(
      (node) => node.textContent
    );
    expect(strongTexts).toEqual(expect.arrayContaining(["Projects Plus", "New"]));

    // The raw markers must not survive as plain text anywhere in the step.
    expect(container.textContent).not.toContain("**Projects Plus**");
    expect(container.textContent).not.toContain("**New**");
  });

  it("never turns an attribute-bearing, script, or attributed-strong payload into DOM nodes", () => {
    (global as unknown as { __ONBOARDING_TRANSLATIONS__: Record<string, string> })
      .__ONBOARDING_TRANSLATIONS__ = {
      ...TRANSLATIONS,
      [ATTACK_KEY]: ATTACK_PAYLOAD,
    };

    const { container } = render(Onboarding, {
      props: { onCreate: jest.fn(), onTry: jest.fn(), onProfile: jest.fn() },
    });

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    // No <strong> may carry an onclick — an attribute-bearing tag must stay text.
    for (const strong of Array.from(container.querySelectorAll("strong"))) {
      expect(strong.hasAttribute("onclick")).toBe(false);
    }

    // The payload must still be visible as literal text, not silently dropped.
    expect(container.textContent).toContain("click me");
  });
});
