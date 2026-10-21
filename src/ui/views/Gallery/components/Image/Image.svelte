<script lang="ts">
  export let alt: string;
  export let src: string;
  export let fit: string;
</script>

<!-- B9: `error` is forwarded so the gallery can show its broken-cover fallback.
     i3-gallery: a cover off screen is not fetched or decoded until it is near
     (a gallery of hundreds of notes loaded every image at once). -->
<img {alt} {src} loading="lazy" decoding="async" style:object-fit={fit} on:error />
