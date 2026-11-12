<script lang="ts">
  import type { App, TFile } from "obsidian";
  import type { InverseIndexStore } from "src/lib/relations/inverseIndexStore";
  import NotePropertiesSession from "./NotePropertiesSession.svelte";

  export let app: App;
  export let file: TFile;
  export let readonly = false;
  export let inverseIndexStore: InverseIndexStore | undefined = undefined;
</script>

<!-- A draft, open menu or picker belongs to one app/file interaction. Fresh
     metadata/file objects of the same path preserve the original input. -->
{#key app}
  {#key file.path}
    <NotePropertiesSession {app} {file} {inverseIndexStore} {readonly} />
  {/key}
{/key}
