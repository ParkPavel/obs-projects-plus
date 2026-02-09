<script lang="ts">
  import { IconButton } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";

  export let onOpen: (event: MouseEvent) => void;

  function handleClick(event: MouseEvent) {
    console.debug('SettingsMenuButton clicked', event);
    onOpen?.(event);
  }
</script>

<IconButton
  icon="settings"
  size="md"
  tooltip={$i18n.t('settings-menu.title')}
  onClick={handleClick}
/>
