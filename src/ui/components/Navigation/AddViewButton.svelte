<script lang="ts">
  import { IconButton } from "obsidian-svelte";

  export let onAdd: () => void;

  function handleClick() {
    console.log('AddViewButton clicked');
    onAdd?.();
  }
</script>

<IconButton
  icon="plus"
  size="md"
  tooltip="Добавить вид"
  onClick={handleClick}
/>
