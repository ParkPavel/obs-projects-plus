/**
 * createFieldLifecycle.test.ts — M03 (S02, C03, C13): the create-field modal
 * closed the moment the button was pressed and ran the bulk write after, so a
 * failed write surfaced as a Notice behind a form that no longer existed and
 * the draft was gone. The form now waits for the writer's answer:
 * pending → success (close) | failure (stay open, keep the draft, say so).
 */

jest.mock("dayjs", () => {
  const real = jest.requireActual("dayjs");
  return { __esModule: true, default: real };
});

const mockNoop = class {
  constructor() { (this as any).$$ = { fragment: null, on_mount: [], on_destroy: [], after_update: [], ctx: [] }; }
  $set() {}
  $on() { return () => {}; }
  $destroy() {}
};

jest.mock("obsidian-svelte", () => ({
  Button: require("./mocks/Button.mock.svelte").default,
  ModalButtonGroup: require("./mocks/ModalButtonGroup.mock.svelte").default,
  ModalContent: require("./mocks/Passthrough.mock.svelte").default,
  ModalLayout: require("./mocks/Passthrough.mock.svelte").default,
  SettingItem: require("./mocks/NamedSettingItem.mock.svelte").default,
  TextInput: require("./mocks/KeyTextInput.mock.svelte").default,
  Select: require("./mocks/Select.mock.svelte").default,
  NumberInput: require("./mocks/EchoNumberInput.mock.svelte").default,
  Switch: mockNoop,
  Icon: mockNoop,
  Callout: mockNoop,
  Typography: mockNoop,
  Autocomplete: mockNoop,
}), { virtual: true });

jest.mock("src/ui/components/TagsInput", () => ({ TagsInput: mockNoop }), { virtual: true });
jest.mock("src/ui/components/MultiTextInput/MultiTextInput.svelte", () => ({ __esModule: true, default: mockNoop }), { virtual: true });
jest.mock("src/ui/components/DateInput.svelte", () => ({ __esModule: true, default: mockNoop }), { virtual: true });
jest.mock("src/ui/components/DatetimeInput.svelte", () => ({ __esModule: true, default: mockNoop }), { virtual: true });

// createFieldModal.ts imports the component as an ES default; the Svelte jest
// transform hands back a CommonJS module, so it is re-exported as one.
jest.mock("../CreateField.svelte", () => ({
  __esModule: true,
  default: jest.requireActual("../CreateField.svelte").default,
}));

const { Modal } = require("obsidian");
const { CreateFieldModal } = require("src/ui/modals/createFieldModal");

// The obsidian mock has no containerEl; the plugin modal tags it on construction.
(Modal.prototype as any).containerEl = { addClass() {} };

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

function openModal(onCreate: jest.Mock) {
  const modal = new CreateFieldModal({} as never, [], onCreate, [], "", undefined, 3);
  const close = jest.spyOn(modal, "close");
  document.body.appendChild(modal.contentEl);
  modal.onOpen();
  const el: HTMLElement = modal.contentEl;
  return {
    modal,
    close,
    nameInput: () => el.querySelector<HTMLInputElement>("[data-testid='text-input']")!,
    button: () => el.querySelector<HTMLButtonElement>("[data-testid='modal-button-group'] button[data-variant='primary']")!,
    alert: () => el.querySelector<HTMLElement>("[role='alert']"),
    dispose: () => { modal.onClose(); el.remove(); },
  };
}

const typeName = (input: HTMLInputElement, text: string) => {
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
};
const pressEnter = (input: HTMLInputElement) =>
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));

describe("CreateFieldModal — waits for the write before closing (M03 C5)", () => {
  it("stays open while the write runs, blocks a second submit, closes on success", async () => {
    const write = deferred<boolean>();
    const onCreate = jest.fn(() => write.promise);
    const ui = openModal(onCreate);

    ui.button().click();
    await flush();
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(ui.close).not.toHaveBeenCalled();
    expect(ui.button().disabled).toBe(true);

    // A double click and an Enter during the write do not start another one.
    ui.button().click();
    pressEnter(ui.nameInput());
    await flush();
    expect(onCreate).toHaveBeenCalledTimes(1);

    write.resolve(true);
    await flush();
    expect(ui.close).toHaveBeenCalledTimes(1);
    ui.dispose();
  });

  it("on a failed write stays open, shows the error, keeps the draft and retries once", async () => {
    const onCreate = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const ui = openModal(onCreate);

    typeName(ui.nameInput(), "budget");
    ui.button().click();
    await flush();
    expect(ui.close).not.toHaveBeenCalled();
    expect(ui.alert()?.textContent).toBeTruthy();
    expect(ui.nameInput().value).toBe("budget");
    expect(ui.button().disabled).toBe(false);

    ui.button().click();
    await flush();
    expect(onCreate).toHaveBeenCalledTimes(2);
    expect(onCreate.mock.calls[1][0].name).toBe("budget");
    expect(ui.close).toHaveBeenCalledTimes(1);
    ui.dispose();
  });

  it("a thrown write counts as failed, not as closed", async () => {
    const onCreate = jest.fn().mockRejectedValue(new Error("disk"));
    const ui = openModal(onCreate);
    ui.button().click();
    await flush();
    expect(ui.close).not.toHaveBeenCalled();
    expect(ui.alert()).not.toBeNull();
    ui.dispose();
  });
});

describe("CreateFieldModal — cancel writes nothing (M03 C6)", () => {
  it("closing before submit never calls the writer", async () => {
    const onCreate = jest.fn();
    const ui = openModal(onCreate);
    typeName(ui.nameInput(), "draft");
    ui.modal.close();
    ui.dispose();
    await flush();
    expect(onCreate).not.toHaveBeenCalled();
  });
});
