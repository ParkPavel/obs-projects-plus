<script lang="ts">
  /**
   * 3.6.1 — what the Projects view shows before any project exists: the
   * first-run window may have been closed, and without this the view was
   * blank with the demo reachable only from the command palette.
   */
  import { createEventDispatcher } from "svelte";
  import { Button } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";

  const dispatch = createEventDispatcher<{ createDemo: void; createProject: void }>();
</script>

<div class="ppp-projects-empty">
  <h2 class="ppp-projects-empty-title">{$i18n.t("projects-empty.title")}</h2>
  <p class="ppp-projects-empty-text">{$i18n.t("projects-empty.text")}</p>
  <div class="ppp-projects-empty-actions">
    <Button variant="primary" on:click={() => dispatch("createDemo")}>{$i18n.t("projects-empty.create-demo")}</Button>
    <Button variant="default" on:click={() => dispatch("createProject")}>{$i18n.t("projects-empty.create-project")}</Button>
  </div>
</div>

<style>
  .ppp-projects-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    min-height: 60%;
    padding: 2rem 1.5rem;
    text-align: center;
  }

  .ppp-projects-empty-title {
    margin: 0;
  }

  .ppp-projects-empty-text {
    max-width: 32rem;
    margin: 0;
    color: var(--text-muted);
  }

  .ppp-projects-empty-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
  }
</style>
