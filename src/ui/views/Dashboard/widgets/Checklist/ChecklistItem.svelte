<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let item: { id: string; label: string; checked: boolean };
  export let readonly: boolean;

  const dispatch = createEventDispatcher<{ toggle: void }>();
</script>

<li class="ppp-checklist-item" class:ppp-checklist-item--done={item.checked}>
  <label class="ppp-checklist-label">
    <input
      type="checkbox"
      checked={item.checked}
      disabled={readonly}
      on:change={() => dispatch("toggle")}
      class="ppp-checklist-checkbox"
    />
    <span class="ppp-checklist-text" class:ppp-checklist-text--done={item.checked}>
      {item.label}
    </span>
  </label>
</li>

<style>
  .ppp-checklist-item {
    display: flex;
    align-items: center;
    padding: 0.25rem 0.375rem;
    border-radius: var(--radius-s, 0.25rem);
  }

  .ppp-checklist-item:hover {
    background: var(--background-modifier-hover);
  }

  .ppp-checklist-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    cursor: pointer;
  }

  .ppp-checklist-checkbox {
    flex-shrink: 0;
  }

  .ppp-checklist-text {
    font-size: var(--font-ui-small);
    color: var(--text-normal);
  }

  .ppp-checklist-text--done {
    text-decoration: line-through;
    color: var(--text-faint);
  }
</style>
