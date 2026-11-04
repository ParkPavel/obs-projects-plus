<script lang="ts">
  import { Button } from "obsidian-svelte";
  import {onDestroy,tick} from "svelte";
  import type {App} from "obsidian";
  import IconButton from "src/ui/components/IconButton/IconButton.svelte";
  import PathSuggestField from "src/ui/components/fields/PathSuggestField.svelte";
  import {vaultPathSource} from "src/lib/suggestions/vaultPaths";
  import { app } from "src/lib/stores/obsidian";
  import {i18n} from "src/lib/stores/i18n";

  export let paths: string[];
  export let onPathsChange: (value: string[]) => void;
  export let buttonText: string;
  export let contextKey="";
  export let disabled=false;
  type Row={id:number;path:string};
  let nextId=0,alive=true;
  const makeRows=(values:string[]):Row[]=>values.map(path=>({id:nextId++,path}));
  const equal=(a:string[],b:string[])=>a.length===b.length&&a.every((value,index)=>value===b[index]);
  let rows=makeRows(paths),saved=[...paths],source=paths,sourceValues=[...paths];
  let owner=contextKey,writer=onPathsChange,locked=disabled,ownerApp:App|undefined=$app;
  let fields:Record<string,PathSuggestField|null|undefined>={};
  export function commitForNavigation():boolean {
    if(!alive||disabled||Object.values(fields).some(field=>field?.isComposing()))return false;
    return Object.values(fields).every(field=>!field||field.commitForNavigation());
  }
  $: pathSource=vaultPathSource($app);
  function sync(values:string[],key:string,callback:typeof onPathsChange,isLocked:boolean,nextApp:App|undefined){
    if(owner!==key||writer!==callback||locked!==isLocked||ownerApp!==nextApp){rows=makeRows(values);saved=[...values];}
    else if((values!==source||!equal(values,sourceValues))&&!equal(values,saved)){rows=makeRows(values);saved=[...values];}
    source=values;sourceValues=[...values];owner=key;writer=callback;locked=isLocked;ownerApp=nextApp;
  }
  $: sync(paths,contextKey,onPathsChange,disabled,$app);
  const refresh=()=>sync(paths,contextKey,onPathsChange,disabled,$app);
  function publish(next:Row[]){
    if(!alive||disabled)return;rows=next;
    const values=next.map(row=>row.path);if(equal(values,saved))return;
    saved=[...values];onPathsChange(values);
  }
  function change(id:number,path:string){refresh();if(!rows.some(row=>row.id===id))return;publish(rows.map(row=>row.id===id?{...row,path}:row));}
  function remove(id:number){
    refresh();if(fields[String(id)]?.isComposing()||!rows.some(row=>row.id===id))return;
    publish(rows.filter(row=>row.id!==id));void tick().then(()=>{if(alive)delete fields[String(id)];});
  }
  function add(){refresh();if(Object.values(fields).some(field=>field?.isComposing()))return;publish([...rows,{id:nextId++,path:""}]);}
  onDestroy(()=>{alive=false;fields={};});
</script>

{#each rows as row (row.id)}
  <div>
    <PathSuggestField
      bind:this={fields[String(row.id)]}
      value={row.path}
      files={$pathSource.files}
      {disabled}
      contextKey={JSON.stringify([contextKey,row.id])}
      ariaLabel={buttonText}
      on:change={({detail})=>change(row.id,detail)}
    />
    <IconButton
      icon="x"
      tooltip={`${$i18n.t("common.remove")}: ${row.path}`}
      {disabled}
      onClick={()=>remove(row.id)}
    />
  </div>
{/each}

<Button
  {disabled}
  on:click={add}>{buttonText}</Button
>

<style>
  div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem;
    padding-bottom: 0.25rem;
    width: 100%;
  }

  div:first-child {
    flex: 1;
  }
</style>
