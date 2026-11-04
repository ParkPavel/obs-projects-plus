<!-- Slot chrome only; actual field controls remain mounted. $$props accepts
     host presentation props without warning or implementing their behavior. -->
<div data-testid="setting-item" data-name={$$props.name}>
  <slot name="header" />
  <slot />
</div>
