import { followFieldAnchor } from "../followFieldAnchor";

it("follows layout-only movement and does not resurrect its RAF after teardown", () => {
  const iframe = document.createElement("iframe"); document.body.append(iframe);
  const doc = iframe.contentDocument!, view = iframe.contentWindow!, anchor = doc.createElement("textarea"), popup = doc.createElement("div"); doc.body.append(anchor, popup);
  let pending!: FrameRequestCallback, top = 100;
  anchor.getBoundingClientRect = () => ({ top, left: 20, width: 100, height: 32 } as DOMRect);
  const request = jest.spyOn(view, "requestAnimationFrame").mockImplementation(callback => { pending = callback; return 0; });
  const cancel = jest.spyOn(view, "cancelAnimationFrame").mockImplementation(() => undefined);
  const changed = jest.fn(), follow = followFieldAnchor(popup, { anchor, changed });
  try {
    pending(0); expect(changed).toHaveBeenCalledTimes(1);
    pending(16); expect(changed).toHaveBeenCalledTimes(1);
    top = 200; pending(32); expect(changed).toHaveBeenCalledTimes(2);
    follow.destroy(); expect(cancel).toHaveBeenCalledWith(0);
    const count = request.mock.calls.length; pending(48); expect(request).toHaveBeenCalledTimes(count);
  } finally { follow.destroy(); request.mockRestore(); cancel.mockRestore(); iframe.remove(); }
});
