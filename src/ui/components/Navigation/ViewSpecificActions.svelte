<script lang="ts">
  import IconButton from "src/ui/components/IconButton/IconButton.svelte";
  import type { ViewDefinition } from "src/settings/settings";
  import { i18n } from "src/lib/stores/i18n";
  import { Menu } from "obsidian";

  const SCALES = ["day", "week", "2weeks", "month", "year"] as const;
  const scaleLabel = (s: string): string =>
    s === "2weeks" ? $i18n.t("views.calendar.intervals.2weeks") : $i18n.t(`settings-menu.view-config.calendar.interval-options.${s}`);
  $: currentScale = String(view?.config?.["interval"] ?? "week");
  function openScaleMenu(e: MouseEvent): void {
    const menu = new Menu();
    for (const s of SCALES) menu.addItem((item) => item.setTitle(scaleLabel(s)).setChecked(s === currentScale).onClick(() => onSetInterval?.(s)));
    menu.showAtMouseEvent(e);
  }

  export let view: ViewDefinition | undefined;
  export let onCenterToday: (() => void) | undefined;
  export let onToggleAgenda: (() => void) | undefined;
  export let onFreezeColumns: (() => void) | undefined;
  /** i2-calendar (N47): the scale was reachable only by a pinch. */
  export let onSetInterval: ((interval: string) => void) | undefined = undefined;
  /** Phone: the drawer state from the session store. Undefined: read the view config. */
  export let agendaOpen: boolean | undefined = undefined;

  $: t = $i18n.t;
  $: isFrozen = view?.config?.["freezeAll"] ?? view?.config?.["freezeColumns"] ?? false;
  $: isAgendaOpen = agendaOpen ?? view?.config?.["agendaOpen"] !== false;
</script>

<div class="actions">
  {#if view?.type === "calendar"}
    {#if onSetInterval}
      <button type="button" class="ppp-scale-btn" aria-haspopup="menu" on:click={openScaleMenu}>{scaleLabel(currentScale)} ▾</button>
    {/if}
    <IconButton
      icon="calendar-check"
      size="md"
      tooltip={t("views.calendar.today")}
      onClick={() => onCenterToday?.()}
    />
    <IconButton
      icon="list-todo"
      active={isAgendaOpen}
      size="md"
      tooltip={isAgendaOpen
        ? t("settings-menu.view-config.calendar.hide-agenda")
        : t("settings-menu.view-config.calendar.show-agenda")}
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
  .ppp-scale-btn {
    height: auto;
    padding: 0.25rem 0.5rem;
    background: transparent;
    box-shadow: none;
    border: none;
    color: var(--text-muted);
    font-size: var(--font-ui-small);
    white-space: nowrap;
  }
  .actions {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs, 0.375rem);
  }
</style>
