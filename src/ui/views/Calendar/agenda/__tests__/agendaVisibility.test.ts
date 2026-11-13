import { isAgendaCollapsed, isAgendaExpanded, shouldMountAgenda } from "../agendaVisibility";

describe("agenda visibility", () => {
  it.each(["day", "week", "2weeks", "month"])("desktop shows the agenda by default in %s scale", (interval) => {
    expect(shouldMountAgenda({ isMobile: false, interval, drawerOpen: false })).toBe(true);
    expect(isAgendaCollapsed(false, undefined)).toBe(false);
  });

  it("after collapsing on desktop the panel stays mounted as a handle and can be expanded", () => {
    expect(shouldMountAgenda({ isMobile: false, interval: "week", drawerOpen: false })).toBe(true);
    expect(isAgendaCollapsed(false, false)).toBe(true);
    expect(isAgendaExpanded(!isAgendaExpanded(false))).toBe(true);
  });

  it("phone drawer stays closed until the button opens it", () => {
    expect(shouldMountAgenda({ isMobile: true, interval: "week", drawerOpen: false })).toBe(false);
    expect(shouldMountAgenda({ isMobile: true, interval: "week", drawerOpen: true })).toBe(true);
    expect(isAgendaCollapsed(true, false)).toBe(false);
  });
});
