import "@testing-library/jest-dom";
import {render,cleanup} from "@testing-library/svelte";
import {tick} from "svelte";
import {enter,optionRows,tap,typeInto} from "./support/comboKit";
const PathField=require("../PathSuggestField.svelte").default;
const flush=async()=>{await tick();await tick();await tick();};
afterEach(cleanup);

test("a human path label commits the exact canonical path once",async()=>{
 const raw="Dir/ Name, 1.md",view=render(PathField,{props:{value:"",files:[{path:raw}],getLabel:()=>"Human label",contextKey:"owner"}}),writes:string[]=[];
 view.component.$on("change",(event:CustomEvent<string>)=>writes.push(event.detail));const input=view.container.querySelector<HTMLInputElement>("input")!;
 await enter(input);tap(optionRows()[0]!);await flush();view.component.$set({value:raw});await flush();input.blur();await flush();
 expect(writes).toEqual([raw]);expect(view.container.querySelector("input")).toBe(input);expect(input.value).toBe(raw);
});

test.each(["context","readonly","disabled"])("a %s transition retires an unfinished path without writing",async transition=>{
 const view=render(PathField,{props:{value:"original",files:[],contextKey:"first"}}),write=jest.fn();view.component.$on("change",write);
 const input=view.container.querySelector<HTMLInputElement>("input")!;input.focus();typeInto(input,"unfinished");await flush();
 if(transition==="context")view.component.$set({contextKey:"second"});
 else {view.component.$set({[transition]:true});await flush();view.component.$set({[transition]:false});}
 await flush();input.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));input.dispatchEvent(new Event("blur"));await flush();
 expect(view.container.querySelector("input")).not.toBe(input);expect(write).not.toHaveBeenCalled();
});

test("readonly paths stay selectable but cannot open or commit edits",async()=>{
 const view=render(PathField,{props:{value:"original",files:[{path:"other"}],readonly:true}}),write=jest.fn();view.component.$on("change",write);
 const input=view.container.querySelector<HTMLInputElement>("input")!;expect(input).toHaveAttribute("readonly");expect(input).not.toBeDisabled();
 input.focus();typeInto(input,"private");input.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));input.blur();await flush();
 expect(write).not.toHaveBeenCalled();expect(document.querySelector('[role="listbox"]')).toBeNull();
});
