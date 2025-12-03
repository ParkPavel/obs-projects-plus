<script lang="ts">
  import { Button, Icon, Popover } from "obsidian-svelte";
  import { Flair } from "src/ui/components/Flair";

  export let icon: string;
  export let count: number;
  export let disabled: boolean;
  export let label: string = "";

  let ref: HTMLButtonElement;
  let isOpen: boolean = false;
</script>

<Button
  bind:ref
  on:click={() => {
    isOpen = !isOpen;
  }}
  {disabled}
  tooltip={label}
>
  <Icon name={icon} />
  {#if count}
    <Flair variant="primary">{count}</Flair>
  {/if}
</Button>
<Popover
  className={"projects--popover"}
  anchorEl={ref}
  open={isOpen}
  onClose={() => {
    isOpen = false;
  }}
  placement="auto"
>
  <slot />
</Popover>
