<!--
  FloatingPopup.svelte — the only popup engine in the plugin.

  Spec:    .ai_internal/New-specification/POPUP_PATTERN_GUIDE.md (#034 / #040).
  Ticket:  #034.1 — Popup standardisation, Phase 4 (DEMOLISH zone, absorbs #040).

  Contract:
    - `triggerEl` HTMLElement is the anchor. If null at mount, no positioning.
    - `open` controls visibility (two-way bind supported via dispatch('close')).
    - Desktop: fixed position with flip + clamp inside viewport.
    - Mobile (`$isMobile`): bottom sheet with backdrop.
    - Close paths: Escape, outside-mousedown, optional close-on-inner-click.
    - Focus: traps Tab inside popup, restores to trigger on close.

  All sizes in rem.
-->
<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy, tick } from "svelte";
  import { isMobile } from "src/lib/stores/ui";

  // ── Public types ───────────────────────────────────────────
  type PopupPlacement =
    | "bottom-start"
    | "bottom-end"
    | "top-start"
    | "top-end"
    | "right-start"
    | "left-start";

  // ── Props ──────────────────────────────────────────────────

  /** Element-anchor the popup positions relative to. May be null for programmatic open. */
  export let triggerEl: HTMLElement | null = null;

  /** Popup open. */
  export let open: boolean = false;

  /** Preferred placement; flip kicks in when no space. */
  export let placement: PopupPlacement = "bottom-start";

  /** Gap from trigger in rem (default 0.25rem). */
  export let offsetRem: number = 0.25;

  /** Close when a click lands inside the popup (action menus). */
  export let closeOnInnerClick: boolean = false;

  /** ARIA role. */
  export let role: "menu" | "listbox" | "dialog" | "tooltip" = "dialog";

  /** Accessible label for the popup container. */
  export let ariaLabel: string = "";

  // ── Internal ───────────────────────────────────────────────
  const dispatch = createEventDispatcher<{ close: void }>();

  let popupEl: HTMLDivElement | null = null;
  let style = "";

  // Track previous open to fire focus-restore exactly once on close.
  let wasOpen = false;

  // ── Reactive position + focus ──────────────────────────────
  $: if (open && popupEl && triggerEl) {
    void recompute();
  }

  // Focus management — when popup opens, focus first interactive.
  $: if (open && !wasOpen) {
    wasOpen = true;
    void focusFirst();
  } else if (!open && wasOpen) {
    wasOpen = false;
    // Restore focus to trigger (it owned focus before opening).
    if (triggerEl && typeof triggerEl.focus === "function") {
      triggerEl.focus();
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────
  onMount(() => {
    document.addEventListener("keydown", handleKeydown, true);
    document.addEventListener("mousedown", handleOutsideMouseDown, true);
  });

  onDestroy(() => {
    document.removeEventListener("keydown", handleKeydown, true);
    document.removeEventListener("mousedown", handleOutsideMouseDown, true);
  });

  // ── Positioning ────────────────────────────────────────────
  async function recompute(): Promise<void> {
    // Wait one tick so the popup is laid out and we can measure.
    await tick();
    if (!open || !popupEl || !triggerEl) return;

    const tRect = triggerEl.getBoundingClientRect();
    const pRect = popupEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const baseFontPx = parseFloat(
      getComputedStyle(document.documentElement).fontSize || "16"
    );
    const offsetPx = offsetRem * baseFontPx;
    const marginPx = 0.5 * baseFontPx;

    const positions: Record<PopupPlacement, { top: number; left: number }> = {
      "bottom-start": { top: tRect.bottom + offsetPx, left: tRect.left },
      "bottom-end": { top: tRect.bottom + offsetPx, left: tRect.right - pRect.width },
      "top-start": { top: tRect.top - pRect.height - offsetPx, left: tRect.left },
      "top-end": { top: tRect.top - pRect.height - offsetPx, left: tRect.right - pRect.width },
      "right-start": { top: tRect.top, left: tRect.right + offsetPx },
      "left-start": { top: tRect.top, left: tRect.left - pRect.width - offsetPx },
    };

    let { top, left } = positions[placement];

    // Flip vertically.
    if (placement.startsWith("bottom") && top + pRect.height > vh - marginPx) {
      const flipped = tRect.top - pRect.height - offsetPx;
      if (flipped >= marginPx) top = flipped;
    } else if (placement.startsWith("top") && top < marginPx) {
      const flipped = tRect.bottom + offsetPx;
      if (flipped + pRect.height <= vh - marginPx) top = flipped;
    }

    // Flip horizontally for left/right.
    if (placement === "right-start" && left + pRect.width > vw - marginPx) {
      const flipped = tRect.left - pRect.width - offsetPx;
      if (flipped >= marginPx) left = flipped;
    } else if (placement === "left-start" && left < marginPx) {
      const flipped = tRect.right + offsetPx;
      if (flipped + pRect.width <= vw - marginPx) left = flipped;
    }

    // Clamp inside viewport.
    const clampedLeft = Math.min(
      Math.max(left, marginPx),
      Math.max(marginPx, vw - pRect.width - marginPx)
    );
    const clampedTop = Math.min(
      Math.max(top, marginPx),
      Math.max(marginPx, vh - pRect.height - marginPx)
    );

    style = `top: ${clampedTop}px; left: ${clampedLeft}px;`;
  }

  async function focusFirst(): Promise<void> {
    await tick();
    if (!popupEl) return;
    const first = popupEl.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    first?.focus();
  }

  // ── Event handlers ─────────────────────────────────────────
  function handleKeydown(e: KeyboardEvent): void {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      requestClose();
      return;
    }
    if (e.key === "Tab" && popupEl) {
      const focusable = Array.from(
        popupEl.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    }
    if (role === "menu" && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End")) {
      if (!popupEl) return;
      const items = Array.from(
        popupEl.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')
      );
      if (items.length === 0) return;
      e.preventDefault();
      const current = items.indexOf(document.activeElement as HTMLElement);
      let next = current;
      if (e.key === "ArrowDown") next = current < 0 ? 0 : (current + 1) % items.length;
      if (e.key === "ArrowUp") next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length;
      if (e.key === "Home") next = 0;
      if (e.key === "End") next = items.length - 1;
      items[next]?.focus();
    }
  }

  function handleOutsideMouseDown(e: MouseEvent): void {
    if (!open) return;
    const target = e.target as Node | null;
    if (!target) return;
    if (popupEl && popupEl.contains(target)) return;
    // Don't auto-close on trigger — let the trigger handle toggle.
    if (triggerEl && triggerEl.contains(target)) return;
    requestClose();
  }

  function handleInnerClick(): void {
    if (closeOnInnerClick) requestClose();
  }

  function requestClose(): void {
    open = false;
    dispatch("close");
  }
</script>

{#if open}
  {#if $isMobile}
    <!-- ── MOBILE: Bottom Sheet ──────────────────────────── -->
    <div
      class="ppp-popup-backdrop"
      role="presentation"
      on:mousedown|self={requestClose}
    >
      <div
        bind:this={popupEl}
        class="ppp-popup ppp-popup--bottom-sheet"
        {role}
        aria-label={ariaLabel || undefined}
        aria-modal="true"
        on:click={handleInnerClick}
      >
        <div class="ppp-bottom-sheet-handle" aria-hidden="true"></div>
        <slot />
      </div>
    </div>
  {:else}
    <!-- ── DESKTOP: Floating popup ───────────────────────── -->
    <div
      bind:this={popupEl}
      class="ppp-popup ppp-popup--floating"
      {style}
      {role}
      aria-label={ariaLabel || undefined}
      on:click={handleInnerClick}
    >
      <slot />
    </div>
  {/if}
{/if}

<style>
  .ppp-popup--floating {
    position: fixed;
    z-index: var(--ppp-z-popover, 50);
    min-width: var(--ppp-popup-min-w, 12rem);
    max-width: var(--ppp-popup-max-w, 24rem);
    background: var(--background-primary);
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--ppp-radius-xl, 0.5rem);
    box-shadow: var(--ppp-shadow-lg, 0 0.25rem 0.5rem rgba(0, 0, 0, 0.15));
    padding: var(--ppp-space-4, 0.5rem);
    animation: ppp-popup-in var(--ppp-duration-fast, 100ms) var(--ppp-ease-out, cubic-bezier(0, 0, 0.2, 1)) forwards;
  }

  @keyframes ppp-popup-in {
    from { opacity: 0; transform: scale(0.95); }
    to   { opacity: 1; transform: scale(1); }
  }

  .ppp-popup-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--ppp-z-overlay, 49);
    background: rgba(0, 0, 0, 0.3);
    animation: ppp-backdrop-in var(--ppp-duration-fast, 100ms) var(--ppp-ease-out, cubic-bezier(0, 0, 0.2, 1)) forwards;
  }

  @keyframes ppp-backdrop-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .ppp-popup--bottom-sheet {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: var(--ppp-bottom-sheet-max-h, 85vh);
    overflow-y: auto;
    background: var(--background-primary);
    border-radius: var(--ppp-bottom-sheet-radius, 1rem 1rem 0 0);
    box-shadow: 0 -0.25rem 1rem rgba(0, 0, 0, 0.2);
    padding: var(--ppp-space-4, 0.5rem);
    animation: ppp-sheet-in var(--ppp-duration-fast, 100ms) var(--ppp-ease-out, cubic-bezier(0, 0, 0.2, 1)) forwards;
  }

  @keyframes ppp-sheet-in {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }

  .ppp-bottom-sheet-handle {
    width: var(--ppp-bottom-sheet-handle-w, 2.5rem);
    height: var(--ppp-bottom-sheet-handle-h, 0.25rem);
    background: var(--background-modifier-border);
    border-radius: var(--ppp-radius-full, 9999px);
    margin: 0 auto var(--ppp-space-4, 0.5rem);
  }
</style>
