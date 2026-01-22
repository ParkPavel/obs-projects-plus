<!--
  ErrorBoundary.svelte
  
  Error boundary component for graceful error handling in Svelte.
  Catches errors during rendering and displays a fallback UI.
  
  Usage:
  <ErrorBoundary>
    <ComponentThatMightFail />
  </ErrorBoundary>
  
  With custom fallback:
  <ErrorBoundary>
    <ComponentThatMightFail />
    <div slot="fallback" let:error let:reset>
      <p>Error: {error.message}</p>
      <button on:click={reset}>Try again</button>
    </div>
  </ErrorBoundary>
-->
<script lang="ts">
  import { createEventDispatcher, setContext } from 'svelte';
  import { i18n } from '../../../lib/stores/i18n';
  
  /** Optional error handler callback */
  export let onError: ((error: Error, errorInfo?: string) => void) | undefined = undefined;
  
  /** Component name for debugging */
  export let componentName: string = 'Unknown';
  
  /** Whether to show error details in development */
  export let showDetails: boolean = false;
  
  const dispatch = createEventDispatcher<{
    error: { error: Error; componentName: string };
    reset: void;
  }>();
  
  let hasError = false;
  let error: Error | null = null;
  let errorInfo: string = '';
  
  $: fallbackTitle = $i18n.t('errors.boundary.title') ?? 'Something went wrong';
  $: fallbackMessage = $i18n.t('errors.boundary.message') ?? 'An error occurred while rendering this component.';
  $: retryLabel = $i18n.t('errors.boundary.retry') ?? 'Try again';
  $: detailsLabel = $i18n.t('errors.boundary.details') ?? 'Error details';
  
  function handleError(e: Error, info?: string) {
    hasError = true;
    error = e;
    errorInfo = info ?? e.stack ?? '';
    
    // Log error in development
    if (process.env['NODE_ENV'] !== 'production') {
      console.error(`[ErrorBoundary] Error in ${componentName}:`, e);
      if (info) {
        console.error('[ErrorBoundary] Error info:', info);
      }
    }
    
    // Call external error handler if provided
    if (onError) {
      onError(e, info);
    }
    
    // Dispatch error event
    dispatch('error', { error: e, componentName });
  }
  
  function reset() {
    hasError = false;
    error = null;
    errorInfo = '';
    dispatch('reset');
  }
  
  // v6.5: CRITICAL FIX - Removed global window error listeners
  // Previous implementation captured ALL window errors, causing
  // false positives and UI crashes on unrelated errors.
  // 
  // Svelte doesn't have built-in error boundaries like React.
  // This component now only provides:
  // 1. A fallback UI for hasError state
  // 2. The catchError() method for explicit error handling
  // 3. Child components should call catchError() when needed
  //
  // For proper error handling, wrap risky code in try-catch and call:
  //   import { getContext } from 'svelte';
  //   const errorBoundary = getContext<ErrorBoundary>('errorBoundary');
  //   try { riskyCode(); } catch (e) { errorBoundary?.catchError(e); }
  
  // Provide this error boundary to children via context
  setContext('errorBoundary', { catchError: handleError });
  
  // Expose error handling function for child components
  export function catchError(e: Error, info?: string) {
    handleError(e, info);
  }
</script>

{#if hasError}
  <slot name="fallback" {error} {reset}>
    <div class="error-boundary" role="alert" aria-live="assertive">
      <div class="error-boundary-content">
        <div class="error-icon" aria-hidden="true">⚠️</div>
        <h3 class="error-title">{fallbackTitle}</h3>
        <p class="error-message">{fallbackMessage}</p>
        
        {#if showDetails && error}
          <details class="error-details">
            <summary>{detailsLabel}</summary>
            <div class="error-stack">
              <p><strong>Component:</strong> {componentName}</p>
              <p><strong>Error:</strong> {error.message}</p>
              {#if errorInfo}
                <pre>{errorInfo}</pre>
              {/if}
            </div>
          </details>
        {/if}
        
        <button 
          class="error-retry-button" 
          on:click={reset}
          aria-label={retryLabel}
        >
          {retryLabel}
        </button>
      </div>
    </div>
  </slot>
{:else}
  <slot />
{/if}

<style>
  .error-boundary {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 120px;
    padding: var(--size-4-4);
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
  }
  
  .error-boundary-content {
    text-align: center;
    max-width: 400px;
  }
  
  .error-icon {
    font-size: 2rem;
    margin-bottom: var(--size-4-2);
  }
  
  .error-title {
    margin: 0 0 var(--size-4-2) 0;
    font-size: var(--font-ui-medium);
    font-weight: var(--font-semibold);
    color: var(--text-normal);
  }
  
  .error-message {
    margin: 0 0 var(--size-4-4) 0;
    font-size: var(--font-ui-small);
    color: var(--text-muted);
  }
  
  .error-details {
    margin-bottom: var(--size-4-4);
    text-align: left;
  }
  
  .error-details summary {
    cursor: pointer;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
  }
  
  .error-stack {
    margin-top: var(--size-4-2);
    padding: var(--size-4-2);
    background: var(--background-primary);
    border-radius: var(--radius-s);
    font-size: var(--font-ui-smaller);
    overflow-x: auto;
  }
  
  .error-stack p {
    margin: 0 0 var(--size-4-1) 0;
    color: var(--text-muted);
  }
  
  .error-stack pre {
    margin: var(--size-4-2) 0 0 0;
    padding: var(--size-4-2);
    background: var(--background-modifier-code-block);
    border-radius: var(--radius-s);
    font-family: var(--font-monospace);
    font-size: var(--font-smallest);
    white-space: pre-wrap;
    word-break: break-all;
    color: var(--text-muted);
  }
  
  .error-retry-button {
    padding: var(--size-4-2) var(--size-4-4);
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: var(--radius-s);
    font-size: var(--font-ui-small);
    cursor: pointer;
    transition: background-color 0.15s ease;
  }
  
  .error-retry-button:hover {
    background: var(--interactive-accent-hover);
  }
  
  .error-retry-button:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
  }
</style>
