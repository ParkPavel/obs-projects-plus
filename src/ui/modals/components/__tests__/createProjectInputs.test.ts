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
 Switch:require("../../../../../node_modules/obsidian-svelte/Switch/Switch.svelte").default,
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
const mockDataview={query:jest.fn()};
jest.mock("src/lib/datasources/dataview/host",()=>({getAPI:()=>mockDataview,isPluginEnabled:()=>true}));
const {app}=require("src/lib/stores/obsidian"),{settings}=require("src/lib/stores/settings");
const {DEFAULT_PROJECT,DEFAULT_SETTINGS}=require("src/settings/settings"),{TFolder}=require("obsidian");
const {i18n}=require("src/lib/stores/i18n"),{get}=require("svelte/store");
const ProjectForm=require("../CreateProject.svelte").default;
const flush=async()=>{await tick();await tick();await tick();};
const makeProject=(id="p1",name="Current")=>({...DEFAULT_PROJECT,id,name,templates:[],excludedNotes:[],dataSource:{id:"source-id",kind:"folder",config:{path:"Notes",recursive:false}},views:[]});
const legacyContains=Object.getOwnPropertyDescriptor(String.prototype,"contains");
let mockOwner:any;
beforeEach(()=>{
 require("src/lib/stores/capabilities").capabilities.set({dataview:false});mockDataview.query.mockReset().mockResolvedValue({successful:true,value:{type:"list",values:[]}});
 Object.defineProperty(String.prototype,"contains",{value:String.prototype.includes,configurable:true});
 mockFolders.splice(0,mockFolders.length,...Array.from({length:600},(_,id)=>new TFolder(id===599?"Projects/Ёлка":`Folders/Item ${id}`)));
 const root=new TFolder("/");
 mockOwner={vault:{getRoot:()=>root,getAllLoadedFiles:jest.fn(()=>[root,...mockFolders]),on:jest.fn(()=>({})),offref:jest.fn()}};
 app.set(mockOwner);settings.set({...DEFAULT_SETTINGS,projects:[makeProject(),makeProject("p2","Other")]});
});
afterEach(()=>{cleanup();jest.useRealTimers();if(legacyContains)Object.defineProperty(String.prototype,"contains",legacyContains);else Reflect.deleteProperty(String.prototype,"contains");});
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

test("additional sources retain the edited row when a preceding source is removed",async()=>{
 const project={...makeProject(),additionalSources:[{id:"one",name:"One",kind:"folder",config:{path:"One",recursive:false}},{id:"two",name:"Two",kind:"folder",config:{path:"Two",recursive:false}}]},view=mount(project as any);await flush();
 const rows=view.container.querySelectorAll('.ppp-additional-source-row'),input=rows[1]!.querySelector<HTMLInputElement>('input')!;await enter(input);typeInto(input,"private draft");input.setSelectionRange(1,4);await flush();
 await fireEvent.click(rows[0]!.querySelector('button')!);await flush();
 expect(view.container.querySelector('.ppp-additional-source-row input')).toBe(input);expect(input.value).toBe("private draft");expect([input.selectionStart,input.selectionEnd]).toEqual([1,4]);
 typeInto(input,"Final");await flush();await fireEvent.click(save(view.container));
 expect(view.onSave.mock.calls[0][0].additionalSources).toEqual([{id:"two",name:"Final",kind:"folder",config:{path:"Two",recursive:false}}]);
});

test("query conditions retain the edited row when a preceding condition is removed",async()=>{
 const project={...makeProject(),dataSource:{id:"source-id",kind:"native-query",config:{from:{kind:"folder",path:"Notes",recursive:false},where:{conjunction:"and",conditions:[{field:"first",operator:"is",enabled:true,value:"a"},{field:"second",operator:"is",enabled:true,value:"b"}]}}}},view=mount(project as any);await flush();
 const rows=view.container.querySelectorAll('.ppp-nq-condition-row'),input=rows[1]!.querySelector<HTMLInputElement>('input')!;await enter(input);typeInto(input,"private draft");input.setSelectionRange(1,4);await flush();
 await fireEvent.click(rows[0]!.querySelector('button')!);await flush();
 expect(view.container.querySelector('.ppp-nq-condition-row input')).toBe(input);expect(input.value).toBe("private draft");expect([input.selectionStart,input.selectionEnd]).toEqual([1,4]);
 typeInto(input,"Final");await flush();await fireEvent.click(save(view.container));
 expect(view.onSave.mock.calls[0][0].dataSource.config.where.conditions).toEqual([{field:"Final",operator:"is",enabled:true,value:"b"}]);
});

test("a legacy source without an id retains its name input through a kind change",async()=>{
 const project={...makeProject(),additionalSources:[{name:"Legacy",kind:"folder",config:{path:"Notes",recursive:false}}]},view=mount(project as any);await flush();
 const row=view.container.querySelector('.ppp-additional-source-row')!,name=row.querySelector<HTMLInputElement>('input')!;
 expect(name).toHaveAttribute('role','combobox');const choice=row.querySelector<HTMLInputElement>('.ppp-option-field input')!;await enter(choice);tap(optionRows().find(option=>option.textContent===t('datasources.tag'))!);await flush();
 expect(row.querySelector('input')).toBe(name);await fireEvent.click(save(view.container));const source=view.onSave.mock.calls[0][0].additionalSources[0];expect(source.id).toEqual(expect.any(String));expect(source.name).toBe('Legacy');expect(source.kind).toBe('tag');
});

const dqlProject=()=>({...makeProject(),dataSource:{id:"dql-source",kind:"dataview",config:{query:"LIST FROM #first"}}});
const typeQuery=(input:HTMLTextAreaElement,text:string)=>{input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));};

test("a late Dataview result cannot replace the current query's preview",async()=>{
 jest.useFakeTimers();require("src/lib/stores/capabilities").capabilities.set({dataview:true});
 const pending:Array<(value:unknown)=>void>=[];mockDataview.query.mockImplementation(()=>new Promise(resolve=>pending.push(resolve)));
 const view=mount(dqlProject() as any);await flush();const input=view.container.querySelector('textarea')!;input.focus();typeQuery(input,"LIST FROM #old");await flush();jest.advanceTimersByTime(650);await flush();expect(pending).toHaveLength(1);
 typeQuery(input,"LIST FROM #second");await flush();jest.advanceTimersByTime(650);await flush();expect(pending).toHaveLength(2);
 pending[1]!({successful:true,value:{type:"list",values:[1,2]}});await flush();const current=view.container.querySelector('.ppp-dv-preview')!.textContent;
 pending[0]!({successful:false});await flush();expect(view.container.querySelector('.ppp-dv-preview')!.textContent).toBe(current);expect(view.container.querySelector('.ppp-dv-preview')).toHaveClass('ppp-dv-preview--success');
});

test("Dataview preview waits for the final IME query",async()=>{
 jest.useFakeTimers();require("src/lib/stores/capabilities").capabilities.set({dataview:true});const view=mount(dqlProject() as any);await flush();jest.advanceTimersByTime(650);await flush();mockDataview.query.mockClear();
 const input=view.container.querySelector('textarea')!;input.focus();input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));typeQuery(input,"LIST FROM #候");await flush();jest.advanceTimersByTime(650);await flush();expect(mockDataview.query).not.toHaveBeenCalled();
 input.value="LIST FROM #候補";input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));await flush();jest.advanceTimersByTime(650);await flush();expect(mockDataview.query).toHaveBeenCalledTimes(1);expect(mockDataview.query.mock.calls[0][0]).toBe("LIST FROM #候補");
});

test("Escape restores both the multiline query and the project value saved later",async()=>{
 require("src/lib/stores/capabilities").capabilities.set({dataview:true});const view=mount(dqlProject() as any);await flush();const input=view.container.querySelector('textarea')!;input.focus();typeQuery(input,"LIST\nFROM #draft");await flush();
 const enterEvent=new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});input.dispatchEvent(enterEvent);expect(enterEvent.defaultPrevented).toBe(false);
 input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await flush();expect(input.value).toBe('LIST FROM #first');await fireEvent.click(save(view.container));expect(view.onSave.mock.calls[0][0].dataSource.config.query).toBe('LIST FROM #first');
});

test("date format presets use the common input and preserve the configuration codes",async()=>{
 const view=mount();await flush();const row=Array.from(view.container.querySelectorAll<HTMLElement>('[data-testid="setting-item"]')).find(item=>item.dataset['name']===t('modals.date-format.preset.name'))!,input=row.querySelector<HTMLInputElement>('input[role="combobox"]');expect(input).not.toBeNull();
 await enter(input!);tap(optionRows().find(option=>option.textContent==='EU (DD.MM.YYYY)')!);await flush();await fireEvent.click(save(view.container));
 expect(view.onSave.mock.calls[0][0].dateFormat).toEqual(expect.objectContaining({preset:'eu',writeFormat:'DD.MM.YYYY',includeTime:false}));
});

test("Escape restores the custom date syntax in the actual project saved later",async()=>{
 const view=mount({...makeProject(),dateFormat:{preset:'custom',writeFormat:'YYYY-MM-DD',includeTime:true}} as any);await flush();const input=inputFor(view.container,'modals.date-format.custom.name');await enter(input);typeInto(input,'DD.MM.YYYY');await flush();input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await flush();
 expect(input.value).toBe('YYYY-MM-DD');await fireEvent.click(save(view.container));expect(view.onSave.mock.calls[0][0].dateFormat).toEqual({preset:'custom',writeFormat:'YYYY-MM-DD',includeTime:true});
});

test("an empty custom date draft blocks Save until restored or corrected",async()=>{
 const view=mount({...makeProject(),dateFormat:{preset:'custom',writeFormat:'YYYY-MM-DD',includeTime:true}} as any);await flush();const input=inputFor(view.container,'modals.date-format.custom.name');await enter(input);typeInto(input,'');await flush();input.blur();await flush();await fireEvent.click(save(view.container));expect(view.onSave).not.toHaveBeenCalled();expect(input.value).toBe('');
 typeInto(input,'DD.MM.YYYY');await flush();await fireEvent.click(save(view.container));expect(view.onSave.mock.calls[0][0].dateFormat.writeFormat).toBe('DD.MM.YYYY');
});

test("Save settles an additional source path and never persists its UI row key",async()=>{
 const view=mount({...makeProject(),additionalSources:[{id:'extra',name:'Extra',kind:'folder',config:{path:'Notes',recursive:false}}]} as any);await flush();
 const input=view.container.querySelector<HTMLInputElement>('.ppp-additional-source-row .ppp-path-field input')!;await enter(input);typeInto(input,'Projects/Ёлка');await flush();await fireEvent.click(save(view.container));
 expect(view.onSave.mock.calls[0][0].additionalSources).toEqual([{id:'extra',name:'Extra',kind:'folder',config:{path:'Projects/Ёлка',recursive:false}}]);
});

test("a unary condition selection keeps the row but removes its stored operand",async()=>{
 const project={...makeProject(),dataSource:{id:'source-id',kind:'native-query',config:{from:{kind:'folder',path:'Notes',recursive:false},where:{conjunction:'and',conditions:[{field:'status',operator:'is',enabled:true,value:'old'}]}}}},view=mount(project as any);await flush();
 const row=view.container.querySelector('.ppp-nq-condition-row')!,field=row.querySelector('input'),operator=row.querySelector<HTMLInputElement>('.ppp-option-field input')!;await enter(operator);
 tap(optionRows().find(option=>option.textContent===t('modals.project.native-query.operators.is-empty'))!);await flush();expect(row.querySelector('input')).toBe(field);await fireEvent.click(save(view.container));
 expect(view.onSave.mock.calls[0][0].dataSource.config.where.conditions).toEqual([{field:'status',operator:'is-empty',enabled:true}]);
});

test("Ctrl+Enter accepts a multiline query and the next Escape restores that accepted baseline",async()=>{
 require('src/lib/stores/capabilities').capabilities.set({dataview:true});const view=mount(dqlProject() as any);await flush();const input=view.container.querySelector('textarea')!;input.focus();typeQuery(input,'LIST\nFROM #accepted');await flush();
 const event=new KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true,cancelable:true});input.dispatchEvent(event);await flush();expect(event.defaultPrevented).toBe(true);
 typeQuery(input,'LIST FROM #cancelled');await flush();input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await flush();expect(input.value).toBe('LIST\nFROM #accepted');await fireEvent.click(save(view.container));expect(view.onSave.mock.calls[0][0].dataSource.config.query).toBe('LIST\nFROM #accepted');
});

test("changing the project retires a pending preview and the old textarea's late events",async()=>{
 jest.useFakeTimers();require('src/lib/stores/capabilities').capabilities.set({dataview:true});const pending:Array<(value:unknown)=>void>=[];mockDataview.query.mockImplementation(()=>new Promise(resolve=>pending.push(resolve)));
 const view=mount(dqlProject() as any);await flush();const old=view.container.querySelector('textarea')!;old.focus();typeQuery(old,'LIST FROM #old');await flush();jest.advanceTimersByTime(650);await flush();
 view.component.$set({project:{...dqlProject(),id:'p2',name:'Other'}});await flush();const current=view.container.querySelector('textarea')!;expect(current).not.toBe(old);expect(view.container.querySelector('.ppp-dv-preview')).toBeNull();
 old.value='retired';old.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));pending[0]!({successful:false});await flush();expect(view.container.querySelector('.ppp-dv-preview')).toBeNull();await fireEvent.click(save(view.container));expect(view.onSave.mock.calls[0][0].dataSource.config.query).toBe('LIST FROM #first');
});

test.each([true,false])("an immutable source acknowledgement retains its folder draft (persisted id: %s)",async withId=>{
 const source={...(withId?{id:'extra'}:{}),name:'Extra',kind:'folder',config:{path:'Notes',recursive:false}},project={...makeProject(),additionalSources:[source]},view=mount(project as any);await flush();
 const input=view.container.querySelector<HTMLInputElement>('.ppp-additional-source-row .ppp-path-field input')!;await enter(input);typeInto(input,'private folder');input.setSelectionRange(1,4);await flush();
 view.component.$set({project:{...project,additionalSources:project.additionalSources.map((item:typeof source)=>({...item,config:{...item.config}}))}});await flush();
 expect(view.container.querySelector('.ppp-additional-source-row .ppp-path-field input')).toBe(input);expect(input.value).toBe('private folder');expect([input.selectionStart,input.selectionEnd]).toEqual([1,4]);await fireEvent.click(save(view.container));expect(view.onSave.mock.calls[0][0].additionalSources[0].config.path).toBe('private folder');
});

test("Save preserves an edited name after the same project's older prop is echoed",async()=>{
 const project=makeProject(),view=mount(project);await flush();const input=inputFor(view.container,'modals.project.name.name');await enter(input);typeInto(input,'Private name');await flush();view.component.$set({project:{...project}});await flush();
 expect(input.value).toBe('Private name');expect(inputFor(view.container,'modals.project.name.name')).toBe(input);await fireEvent.click(save(view.container));expect(view.onSave.mock.calls[0][0].name).toBe('Private name');
});

test("Save preserves an edited DQL draft after an older project prop is echoed",async()=>{
 require('src/lib/stores/capabilities').capabilities.set({dataview:true});const project=dqlProject(),view=mount(project as any);await flush();const input=view.container.querySelector('textarea')!;input.focus();typeQuery(input,'LIST FROM #private');await flush();view.component.$set({project:{...project}});await flush();
 expect(input.value).toBe('LIST FROM #private');await fireEvent.click(save(view.container));expect(view.onSave.mock.calls[0][0].dataSource.config.query).toBe('LIST FROM #private');
});

test("Save validates the current custom date draft after an older invalid prop is echoed",async()=>{
 const project={...makeProject(),dateFormat:{preset:'custom',writeFormat:'',includeTime:true}},view=mount(project as any);await flush();const input=inputFor(view.container,'modals.date-format.custom.name');await enter(input);typeInto(input,'DD.MM.YYYY');await flush();view.component.$set({project:{...project,dateFormat:{...project.dateFormat}}});await flush();
 expect(input.value).toBe('DD.MM.YYYY');await fireEvent.click(save(view.container));expect(view.onSave).toHaveBeenCalledTimes(1);expect(view.onSave.mock.calls[0][0].dateFormat.writeFormat).toBe('DD.MM.YYYY');
});

test("an untouched date input cannot authorize saving a newly invalid parent value",async()=>{
 const project={...makeProject(),dateFormat:{preset:'custom',writeFormat:'YYYY-MM-DD',includeTime:true}},view=mount(project as any);await flush();const input=inputFor(view.container,'modals.date-format.custom.name');await enter(input);
 view.component.$set({project:{...project,dateFormat:{...project.dateFormat,writeFormat:''}}});await flush();await fireEvent.click(save(view.container));expect(view.onSave).not.toHaveBeenCalled();
});

test("a legacy name keeps its draft and row through an older immutable parent snapshot",async()=>{
 const project={...makeProject(),additionalSources:[{name:'Legacy',kind:'folder',config:{path:'Notes',recursive:false}}]},view=mount(project as any);await flush();const input=view.container.querySelector<HTMLInputElement>('.ppp-additional-source-row input')!;await enter(input);typeInto(input,'Private');await flush();
 view.component.$set({project:{...project,additionalSources:[{config:{recursive:false,path:'Notes'},kind:'folder',name:'Legacy'}]}});await flush();expect(view.container.querySelector('.ppp-additional-source-row input')).toBe(input);expect(input.value).toBe('Private');
 view.component.$set({project:{...project,additionalSources:[{name:'Private',kind:'folder',config:{path:'Notes',recursive:false}}]}});await flush();expect(view.container.querySelector('.ppp-additional-source-row input')).toBe(input);await fireEvent.click(save(view.container));expect(view.onSave.mock.calls[0][0].additionalSources[0].name).toBe('Private');
});

test("a condition keeps its edited field through an older immutable parent snapshot",async()=>{
 const project={...makeProject(),dataSource:{id:'source-id',kind:'native-query',config:{from:{kind:'folder',path:'Notes',recursive:false},where:{conjunction:'and',conditions:[{field:'original',operator:'is',enabled:true,value:'a'}]}}}},view=mount(project as any);await flush();const input=view.container.querySelector<HTMLInputElement>('.ppp-nq-condition-row input')!;await enter(input);typeInto(input,'Private');await flush();
 view.component.$set({project:JSON.parse(JSON.stringify(project))});await flush();expect(view.container.querySelector('.ppp-nq-condition-row input')).toBe(input);expect(input.value).toBe('Private');await fireEvent.click(save(view.container));expect(view.onSave.mock.calls[0][0].dataSource.config.where.conditions[0].field).toBe('Private');
});

test("a replacement Dataview source with the same query retires the old source's preview",async()=>{
 jest.useFakeTimers();require('src/lib/stores/capabilities').capabilities.set({dataview:true});const pending:Array<(value:unknown)=>void>=[];mockDataview.query.mockImplementation(()=>new Promise(resolve=>pending.push(resolve)));
 const project=dqlProject(),view=mount(project as any);await flush();const input=view.container.querySelector('textarea')!;input.focus();typeQuery(input,'LIST FROM #pending');await flush();jest.advanceTimersByTime(650);await flush();expect(pending).toHaveLength(1);
 view.component.$set({project:{...project,dataSource:{...project.dataSource,id:'replacement-source',config:{query:'LIST FROM #pending'}}}});await flush();pending[0]!({successful:false});await flush();expect(view.container.querySelector('.ppp-dv-preview')).toBeNull();
});

test("replacing a source retires its textarea draft while minting a legacy id retains the original input",async()=>{
 require('src/lib/stores/capabilities').capabilities.set({dataview:true});const project=dqlProject(),view=mount(project as any);await flush();const old=view.container.querySelector('textarea')!;old.focus();typeQuery(old,'LIST FROM #private');await flush();
 view.component.$set({project:{...project,dataSource:{...project.dataSource,id:'replacement',config:{query:'LIST FROM #replacement'}}}});await flush();const current=view.container.querySelector('textarea')!;expect(current).not.toBe(old);expect(current.value).toBe('LIST FROM #replacement');old.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));await fireEvent.click(save(view.container));expect(view.onSave.mock.calls[0][0].dataSource.config.query).toBe('LIST FROM #replacement');view.unmount();
 const {id:_id,...source}=project.dataSource,legacy=mount({...project,dataSource:source} as any);await flush();const input=legacy.container.querySelector('textarea')!;input.focus();typeQuery(input,'LIST FROM #mint');await flush();expect(legacy.container.querySelector('textarea')).toBe(input);await fireEvent.click(save(legacy.container));expect(legacy.onSave.mock.calls[0][0].dataSource.id).toEqual(expect.any(String));
});
