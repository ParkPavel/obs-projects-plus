<script lang="ts">
  import type { App, TFile } from "obsidian";
  import { writable } from "svelte/store";
  import { providePaletteProject } from "src/ui/paletteProject";
  import NotePropertiesBlock from "../../NotePropertiesBlock.svelte";
  export let app: App;
  export let file: TFile;
  export let projectId: string;
  const project = writable<string | undefined>(projectId);
  providePaletteProject(project);
  $: project.set(projectId);
</script>

<NotePropertiesBlock {app} {file} />
