<script lang="ts">
  /**
   * #192 / S8 — a component whose only job is to report one fact.
   *
   * Does Svelte 3.59.2 still have the element in its parent when an action's
   * `destroy` runs? `AgendaSidebar.svelte:525-531` moves the node back to its
   * original parent inside `destroy`, and whether that line is live code or
   * dead code depends entirely on the answer. The plan says to measure it, so
   * this measures it instead of reading the framework's source and inferring.
   */
  export let report: (parentTag: string | null) => void;

  function watchDestroy(node: HTMLElement) {
    return {
      destroy() {
        report(node.parentElement?.tagName ?? null);
      },
    };
  }
</script>

<div class="probe" use:watchDestroy>probe</div>
