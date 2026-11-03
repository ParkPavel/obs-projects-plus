import { compactDraggedColumn } from "../columnClone";

const initialFont = document.documentElement.style.fontSize;
afterEach(() => { document.documentElement.style.fontSize = initialFont; document.body.innerHTML = ""; });

it.each([1, 0.55, 0.25, 1.5].flatMap(scale => [false, true].map(constrained => ({ scale, constrained }))))("keeps the drag hit-point at $scale with inherited constraints=$constrained and repeated callbacks", ({ scale, constrained }) => {
  Object.assign(document.documentElement.style, { fontSize: "20px" });
  const clone = document.createElement("div"), column = document.createElement("section"), header = document.createElement("header"), cards = document.createElement("div");
  column.className = "projects--board--column"; header.className = "projects--board--column--header";
  column.append(header, cards); clone.append(column); document.body.append(clone);
  Object.assign(clone.style, { left: "100px", top: "120px", width: `${270 * scale}px`, height: `${400 * scale}px` });
  // cloneNode retains the live wrapper's unscaled min/max dimensions; the
  // library's pinned width/height still define its intended cursor centre.
  if (constrained) Object.assign(clone.style, { minWidth: "270px", minHeight: "400px" });
  const px = (value: string) => parseFloat(value) * (value.endsWith("rem") ? 20 : 1);
  jest.spyOn(clone, "getBoundingClientRect").mockImplementation(() => {
    const translation = (clone.style.translate || "0px 0px").split(" ");
    const factor = Number(clone.style.scale) || 1, left = px(clone.style.left) + px(translation[0]!), top = px(clone.style.top) + px(translation[1]!);
    const width = Math.max(px(clone.style.width), px(clone.style.minWidth || "0px")) * factor;
    const height = Math.max(px(clone.style.height), px(clone.style.minHeight || "0px")) * factor;
    return { left, top, width, height, right: left + width, bottom: top + height } as DOMRect;
  });
  const centre = () => { const r = clone.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const before = [100 + 270 * scale / 2, 120 + 400 * scale / 2]; compactDraggedColumn(clone, 270, scale);
  expect(centre()[0]).toBeCloseTo(before[0]!); expect(centre()[1]).toBeCloseTo(before[1]!);
  expect(clone.getBoundingClientRect().width).toBeCloseTo(48 * scale);
  expect(clone.getBoundingClientRect().height).toBeCloseTo(270 * scale);
  compactDraggedColumn(clone, 270, scale);
  expect(centre()[0]).toBeCloseTo(before[0]!); expect(centre()[1]).toBeCloseTo(before[1]!);
  expect(header.isConnected).toBe(true); expect(cards.isConnected).toBe(false);
});

it("does not pin a disconnected or zero-sized early clone to zero", () => {
  const clone = document.createElement("div"); compactDraggedColumn(clone, 270, 0.55); expect(clone.style.width).toBe("");
  document.body.append(clone); compactDraggedColumn(clone, 270, 0.55); expect(clone.style.width).toBe("");
});
