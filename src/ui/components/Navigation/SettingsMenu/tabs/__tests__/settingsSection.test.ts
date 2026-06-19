import "@testing-library/jest-dom";
import { tick } from "svelte";

// #093 slice 4 — SettingsSection is the §3 panel-anatomy accordion: open by
// default, or collapsed for advanced groups (progressive disclosure), toggled
// by its header. These tests lock that contract.

const SettingsSection = require("../SettingsSection.svelte").default;

function mount(props: Record<string, unknown>) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new SettingsSection({ target, props: { title: "Section", ...props } });
  return {
    target,
    header: target.querySelector<HTMLButtonElement>(".settings-section-header"),
    body: () => target.querySelector(".settings-section-body"),
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

describe("SettingsSection (#093 §3 accordion)", () => {
  test("open by default: body shown, aria-expanded true", () => {
    const m = mount({});
    expect(m.body()).not.toBeNull();
    expect(m.header).toHaveAttribute("aria-expanded", "true");
    m.destroy();
  });

  test("collapsed: body hidden until header clicked", async () => {
    const m = mount({ collapsed: true });
    expect(m.body()).toBeNull();
    expect(m.header).toHaveAttribute("aria-expanded", "false");
    m.header?.click();
    await tick();
    expect(m.body()).not.toBeNull();
    expect(m.header).toHaveAttribute("aria-expanded", "true");
    m.destroy();
  });

  test("clicking an open section collapses it", async () => {
    const m = mount({});
    m.header?.click();
    await tick();
    expect(m.body()).toBeNull();
    m.destroy();
  });

  test("renders the title", () => {
    const m = mount({ title: "Время и Timeline" });
    expect(m.target.querySelector(".settings-section-title")?.textContent).toBe("Время и Timeline");
    m.destroy();
  });
});
