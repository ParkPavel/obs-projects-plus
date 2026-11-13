import "@testing-library/jest-dom";
import { render, cleanup, fireEvent } from "@testing-library/svelte";
import { tick } from "svelte";
jest.mock("obsidian-svelte", () => ({
  ...jest.requireActual("obsidian-svelte"),
  SettingItem: require("src/ui/modals/components/__tests__/mocks/Passthrough.mock.svelte").default,
  Switch: require("../../../node_modules/obsidian-svelte/Switch/Switch.svelte").default,
}));
const Projects = require("./Projects.svelte").default;
const { DEFAULT_SETTINGS } = require("src/settings/settings");
const project = { id: "p", name: "Project", views: [{ id: "v", name: "View" }] };
const flush = async () => { await tick(); await tick(); await tick(); };
afterEach(cleanup);
test("the actual host Switch's initial prop echoes never add/remove commands", async () => {
  const save = jest.fn();
  render(Projects, { props: { projects: [project], preferences: { ...DEFAULT_SETTINGS.preferences, commands: [{ project: "p" }] }, save } });
  await flush(); expect(save).not.toHaveBeenCalled();
});
test("an external command preference refresh is reflected without creating a duplicate", async () => {
  const save = jest.fn(), preferences = { ...DEFAULT_SETTINGS.preferences, commands: [] };
  const view = render(Projects, { props: { projects: [project], preferences, save } }); await flush(); save.mockClear();
  view.component.$set({ preferences: { ...preferences, commands: [{ project: "p", view: "v" }] } }); await flush();
  expect(view.container.querySelectorAll(".checkbox-container")[1]).toHaveClass("is-enabled");
  expect(save).not.toHaveBeenCalled();
});
test("a real switch click changes only its canonical command, parent acknowledgement adds nothing", async () => {
  const save = jest.fn(), preferences = { ...DEFAULT_SETTINGS.preferences, commands: [] };
  const view = render(Projects, { props: { projects: [project], preferences, save } }); await flush(); save.mockClear();
  await fireEvent.click(view.container.querySelectorAll(".checkbox-container")[1]!); await flush();
  expect(save).toHaveBeenCalledTimes(1); expect(save.mock.calls[0][0].commands).toEqual([{ project: "p", view: "v" }]);
  view.component.$set({ preferences: save.mock.calls[0][0] }); await flush(); expect(save).toHaveBeenCalledTimes(1);
});
