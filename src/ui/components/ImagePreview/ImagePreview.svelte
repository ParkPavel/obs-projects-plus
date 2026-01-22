<script lang="ts">
  import { Icon } from 'obsidian-svelte';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{ remove: void }>();

  /**
   * Image URL or Obsidian internal link
   */
  export let src: string = '';
  
  /**
   * Alternative text
   */
  export let alt: string = 'Image preview';
  
  /**
   * Allow removing the image
   */
  export let removable: boolean = false;
  
  /**
   * Compact mode (smaller preview)
   */
  export let compact: boolean = false;
  
  /**
   * Aspect ratio (default: 16/9 for banners)
   */
  export let aspectRatio: string = '16 / 9';

  let imageLoaded = false;
  let imageError = false;
  
  function handleLoad() {
    imageLoaded = true;
    imageError = false;
  }
  
  function handleError() {
    imageError = true;
    imageLoaded = false;
  }
  
  function handleRemove() {
    dispatch('remove');
  }
  
  // Check if it's an Obsidian internal link
  $: isObsidianLink = src.startsWith('[[') && src.endsWith(']]');
  $: displaySrc = isObsidianLink ? src.slice(2, -2) : src;
</script>

<div class="image-preview" class:compact class:has-image={src && !imageError}>
  {#if src && !imageError}
    <div class="preview-container" style:aspect-ratio={aspectRatio}>
      {#if !imageLoaded}
        <div class="preview-loading">
          <Icon name="image" size="lg" />
          <span>Loading...</span>
        </div>
      {/if}
      
      <img
        {src}
        {alt}
        on:load={handleLoad}
        on:error={handleError}
        class:loaded={imageLoaded}
      />
      
      {#if removable}
        <button class="remove-button" on:click={handleRemove} aria-label="Remove image">
          <Icon name="x" size="sm" />
        </button>
      {/if}
    </div>
    
    {#if displaySrc}
      <div class="preview-caption">
        <Icon name="link" size="xs" />
        <span>{displaySrc}</span>
      </div>
    {/if}
  {:else if imageError}
    <div class="preview-error">
      <Icon name="alert-circle" size="lg" />
      <span>Failed to load image</span>
      {#if removable}
        <button class="text-button" on:click={handleRemove}>Remove</button>
      {/if}
    </div>
  {:else}
    <div class="preview-empty">
      <Icon name="image" size="lg" />
      <span>No image</span>
    </div>
  {/if}
</div>

<style>
  .image-preview {
    width: 100%;
    border-radius: var(--radius-m);
    overflow: hidden;
    background: var(--background-secondary);
    border: 0.0625rem solid var(--background-modifier-border);
  }
  
  .image-preview.compact {
    max-width: 300px;
  }
  
  .preview-container {
    position: relative;
    width: 100%;
    overflow: hidden;
    background: var(--background-modifier-hover);
  }
  
  .preview-container img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  
  .preview-container img.loaded {
    opacity: 1;
  }
  
  .preview-loading {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: var(--text-muted);
    font-size: 0.875rem;
  }
  
  .remove-button {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    min-width: 2.5rem;
    min-height: 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    cursor: pointer;
    opacity: 0;
    transition: all 0.2s ease;
  }
  
  .preview-container:hover .remove-button {
    opacity: 1;
  }
  
  .remove-button:hover {
    background: var(--text-error);
    transform: scale(1.1);
  }
  
  .preview-caption {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--background-secondary-alt);
    color: var(--text-muted);
    font-size: 0.75rem;
    font-family: var(--font-monospace);
    border-top: 0.0625rem solid var(--background-modifier-border);
  }
  
  .preview-caption span {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .preview-empty,
  .preview-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 2rem 1rem;
    color: var(--text-muted);
    font-size: 0.875rem;
  }
  
  .preview-error {
    color: var(--text-error);
  }
  
  .text-button {
    padding: 0.5rem 0.75rem;
    min-height: 2.5rem;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .text-button:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }
  
  /* Mobile responsive styles */
  @media (max-width: 48em) {
    .image-preview.compact {
      max-width: 100%;
    }
    
    .remove-button {
      min-width: 2.75rem;
      min-height: 2.75rem;
      top: 0.375rem;
      right: 0.375rem;
      opacity: 0.9;
    }
    
    .remove-button:active {
      transform: scale(0.95);
    }
    
    .preview-caption {
      padding: 0.375rem 0.5rem;
      font-size: 0.6875rem;
    }
    
    .preview-empty,
    .preview-error {
      padding: 1.5rem 0.75rem;
      font-size: 0.8125rem;
    }
    
    .text-button {
      padding: 0.5rem 0.75rem;
      font-size: 0.6875rem;
      min-height: 2.75rem;
    }
  }
</style>
