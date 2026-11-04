import "@testing-library/jest-dom";
import {render,cleanup} from "@testing-library/svelte";
import {tick} from "svelte";
jest.mock("dayjs", () => ({ __esModule: true, default: jest.requireActual("dayjs") }));
const FieldControl=require("../FieldControl.svelte").default;
const flush=async()=>{await tick();await tick();await tick();};
afterEach(cleanup);

test("normalising absent time configuration to false keeps the same date draft",async()=>{
 const onChange=jest.fn(),field={name:"due",type:"date",typeConfig:{},repeated:false,identifier:false,derived:false};
 const view=render(FieldControl,{props:{field,value:new Date(2026,10,1),onChange}});
 const input=view.container.querySelector<HTMLInputElement>("input.ppp-text-field")!;input.focus();
 input.value="10.11.2026";input.dispatchEvent(new Event("input",{bubbles:true}));input.setSelectionRange(1,4);await flush();
 view.component.$set({field:{...field,typeConfig:{time:false}}});await flush();
 expect(view.container.querySelector("input.ppp-text-field")).toBe(input);expect(input.value).toBe("10.11.2026");
 expect([input.selectionStart,input.selectionEnd]).toEqual([1,4]);expect(document.activeElement).toBe(input);expect(onChange).not.toHaveBeenCalled();
});

test.each<[boolean,"owner"|"lock"]>([[false,"owner"],[true,"owner"],[false,"lock"],[true,"lock"]])("a real date adapter (time=%s) retires its draft after %s",async(withTime,retirement)=>{
 const onChange=jest.fn(),field={name:"due",type:"date",typeConfig:{time:withTime},repeated:false,identifier:false,derived:false};
 const view=render(FieldControl,{props:{field,value:new Date(2026,10,1,9,30),onChange}});
 const input=view.container.querySelector<HTMLInputElement>("input.ppp-text-field")!;input.focus();
 input.value=withTime?"10.11.2026 14:20":"10.11.2026";input.dispatchEvent(new Event("input",{bubbles:true}));await flush();
 if(retirement==="owner")view.component.$set({field:{...field,name:"other"},value:new Date(2026,10,5,12,30)});
 else {view.component.$set({readonly:true});await flush();view.component.$set({readonly:false});}
 await flush();input.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true,cancelable:true}));input.dispatchEvent(new FocusEvent("blur",{bubbles:false}));await flush();
 expect(onChange).not.toHaveBeenCalled();expect(view.container.querySelector("input.ppp-text-field")).not.toBe(input);
});
