/**
 * w4-p02 (audit F14) — the create window waits for the note to be written.
 *
 * It closed right after handing the name over (`void onSave; close()`), so a
 * refused create left no window to show the error in and lost what was typed.
 * Now it closes once the write succeeds; a refusal reaches the form
 * (CreateNote.svelte shows it under the name and keeps the input).
 */
import { Modal } from "obsidian";
type ProjectDefinition = import("src/settings/settings").ProjectDefinition;

type FormProps = { onSave: (name: string, templatePath: string, project: ProjectDefinition) => Promise<void> };
let form: FormProps | undefined;

jest.mock("src/ui/modals/components/CreateNote.svelte", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(function (this: { $destroy: () => void }, opts: { props: FormProps }) {
    form = opts.props;
    this.$destroy = () => undefined;
  }),
}));

import { CreateNoteModal } from "../createNoteModal";

const project = {
  id: "p",
  name: "P",
  defaultName: "Note",
  templates: [],
  dataSource: { kind: "folder", config: { path: "F" } },
} as unknown as ProjectDefinition;

function deferred(): { promise: Promise<void>; resolve: () => void; reject: (e: Error) => void } {
  let resolve!: () => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function open(onSave: () => Promise<void>) {
  const modal = new CreateNoteModal({} as never, project, onSave);
  const close = jest.spyOn(modal, "close");
  modal.onOpen();
  return { close };
}

beforeAll(() => {
  Object.defineProperty(Modal.prototype, "containerEl", {
    configurable: true,
    get: () => ({ addClass: () => undefined }),
  });
});

describe("CreateNoteModal — closes after the write, not before", () => {
  it("stays open while the note is written and closes once it is (old code: closed at once)", async () => {
    const write = deferred();
    const { close } = open(() => write.promise);
    const saving = form!.onSave("Note", "", project);
    await Promise.resolve();
    expect(close).not.toHaveBeenCalled();
    write.resolve();
    await saving;
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("stays open and hands the refusal to the form", async () => {
    const { close } = open(() => Promise.reject(new Error("vault refused")));
    await expect(form!.onSave("Note", "", project)).rejects.toThrow("vault refused");
    expect(close).not.toHaveBeenCalled();
  });
});
