import { hexToHsv } from "src/lib/colors/math";
import { normalizeHexColor } from "src/lib/colors/recordColor";
import { normalizeColor } from "src/lib/visualizer/colors";

/** Resolve existing CSS notation in the picker's own document, not the main window. */
export function parsePickerColor(input: string, doc: Document) {
  const hex = normalizeHexColor(input);
  if (hex) return { color: hex, hsv: hexToHsv(hex)! };
  const css = normalizeColor(input);
  if (css) {
    const probe = (doc.body ?? doc.documentElement).createSpan({ attr: { hidden: "" } });
    probe.style.color = css;
    try {
      if (probe.style.color) {
        const resolved = doc.defaultView?.getComputedStyle(probe).color;
        const match = resolved?.match(/^rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\s*\)$/);
        if (match) {
          const rgb = "#" + match.slice(1, 4).map(channel =>
            Math.max(0, Math.min(255, Math.round(Number(channel)))).toString(16).padStart(2, "0")
          ).join("");
          // Alpha survives until a deliberate HSV/HEX replacement. Saved
          // palettes accept opaque HEX only; never flatten a transparent color.
          return { color: match[4] !== undefined && Number(match[4]) < 1 ? css : rgb, hsv: hexToHsv(rgb)! };
        }
      }
    } finally {
      probe.remove();
    }
  }
  // No inferred replacement for an invalid/unresolved incoming color.
  return null;
}
