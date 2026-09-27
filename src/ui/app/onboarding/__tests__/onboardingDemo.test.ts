/**
 * 3.6.1 — the first-run window offers the three linked demo projects as its
 * primary path; the starter profiles are gone. The demo card is native DOM
 * (obsidian-svelte's Button is stubbed in jest), so its states are asserted
 * here: one call per click, inert while the demo is written, a message and a
 * second chance when it fails.
 */

import "@testing-library/jest-dom";
import { render, fireEvent, waitFor } from "@testing-library/svelte";

import Onboarding from "../Onboarding.svelte";

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("Onboarding — the demo is the primary path", () => {
  it("offers no starter profiles", () => {
    const { container } = render(Onboarding, { props: { onCreate: jest.fn(), onTry: jest.fn(() => Promise.resolve(true)) } });
    expect(container.querySelector(".ppp-onboarding-profile")).toBeNull();
    expect(container.querySelector(".ppp-onboarding-demo")).not.toBeNull();
  });

  it("creates the demo once and stays inert while it is written", async () => {
    const gate = deferred<boolean>();
    const onTry = jest.fn(() => gate.promise);
    const { container } = render(Onboarding, { props: { onCreate: jest.fn(), onTry } });
    const card = container.querySelector<HTMLButtonElement>(".ppp-onboarding-demo")!;

    await fireEvent.click(card);
    await fireEvent.click(card);
    expect(onTry).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(card).toBeDisabled());

    gate.resolve(true);
    await gate.promise;
  });

  it("says so and lets the user try again when the demo could not be created", async () => {
    const onTry = jest.fn(() => Promise.resolve(false));
    const { container } = render(Onboarding, { props: { onCreate: jest.fn(), onTry } });
    const card = container.querySelector<HTMLButtonElement>(".ppp-onboarding-demo")!;

    await fireEvent.click(card);
    await waitFor(() => expect(container.querySelector(".ppp-onboarding-error")).not.toBeNull());
    expect(card).not.toBeDisabled();
  });
});
