<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Icon } from 'obsidian-svelte';
  import { i18n } from 'src/lib/stores/i18n';
  import type { AgendaIcon } from 'src/settings/v3/settings';
  
  const dispatch = createEventDispatcher<{
    select: AgendaIcon;
    close: void;
  }>();
  
  // i18n helper
  const t = (key: string) => $i18n.t(`views.calendar.agenda.custom.icon-picker.${key}`);
  
  export let currentIcon: AgendaIcon | undefined;
  
  let searchQuery = '';
  
  // Popular Lucide icons for agenda lists
  const lucideIcons = [
    'clipboard', 'clipboard-list', 'clipboard-check', 'clipboard-x',
    'check-circle', 'circle', 'circle-dot', 'target',
    'flame', 'zap', 'star', 'heart', 'bookmark',
    'calendar', 'calendar-clock', 'clock', 'timer',
    'alert-circle', 'alert-triangle', 'info', 'help-circle',
    'inbox', 'archive', 'folder', 'file-text',
    'trending-up', 'trending-down', 'activity', 'bar-chart',
    'tag', 'tags', 'hash', 'at-sign',
    'user', 'users', 'user-check', 'user-plus',
    'home', 'briefcase', 'shopping-cart', 'coffee',
  ];
  
  // Popular emojis for agenda lists
  const emojis = [
    '🔥', '⭐', '💪', '🎯', '⚡', '💎', '🏆', '👑',
    '📋', '📝', '✅', '❌', '⏰', '📅', '🔔', '💡',
    '🚀', '🎉', '🎊', '🎈', '🎁', '🎯', '🔮', '🌟',
    '📌', '📍', '🔗', '⚙️', '🛠️', '🔧', '⚡', '💬',
    '📧', '📬', '📪', '📫', '📮', '📤', '📥', '📦',
    '🎨', '🎭', '🎪', '🎬', '🎵', '🎸', '🎹', '🎤',
  ];
  
  $: filteredLucide = searchQuery
    ? lucideIcons.filter(icon => icon.includes(searchQuery.toLowerCase()))
    : lucideIcons;
    
  $: filteredEmojis = emojis; // Emoji search can be added later
  
  function selectIcon(type: 'lucide' | 'emoji', value: string) {
    const icon: AgendaIcon = { type, value };
    dispatch('select', icon);
  }
  
  function isSelected(type: string, value: string): boolean {
    return currentIcon?.type === type && currentIcon?.value === value;
  }
</script>

<div class="icon-picker-modal">
  <div class="modal-header">
    <h3>Select Icon</h3>
    <button 
      class="close-btn"
      on:click={() => dispatch('close')}
      aria-label="Close"
    >
      <Icon name="x" size="sm" />
    </button>
  </div>
  
  <div class="modal-content">
    <div class="search-box">
      <Icon name="search" size="sm" />
      <input 
        type="text"
        placeholder={t('search-placeholder')}
        bind:value={searchQuery}
      />
    </div>
    
    <div class="icon-section">
      <h4>{t('lucide-tab')}</h4>
      <div class="icon-grid">
        {#each filteredLucide as iconName}
          <button
            class="icon-btn"
            class:selected={isSelected('lucide', iconName)}
            on:click={() => selectIcon('lucide', iconName)}
            title={iconName}
          >
            <Icon name={iconName} size="md" />
          </button>
        {/each}
      </div>
    </div>
    
    <div class="icon-section">
      <h4>{t('emoji-tab')}</h4>
      <div class="icon-grid">
        {#each filteredEmojis as emoji}
          <button
            class="icon-btn emoji"
            class:selected={isSelected('emoji', emoji)}
            on:click={() => selectIcon('emoji', emoji)}
            title={emoji}
          >
            {emoji}
          </button>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .icon-picker-modal {
    display: flex;
    flex-direction: column;
    max-height: 32rem;
    background: var(--background-primary);
    border-radius: var(--radius-m);
    box-shadow: var(--shadow-l);
  }
  
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border-bottom: 0.0625rem solid var(--background-modifier-border);
  }
  
  .modal-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-normal);
  }
  
  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.75rem;
    border: none;
    border-radius: var(--radius-s);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .close-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
  
  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }
  
  .search-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    margin-bottom: 1rem;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--background-primary);
  }
  
  .search-box input {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--text-normal);
    font-size: 0.875rem;
    outline: none;
  }
  
  .icon-section {
    margin-bottom: 1.5rem;
  }
  
  .icon-section h4 {
    margin: 0 0 0.75rem 0;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .icon-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(2.75rem, 1fr));
    gap: 0.375rem;
  }
  
  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 2.75rem;
    min-height: 2.75rem;
    aspect-ratio: 1;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--background-secondary);
    color: var(--text-normal);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .icon-btn.emoji {
    font-size: 1.25rem;
  }
  
  .icon-btn:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }
  
  .icon-btn.selected {
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
    color: var(--text-on-accent);
  }
</style>
