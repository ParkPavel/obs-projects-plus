import { createOwnerFrames } from "../ownerFrames";

it("uses the element's own window and cancels frame ID0 without later refocusing a destroyed editor", () => {
  const iframe = document.createElement("iframe"); document.body.append(iframe);
  const doc = iframe.contentDocument!, view = iframe.contentWindow!, node = doc.createElement("textarea"); doc.body.append(node);
  let pending!: FrameRequestCallback;
  const request = jest.spyOn(view, "requestAnimationFrame").mockImplementation(callback => { pending = callback; return 0; });
  const cancel = jest.spyOn(view, "cancelAnimationFrame").mockImplementation(() => undefined);
  const main = jest.spyOn(window, "requestAnimationFrame");
  const frames = createOwnerFrames(), task = jest.fn();
  try {
    frames.schedule(node, task); expect(request).toHaveBeenCalledTimes(1); expect(main).not.toHaveBeenCalled();
    frames.destroy(); expect(cancel).toHaveBeenCalledWith(0);
    pending(10); expect(task).not.toHaveBeenCalled();
    frames.schedule(node, task); expect(request).toHaveBeenCalledTimes(1);
  } finally { frames.destroy(); request.mockRestore(); cancel.mockRestore(); main.mockRestore(); iframe.remove(); }
});
