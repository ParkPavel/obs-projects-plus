<script lang="ts">
  const PROPERTIES_URL = "https://help.obsidian.md/Editing+and+formatting/Properties";

  export let text: string;

  type Segment =
    | { type: "text"; value: string }
    | { type: "strong"; value: string }
    | { type: "link"; value: string; href: string };

  const MARKUP_RE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;

  function parse(input: string): Segment[] {
    const segments: Segment[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    MARKUP_RE.lastIndex = 0;
    while ((match = MARKUP_RE.exec(input))) {
      if (match.index > lastIndex) {
        segments.push({ type: "text", value: input.slice(lastIndex, match.index) });
      }
      if (match[1] !== undefined) {
        segments.push({ type: "strong", value: match[1] });
      } else if (match[3] === "properties") {
        segments.push({ type: "link", value: match[2] ?? "", href: PROPERTIES_URL });
      } else {
        segments.push({ type: "text", value: match[0] });
      }
      lastIndex = MARKUP_RE.lastIndex;
    }
    if (lastIndex < input.length) {
      segments.push({ type: "text", value: input.slice(lastIndex) });
    }
    return segments;
  }

  $: segments = parse(text);
</script>

{#each segments as segment}{#if segment.type === "strong"}<strong>{segment.value}</strong
  >{:else if segment.type === "link"}<a href={segment.href}>{segment.value}</a
  >{:else}{segment.value}{/if}{/each}
