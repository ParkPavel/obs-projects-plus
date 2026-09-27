/**
 * Icon buttons are operable from the keyboard.
 *
 * obsidian-svelte 0.2.1 renders its IconButton as `<div on:click>` with no
 * role, no tab stop and no key handler, so every icon-only action it drew
 * (add view, settings menu, board column actions, archive restore/delete, …)
 * was out of reach for keyboard users, and the Svelte compiler warned about
 * it on every build. The plugin now uses its own IconButton.
 */

import "@testing-library/jest-dom";
import { fireEvent, render } from "@testing-library/svelte";
import * as fs from "fs";
import * as path from "path";
import { collectSourceFiles, SRC_ROOT } from "./support/cssScan";

// Loaded lazily so the import guard below reports on its own when the
// component is missing.
const loadIconButton = () => require("src/ui/components/IconButton/IconButton.svelte").default;

describe("IconButton — keyboard access", () => {
  function renderButton(props: Record<string, unknown> = {}) {
    const onClick = jest.fn();
    const { container } = render(loadIconButton(), { props: { icon: "plus", tooltip: "Add", onClick, ...props } });
    const button = container.querySelector(".clickable-icon") as HTMLElement;
    return { button, onClick };
  }

  test("is a focusable button with its tooltip as the accessible name", () => {
    const { button } = renderButton();
    expect(button).toHaveAttribute("role", "button");
    expect(button).toHaveAttribute("tabindex", "0");
    expect(button).toHaveAttribute("aria-label", "Add");
  });

  test.each(["Enter", " "])("activates on %p", async (key) => {
    const { button, onClick } = renderButton();
    await fireEvent.keyDown(button, { key });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("still activates on click", async () => {
    const { button, onClick } = renderButton();
    await fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("keeps its key from a parent that also handles Enter", async () => {
    const parentKeydown = jest.fn();
    const { button, onClick } = renderButton();
    button.parentElement?.addEventListener("keydown", parentKeydown);
    await fireEvent.keyDown(button, { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(parentKeydown).not.toHaveBeenCalled();
  });

  test("ignores other keys", async () => {
    const { button, onClick } = renderButton();
    await fireEvent.keyDown(button, { key: "a" });
    expect(onClick).not.toHaveBeenCalled();
  });

  test("a disabled button leaves the tab order and does not activate", async () => {
    const { button, onClick } = renderButton({ disabled: true });
    expect(button).toHaveAttribute("tabindex", "-1");
    expect(button).toHaveAttribute("aria-disabled", "true");
    await fireEvent.keyDown(button, { key: "Enter" });
    await fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("IconButton — no source uses the inaccessible one", () => {
  test("no file imports IconButton from obsidian-svelte", () => {
    const offenders = collectSourceFiles(SRC_ROOT, [".svelte", ".ts"])
      .filter((file) => !/\.(test|spec)\.ts$/.test(file))
      .filter((file) => {
        const code = fs.readFileSync(file, "utf8").replace(/^\s*\/\/.*$/gm, "");
        return /import\s*\{[^}]*\bIconButton\b[^}]*\}\s*from\s*["']obsidian-svelte["']/.test(code);
      })
      .map((file) => path.relative(SRC_ROOT, file).split(path.sep).join("/"));
    expect(offenders).toEqual([]);
  });

  // IconButton takes an onClick prop and dispatches no component events, so
  // `on:click` on it is never called — the board card's pencil was wired that
  // way and did nothing, with the mouse as with the keyboard.
  test("no IconButton is wired with on:click", () => {
    const offenders = collectSourceFiles(SRC_ROOT, [".svelte"])
      .filter((file) => /<IconButton\b[^>]*\son:click\b/.test(fs.readFileSync(file, "utf8")))
      .map((file) => path.relative(SRC_ROOT, file).split(path.sep).join("/"));
    expect(offenders).toEqual([]);
  });
});
