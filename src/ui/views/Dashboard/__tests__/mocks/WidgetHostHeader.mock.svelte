<script>
  export let widget;
  export let reorderable = false;
</script>

<!-- A block with a header, as WidgetShell draws it: the title and a button. -->
<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
<div role="region" data-widget-id={widget.id} data-reorderable={reorderable} tabindex="0">
  <div class="ppp-widget-header"><span class="ppp-widget-title">{widget.title}</span><button type="button" class="menu">⋯</button></div>
</div>
