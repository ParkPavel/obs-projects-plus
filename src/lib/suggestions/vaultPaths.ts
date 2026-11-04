import type {App,TFile,TFolder} from "obsidian";
import {readable,type Readable} from "svelte/store";
import {isTFile,isTFolder} from "src/lib/obsidian";

export interface VaultPaths { readonly files:readonly TFile[]; readonly folders:readonly TFolder[] }
const empty:VaultPaths={files:[],folders:[]};
const idle=readable(empty),sources=new WeakMap<App,Readable<VaultPaths>>();

/** One permitted vault-path pool per app, subscribed only while a picker lives. */
export function vaultPathSource(owner:App|undefined):Readable<VaultPaths>{
 if(!owner)return idle;
 const existing=sources.get(owner);if(existing)return existing;
 const source=readable(empty,set=>{
  let alive=true,timer:number|undefined;
  const refresh=()=>{
   timer=undefined;if(!alive)return;
   const loaded=owner.vault.getAllLoadedFiles(),root=owner.vault.getRoot();
   set({files:loaded.filter(isTFile),folders:loaded.filter(isTFolder).filter(folder=>folder!==root)});
  };
  const schedule=()=>{if(timer!==undefined)window.clearTimeout(timer);timer=window.setTimeout(refresh,100);};
  const refs=[owner.vault.on("create",schedule),owner.vault.on("delete",schedule),owner.vault.on("rename",schedule)];
  refresh();
  return()=>{alive=false;if(timer!==undefined)window.clearTimeout(timer);for(const ref of refs)owner.vault.offref(ref);};
 });
 sources.set(owner,source);return source;
}
