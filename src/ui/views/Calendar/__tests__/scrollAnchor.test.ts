import { captureScrollAnchor } from "../scrollAnchor";

it.each([0, 3])("keeps a retained visible date after variable-height prepend with %s units trimmed below", trimmed => {
  const parent = document.createElement("div"); document.body.appendChild(parent);
  const anchor = document.createElement("div"); parent.appendChild(anchor);
  parent.scrollTop = 120;
  let contentTop = 80;
  Object.defineProperty(anchor, "getBoundingClientRect", { value: () => ({ top: contentTop - parent.scrollTop }) });
  let totalHeight = 2000;
  Object.defineProperty(parent, "scrollHeight", { get: () => totalHeight });
  const before = anchor.getBoundingClientRect().top;
  const restore = captureScrollAnchor(parent, anchor);
  const addedHeight = 210 + 340 + 175;
  contentTop += addedHeight;
  totalHeight += addedHeight - (trimmed ? 300 + 200 + 225 : 0);
  restore();
  expect(parent.scrollTop).toBe(120 + addedHeight);
  expect(anchor.getBoundingClientRect().top).toBe(before);
  parent.remove();
});

it("respects browser scroll anchoring and ignores a detached owner", () => {
  const parent = document.createElement("div"), anchor = document.createElement("div");
  document.body.appendChild(parent); parent.appendChild(anchor);
  let contentTop = 80;
  Object.defineProperty(anchor, "getBoundingClientRect", { value: () => ({ top: contentTop - parent.scrollTop }) });
  const restore = captureScrollAnchor(parent, anchor);
  contentTop += 600; parent.scrollTop += 600;
  restore(); expect(parent.scrollTop).toBe(600);
  parent.remove(); contentTop += 600; restore(); expect(parent.scrollTop).toBe(600);
});
