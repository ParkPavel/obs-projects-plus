<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  const dispatch = createEventDispatcher<{ change: string }>();

  /**
   * Current time value in HH:mm format
   */
  export let value: string = '12:00';
  
  /**
   * Mobile mode - use native picker with enhanced haptics
   */
  export let isMobile: boolean = false;
  
  // Detect mobile on mount
  onMount(() => {
    if (typeof window !== 'undefined') {
      isMobile = isMobile || window.innerWidth <= 768 || 'ontouchstart' in window;
    }
  });
  
  /**
   * Haptic feedback for mobile
   */
  function triggerHaptic() {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10); // 10ms micro-vibration
    }
  }
  
  function handleChange(e: Event) {
    if (isMobile) {
      triggerHaptic();
    }
    dispatch('change', (e.currentTarget as HTMLInputElement).value);
  }
</script>

<!-- Native time input for both desktop and mobile -->
<div class="time-picker-native" class:mobile={isMobile}>
  <input
    type="time"
    {value}
    on:change={handleChange}
    on:click|stopPropagation
    class="native-time-input"
    aria-label="Time picker"
  />
</div>

<style>
  .time-picker-native {
    width: 100%;
    padding: 0;
    background: transparent;
    border-radius: var(--radius-m);
  }
  
  .time-picker-native.mobile {
    padding: 0;
  }
  
  .native-time-input {
    width: 100%;
    padding: 0.75rem;
    font-size: 1.125rem;
    text-align: center;
    background: var(--background-primary);
    border: 0.125rem solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    color: var(--text-normal);
    font-family: var(--font-monospace);
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .native-time-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 0.125rem rgba(var(--interactive-accent-rgb), 0.2);
  }
  
  .native-time-input:hover {
    border-color: var(--interactive-accent);
  }
  
  /* Mobile responsive styles */
  @media (max-width: 48em) {
    .time-picker-native {
      padding: 0;
    }
    
    .native-time-input {
      font-size: 1rem;
      padding: 0.875rem;
      min-height: 2.75rem;
    }
  }
</style>
