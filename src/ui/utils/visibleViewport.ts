/** The unobscured, possibly panned part of a window (keyboard/zoom included). */
export function visibleViewport(view: Window) {
  const viewport = view.visualViewport;
  const usable = viewport && viewport.width > 0 && viewport.height > 0;
  const left = usable ? viewport.offsetLeft : 0;
  const top = usable ? viewport.offsetTop : 0;
  const width = usable ? viewport.width : view.innerWidth;
  const height = usable ? viewport.height : view.innerHeight;
  return { left, top, width, height, right: left + width, bottom: top + height };
}
