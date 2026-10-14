<script lang="ts">
  export let alt: string;
  export let src: string;
  export let fit: string;
</script>

<!-- B9: `error` is forwarded so the gallery can show its broken-cover fallback. -->
<img {alt} {src} style:object-fit={fit} on:error />
