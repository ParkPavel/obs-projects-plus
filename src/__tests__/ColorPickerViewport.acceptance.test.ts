/** Actual ColorPicker component CSS in Chrome; not a substitute for phone acceptance. */
import { cssFile, describeWithChrome, renderProbe, svelteStyle, unscope } from "./support/renderProbe";

const colorPickerCss = unscope(svelteStyle("ui/components/ColorPicker/ColorPicker.svelte"));
const pickerMarkup = `<div id="host">
  <div id="picker" class="color-picker">
    <div class="palette-section">
      <span class="palette-label">Pick color</span>
      <div id="sat" class="sat-light-picker"></div>
      <div class="hue-slider"></div>
      <div class="preview-row"><div class="color-preview"></div><div class="hsv-values">H: 0 S: 0 V: 0</div><button class="action-btn"></button></div>
    </div>
    <div class="palette-section">
      <div class="section-header"><span class="palette-label">Favorites</span></div>
      <div class="favorites-grid">${Array.from({ length: 12 }, () => `<div class="swatch-container"><button class="color-swatch"></button><button class="remove-btn"></button></div>`).join("")}</div>
    </div>
    <div class="palette-section"><span class="palette-label">HEX</span><div class="hex-row"><div class="hex-preview"></div><input class="hex-input"></div></div>
  </div>
</div>`;

describeWithChrome("ColorPicker responsive size", () => {
  test("mobile palette remains within the viewport width and uses its own scroll area", () => {
    const result = renderProbe({
      width: 390,
      height: 844,
      css: [cssFile("ui/tokens/tokens.css"), colorPickerCss, "#host{width:100vw;max-width:100vw}"],
      html: pickerMarkup,
      evaluate: "probe.viewportWidth=String(document.documentElement.clientWidth);probe.viewportHeight=String(document.documentElement.clientHeight);",
      measure: [
        { id: "host", props: ["boxWidth"] },
        { id: "picker", props: ["boxWidth", "boxHeight", "max-block-size", "overflow-x", "overflow-y"] },
      ],
    });
    const viewportWidth = Number(result["__probe"]!["viewportWidth"]);
    const viewportHeight = Number(result["__probe"]!["viewportHeight"]);
    expect(Number(result["host"]!["boxWidth"])).toBeLessThanOrEqual(viewportWidth);
    expect(Number(result["picker"]!["boxWidth"])).toBeLessThanOrEqual(viewportWidth);
    expect(Number(result["picker"]!["boxHeight"])).toBeLessThanOrEqual(Math.min(viewportHeight * 0.52, 28 * 16) + 1);
    expect(result["picker"]!["overflow-y"]).toBe("auto");
    expect(result["picker"]!["overflow-x"]).toBe("hidden");
  });

  test("desktop palette uses the compact swatch and picker dimensions", () => {
    const result = renderProbe({
      width: 1280,
      height: 900,
      css: [cssFile("ui/tokens/tokens.css"), colorPickerCss, "#host{width:28rem}"],
      html: pickerMarkup,
      measure: [
        { id: "sat", props: ["boxHeight"] },
        { id: "picker", props: ["boxWidth", "boxHeight", "max-block-size"] },
      ],
    });
    expect(Number(result["sat"]!["boxHeight"])).toBe(96);
    expect(Number(result["picker"]!["boxWidth"])).toBeLessThanOrEqual(28 * 16);
    expect(Number(result["picker"]!["boxHeight"])).toBeLessThanOrEqual(34 * 16);
  });
});
