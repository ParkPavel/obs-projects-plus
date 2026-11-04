import "@testing-library/jest-dom";
import {render,cleanup,fireEvent} from "@testing-library/svelte";
import {tick} from "svelte";
import {enter,typeInto,optionRows,tap} from "src/ui/components/fields/__tests__/support/comboKit";
// Only decorative icon chrome is replaced: the old autocomplete/filter/input
// code runs unchanged, without its circular package barrel's Jest init issue.
jest.mock("../../../../../node_modules/obsidian-svelte/Icon",()=>({
 Icon:jest.requireActual("src/__mocks__/obsidian-svelte.js").Icon,
 IconButton:jest.requireActual("src/__mocks__/obsidian-svelte.js").IconButton,
 useIcon:()=>({update(){},destroy(){}}),
}));
// Preserve actual compiled constructors through the package's JS re-exports.
jest.mock("../../../../../node_modules/obsidian-svelte/Autocomplete",()=>({Autocomplete:require("../../../../../node_modules/obsidian-svelte/Autocomplete/Autocomplete.svelte").default}));
jest.mock("../../../../../node_modules/obsidian-svelte/Input",()=>({TextInput:require("../../../../../node_modules/obsidian-svelte/Input/TextInput.svelte").default}));
jest.mock("../../../../../node_modules/obsidian-svelte/Popover",()=>({
 Suggestion:require("../../../../../node_modules/obsidian-svelte/Popover/Suggestion.svelte").default,
 SuggestionItem:require("../../../../../node_modules/obsidian-svelte/Popover/SuggestionItem.svelte").default,
}));
jest.mock("obsidian-svelte",()=>({
 ...jest.requireActual("obsidian-svelte"),
 FileAutocomplete:require("../../../../../node_modules/obsidian-svelte/Autocomplete/FileAutocomplete.svelte").default,
 Button:require("src/ui/modals/components/__tests__/mocks/Button.mock.svelte").default,
}));
const mockFiles:Array<{path:string;name:string}>=[];
jest.mock("src/lib/obsidian",()=>({...jest.requireActual("src/lib/obsidian"),getFilesInFolder:jest.fn(()=>mockFiles)}));
const {app}=require("src/lib/stores/obsidian"),{getFilesInFolder}=require("src/lib/obsidian");
const {TFile}=require("obsidian");
let mockOwner:any;
let mockVaultEvents:Map<string,Set<(...args:unknown[])=>void>>;
const FileList=require("../FileListInput.svelte").default;
const flush=async()=>{await tick();await tick();await tick();};
const legacyContains=Object.getOwnPropertyDescriptor(String.prototype,"contains");
beforeEach(()=>{
 Object.defineProperty(String.prototype,"contains",{value:String.prototype.includes,configurable:true});
 mockFiles.splice(0,mockFiles.length,new TFile("one.md"),new TFile("two.md"));
 mockVaultEvents=new Map();
 mockOwner={vault:{getRoot:()=>({path:"/"}),getFiles:jest.fn(()=>mockFiles),getAllLoadedFiles:jest.fn(()=>mockFiles),on:jest.fn((name:string,callback:(...args:unknown[])=>void)=>{const callbacks=mockVaultEvents.get(name)??new Set();callbacks.add(callback);mockVaultEvents.set(name,callbacks);return{name,callback};}),offref:jest.fn((ref:{name:string;callback:(...args:unknown[])=>void})=>mockVaultEvents.get(ref.name)?.delete(ref.callback))}};
 app.set(mockOwner);
 getFilesInFolder.mockClear();
});
afterEach(()=>{cleanup();jest.useRealTimers();if(legacyContains)Object.defineProperty(String.prototype,"contains",legacyContains);else Reflect.deleteProperty(String.prototype,"contains");});

test("file paths use the same original-input combo and no parent acknowledgement writes",async()=>{
 const onPathsChange=jest.fn(),view=render(FileList,{props:{paths:["one.md"],buttonText:"Add path",onPathsChange}});await flush();
 const input=view.container.querySelector("input")!;expect(input).toHaveAttribute("role","combobox");
 view.component.$set({paths:["one.md"]});await flush();expect(view.container.querySelector("input")).toBe(input);expect(onPathsChange).not.toHaveBeenCalled();
});

test("the permitted file source supports transliteration beyond its first result page",async()=>{
 mockFiles.splice(0,mockFiles.length,...Array.from({length:600},(_,id)=>new TFile(id===599?"Notes/Ёлка.md":`Notes/File ${id}.md`)));
 const onPathsChange=jest.fn(),view=render(FileList,{props:{paths:[""],buttonText:"Add path",onPathsChange}});
 const input=view.container.querySelector<HTMLInputElement>("input")!;await enter(input);typeInto(input,"elka");await flush();
 const rows=Array.from(document.querySelectorAll<HTMLElement>('[role="option"],.suggestion-item'));
 expect(rows.map(row=>row.textContent)).toContain("Notes/Ёлка.md");expect(view.container.querySelector("input")).toBe(input);expect(onPathsChange).not.toHaveBeenCalled();
});

test("removing another path preserves the surviving original input and its unfinished draft",async()=>{
 const onPathsChange=jest.fn(),view=render(FileList,{props:{paths:["one.md","two.md"],buttonText:"Add path",onPathsChange}});
 const input=view.container.querySelectorAll<HTMLInputElement>("input")[1]!;input.focus();typeInto(input,"private draft");input.setSelectionRange(1,4);await flush();
 await fireEvent.click(view.container.querySelectorAll('[role="button"]')[0]!);await flush();
 expect(onPathsChange).toHaveBeenLastCalledWith(["two.md"]);view.component.$set({paths:["two.md"]});await flush();
 expect(view.container.querySelector("input")).toBe(input);expect(input.value).toBe("private draft");expect([input.selectionStart,input.selectionEnd]).toEqual([1,4]);
});

test("retiring an unfinished path does not publish it",async()=>{
 const onPathsChange=jest.fn(),view=render(FileList,{props:{paths:["one.md"],buttonText:"Add path",onPathsChange}});
 const input=view.container.querySelector<HTMLInputElement>("input")!;input.focus();typeInto(input,"unfinished");await flush();view.unmount();expect(onPathsChange).not.toHaveBeenCalled();
});

test("path controls share one permitted app source rather than traversing it for every row",async()=>{
 const view=render(FileList,{props:{paths:["one.md","two.md"],buttonText:"Add path",onPathsChange:jest.fn()}});await flush();
 const reads=()=>getFilesInFolder.mock.calls.length+mockOwner.vault.getAllLoadedFiles.mock.calls.length;
 expect(reads()).toBe(1);const input=view.container.querySelector<HTMLInputElement>("input")!;input.focus();typeInto(input,"query");await flush();
 expect(reads()).toBe(1);
});

test("a created file refreshes the options without replacing the original query input",async()=>{
 jest.useFakeTimers();const onPathsChange=jest.fn(),view=render(FileList,{props:{paths:[""],buttonText:"Add path",onPathsChange}});
 const input=view.container.querySelector<HTMLInputElement>("input")!;await enter(input);typeInto(input,"New");input.setSelectionRange(1,3);await flush();
 const file=new TFile("New.md");mockFiles.push(file);mockVaultEvents.get("create")?.forEach(callback=>callback(file));jest.advanceTimersByTime(200);await flush();
 const labels=Array.from(document.querySelectorAll<HTMLElement>('[role="option"],.suggestion-item')).map(row=>row.textContent);
 expect(labels).toContain("New.md");expect(view.container.querySelector("input")).toBe(input);expect([input.selectionStart,input.selectionEnd]).toEqual([1,3]);expect(document.activeElement).toBe(input);expect(onPathsChange).not.toHaveBeenCalled();
});

test("choosing a canonical path writes once and its acknowledgement retains the input",async()=>{
 const onPathsChange=jest.fn(),view=render(FileList,{props:{paths:["one.md"],buttonText:"Add path",onPathsChange}});
 const input=view.container.querySelector<HTMLInputElement>("input")!;await enter(input);
 const option=optionRows().find(row=>row.textContent==="two.md");expect(option).toBeDefined();tap(option!);await flush();
 expect(onPathsChange).toHaveBeenCalledTimes(1);expect(onPathsChange).toHaveBeenCalledWith(["two.md"]);
 view.component.$set({paths:["two.md"]});await flush();input.blur();await flush();
 expect(view.container.querySelector("input")).toBe(input);expect(onPathsChange).toHaveBeenCalledTimes(1);
});

test.each(["context","lock"])("a %s change retires the path interaction before an old callback can write",async change=>{
 const onPathsChange=jest.fn(),view=render(FileList,{props:{paths:["one.md"],buttonText:"Add path",contextKey:"first",onPathsChange}});
 const input=view.container.querySelector<HTMLInputElement>("input")!;input.focus();typeInto(input,"private draft");await flush();
 if(change==="context")view.component.$set({contextKey:"second"});else{view.component.$set({disabled:true});await flush();view.component.$set({disabled:false});}
 await flush();input.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));input.dispatchEvent(new Event("blur"));await flush();
 expect(view.container.querySelector("input")).not.toBe(input);expect(onPathsChange).not.toHaveBeenCalled();
});

test("IME prevents premature path confirmation, add and removal",async()=>{
 const onPathsChange=jest.fn(),view=render(FileList,{props:{paths:["one.md"],buttonText:"Add path",onPathsChange}});
 const input=view.container.querySelector<HTMLInputElement>("input")!;input.focus();input.dispatchEvent(new CompositionEvent("compositionstart",{bubbles:true}));typeInto(input,"候補");await flush();
 input.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true,isComposing:false}));
 await fireEvent.click(view.container.querySelector('button')!);await fireEvent.click(view.container.querySelector('[role="button"]')!);await flush();
 expect(onPathsChange).not.toHaveBeenCalled();input.dispatchEvent(new CompositionEvent("compositionend",{bubbles:true}));await flush();
});

test("the last path picker retires its shared source listeners and pending refresh",async()=>{
 jest.useFakeTimers();const props={paths:["one.md"],buttonText:"Add path",onPathsChange:jest.fn()},first=render(FileList,{props}),second=render(FileList,{props});await flush();
 expect(mockOwner.vault.getAllLoadedFiles).toHaveBeenCalledTimes(1);expect(mockOwner.vault.on).toHaveBeenCalledTimes(3);
 first.unmount();expect(mockOwner.vault.offref).not.toHaveBeenCalled();
 mockVaultEvents.get("create")?.forEach(callback=>callback(new TFile("later.md")));second.unmount();jest.advanceTimersByTime(1000);await flush();
 expect(mockOwner.vault.offref).toHaveBeenCalledTimes(3);expect(mockOwner.vault.getAllLoadedFiles).toHaveBeenCalledTimes(1);
});
