<!-- Stand-in for obsidian-svelte SettingItem that renders its slot and keeps the
     field name visible, so a test can tell which fields the editor offers. -->
<script>
  export let name = "";
</script>

<div data-testid="setting-item" data-name={name}><slot /></div>
