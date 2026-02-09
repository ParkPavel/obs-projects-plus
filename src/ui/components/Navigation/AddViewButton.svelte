<script lang="ts">
  import { IconButton } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";

  export let onAdd: () => void;

  function handleClick() {
    console.debug('AddViewButton clicked');
    onAdd?.();
  }
</script>

<IconButton
  icon="plus"
  size="md"
  tooltip={$i18n.t('settings-menu.views.add-view')}
  onClick={handleClick}
/>
