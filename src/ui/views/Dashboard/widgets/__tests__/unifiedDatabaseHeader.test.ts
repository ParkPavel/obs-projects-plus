import "@testing-library/jest-dom";
import {render,cleanup} from "@testing-library/svelte";
import {tick} from "svelte";
import {DataFieldType} from "src/lib/dataframe/dataframe";
// Keep the real props builder and real block, repairing only Jest's registry
// re-export interop for a dynamically constructed Svelte component.
jest.mock("../widgetComponentRegistry",()=>{const actual=jest.requireActual("../widgetComponentRegistry");return{...actual,WIDGET_CONTENT:{...actual.WIDGET_CONTENT,"database-call":{...actual.WIDGET_CONTENT['database-call'],component:require('../DatabaseCall/DatabaseCallBlock.svelte').default}}};});
const Host=require("../WidgetHost.svelte").default;
const field={name:"name",type:DataFieldType.String,identifier:true,repeated:false,derived:false,typeConfig:{}};
const frame={fields:[field],records:["Alpha","Beta"].map(name=>({id:name+".md",values:{name}}))};
const makeWidget=(id:string)=>({id,type:"database-call",title:id,layout:{x:0,y:0,w:6,h:5},config:{activeTabId:"first",viewTabs:[{id:"first",viewType:"table",label:"Table",config:{}}]}});
const flush=async()=>{await tick();await tick();await tick();};
const oldObserver=globalThis.IntersectionObserver;
beforeEach(()=>{globalThis.IntersectionObserver=class{constructor(private callback:IntersectionObserverCallback){}observe(target:Element){this.callback([{isIntersecting:true,target} as IntersectionObserverEntry],this as unknown as IntersectionObserver);}disconnect(){}unobserve(){}} as unknown as typeof IntersectionObserver;});
afterEach(()=>{cleanup();globalThis.IntersectionObserver=oldObserver;});
const mount=(id:string)=>render(Host,{props:{widget:makeWidget(id),frame,fields:[field],api:{},readonly:false,getRecordColor:()=>null}});

test("embedded tabs, filters, search and view settings share the header containing the block menu",async()=>{
 const view=mount("one");await flush();const header=view.container.querySelector('.ppp-widget-header')!,controls=view.container.querySelector('.ppp-dbc-head')!;
 expect(header.querySelector('.ppp-widget-menu-btn')).not.toBeNull();expect(controls).not.toBeNull();expect(header.contains(controls)).toBe(true);expect(header.querySelectorAll('.ppp-t2-controlbar')).toHaveLength(1);expect(view.container.querySelector('.ppp-widget-content .ppp-dbc-head')).toBeNull();
});

test("two block headers keep their own search state and retire docked controls on collapse",async()=>{
 const first=mount("one"),second=mount("two");await flush();
 const toolbar=first.container.querySelector<HTMLElement>('.ppp-widget-header .ppp-t2-controlbar');expect(toolbar).not.toBeNull();toolbar!.querySelector<HTMLButtonElement>('.ppp-t2-cb-btn')!.click();await flush();const input=toolbar!.querySelector<HTMLInputElement>('input')!;input.focus();input.value='Al';input.dispatchEvent(new Event('input',{bubbles:true}));await flush();input.setSelectionRange(1,2);
 first.component.$set({frame:{...frame,records:[...frame.records]}});await flush();expect(toolbar!.querySelector('input')).toBe(input);expect(document.activeElement).toBe(input);expect(first.container.querySelectorAll('.ppp-t2-row')).toHaveLength(1);expect(second.container.querySelectorAll('.ppp-t2-row')).toHaveLength(2);
 first.component.$set({widget:{...makeWidget('one'),collapsed:true}});await flush();expect(input.isConnected).toBe(false);expect(first.container.querySelector('.ppp-dbc-head')).toBeNull();expect(second.container.querySelector('.ppp-widget-header .ppp-t2-controlbar')).not.toBeNull();
});
