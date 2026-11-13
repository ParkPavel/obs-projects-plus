import "@testing-library/jest-dom";
import { tick } from "svelte";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import { DEFAULT_PROJECT } from "src/settings/settings";

jest.mock("src/ui/views/helpers", () => ({
  ...jest.requireActual("src/ui/views/helpers"),
  getRecordColorContext: { get: () => () => null, set: () => undefined },
  sortRecordsContext: { get: () => (records: unknown[]) => records, set: () => undefined },
  showMobileNavMenu: jest.fn(),
  handleHoverLink: jest.fn(),
}));
jest.mock("src/lib/record/openRecord", () => ({
  ...jest.requireActual("src/lib/record/openRecord"),
  activateRecord: jest.fn(() => Promise.resolve()),
}));
jest.mock("src/ui/modals/createNoteModal", () => ({
  ...jest.requireActual("src/ui/modals/createNoteModal"),
  CreateNoteModal: jest.fn().mockImplementation(() => ({ open: jest.fn() })),
}));
jest.mock(
  "obsidian",
  () => {
    const actual = jest.requireActual("src/__mocks__/obsidian") as Record<string, unknown>;
    class Component {
      load(): void {}
      unload(): void {}
    }
    return { ...actual, Component, Notice: jest.fn() };
  },
  { virtual: true }
);
jest.mock("src/ui/components/Flair", () => ({
  Flair: jest.requireActual("src/ui/components/Flair/Flair.svelte").default,
}));
jest.mock("src/ui/components/Layout", () => ({
  ViewLayout: jest.requireActual("src/ui/components/Layout/ViewLayout.svelte").default,
  ViewContent: jest.requireActual("src/ui/components/Layout/ViewContent.svelte").default,
}));
jest.mock("src/ui/views/Board/components", () => ({
  Board: jest.requireActual("src/ui/views/Board/components/Board/Board.svelte").default,
}));
jest.mock("obsidian-svelte", () => ({
  ...jest.requireActual("obsidian-svelte"),
  Button: jest.requireActual("./fixtures/ButtonStub.svelte").default,
}));
jest.mock("../components/Board/NewColumn.svelte", () => ({
  default: jest.requireActual("./fixtures/BoardNewColumnStub.svelte").default,
}));

type Mounted = { $destroy(): void };
type ComponentClass = new (options: { target: HTMLElement; props: Record<string, unknown> }) => Mounted;

const BoardView = require("../BoardView.svelte").default as ComponentClass;
const { app } = require("src/lib/stores/obsidian") as { app: { set(value: unknown): void } };
const { CreateNoteModal } = require("src/ui/modals/createNoteModal") as { CreateNoteModal: jest.Mock };

const status = {
  name: "status",
  type: DataFieldType.Select,
  repeated: false,
  identifier: false,
  derived: false,
  typeConfig: { options: ["Todo"] },
};

const priority = {
  name: "priority",
  type: DataFieldType.Select,
  repeated: false,
  identifier: false,
  derived: false,
  typeConfig: { options: ["High"] },
};

const project = {
  ...DEFAULT_PROJECT,
  id: "board-note-project",
  name: "Board notes",
  defaultName: "Untitled",
  newNotesFolder: "notes",
  templates: ["templates/First.md", "templates/Second.md"],
  dataSource: { kind: "folder", config: { path: "notes", recursive: false } },
};

type BoardMountOptions = {
  readonly?: boolean;
  dataReadOnly?: boolean;
  addRecord?: jest.Mock;
};

const mountedBoards: Array<{ destroy(): void }> = [];

function mountBoard(options: BoardMountOptions = {}) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const record = { id: "notes/Existing.md", values: { status: "Todo", priority: "High" } };
  const api = {
    addRecord: options.addRecord ?? jest.fn().mockResolvedValue(undefined),
    updateRecord: jest.fn(),
    updateRecords: jest.fn(),
  };
  const component = new BoardView({
    target,
    props: {
      project,
      frame: { fields: [status, priority], records: [record] },
      readonly: options.readonly ?? false,
      dataReadOnly: options.dataReadOnly ?? false,
      api,
      getRecordColor: () => null,
      sortRecords: (records: readonly { id: string; values: Record<string, unknown> }[]) => [...records],
      getRecord: (id: string) => (id === record.id ? record : undefined),
      config: { groupByField: "status" },
      onConfigChange: jest.fn(),
      hasSort: false,
      hasFilter: true,
      filterConditions: [
        { field: "priority", operator: "is", value: "High" },
        { field: "status", operator: "is", value: "Done" },
      ],
    },
  });
  const mounted = { target, api, destroy: () => { component.$destroy(); target.remove(); } };
  mountedBoards.push(mounted);
  return mounted;
}

async function openDraft(target: HTMLElement) {
  const addButton = target.querySelector<HTMLButtonElement>("[data-board-add-note] button");
  expect(addButton).toBeDefined();
  addButton?.click();
  await tick();
  return target.querySelector<HTMLElement>("[data-note-draft]");
}

async function fillName(target: HTMLElement, value: string) {
  const input = target.querySelector<HTMLInputElement>("[data-note-name]")!;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
  return input;
}

beforeEach(() => {
  app.set({
    metadataCache: { getFirstLinkpathDest: () => null, getCache: () => null },
    vault: {
      getAbstractFileByPath: () => null,
      getResourcePath: (file: { path: string }) => `app://vault/${file.path}`,
    },
  });
  CreateNoteModal.mockClear();
});

afterEach(() => {
  mountedBoards.splice(0).forEach(({ destroy }) => destroy());
  document.body.innerHTML = "";
});

it("creates in the selected column with filter context and the chosen template, without a modal", async () => {
  const mounted = mountBoard();
  await tick();
  const column = mounted.target.querySelector<HTMLElement>('section[data-id="Todo"]')!;
  expect(await openDraft(column)).not.toBeNull();
  expect(column.querySelector("[data-note-name]")).toHaveValue("Untitled");

  expect(CreateNoteModal).not.toHaveBeenCalled();
  const template = column.querySelector<HTMLSelectElement>("[data-note-template]")!;
  template.value = "templates/Second.md";
  template.dispatchEvent(new Event("change", { bubbles: true }));
  await fillName(column, "Planned");
  column.querySelector<HTMLButtonElement>("[data-note-save]")?.click();
  await Promise.resolve();
  await tick();

  expect(mounted.api.addRecord).toHaveBeenCalledWith(
    { id: "notes/Planned.md", values: { priority: "High", status: "Todo" } },
    [status, priority],
    "templates/Second.md"
  );
  expect(column.querySelector("[data-note-draft]")).toBeNull();
  expect(CreateNoteModal).not.toHaveBeenCalled();
});

it("blocks invalid names and cancels with the button or Escape without writing", async () => {
  const mounted = mountBoard();
  await tick();
  const column = mounted.target.querySelector<HTMLElement>('section[data-id="Todo"]')!;
  await openDraft(column);

  await fillName(column, "");
  expect(column.querySelector("[data-note-save]")).toBeDisabled();
  column.querySelector<HTMLButtonElement>("[data-note-save]")?.click();
  expect(mounted.api.addRecord).not.toHaveBeenCalled();

  column.querySelector<HTMLButtonElement>("[data-note-cancel]")?.click();
  await tick();
  expect(column.querySelector("[data-note-draft]")).toBeNull();

  await openDraft(column);
  column.querySelector<HTMLInputElement>("[data-note-name]")?.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
  );
  await tick();
  expect(column.querySelector("[data-note-draft]")).toBeNull();
  expect(mounted.api.addRecord).not.toHaveBeenCalled();
});

it("surfaces a rejected write, keeps the draft, and permits retry", async () => {
  const addRecord = jest.fn().mockRejectedValueOnce(new Error("disk busy")).mockResolvedValue(undefined);
  const mounted = mountBoard({ addRecord });
  await tick();
  const column = mounted.target.querySelector<HTMLElement>('section[data-id="Todo"]')!;
  await openDraft(column);
  await fillName(column, "Planned");

  column.querySelector<HTMLButtonElement>("[data-note-save]")?.click();
  await Promise.resolve();
  await tick();

  expect(column.querySelector("[data-note-draft]")).not.toBeNull();
  expect(column.querySelector('[role="alert"]')).not.toBeNull();
  column.querySelector<HTMLButtonElement>("[data-note-save]")?.click();
  await Promise.resolve();
  await tick();

  expect(addRecord).toHaveBeenCalledTimes(2);
  expect(column.querySelector("[data-note-draft]")).toBeNull();
});

it.each([
  { readonly: true, dataReadOnly: false },
  { readonly: false, dataReadOnly: true },
])("does not expose note creation in readonly=$readonly dataReadOnly=$dataReadOnly", async (options) => {
  const mounted = mountBoard(options);
  await tick();
  expect(mounted.target.querySelector("[data-board-add-note]")).toBeNull();
  expect(mounted.api.addRecord).not.toHaveBeenCalled();
});
