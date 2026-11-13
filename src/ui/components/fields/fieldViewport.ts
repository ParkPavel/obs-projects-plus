import { visibleViewport } from "src/ui/utils/visibleViewport";

/** Resolve env(safe-area-inset-*) through computed padding, in the field's window. */
export function fieldViewport(view: Window, insets?: Pick<CSSStyleDeclaration, "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft">) {
  const bounds = visibleViewport(view);
  const viewport = view.visualViewport;
  const usable = viewport && viewport.width > 0 && viewport.height > 0;
  const originTop = usable ? viewport.offsetTop : 0;
  const originLeft = usable ? viewport.offsetLeft : 0;
  // coercion-exempt: Class C - computed CSS padding resolves env() to CSS pixels, not record data
  const px = (value: string | undefined) => { const parsed = parseFloat(value ?? ""); return Number.isFinite(parsed) ? Math.max(0, parsed) : 0; };
  const top = Math.max(bounds.top, originTop + px(insets?.paddingTop));
  const left = Math.max(bounds.left, originLeft + px(insets?.paddingLeft));
  const bottom = Math.max(top, Math.min(bounds.bottom, originTop + (usable ? viewport.height : view.innerHeight) - px(insets?.paddingBottom)));
  const right = Math.max(left, Math.min(bounds.right, originLeft + (usable ? viewport.width : view.innerWidth) - px(insets?.paddingRight)));
  return { top, left, bottom, right, height: bottom - top, width: right - left };
}
