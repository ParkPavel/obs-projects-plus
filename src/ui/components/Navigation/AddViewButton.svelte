<script lang="ts">
  import IconButton from "src/ui/components/IconButton/IconButton.svelte";
  import { i18n } from "src/lib/stores/i18n";

  export let onAdd: (event: MouseEvent) => void;

  function handleClick(event: MouseEvent) {
    onAdd?.(event);
  }
</script>

<IconButton
  icon="plus"
  size="md"
  tooltip={$i18n.t('settings-menu.views.add-view')}
  onClick={handleClick}
/>
