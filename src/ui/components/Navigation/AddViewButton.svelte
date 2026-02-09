<script lang="ts">
  import { IconButton } from "obsidian-svelte";

  export let onAdd: () => void;

  function handleClick() {
    console.debug('AddViewButton clicked');
    onAdd?.();
  }
</script>

<IconButton
  icon="plus"
  size="md"
  tooltip="Добавить вид"
  onClick={handleClick}
/>
