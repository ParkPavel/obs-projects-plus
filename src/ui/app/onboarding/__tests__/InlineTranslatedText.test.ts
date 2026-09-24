/**
 * P1 — `InlineTranslatedText.svelte` is the onboarding-only inline
 * markup parser that replaces `{@html sanitizeHtml(...)}`. It parses
 * only `**bold**` into `<strong>` and `[label](properties)` into an
 * anchor pointing at Obsidian's Properties help page — a fixed URL the
 * component owns, not something the translation string supplies. Any
 * other bracketed destination is not a supported link target and must
 * stay literal text (in particular, an `[label](javascript:...)` payload
 * must never become a clickable `href`).
 *
 * This component does not exist yet on the base commit, so this test's
 * import is expected to fail to resolve — that unresolved-module failure
 * is the accepted RED for this file.
 */

import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";

import InlineTranslatedText from "../InlineTranslatedText.svelte";

const PROPERTIES_URL = "https://help.obsidian.md/Editing+and+formatting/Properties";

describe("InlineTranslatedText — parses onboarding markup into real DOM nodes (P1)", () => {
  it("turns [label](properties) into a real anchor pointing at the fixed Properties URL", () => {
    const { container } = render(InlineTranslatedText, {
      props: { text: "Projects Plus lets you manage notes using [front matter](properties)." },
    });

    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute("href", PROPERTIES_URL);
    expect(link?.textContent).toBe("front matter");

    // The markup syntax itself must not leak into the rendered text.
    expect(container.textContent).not.toContain("[front matter]");
    expect(container.textContent).not.toContain("(properties)");
  });

  it("leaves an unsupported link destination as literal text", () => {
    const { container } = render(InlineTranslatedText, {
      props: { text: "Click [here](javascript:alert(1)) to continue." },
    });

    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("[here](javascript:alert(1))");
  });

  it("still parses **bold** alongside a properties link in the same string", () => {
    const { container } = render(InlineTranslatedText, {
      props: { text: "Read the **docs** or open [front matter](properties)." },
    });

    const strong = container.querySelector("strong");
    expect(strong?.textContent).toBe("docs");

    const link = container.querySelector("a");
    expect(link).toHaveAttribute("href", PROPERTIES_URL);
  });
});
