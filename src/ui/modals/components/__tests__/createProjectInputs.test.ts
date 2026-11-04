import "@testing-library/jest-dom";
import {render,cleanup,fireEvent} from "@testing-library/svelte";
import {tick} from "svelte";
import {enter,optionRows,tap,typeInto} from "src/ui/components/fields/__tests__/support/comboKit";
jest.mock("dayjs",()=>({__esModule:true,default:jest.requireActual("dayjs")}));
// Decorative chrome only. The pre-migration inputs/autocomplete/selection run
// their actual installed implementation, including their real event contracts.
jest.mock("../../../../../node_modules/obsidian-svelte/Icon",()=>({
 Icon:jest.requireActual("src/__mocks__/obsidian-svelte.js").Icon,
 IconButton:jest.requireActual("src/__mocks__/obsidian-svelte.js").IconButton,
 useIcon:()=>({update(){},destroy(){}}),
}));
jest.mock("../../../../../node_modules/obsidian-svelte/Autocomplete",()=>({Autocomplete:require("../../../../../node_modules/obsidian-svelte/Autocomplete/Autocomplete.svelte").default}));
jest.mock("../../../../../node_modules/obsidian-svelte/Input",()=>({TextInput:require("../../../../../node_modules/obsidian-svelte/Input/TextInput.svelte").default}));
jest.mock("../../../../../node_modules/obsidian-svelte/Popover",()=>({
 Suggestion:require("../../../../../node_modules/obsidian-svelte/Popover/Suggestion.svelte").default,
 SuggestionItem:require("../../../../../node_modules/obsidian-svelte/Popover/SuggestionItem.svelte").default,
}));
jest.mock("obsidian-svelte",()=>({
 ...jest.requireActual("obsidian-svelte"),
 TextInput:require("../../../../../node_modules/obsidian-svelte/Input/TextInput.svelte").default,
 FileAutocomplete:require("../../../../../node_modules/obsidian-svelte/Autocomplete/FileAutocomplete.svelte").default,
 Select:require("../../../../../node_modules/obsidian-svelte/Select/Select.svelte").default,
 TextArea:require("../../../../../node_modules/obsidian-svelte/TextArea/TextArea.svelte").default,
 Button:require("./mocks/Button.mock.svelte").default,
 SettingItem:require("./mocks/ProjectChrome.mock.svelte").default,
 ModalLayout:require("./mocks/ProjectChrome.mock.svelte").default,
 ModalContent:require("./mocks/ProjectChrome.mock.svelte").default,
 ModalButtonGroup:require("./mocks/ModalButtonGroup.mock.svelte").default,
}));
jest.mock("src/ui/components/Accordion",()=>({Accordion:require("./mocks/ProjectChrome.mock.svelte").default,AccordionItem:require("./mocks/ProjectChrome.mock.svelte").default}));
jest.mock("src/ui/components/FileListInput",()=>({FileListInput:require("src/ui/components/FileListInput/FileListInput.svelte").default}));
const mockFolders:Array<{path:string;name:string}>=[];
jest.mock("src/lib/obsidian",()=>({...jest.requireActual("src/lib/obsidian"),getFoldersInFolder:()=>mockFolders}));
jest.mock("src/lib/stores/capabilities",()=>({capabilities:require("svelte/store").writable({dataview:false})}));
const {app}=require("src/lib/stores/obsidian"),{settings}=require("src/lib/stores/settings");
const {DEFAULT_PROJECT,DEFAULT_SETTINGS}=require("src/settings/settings"),{TFolder}=require("obsidian");
const {i18n}=require("src/lib/stores/i18n"),{get}=require("svelte/store");
const ProjectForm=require("../CreateProject.svelte").default;
const flush=async()=>{await tick();await tick();await tick();};
const makeProject=(id="p1",name="Current")=>({...DEFAULT_PROJECT,id,name,templates:[],excludedNotes:[],dataSource:{id:"source-id",kind:"folder",config:{path:"Notes",recursive:false}},views:[]});
const legacyContains=Object.getOwnPropertyDescriptor(String.prototype,"contains");
let mockOwner:any;
beforeEach(()=>{
 Object.defineProperty(String.prototype,"contains",{value:String.prototype.includes,configurable:true});
 mockFolders.splice(0,mockFolders.length,...Array.from({length:600},(_,id)=>new TFolder(id===599?"Projects/Ёлка":`Folders/Item ${id}`)));
 const root=new TFolder("/");
 mockOwner={vault:{getRoot:()=>root,getAllLoadedFiles:jest.fn(()=>[root,...mockFolders]),on:jest.fn(()=>({})),offref:jest.fn()}};
 app.set(mockOwner);settings.set({...DEFAULT_SETTINGS,projects:[makeProject(),makeProject("p2","Other")]});
});
afterEach(()=>{cleanup();if(legacyContains)Object.defineProperty(String.prototype,"contains",legacyContains);else Reflect.deleteProperty(String.prototype,"contains");});
const t=(key:string)=>get(i18n).t(key);
const inputFor=(target:HTMLElement,key:string)=>Array.from(target.querySelectorAll<HTMLElement>('[data-testid="setting-item"]')).find(row=>row.dataset['name']===t(key))!.querySelector<HTMLInputElement>("input")!;
const save=(target:HTMLElement)=>target.querySelector<HTMLButtonElement>('[data-variant="primary"]')!;
const mount=(project=makeProject())=>{const onSave=jest.fn();return{...render(ProjectForm,{props:{title:"Project",cta:"Save",project,onSave}}),onSave};};

test("project name and source choice use the shared original-input controls",async()=>{
 const view=mount();await flush();
 expect(inputFor(view.container,"modals.project.name.name")).toHaveAttribute("role","combobox");
 expect(inputFor(view.container,"modals.project.datasource.name")).toHaveAttribute("role","combobox");
 expect(document.querySelector(".ppp-popup input")).toBeNull();
});

test("saving while a project name is composing cannot persist its unfinished candidate",async()=>{
 const view=mount();await flush();const input=inputFor(view.container,"modals.project.name.name");await enter(input);
 input.dispatchEvent(new CompositionEvent("compositionstart",{bubbles:true}));typeInto(input,"候補");await flush();
 await fireEvent.click(save(view.container));expect(view.onSave).not.toHaveBeenCalled();
 input.dispatchEvent(new CompositionEvent("compositionend",{bubbles:true}));await flush();await fireEvent.click(save(view.container));
 expect(view.onSave).toHaveBeenCalledTimes(1);expect(view.onSave.mock.calls[0][0].name).toBe("候補");
});

test("folder search transliterates the complete permitted source and saves its exact identity",async()=>{
 const view=mount();await flush();const input=inputFor(view.container,"modals.project.path.name");await enter(input);typeInto(input,"elka");await flush();
 const option=Array.from(document.querySelectorAll<HTMLElement>('[role="option"],.suggestion-item')).find(row=>row.textContent==="Projects/Ёлка");expect(option).toBeDefined();tap(option!);await flush();
 expect(inputFor(view.container,"modals.project.path.name")).toBe(input);await fireEvent.click(save(view.container));
 expect(view.onSave.mock.calls[0][0].dataSource).toEqual({id:"source-id",kind:"folder",config:{path:"Projects/Ёлка",recursive:false}});
});

test("an invalid query limit remains a draft and blocks Save until corrected",async()=>{
 const project={...makeProject(),dataSource:{id:"source-id",kind:"native-query",config:{from:{kind:"folder",path:"Notes",recursive:false},limit:100}}};
 const view=mount(project as any);await flush();const input=inputFor(view.container,"modals.project.native-query.limit.name");await enter(input);typeInto(input,"25bad");await flush();
 input.blur();await flush();await fireEvent.click(save(view.container));expect(view.onSave).not.toHaveBeenCalled();expect(input.value).toBe("25bad");
 await enter(input);typeInto(input,"500");await flush();await fireEvent.click(save(view.container));
 expect(view.onSave).toHaveBeenCalledTimes(1);expect(view.onSave.mock.calls[0][0].dataSource.config.limit).toBe(500);
});

test("switching the project owner retires its draft and validates the new owner's original name",async()=>{
 const view=mount();await flush();const old=inputFor(view.container,"modals.project.name.name");await enter(old);typeInto(old,"private draft");await flush();
 view.component.$set({project:makeProject("p2","Other")});await flush();
 expect(inputFor(view.container,"modals.project.name.name")).not.toBe(old);expect(inputFor(view.container,"modals.project.name.name").value).toBe("Other");
 old.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));old.dispatchEvent(new Event("blur"));await flush();await fireEvent.click(save(view.container));
 expect(view.onSave).toHaveBeenCalledTimes(1);expect(view.onSave.mock.calls[0][0]).toEqual(expect.objectContaining({id:"p2",name:"Other"}));
});

test("a source choice stores its code and retains the source's existing identity",async()=>{
 const view=mount();await flush();const input=inputFor(view.container,"modals.project.datasource.name");await enter(input);
 tap(optionRows().find(row=>row.textContent===t("datasources.tag"))!);await flush();
 expect(inputFor(view.container,"modals.project.datasource.name")).toBe(input);await fireEvent.click(save(view.container));
 expect(view.onSave.mock.calls[0][0].dataSource).toEqual({id:"source-id",kind:"tag",config:{tag:"",hierarchy:false}});
});

test("Save explicitly settles an active folder draft without relying on native blur",async()=>{
 const view=mount();await flush();const input=inputFor(view.container,"modals.project.path.name");await enter(input);typeInto(input,"New folder");await flush();
 await fireEvent.click(save(view.container));expect(view.onSave.mock.calls[0][0].dataSource.config.path).toBe("New folder");
});

test("Save explicitly settles an active template draft without relying on native blur",async()=>{
 const project={...makeProject(),templates:["one.md"]},view=mount(project);await flush();const input=inputFor(view.container,"modals.project.templates.name");await enter(input);typeInto(input,"two.md");await flush();
 await fireEvent.click(save(view.container));expect(view.onSave.mock.calls[0][0].templates).toEqual(["two.md"]);
});

test.each(["0",""])("a query limit of %p retains the existing unlimited configuration contract",async value=>{
 const project={...makeProject(),dataSource:{id:"source-id",kind:"native-query",config:{from:{kind:"folder",path:"Notes",recursive:false},limit:100}}};
 const view=mount(project as any);await flush();const input=inputFor(view.container,"modals.project.native-query.limit.name");await enter(input);typeInto(input,value);await flush();await fireEvent.click(save(view.container));
 expect(view.onSave).toHaveBeenCalledTimes(1);expect(view.onSave.mock.calls[0][0].dataSource.config).not.toHaveProperty("limit");
});

test("a template acknowledgement in the actual project form preserves its original input",async()=>{
 const view=mount({...makeProject(),templates:["one.md","two.md"]});await flush();
 const row=Array.from(view.container.querySelectorAll<HTMLElement>('[data-testid="setting-item"]')).find(item=>item.dataset['name']===t("modals.project.templates.name"))!;
 const input=row.querySelectorAll<HTMLInputElement>("input")[1]!;await enter(input);typeInto(input,"private draft");input.setSelectionRange(1,4);await flush();
 await fireEvent.click(row.querySelectorAll('[role="button"]')[0]!);await flush();
 expect(row.querySelector("input")).toBe(input);expect(input.value).toBe("private draft");expect([input.selectionStart,input.selectionEnd]).toEqual([1,4]);
 input.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));await flush();
 expect(row.querySelector("input")).toBe(input);await fireEvent.click(save(view.container));
 expect(view.onSave.mock.calls[0][0].templates).toEqual(["private draft"]);
});

test("composition in a template blocks whole-project Save",async()=>{
 const view=mount({...makeProject(),templates:["one.md"]});await flush();const input=inputFor(view.container,"modals.project.templates.name");await enter(input);
 input.dispatchEvent(new CompositionEvent("compositionstart",{bubbles:true}));typeInto(input,"候補");await flush();await fireEvent.click(save(view.container));expect(view.onSave).not.toHaveBeenCalled();
 input.dispatchEvent(new CompositionEvent("compositionend",{bubbles:true}));await flush();await fireEvent.click(save(view.container));expect(view.onSave.mock.calls[0][0].templates).toEqual(["候補"]);
});

test("retiring a composing source does not leave the replacement form permanently blocked",async()=>{
 const view=mount();await flush();const input=inputFor(view.container,"modals.project.path.name");await enter(input);input.dispatchEvent(new CompositionEvent("compositionstart",{bubbles:true}));typeInto(input,"候補");await flush();
 view.component.$set({project:{...makeProject(),dataSource:{id:"source-id",kind:"tag",config:{tag:"#valid",hierarchy:false}}}});await flush();
 input.dispatchEvent(new Event("blur"));await flush();await fireEvent.click(save(view.container));
 expect(view.onSave).toHaveBeenCalledTimes(1);expect(view.onSave.mock.calls[0][0].dataSource.config).toEqual({tag:"#valid",hierarchy:false});
});

test("an originally empty project name cannot bypass required-name validation",async()=>{
 const view=mount(makeProject("new",""));await flush();await fireEvent.click(save(view.container));expect(view.onSave).not.toHaveBeenCalled();expect(save(view.container)).toBeDisabled();
});
