import { rootFontPx, remAt } from "src/ui/utils/cssLength";
import { fieldViewport } from "./fieldViewport";
import { aboveFieldPlacement, makeRoomAbove } from "./aboveFieldPlacement";

/** One geometry policy for original-input suggestions, including formula textareas. */
export function placeAboveField(field: HTMLElement, popup: HTMLElement, insets: HTMLElement | null, roomAttempt: string) {
  const doc = field.ownerDocument, view = doc.defaultView;
  if (!view) return { style: "visibility: hidden;", visible: false, roomAttempt };
  const base = rootFontPx(doc);
  let anchor = field.getBoundingClientRect();
  const box = popup.getBoundingClientRect();
  const bounds = fieldViewport(view, insets ? view.getComputedStyle(insets) : undefined);
  const natural = Math.min(Math.max(popup.scrollHeight, box.height), 12 * base);
  const width = Math.min(box.width, 24 * base);
  let placement = aboveFieldPlacement(anchor, natural, width, bounds, base);
  const area = `${bounds.width}|${bounds.height}`;
  if (field.isConnected && !placement.visible && placement.missing > 0 && roomAttempt !== area) {
    roomAttempt = area;
    makeRoomAbove(field, placement.missing, bounds);
    anchor = field.getBoundingClientRect();
    placement = aboveFieldPlacement(anchor, natural, width, bounds, base);
  }
  const visible = field.isConnected && placement.visible;
  const style = `top: ${remAt(placement.top, base)}; left: ${remAt(placement.left, base)}; width: ${remAt(placement.width, base)}; max-height: ${remAt(placement.height, base)}; visibility: ${visible ? "visible" : "hidden"};`;
  return { style, visible, roomAttempt };
}
