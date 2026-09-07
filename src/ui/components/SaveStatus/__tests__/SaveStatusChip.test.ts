/**
 * #185 — the standing mark that a change is not on disk.
 */

import "@testing-library/jest-dom";
import { tick } from "svelte";

import { saveStatus, setSaveRetryHandler } from "src/lib/settings/saveStatus";
import { findErrorCode } from "src/lib/errors/errorCodes";

const SaveStatusChip = require("../SaveStatusChip.svelte").default;

const FAILED = {
  kind: "failed",
  attempts: 3,
  message: "EACCES",
  code: "PPP-101",
} as const;

function mount() {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new SaveStatusChip({ target, props: {} });
  return {
    target,
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

describe("SaveStatusChip (#185)", () => {
  afterEach(() => {
    saveStatus.set({ kind: "idle" });
    setSaveRetryHandler(null);
  });

  it("shows nothing while writes are landing", async () => {
    const { target, destroy } = mount();
    expect(target.querySelector(".save-status-chip")).toBeNull();

    saveStatus.set({ kind: "saving" });
    await tick();
    expect(target.querySelector(".save-status-chip")).toBeNull();
    destroy();
  });

  it("stands up when the write has failed, and stays up", async () => {
    const { target, destroy } = mount();
    saveStatus.set(FAILED);
    await tick();

    const chip = target.querySelector(".save-status-chip");
    expect(chip).not.toBeNull();
    expect(chip).toHaveTextContent("save-status.failed.label");
    destroy();
  });

  it("shows the code the writer reported, and its cause on hover (#202)", async () => {
    const { target, destroy } = mount();
    saveStatus.set(FAILED);
    await tick();

    const chip = target.querySelector(".save-status-chip");
    expect(chip?.querySelector(".code")).toHaveTextContent("PPP-101");
    // Compared against the registry rather than a pasted sentence: the point is
    // that the cause travelled from the code to the tooltip, not what it says.
    const cause = findErrorCode("PPP-101")?.cause ?? "";
    expect(cause.length).toBeGreaterThan(0);
    expect(chip?.getAttribute("title")).toContain(cause);
    destroy();
  });

  it("shows whatever code the status carries, not a fixed one (#202)", async () => {
    // The mark is not hard-wired to the settings writer's own event; it renders
    // what it was told, so a second failing writer would not need a second chip.
    const { target, destroy } = mount();
    saveStatus.set({ ...FAILED, code: "PPP-104" });
    await tick();

    expect(target.querySelector(".code")).toHaveTextContent("PPP-104");
    destroy();
  });

  it("asks the writer to retry when clicked, and clears once it succeeds", async () => {
    const retry = jest.fn();
    setSaveRetryHandler(retry);
    const { target, destroy } = mount();
    saveStatus.set(FAILED);
    await tick();

    const chip = target.querySelector<HTMLButtonElement>(".save-status-chip");
    chip?.click();
    expect(retry).toHaveBeenCalledTimes(1);

    saveStatus.set({ kind: "idle" });
    await tick();
    expect(target.querySelector(".save-status-chip")).toBeNull();
    destroy();
  });
});

describe("SaveStatusChip — the diverged mark (#200)", () => {
  const DIVERGED = { kind: "diverged", code: "PPP-102" } as const;

  afterEach(() => {
    saveStatus.set({ kind: "idle" });
    setSaveRetryHandler(null);
  });

  it("stands up when the file was replaced by somebody else", async () => {
    const { target, destroy } = mount();
    saveStatus.set(DIVERGED);
    await tick();

    const chip = target.querySelector(".save-status-chip");
    expect(chip).not.toBeNull();
    expect(target.querySelector(".code")).toHaveTextContent("PPP-102");
    destroy();
  });

  it("offers no retry, because the retry would be the overwrite", async () => {
    // The property, stated as the DOM sees it: not a button, no handler, and
    // clicking it reaches nobody. A disabled button would still say there is
    // something to press.
    const retry = jest.fn();
    setSaveRetryHandler(retry);
    const { target, destroy } = mount();
    saveStatus.set(DIVERGED);
    await tick();

    const chip = target.querySelector<HTMLElement>(".save-status-chip");
    expect(chip?.tagName).toBe("SPAN");
    chip?.click();
    expect(retry).not.toHaveBeenCalled();
    destroy();
  });

  it("carries its own cause in the tooltip, not the failed one", async () => {
    const { target, destroy } = mount();
    saveStatus.set(DIVERGED);
    await tick();

    const title = target
      .querySelector<HTMLElement>(".save-status-chip")
      ?.getAttribute("title");
    expect(title).toContain(findErrorCode("PPP-102")?.cause);
    destroy();
  });

  it("gives way to a failure: one mark, and it says the more urgent thing", async () => {
    const { target, destroy } = mount();
    saveStatus.set(DIVERGED);
    await tick();
    saveStatus.set(FAILED);
    await tick();

    expect(
      target.querySelector<HTMLElement>(".save-status-chip")?.tagName
    ).toBe("BUTTON");
    destroy();
  });
});
