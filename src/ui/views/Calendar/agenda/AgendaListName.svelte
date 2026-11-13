<script lang="ts">
  /**
   * w4-input2 — a list's name is typed where the list lives. «Add list» puts
   * this row at the end of the agenda's lists and «Rename list» puts it in the
   * list's own header, instead of a separate window with a name line.
   *
   * It is the kit TextField (draft, IME, keyboard, tap-outside release), so it
   * commits as every other field does: Enter, ✓ or leaving the field keeps the
   * name; Escape, ✕ or an empty name drops the edit. A name another list
   * already has stays in the field, marked, until it is changed or dropped.
   * The gear hands the typed name to the full list editor (icon, colour,
   * filters) for a new list.
   */
  import { createEventDispatcher, onMount } from 'svelte';
  import { Icon } from 'obsidian-svelte';
  import { i18n } from 'src/lib/stores/i18n';
  import TextField from 'src/ui/components/fields/TextField.svelte';
  import type { AgendaIcon } from 'src/settings/v3/settings';
  import { agendaEmoji } from './agendaEmoji';

  export let name = '';
  export let icon: AgendaIcon = { type: 'lucide', value: 'clipboard-list' };
  /** Names of the other lists; a match is a clash, case aside. */
  export let takenNames: string[] = [];
  /** Offer the full editor (a new list only). */
  export let withSettings = false;

  const dispatch = createEventDispatcher<{ save: string; cancel: void; settings: string }>();

  let field: TextField;
  let text = name;
  let done = false;
  let clash = false;

  $: taken = new Set(takenNames.map(n => n.trim().toLowerCase()));

  onMount(() => field.select());

  function finish(value: string, reason: 'enter' | 'blur') {
    if (done) return;
    const trimmed = value.trim();
    if (trimmed === '') {
      done = true;
      dispatch('cancel');
      return;
    }
    if (taken.has(trimmed.toLowerCase())) {
      clash = true;
      if (reason === 'enter') field.focus();
      return;
    }
    done = true;
    dispatch('save', trimmed);
  }

  function drop() {
    if (done) return;
    done = true;
    dispatch('cancel');
  }

  // The buttons must not take the focus first: a tap that blurred the field
  // would commit it before ✕ could drop it (a touch is held off by the row's
  // data-ppp-field-tools, see releaseOnOutsideTap).
  const hold = (e: Event) => e.preventDefault();
</script>

<div class="agenda-list-name" data-ppp-field-tools>
  <span class="name-icon">
    {#if icon.type === 'emoji'}
      {agendaEmoji(icon.value)}
    {:else}
      <Icon name={icon.value} size="sm" />
    {/if}
  </span>
  <div class="name-field">
    <TextField
      bind:this={field}
      value={name}
      error={clash}
      commitUnchanged
      inputClass="name-input"
      placeholder={$i18n.t('views.calendar.agenda.custom.list-editor.name-placeholder')}
      ariaLabel={$i18n.t('views.calendar.agenda.custom.list-editor.name-label')}
      on:input={(e) => { text = e.detail; clash = false; }}
      on:commit={(e) => finish(e.detail.value, e.detail.reason === 'enter' ? 'enter' : 'blur')}
      on:cancel={drop}
    />
    {#if clash}
      <span class="name-error" role="alert">{$i18n.t('views.calendar.agenda.custom.list-editor.name-exists')}</span>
    {/if}
  </div>
  <button
    class="name-btn name-btn--save clickable-icon"
    aria-label={$i18n.t('views.calendar.agenda.custom.list-editor.create')}
    on:mousedown={hold}
    on:click={() => finish(text, 'enter')}
  >
    <Icon name="check" size="sm" />
  </button>
  {#if withSettings}
    <button
      class="name-btn clickable-icon"
      aria-label={$i18n.t('views.calendar.agenda.custom.edit-list')}
      on:mousedown={hold}
      on:click={() => { if (!done) { done = true; dispatch('settings', text.trim()); } }}
    >
      <Icon name="settings" size="sm" />
    </button>
  {/if}
  <button
    class="name-btn clickable-icon"
    aria-label={$i18n.t('views.calendar.agenda.custom.list-editor.cancel')}
    on:mousedown={hold}
    on:click={drop}
  >
    <Icon name="x" size="sm" />
  </button>
</div>

<style>
  .agenda-list-name {
    display: flex;
    align-items: flex-start;
    gap: var(--ppp-spacing-xs, 0.375rem);
    padding: var(--ppp-spacing-xs, 0.375rem) var(--ppp-spacing-sm, 0.5rem);
    border-left: 0.1875rem solid var(--list-accent, var(--interactive-accent));
    border-radius: var(--radius-s);
    background: var(--background-secondary);
  }

  .name-icon {
    display: flex;
    align-items: center;
    min-height: var(--input-height, 2rem);
    color: var(--list-accent, var(--interactive-accent));
  }

  .name-field {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--ppp-spacing-2xs, 0.25rem);
    min-width: 0;
  }

  .name-field :global(.name-input) {
    width: 100%;
  }

  .name-error {
    color: var(--text-error);
    font-size: var(--font-ui-smaller);
  }

  .name-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: var(--input-height, 2rem);
    flex-shrink: 0;
  }

  .name-btn--save {
    color: var(--interactive-accent);
  }

  @media (pointer: coarse) {
    .name-btn {
      min-width: 2.75rem;
      min-height: 2.75rem;
    }

    .name-icon {
      min-height: 2.75rem;
    }
  }
</style>
