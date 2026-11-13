/** Actual Svelte markup/source CSS in Chrome. Modeled host layers/keyboard are
 * explicit fixtures; this is not a live Obsidian or iPhone acceptance result. */
import { cleanup, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { cssFile, describeWithChrome, renderProbe, svelteStyle, unscope } from "./support/renderProbe";
const DateInput = require("src/ui/views/Calendar/agenda/DateFormulaInput.svelte").default;
const SelectField = require("src/ui/components/fields/SelectField.svelte").default;
const css = ["ui/components/fields/ComboField.svelte", "ui/components/fields/OptionField.svelte",
  "ui/components/fields/ValueSuggestField.svelte", "ui/views/Calendar/agenda/DateFormulaInput.svelte"].map(file => unscope(svelteStyle(file)));
const flush = async () => { await tick(); await tick(); await tick(); };
afterEach(cleanup);
describeWithChrome("original input suggestions above a modal and modeled phone keyboard", () => {
  test.each([{ surface: "settings", layer: 50 }, { surface: "settings", layer: 100 },
    { surface: "Agenda/filter date", layer: 50 }, { surface: "Agenda/filter date", layer: 100 },
    { surface: "settings", layer: 1000, token: false }])("$surface with host modal layer $layer", async ({ surface, layer, token = true }) => {
    const view = render(surface === "settings" ? SelectField : DateInput, { props: surface === "settings"
      ? { value: "", options: [{ value: "number", label: "Число" }, { value: "date", label: "Дата" }] } : { value: "" } });
    const input = view.container.querySelector<HTMLInputElement>("input")!; input.id = "original-input";
    input.focus(); await flush();
    const popup = document.querySelector<HTMLElement>(".ppp-combo-popup")!; popup.id = "choices";
    const html = `<div class="modal-container">${view.container.outerHTML}</div>${popup.outerHTML}<div id="keyboard"></div>`;
    const hostLayer = token ? `:root{--layer-modal:${layer};--background-primary:#fff;--background-modifier-border:#aaa} .modal-container{z-index:var(--layer-modal);}`
      : `:root{--background-primary:#fff;--background-modifier-border:#aaa} .modal-container{z-index:${layer};}`;
    const result = renderProbe({ width: 390, height: 844, css: [cssFile("ui/tokens/tokens.css"), ...css,
      `body{margin:0} ${hostLayer} .modal-container{position:fixed;inset:0;background:#eee} #original-input{position:fixed;top:400px;left:20px;width:200px;height:32px;box-sizing:border-box} #keyboard{position:fixed;top:507px;bottom:0;width:100%;background:#ddd;z-index:200}`], html,
      measure: [{ id: "original-input", props: ["boxTop", "boxBottom"] }, { id: "choices", props: ["boxBottom", "visibility"] }],
      evaluate: `const list=document.getElementById('choices'),rect=list.getBoundingClientRect(),hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);probe.visible=String(list.contains(hit));probe.at=hit?.outerHTML.slice(0,160);probe.z=getComputedStyle(list).zIndex;probe.inputs=String(document.querySelectorAll('input').length);`,
    });
    expect(Number(result["choices"]!["boxBottom"])).toBeLessThan(Number(result["original-input"]!["boxTop"]));
    expect(Number(result["original-input"]!["boxBottom"])).toBeLessThanOrEqual(507);
    expect(result["choices"]!["visibility"]).toBe("visible");
    if (result["__probe"]!["visible"] !== "true") throw new Error(JSON.stringify(result));
    expect(result["__probe"]!["inputs"]).toBe("1");
  });
});
