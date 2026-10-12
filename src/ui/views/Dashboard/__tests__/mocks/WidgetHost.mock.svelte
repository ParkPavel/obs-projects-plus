<script>
  export let widget;
  export let reorderable = false;
</script>

<!-- Same intentional focusable region as WidgetShell, the target of creation reveal. -->
<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
<div role="region" data-testid="widget-host" data-widget-id={widget.id} data-reorderable={reorderable} tabindex="0">{widget.title}</div>
