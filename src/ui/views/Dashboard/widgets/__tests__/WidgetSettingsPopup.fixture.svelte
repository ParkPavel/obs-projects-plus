<script lang="ts">
  import WidgetSettingsPopup from "../WidgetSettingsPopup.svelte";
  let open = true;
</script>
<section class="ppp-widget-host">
  <button aria-haspopup="menu">Block menu</button>
  {#if open}
    <WidgetSettingsPopup label="Formula settings" on:close={() => open = false}>
      <label>Expression <input value="price * 2" /></label>
    </WidgetSettingsPopup>
  {/if}
</section>
