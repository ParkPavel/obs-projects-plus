/**
 * #169 — the signal contract of the inline «+ New» row, exercised rather than read.
 *
 * The adversarial review of #169 was right about the first version of this
 * check: `A169_widgetWeight` asserted the collapsed-widget behaviour by
 * searching source text for statement order, which is a claim about how the
 * code is written and not about what a click does. The risky half is timing —
 * a lazily mounted component that receives a counter which was already raised
 * before it existed — and timing is exactly what source text cannot show.
 *
 * So the component is really mounted, at the two moments that matter:
 *
 *   1. mounted with the signal ALREADY raised. This is the collapsed widget:
 *      the header is on screen while the content is not, so the press lands
 *      before this component exists and arrives as an initial prop value. A
 *      receiver that compared against its own incoming value would read this
 *      as "nothing happened" — which is the click doing nothing at all.
 *   2. mounted at rest, then raised. The ordinary case.
 *
 * …and at the moment that must NOT act: mounted at rest and left alone.
 */

import "@testing-library/jest-dom";
import { render, waitFor } from "@testing-library/svelte";

import TableNewRow from "../TableNewRow.svelte";

// jsdom implements no layout, so it ships no `scrollIntoView` at all. The row
// calls it because it sits after a windowed list and would otherwise focus an
// input the user cannot see. Supplied here rather than guarded in the
// component: a `typeof` check in shipped code would exist only for this test,
// and every browser Obsidian runs in has the method.
beforeAll(() => {
  Element.prototype.scrollIntoView = function scrollIntoView() {
    /* no layout to scroll */
  };
});

const input = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement>(".ppp-t2-newrow-input");

describe("#169 — a signal raised before this row existed still opens it", () => {
  it("mounts already open when the widget was expanded by the same press", () => {
    // The collapsed case, end to end within this component's reach: expanding
    // mounts the row with the counter already at 1.
    const { container } = render(TableNewRow, { props: { openSignal: 1 } });
    return waitFor(() => {
      expect(input(container)).not.toBeNull();
    });
  });

  it("opens on a later press, the ordinary path", async () => {
    const { container, component } = render(TableNewRow, { props: { openSignal: 0 } });
    expect(input(container)).toBeNull();
    await component.$set({ openSignal: 1 });
    await waitFor(() => {
      expect(input(container)).not.toBeNull();
    });
  });

  it("stays shut when nobody pressed anything", async () => {
    // The guard on the mount-time rule: a component that opened whenever it
    // was constructed would pop an input every time the canvas re-rendered.
    const { container } = render(TableNewRow, { props: { openSignal: 0 } });
    await Promise.resolve();
    expect(input(container)).toBeNull();
    expect(container.querySelector(".ppp-t2-newrow-btn")).not.toBeNull();
  });

  it("does not re-open on a repeat of a signal it already spent", async () => {
    // Setting the same value again is not a new press. Without this the row
    // would reopen on any unrelated re-render that re-sent its props.
    const { container, component } = render(TableNewRow, { props: { openSignal: 1 } });
    await waitFor(() => expect(input(container)).not.toBeNull());
    input(container)!.dispatchEvent(new Event("blur"));
    await waitFor(() => expect(input(container)).toBeNull());
    await component.$set({ openSignal: 1 });
    await Promise.resolve();
    expect(input(container)).toBeNull();
  });

  it("commits the typed name once, and only when there is one", async () => {
    const created: string[] = [];
    const { container, component } = render(TableNewRow, { props: { openSignal: 1 } });
    component.$on("create", (e: CustomEvent<string>) => created.push(e.detail));
    await waitFor(() => expect(input(container)).not.toBeNull());

    const el = input(container)!;
    el.value = "  Acme  ";
    el.dispatchEvent(new Event("input"));
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await waitFor(() => expect(created).toEqual(["Acme"]));

    // Enter chains the next row; an empty one must not create anything.
    await waitFor(() => expect(input(container)).not.toBeNull());
    input(container)!.dispatchEvent(new Event("blur"));
    await Promise.resolve();
    expect(created).toEqual(["Acme"]);
  });
});
