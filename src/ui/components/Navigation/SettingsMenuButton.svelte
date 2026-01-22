<script lang="ts">
  import { IconButton } from "obsidian-svelte";

  export let onOpen: (event: MouseEvent) => void;

  function handleClick(event: MouseEvent) {
    console.log('SettingsMenuButton clicked', event);
    onOpen?.(event);
  }
</script>

<IconButton
  icon="settings"
  size="md"
  tooltip="Настройки"
  onClick={handleClick}
/>
