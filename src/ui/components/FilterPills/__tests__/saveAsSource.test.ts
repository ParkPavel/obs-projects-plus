/**
 * #184 step 2 — naming a filter you have already watched work.
 *
 * The whole argument for putting this in the view's filter bar rather than in
 * the project editor is that here the filter is visible and has already
 * narrowed what is on screen. That argument is only honoured if the action is
 * absent when there is nothing to name, so the first two tests are about when
 * the button is NOT there.
 *
 * This component mounts in jest (unlike `DatabaseCallBlock`, which closes a
 * require cycle through `BoardView`), so these drive the real thing.
 */

import "@testing-library/jest-dom";
import { render, waitFor } from "@testing-library/svelte";

import type { FilterDefinition } from "src/settings/base/settings";
import ViewFilterBar from "../ViewFilterBar.svelte";

const withCondition: FilterDefinition = {
  conjunction: "and",
  conditions: [{ field: "status", operator: "is", value: "open" }],
} as unknown as FilterDefinition;

const emptyFilter: FilterDefinition = {
  conjunction: "and",
  conditions: [],
} as unknown as FilterDefinition;

const save = (container: HTMLElement) =>
  container.querySelector<HTMLButtonElement>(".ppp-viewfilter-save");
const nameInput = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement>(".ppp-viewfilter-name");

const mount = (props: Record<string, unknown>) =>
  render(ViewFilterBar, { props: { fields: [], records: [], ...props } });

describe("#184 — the action exists only when there is something worth naming", () => {
  it("is absent with no filter at all", () => {
    // A selection with no conditions equals the project it came from. Offering
    // to save one would produce a source that means nothing, which is exactly
    // the argument that kept this out of the project editor.
    const { container } = mount({ filter: undefined });
    expect(save(container)).toBeNull();
  });

  it("is absent for a filter that has conditions but none enabled", () => {
    // `conditions.length` alone would be the wrong test: a disabled condition
    // narrows nothing, so the user has not watched this filter work either.
    const disabled = {
      conjunction: "and",
      conditions: [{ field: "status", operator: "is", value: "open", enabled: false }],
    } as unknown as FilterDefinition;
    const { container } = mount({ filter: disabled });
    expect(save(container)).toBeNull();
  });

  it("is absent in a read-only view", () => {
    // Nothing here could be written, so offering to write would be a promise
    // the surface cannot keep.
    const { container } = mount({ filter: withCondition, readonly: true });
    expect(save(container)).toBeNull();
  });

  it("appears once a condition is actually narrowing", () => {
    const { container } = mount({ filter: withCondition });
    expect(save(container)).not.toBeNull();
  });
});

describe("#184 — naming it", () => {
  it("asks for a name before saving anything", async () => {
    // The name is the only thing that will identify this selection in a picker
    // later, so it is not optional and there is no unnamed path.
    const saved: string[] = [];
    const { container, component } = mount({ filter: withCondition });
    component.$on("saveAsSource", (e: CustomEvent<string>) => saved.push(e.detail));

    save(container)!.click();
    await waitFor(() => expect(nameInput(container)).not.toBeNull());
    expect(saved).toEqual([]);
  });

  it("emits the trimmed name on Enter", async () => {
    const saved: string[] = [];
    const { container, component } = mount({ filter: withCondition });
    component.$on("saveAsSource", (e: CustomEvent<string>) => saved.push(e.detail));

    save(container)!.click();
    await waitFor(() => expect(nameInput(container)).not.toBeNull());
    const el = nameInput(container)!;
    el.value = "  Active clients  ";
    el.dispatchEvent(new Event("input"));
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    await waitFor(() => expect(saved).toEqual(["Active clients"]));
  });

  it("Escape abandons it, and nothing is saved", async () => {
    const saved: string[] = [];
    const { container, component } = mount({ filter: withCondition });
    component.$on("saveAsSource", (e: CustomEvent<string>) => saved.push(e.detail));

    save(container)!.click();
    await waitFor(() => expect(nameInput(container)).not.toBeNull());
    const el = nameInput(container)!;
    el.value = "typed then abandoned";
    el.dispatchEvent(new Event("input"));
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    await waitFor(() => expect(nameInput(container)).toBeNull());
    expect(saved).toEqual([]);
  });

  it("a blank name is a cancel, not an unnamed source", async () => {
    // Blur commits, which is what makes the inline input forgiving. An empty
    // one must not therefore write a source called "".
    const saved: string[] = [];
    const { container, component } = mount({ filter: withCondition });
    component.$on("saveAsSource", (e: CustomEvent<string>) => saved.push(e.detail));

    save(container)!.click();
    await waitFor(() => expect(nameInput(container)).not.toBeNull());
    const el = nameInput(container)!;
    el.value = "   ";
    el.dispatchEvent(new Event("input"));
    el.dispatchEvent(new Event("blur"));

    await waitFor(() => expect(nameInput(container)).toBeNull());
    expect(saved).toEqual([]);
  });

  it("does not disturb the filter it is naming", async () => {
    // Saving is a read of the filter, never an edit of it. A `change` here
    // would rewrite the user's view filter as a side effect of naming it.
    const changes: unknown[] = [];
    const { container, component } = mount({ filter: withCondition });
    component.$on("change", (e: CustomEvent<unknown>) => changes.push(e.detail));

    save(container)!.click();
    await waitFor(() => expect(nameInput(container)).not.toBeNull());
    const el = nameInput(container)!;
    el.value = "Active";
    el.dispatchEvent(new Event("input"));
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    await waitFor(() => expect(nameInput(container)).toBeNull());
    expect(changes).toEqual([]);
  });
});

describe("#184 — the empty-filter guard is about narrowing, not about shape", () => {
  it("an explicitly empty definition is still nothing to save", () => {
    const { container } = mount({ filter: emptyFilter });
    expect(save(container)).toBeNull();
  });
});
