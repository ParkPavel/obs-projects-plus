import { moveTableControls } from "../tableControlsHost";

afterEach(() => { document.body.replaceChildren(); });
function setup() {
  const home = document.createElement("div"), target = document.createElement("div"), other = document.createElement("div");
  const node = document.createElement("div"), input = document.createElement("input"), after = document.createElement("span");
  node.append(input); home.append(node, after); document.body.append(home, target, other);
  return { home, target, other, node, input, after };
}

test("moving the original toolbar preserves focus/selection and returning home preserves its sibling order", () => {
  const m = setup(); m.input.value = "draft"; m.input.focus(); m.input.setSelectionRange(1, 4, "backward");
  const action = moveTableControls(m.node, m.target);
  expect(m.node.parentElement).toBe(m.target); expect(document.activeElement).toBe(m.input);
  action.update(m.other); expect(m.node.parentElement).toBe(m.other); expect(document.activeElement).toBe(m.input);
  expect([m.input.selectionStart, m.input.selectionEnd, m.input.selectionDirection]).toEqual([1, 4, "backward"]);
  action.update(null); expect(m.node.parentElement).toBe(m.home); expect(m.node.nextElementSibling).toBe(m.after); action.destroy();
});

test("detached, foreign-document and descendant targets cannot move or resurrect controls", () => {
  const m = setup(), detached = document.createElement("div"), foreign = document.implementation.createHTMLDocument("other");
  const action = moveTableControls(m.node, detached); expect(m.node.parentElement).toBe(m.home);
  action.update(foreign.body); expect(m.node.parentElement).toBe(m.home);
  action.update(m.input); expect(m.node.parentElement).toBe(m.home);
  action.destroy(); action.update(m.target); expect(m.node.isConnected).toBe(false); expect(m.target.childNodes).toHaveLength(0);
});

test("repeated placement in the same header does not reparent or disturb the active input", () => {
  const m = setup(), action = moveTableControls(m.node, m.target), append = jest.spyOn(m.target, "appendChild");
  m.input.focus(); m.input.value = "query"; m.input.setSelectionRange(2, 2);
  action.update(m.target); expect(append).not.toHaveBeenCalled(); expect(document.activeElement).toBe(m.input); expect(m.input.selectionStart).toBe(2); action.destroy();
});
