import { aboveFieldPlacement } from "../aboveFieldPlacement";

it("suppresses an unmeasurable source field instead of exposing a detached suggestion list", () => {
  const anchor = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
  expect(aboveFieldPlacement(anchor, 80, 200, { top: 0, bottom: 800, left: 0, right: 400, width: 400 }, 16).visible).toBe(false);
});
