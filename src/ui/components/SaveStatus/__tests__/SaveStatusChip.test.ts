/**
 * #185 — the standing mark that a change is not on disk.
 */

import "@testing-library/jest-dom";
import { tick } from "svelte";

import { saveStatus, setSaveRetryHandler } from "src/lib/settings/saveStatus";

const SaveStatusChip = require("../SaveStatusChip.svelte").default;

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
    saveStatus.set({ kind: "failed", attempts: 3, message: "EACCES" });
    await tick();

    const chip = target.querySelector(".save-status-chip");
    expect(chip).not.toBeNull();
    expect(chip).toHaveTextContent("save-status.failed.label");
    destroy();
  });

  it("asks the writer to retry when clicked, and clears once it succeeds", async () => {
    const retry = jest.fn();
    setSaveRetryHandler(retry);
    const { target, destroy } = mount();
    saveStatus.set({ kind: "failed", attempts: 3, message: "EACCES" });
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
