<script lang="ts">
 import {createEventDispatcher,onDestroy} from "svelte";
 import ValueSuggestField from "./ValueSuggestField.svelte";
 type PathItem={readonly path:string};
 export let value="";
 export let files:readonly PathItem[]=[];
 export let getLabel:(file:PathItem)=>string=file=>file.path;
 export let placeholder="";
 export let ariaLabel:string|undefined=undefined;
 export let width="100%";
 export let autoFocus=false;
 export let readonly=false;
 export let disabled=false;
 export let contextKey="";
 let field:ValueSuggestField,alive=true;
 onDestroy(()=>{alive=false;});
 export function focus():void{field?.focus();}
 export function isComposing():boolean{return field?.isComposing()??false;}
 export function commitForNavigation():boolean{return field?.commitForNavigation()??false;}
 export function syncForSubmit():boolean{return field?.syncForSubmit()??false;}
 const dispatch=createEventDispatcher<{change:string}>();
 $: choices=files.map(file=>({id:file.path,label:getLabel(file),value:file.path}));
 $: change=forOwner(contextKey);
 function forOwner(owner:string){return(event:CustomEvent<string>)=>{if(alive&&!disabled&&!readonly&&owner===contextKey)dispatch("change",event.detail);};}
</script>

<div class="ppp-path-field" style:width>
 {#key JSON.stringify([contextKey,disabled,readonly])}
  <ValueSuggestField bind:this={field} {value} {choices} {placeholder} {ariaLabel} {autoFocus} {disabled} readOnly={readonly} on:commit={change}/>
 {/key}
</div>

<style>
 .ppp-path-field{flex:1;min-width:0;max-width:100%;}
</style>
