<script lang="ts">
  import FloatingPopup from "../FloatingPopup.svelte";
  import ComboField from "src/ui/components/fields/ComboField.svelte";
  let open = true;
  let triggerEl: HTMLButtonElement | null = null;
</script>
<button bind:this={triggerEl}>Open</button>
<FloatingPopup bind:open {triggerEl}>
  <ComboField value="" options={[{ id: "a", label: "Alpha" }]} allowCustom />
</FloatingPopup>
