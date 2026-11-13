import "@testing-library/jest-dom";
import { render, fireEvent, cleanup } from "@testing-library/svelte";
import { tick } from "svelte";
jest.mock("src/lib/stores/ui", () => ({isMobile:require("svelte/store").writable(false)}));
const Fixture = require("./PipelinePopup.fixture.svelte").default;
const settle = async () => {await tick();await tick();};
beforeEach(()=>jest.useFakeTimers());
afterEach(()=>{cleanup();jest.clearAllTimers();jest.useRealTimers();});
async function open() {
  const view=render(Fixture);await settle();
  await fireEvent.click(document.querySelector(".ppp-step-summary")!);await settle();
  return {view,name:document.querySelector<HTMLInputElement>(".ppp-compute-name")!,formula:document.querySelector<HTMLTextAreaElement>(".ppp-compute-expr textarea")!};
}
test("outside dismissal synchronizes both pending column name and formula before unmount, then reopens them",async()=>{
  const {view,name,formula}=await open();
  await fireEvent.input(name,{target:{value:"renamed"}});
  await fireEvent.input(formula,{target:{value:"price * 3"}});
  await fireEvent.mouseDown(document.body);await settle();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  const value=JSON.parse(view.container.querySelector("output")!.textContent!);
  expect(value.steps[0].columns[0]).toEqual({name:"renamed",expression:"price * 3",formulaVersion:"unified-v1"});
  expect(view.container.querySelector("output")).toHaveAttribute("data-writes","1");
  jest.advanceTimersByTime(1000);await settle();
  expect(view.container.querySelector("output")).toHaveAttribute("data-writes","1");
  await fireEvent.click(view.container.querySelector("button")!);await settle();
  await fireEvent.click(document.querySelector(".ppp-step-summary")!);await settle();
  expect(document.querySelector(".ppp-compute-name")).toHaveValue("renamed");
  expect(document.querySelector(".ppp-compute-expr textarea")).toHaveValue("price * 3");
});
test.each(["invalid","composition"])("a %s formula retains the popup and can be corrected",async kind=>{
  const {view,formula}=await open();
  if(kind === "composition")await fireEvent.compositionStart(formula);
  await fireEvent.input(formula,{target:{value:kind === "invalid" ? "price *" : "price * 3"}});
  await fireEvent.mouseDown(document.body);await settle();
  expect(document.querySelector(".ppp-compute-expr textarea")).toBe(formula);
  expect(view.container.querySelector("output")).toHaveAttribute("data-writes","0");
  if(kind === "composition")await fireEvent.compositionEnd(formula);
  await fireEvent.input(formula,{target:{value:"price * 4"}});
  await fireEvent.mouseDown(document.body);await settle();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(JSON.parse(view.container.querySelector("output")!.textContent!).steps[0].columns[0].expression).toBe("price * 4");
});

test.each(["empty","unknown"])("an unchanged %s definition can close without being rewritten",async kind=>{
  const column={name:"total",expression:kind === "empty" ? "" : "price * 2",formulaVersion:kind === "empty" ? "unified-v1" : "future-v9"};
  const view=render(Fixture,{props:{pipeline:{steps:[{type:"compute",columns:[column]}]}}});await settle();
  await fireEvent.click(document.querySelector(".ppp-step-summary")!);await settle();
  await fireEvent.mouseDown(document.body);await settle();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(JSON.parse(view.container.querySelector("output")!.textContent!).steps[0].columns[0]).toEqual(column);
});
