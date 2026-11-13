import { Modal } from "obsidian";
import { DataFieldType } from "src/lib/dataframe/dataframe";

type FieldForTest = {
  name: string;
  type: string;
  repeated: boolean;
  identifier: boolean;
  derived: boolean;
};
type FormProps = {
  onSave: (field: FieldForTest) => Promise<void>;
};
let form: FormProps | undefined;

jest.mock("../components/ConfigureField.svelte", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(function (
    this: { $destroy: () => void },
    options: { props: FormProps }
  ) {
    form = options.props;
    this.$destroy = () => undefined;
  }),
}));

import { ConfigureFieldModal } from "../configureField";

function deferred(): { promise: Promise<void>; resolve: () => void; reject: (error: Error) => void } {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function open(onSave: (field: FieldForTest) => void | Promise<void>) {
  const field = {
    name: "Title",
    type: DataFieldType.String,
    repeated: false,
    identifier: false,
    derived: false,
  };
  const modal = new ConfigureFieldModal({} as never, "Configure field", field, [], true, onSave);
  const close = jest.spyOn(modal, "close");
  modal.onOpen();
  return { close, field };
}

beforeAll(() => {
  Object.defineProperty(Modal.prototype, "containerEl", {
    configurable: true,
    get: () => ({ addClass: () => undefined }),
  });
});

describe("ConfigureFieldModal — closes only after the save succeeds", () => {
  it("waits for the write before closing", async () => {
    const write = deferred();
    const { close, field } = open(() => write.promise);
    const saving = form!.onSave(field);
    await Promise.resolve();
    expect(close).not.toHaveBeenCalled();
    write.resolve();
    await saving;
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("keeps the modal open and rethrows failures for the form to display", async () => {
    const { close, field } = open(() => Promise.reject(new Error("write refused")));
    await expect(form!.onSave(field)).rejects.toThrow("write refused");
    expect(close).not.toHaveBeenCalled();
  });
});
