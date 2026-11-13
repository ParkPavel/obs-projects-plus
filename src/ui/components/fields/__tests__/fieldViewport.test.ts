import { fieldViewport } from "../fieldViewport";

const insets = { paddingTop: "44px", paddingRight: "17px", paddingBottom: "34px", paddingLeft: "0px" };
function view(keyboard: number, pan = 0): Window {
  return {
    innerWidth: 400, innerHeight: 800,
    visualViewport: { width: 400, height: 800, offsetTop: pan, offsetLeft: 0 },
    document: { documentElement: {}, querySelector: () => null },
    getComputedStyle: () => ({ getPropertyValue: () => `${keyboard}px` }),
  } as unknown as Window;
}

it("keeps the notch and home-indicator area out of field overlays", () => {
  expect(fieldViewport(view(0), insets)).toEqual({ top: 44, left: 0, bottom: 766, right: 383, width: 383, height: 722 });
});
it("the keyboard already covers the bottom safe-area; it is not deducted twice", () => {
  expect(fieldViewport(view(300), insets).bottom).toBe(500);
});
it("uses the supplied window's panned coordinates with its keyboard and safe-area", () => {
  const bounds = fieldViewport(view(300, 120), insets);
  expect(bounds.top).toBe(164);
  expect(bounds.bottom).toBe(500);
});
