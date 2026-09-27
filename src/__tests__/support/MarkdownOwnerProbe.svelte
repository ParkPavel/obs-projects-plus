<script lang="ts">
  // Test-only: exposes the owner markdownOwner() gives a component.
  import { markdownOwner } from "src/lib/markdownOwner";

  export let onOwner: (owner: unknown) => void;
  onOwner(markdownOwner());
</script>
