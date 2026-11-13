/**
 * Agenda panel visibility (desktop side panel vs phone drawer).
 *
 * Desktop: the panel is always mounted in every scale; `config.agendaOpen`
 * only chooses expanded (default, undefined/true) or collapsed to a handle
 * (false). It never disappears, so a collapsed panel can always be reopened.
 * Phone: a session drawer opened by the navbar button (plus the day scale,
 * where it is mounted hidden until opened).
 */
export function isAgendaExpanded(agendaOpen: boolean | undefined): boolean {
  return agendaOpen !== false;
}

export function shouldMountAgenda(opts: {
  isMobile: boolean;
  interval: string;
  drawerOpen: boolean;
}): boolean {
  if (!opts.isMobile) return true;
  return opts.interval === "day" || opts.drawerOpen;
}

/** Collapsed state for the mounted panel (desktop only). */
export function isAgendaCollapsed(isMobile: boolean, agendaOpen: boolean | undefined): boolean {
  return !isMobile && !isAgendaExpanded(agendaOpen);
}
