<script lang="ts">
  import { IconButton } from "obsidian-svelte";
  import type { ViewDefinition } from "src/settings/settings";
  import { i18n } from "src/lib/stores/i18n";

  export let view: ViewDefinition | undefined;
  export let onCenterToday: (() => void) | undefined;
  export let onToggleAgenda: (() => void) | undefined;
  export let onFreezeColumns: (() => void) | undefined;

  $: t = $i18n.t;
  $: isFrozen = view?.config?.["freezeAll"] ?? view?.config?.["freezeColumns"] ?? false;
  $: isAgendaOpen = view?.config?.["agendaOpen"] ?? false;
</script>

<div class="actions">
  {#if view?.type === "calendar"}
    <IconButton
      icon="calendar"
      size="md"
      tooltip={t("views.calendar.today")}
      onClick={() => onCenterToday?.()}
    />
    <IconButton
      icon={isAgendaOpen ? "panel-right-close" : "panel-right-open"}
      size="md"
      tooltip={isAgendaOpen ? t("views.calendar.hide-agenda") : t("views.calendar.show-agenda")}
      onClick={() => onToggleAgenda?.()}
    />
  {/if}
  {#if view?.type === "board"}
    <IconButton
      icon={isFrozen ? "lock" : "unlock"}
      size="md"
      tooltip={isFrozen ? t("views.board.unfreeze-all") : t("views.board.freeze-all")}
      onClick={() => onFreezeColumns?.()}
    />
  {/if}
</div>

<style>
  .actions {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs, 0.375rem);
  }
</style>
