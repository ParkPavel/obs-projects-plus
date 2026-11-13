<script lang="ts">
  import WidgetSettingsPopup from "../WidgetSettingsPopup.svelte";
  import TextField from "src/ui/components/fields/TextField.svelte";
  import CoverBannerConfig from "../CoverBanner/CoverBannerConfig.svelte";
  let expression = "price * 2";
  let banner: Record<string,unknown> = {src:"old.png"};
  let bannerWrites = 0;
  let open = true;
</script>
<section class="ppp-widget-host">
  <button aria-haspopup="menu">Block menu</button>
  {#if open}
    <WidgetSettingsPopup label="Formula settings" on:close={() => open = false}>
      <TextField value={expression} validate={value=>value !== "invalid"} on:commit={event=>expression=event.detail.value} />
      <CoverBannerConfig config={banner} on:change={event=>{banner=event.detail;bannerWrites++;}} />
    </WidgetSettingsPopup>
  {/if}
</section>
<output>{expression}</output>
<output id="banner-result" data-writes={bannerWrites}>{String(banner["src"])}</output>
