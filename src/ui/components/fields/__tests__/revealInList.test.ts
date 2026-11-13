import { revealInList } from "../revealInList";

it.each([1, .5])("reveals the active option only inside its list at scale%s", scale => {
  const outer = document.createElement("div"), list = document.createElement("div"), row = document.createElement("button");
  outer.append(list); list.append(row); document.body.append(outer);
  const box = (top: number, height: number) => ({ top, bottom: top + height, height, width: 100, left: 0, right: 100, x: 0, y: top, toJSON: () => ({}) });
  Object.defineProperties(list, { clientHeight: { value: 100 }, offsetHeight: { value: 100 }, clientTop: { value: 0 } });
  list.getBoundingClientRect = () => box(20, 100 * scale);
  row.getBoundingClientRect = () => box(20 + 130 * scale, 20 * scale);
  outer.scrollTop = 44;
  try {
    revealInList(row, list);
    expect(list.scrollTop).toBe(50); expect(outer.scrollTop).toBe(44);
    row.getBoundingClientRect = () => box(20 - 20 * scale, 20 * scale);
    revealInList(row, list);
    expect(list.scrollTop).toBe(30); expect(outer.scrollTop).toBe(44);
  } finally { outer.remove(); }
});
