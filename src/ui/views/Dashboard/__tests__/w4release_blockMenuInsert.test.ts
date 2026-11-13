import { render } from "@testing-library/svelte";
import { tick } from "svelte";
import { Platform } from "obsidian";
const mockMenus: Array<Array<{ title?: string; onClick?: () => void }>> = [];
jest.mock("src/lib/contextMenu", () => ({ openContextMenu: (items: Array<{title?: string}>) => mockMenus.push(items) }));
jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return { i18n: writable({t: (_key: string,o?: {defaultValue?: string}) => o?.defaultValue ?? _key}) };
});
jest.mock("../widgets/WidgetHost.svelte", () => require("./mocks/WidgetHostInsert.mock.svelte"));
const WidgetGrid = require("../WidgetGrid.svelte").default;
const blocks = [
  {id:"a",type:"text",title:"One",config:{}},
  {id:"b",type:"text",title:"Two",config:{}},
];
const mount = (readonly=false) => {
  const view=render(WidgetGrid,{props:{widgets:blocks,dndWidgets:blocks,canDnd:!readonly,readonly,
    frame:{fields:[],records:[]},displayFrame:{fields:[],records:[]},api:{},getRecordColor:()=>null,
    fields:[],tableConfig:undefined,primaryDataTableId:"a",fieldPresets:[],activeFieldPresetId:undefined,
    availableSources:[],rightFrames:new Map(),project:{id:"p",name:"Project"},
  }});
  const inserts:unknown[]=[];
  view.component.$on("insert",(event:CustomEvent)=>inserts.push(event.detail));
  return {view,inserts};
};
afterEach(()=>{ Platform.isPhone=false;document.body.innerHTML="";mockMenus.length=0; });
describe("block menu insertion in a phone's stacked layout",()=>{
  it.each([["Insert block before",1],["Insert block after",2]])("%s inserts at the selected block's boundary",async(title,index)=>{
    Platform.isPhone=true;
    const {view,inserts}=mount();
    await tick();
    view.container.querySelector<HTMLButtonElement>('[data-widget-id="b"] button')!.click();
    const entry=mockMenus.at(-1)?.find(item=>item.title===title);
    expect(entry).toBeDefined();entry?.onClick?.();
    await tick();await tick();
    const text=document.querySelector<HTMLButtonElement>('[data-block-type="text"]');
    expect(text).not.toBeNull();text?.click();
    expect(inserts).toEqual([{type:"text",index}]);
  });
  it("offers no insertion on a read-only page",async()=>{
    Platform.isPhone=true;
    const {view}=mount(true);await tick();
    view.container.querySelector<HTMLButtonElement>('[data-widget-id="b"] button')?.click();
    expect(mockMenus.flat().some(item=>item.title?.startsWith("Insert block"))).toBe(false);
  });
});
