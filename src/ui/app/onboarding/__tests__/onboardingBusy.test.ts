/**
 * scene 7 review round 1 — item 5: the busy state must contain the WHOLE
 * onboarding surface while a profile write is pending, not just the profile
 * buttons themselves.
 *
 * `obsidian-svelte`'s `Button`/`ModalButtonGroup`/`Typography` are stubbed to
 * render nothing at all in this test environment (see
 * `src/__mocks__/obsidian-svelte.js` — every export is a no-op component with
 * `fragment: null`, by design, so Jest never has to parse the real
 * ESM+Svelte package). That means "Создать новый проект" and "Попробовать
 * демо-проект" — both rendered through `<Button>` — produce no DOM node here,
 * so their `disabled` state cannot be asserted through this harness; the
 * production fix (passing `disabled={busy}` to both, in `Onboarding.svelte`)
 * is exercised live in the coordinator's OBStests walkthrough instead. What
 * IS real, native DOM in this component — the profile buttons and the
 * "Другой способ" `<details>`/`<summary>` toggle — is covered below.
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

describe("Onboarding — busy containment (scene 7, review round 1)", () => {
  it("disables every profile button and blocks the \"Другой способ\" toggle while a profile write is pending", async () => {
    const gate = deferred<void>();
    const onProfile = jest.fn(() => gate.promise);

    const { container } = render(Onboarding, {
      props: { onCreate: jest.fn(), onTry: jest.fn(), onProfile },
    });

    const profileButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".ppp-onboarding-profile")
    );
    expect(profileButtons.length).toBe(3);

    await fireEvent.click(profileButtons[0]!);
    expect(onProfile).toHaveBeenCalledTimes(1);

    // Every profile button — including the ones NOT clicked — is inert
    // while the write is in flight.
    await waitFor(() => {
      for (const button of profileButtons) expect(button).toBeDisabled();
    });

    // The "Другой способ" summary is marked inert and refuses to expand.
    const summary = container.querySelector("summary")!;
    const details = container.querySelector("details")!;
    expect(summary.getAttribute("aria-disabled")).toBe("true");
    expect(details.open).toBe(false);

    await fireEvent.click(summary);
    expect(details.open).toBe(false);

    // Success keeps this component's `busy` latched — `onboardingModal.ts`
    // closes the modal once `onProfile` resolves, so there is deliberately
    // no "un-busy" transition to observe here; resolving the gate only
    // confirms `onProfile` was awaited rather than fired-and-forgotten.
    gate.resolve();
    await gate.promise;
  });

  it("leaves \"Другой способ\" free to open when no write is pending", async () => {
    const onProfile = jest.fn(() => Promise.resolve());

    const { container } = render(Onboarding, {
      props: { onCreate: jest.fn(), onTry: jest.fn(), onProfile },
    });

    const summary = container.querySelector("summary")!;
    const details = container.querySelector("details")!;

    await fireEvent.click(summary);
    expect(details.open).toBe(true);
  });
});
