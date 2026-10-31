<script lang="ts">
  export let onEdit: (editing: boolean) => void;
  export let onColumnAdd: (name: string) => void;
  export let fieldError: string;
  export let onValidate: (name: string) => boolean;

  $: void onEdit;
  $: void onColumnAdd;
  $: void fieldError;
  $: void onValidate;
</script>

<div data-board-new-column-stub></div>
