<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { settings } from "src/lib/stores/settings";
  import { i18n } from "src/lib/stores/i18n";
  import type { ProjectDefinition } from "src/settings/settings";
  import SearchField from "src/ui/components/fields/SearchField.svelte";

  export let onCreate: () => void;
  export let onImport: () => void | Promise<void>;
  export let onOpen: (id: string) => boolean;
  export let onShare: (id: string) => void | Promise<void>;
  export let onCopies: () => void;
  export let onConfiguration: (mode: "draft" | "restore") => void | Promise<void>;
  let alive = true, busy = false, query = "", archived = false, page = 0, message = "";
  let search: SearchField;
  let root: HTMLElement;
  const pageSize = 12;
  onDestroy(() => { alive = false; });
  $: t = (key: string) => $i18n.t("project-manager." + key);
  $: projects = archived ? $settings.archives : $settings.projects;
  $: filtered = projects.filter(project => project.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  $: pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  $: if (page >= pages) page = pages - 1;
  $: pending = !!$settings.preferences.projectFiles?.pendingImport;
  function source(project: ProjectDefinition, translate: (key: string) => string): string {
    if (project.dataSource.kind === "folder") return project.dataSource.config.path || translate("vault");
    if (project.dataSource.kind === "tag") return "#" + project.dataSource.config.tag.replace(/^#/, "");
    return translate("other-source");
  }
  async function run(action: () => unknown | Promise<unknown>) {
    if (!alive || busy) return;
    busy = true; message = "";
    try { await action(); }
    catch { if (alive) message = t("failed"); }
    finally {
      if (alive) {
        busy = false; await tick();
        if (alive && root?.ownerDocument.activeElement === root?.ownerDocument.body) search?.focus();
      }
    }
  }
  function open(id: string) { if (!onOpen(id) && alive) message = t("opened-behind-settings"); }
</script>

<section class="ppp-modal ppp-project-management" aria-label={t("title")} bind:this={root}>
  <h3>{t("title")}</h3>
  <p>{t("description")}</p>
  <div class="actions">
    <button type="button" class="mod-cta" disabled={busy || pending} on:click={() => run(onCreate)}>{t("create")}</button>
    <button type="button" disabled={busy} on:click={() => run(onImport)}>{t("import")}</button>
    <button type="button" disabled={busy} on:click={() => run(onCopies)}>{t("copies")}</button>
  </div>
  {#if pending}
    <p role="status">{t("pending")}</p>
    <button type="button" disabled={busy} on:click={() => run(onImport)}>{t("pending-action")}</button>
  {/if}
  <SearchField bind:this={search} {query} ariaLabel={t("search")} placeholder={t("search")} on:queryChange={event => { query = event.detail; page = 0; }} />
  <div class="actions" role="group" aria-label={t("list")}>
    <button type="button" aria-pressed={!archived} on:click={() => { archived = false; page = 0; }}>{t("active")} ({$settings.projects.length})</button>
    <button type="button" aria-pressed={archived} on:click={() => { archived = true; page = 0; }}>{t("archived")} ({$settings.archives.length})</button>
  </div>
  {#if !filtered.length}<p>{query ? t("no-results") : t("empty")}</p>{/if}
  <ul>
    {#each filtered.slice(page * pageSize, (page + 1) * pageSize) as project (project.id)}
      <li>
        <strong>{project.name || t("untitled")}</strong>
        <p class="source">{source(project, t)}</p>
        <div class="actions">
          {#if !archived}<button type="button" disabled={busy} on:click={() => run(() => open(project.id))}>{t("open")}</button>{/if}
          <button type="button" disabled={busy || pending} on:click={() => run(() => onShare(project.id))}>{t("share")}</button>
          <button type="button" disabled={busy || pending} on:click={() => run(() => archived ? settings.restoreArchive(project.id) : settings.archiveProject(project.id))}>{t(archived ? "unarchive" : "archive")}</button>
        </div>
      </li>
    {/each}
  </ul>
  {#if pages > 1}
    <div class="actions">
      <button type="button" disabled={!page} on:click={() => page--}>{$i18n.t("package-inspect.binding-previous")}</button>
      <span>{$i18n.t("package-inspect.binding-page", { page: page + 1, pages })}</span>
      <button type="button" disabled={page + 1 >= pages} on:click={() => page++}>{$i18n.t("package-inspect.binding-next")}</button>
    </div>
  {/if}
  <details>
    <summary>{t("configuration")}</summary>
    <div class="actions">
      <button type="button" disabled={busy || pending} on:click={() => run(() => onConfiguration("draft"))}>{$i18n.t("project-configuration.draft")}</button>
      <button type="button" disabled={busy || pending} on:click={() => run(() => onConfiguration("restore"))}>{$i18n.t("project-configuration.restore")}</button>
    </div>
  </details>
  <p role="status" aria-live="polite">{busy ? t("working") : message}</p>
</section>

<style>
  .ppp-project-management { min-width: 0; margin-bottom: 1.5rem; overflow-wrap: anywhere; }
  h3 { margin-top: 0; }
  .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-block: 0.75rem; }
  button { min-width: 0; min-height: 2.75rem; height: auto; max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { min-width: 0; padding-block: 0.75rem; border-bottom: var(--border-width) solid var(--background-modifier-border); }
  .source { margin-block: 0.25rem; color: var(--text-muted); }
  summary { cursor: pointer; }
  @media (max-width: 30rem) { .actions > button { flex: 1 1 100%; } }
</style>
