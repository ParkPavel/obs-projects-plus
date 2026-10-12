import { render } from "@testing-library/svelte";
import { tick } from "svelte";
const Wizard = require("../WidgetSetupWizard.svelte").default;

it("a read-only unconfigured widget explains itself without offering a write", async () => {
  const view = render(Wizard, { props: { icon: "bar-chart", message: "Not configured", readonly: true } });
  const configure = jest.fn(); view.component.$on("configure", configure);
  expect(view.container.textContent).toContain("Not configured");
  expect(view.container.querySelector("button")).toBeNull();
  view.component.$set({ readonly: false }); await tick();
  view.container.querySelector("button")!.click();
  expect(configure).toHaveBeenCalledTimes(1);
});
