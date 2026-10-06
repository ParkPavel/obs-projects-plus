<script lang="ts">
  /**
   * Test stand-in for WidgetHost: the same outer shape WidgetShell renders (a host
   * with a header that carries the grip, then the content), without the registry,
   * stores and widgets behind the real one.
   */
  export let widget: { id: string };
  export let reorderable = false;
  void $$restProps;
</script>

<div class="ppp-widget-host" data-widget={widget.id}>
  <div class="ppp-widget-header">
    {#if reorderable}
      <div class="ppp-widget-grip" role="button" tabindex="0" aria-label="grip"></div>
    {/if}
    <span class="ppp-widget-title">{widget.id}</span>
  </div>
  <div class="ppp-widget-content">content of {widget.id}</div>
</div>
