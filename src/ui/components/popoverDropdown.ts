/**
 * Shared popover dropdown utility.
 * Extracts duplicated imperative popover logic from FiltersTab, SortTab, ColorFiltersTab.
 * Uses activeDocument for Obsidian multi-window support.
 */
import { setIcon } from "obsidian";

export interface PopoverItem {
  label: string;
  icon?: string;
  selected?: boolean;
  handler: () => void;
}

export interface PopoverHandle {
  el: HTMLElement;
  destroy: () => void;
}

let currentPopover: PopoverHandle | null = null;

export function destroyPopover(): void {
  if (currentPopover) {
    const el = currentPopover.el;
    if ((el as any).__vvCleanup) (el as any).__vvCleanup();
    el.parentNode?.removeChild(el);
    currentPopover = null;
  }
}

export function getPopoverEl(): HTMLElement | null {
  return currentPopover?.el ?? null;
}

function positionPop(el: HTMLElement, anchor: HTMLElement, maxHRem: number): void {
  const fs = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const toRem = (v: number) => `${(v / fs).toFixed(2)}rem`;
  const isTouch = window.matchMedia("(pointer: coarse)").matches;

  if (isTouch) {
    const vv = window.visualViewport;
    const gap = 0.25 * fs;
    const wantH = Math.min(maxHRem, 11) * fs;

    function place() {
      const r = anchor.getBoundingClientRect();
      const visTop = vv ? vv.offsetTop : 0;
      const visH = vv ? vv.height : window.innerHeight;
      const visBot = visTop + visH;
      const anch = Math.min(r.top, visBot - gap);
      const avail = anch - visTop - gap * 2;
      const h = Math.max(5 * fs, Math.min(wantH, avail));
      const top = Math.max(visTop + gap, anch - h - gap);

      el.style.top = toRem(top);
      el.style.height = toRem(h);
      el.style.maxHeight = toRem(h);
    }

    el.classList.add("ppp-pop-box--mobile-kbd");

    el.style.opacity = "0";
    el.style.pointerEvents = "none";
    place();

    let revealed = false;
    function reveal() {
      if (revealed) return;
      revealed = true;
      place();
      el.style.opacity = "1";
      el.style.pointerEvents = "";
    }

    const fallbackTimer = setTimeout(reveal, 120);

    if (vv) {
      const onVV = () => {
        if (!revealed) {
          clearTimeout(fallbackTimer);
          reveal();
        } else {
          place();
        }
      };
      vv.addEventListener("resize", onVV);
      vv.addEventListener("scroll", onVV);
      (el as any).__vvCleanup = () => {
        clearTimeout(fallbackTimer);
        vv.removeEventListener("resize", onVV);
        vv.removeEventListener("scroll", onVV);
      };
    } else {
      clearTimeout(fallbackTimer);
      reveal();
    }
    return;
  }

  const r = anchor.getBoundingClientRect();
  const maxH = maxHRem * fs;
  const gap = 0.5 * fs;
  const below = window.innerHeight - r.bottom - gap;
  el.style.top =
    below >= maxH || below > r.top - gap
      ? toRem(r.bottom + 0.125 * fs)
      : toRem(r.top - maxH - 0.125 * fs);
  el.style.left = toRem(
    Math.max(0.25 * fs, Math.min(r.left, window.innerWidth - 16.25 * fs))
  );
}

export function makePopover(
  anchor: HTMLElement,
  items: PopoverItem[],
  searchable = false
): PopoverHandle {
  destroyPopover();
  const box = activeDocument.createElement("div");
  box.addClass("ppp-pop-box");
  box.setAttribute("data-settings-dropdown", "");
  const maxHRem = Math.min(
    items.length * 2.125 + (searchable ? 2.625 : 0) + 0.5,
    17.5
  );
  box.style.maxHeight = `${maxHRem}rem`;
  positionPop(box, anchor, maxHRem);

  const list = activeDocument.createElement("div");
  list.addClass("ppp-pop-list");
  list.style.flex = "1";
  list.style.minHeight = "0";

  const allBtns: { el: HTMLElement; label: string }[] = [];

  for (const it of items) {
    const btn = activeDocument.createElement("button");
    btn.addClass("ppp-pop-item");
    if (it.selected) btn.addClass("ppp-pop-item--selected");
    btn.type = "button";
    btn.addEventListener("mouseenter", () => {
      btn.style.background = "var(--background-modifier-hover)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = "transparent";
    });
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      it.handler();
      destroyPopover();
    });

    if (it.icon) {
      const ic = activeDocument.createElement("span");
      ic.addClass("ppp-pop-muted");
      setIcon(ic, it.icon ?? "file-text");
      btn.appendChild(ic);
    }

    const lbl = activeDocument.createElement("span");
    lbl.addClass("ppp-popover-label");
    lbl.textContent = it.label;
    btn.appendChild(lbl);

    if (it.selected) {
      const chk = activeDocument.createElement("span");
      chk.addClass("ppp-pop-muted");
      chk.style.color = "var(--interactive-accent)";
      setIcon(chk, "check");
      btn.appendChild(chk);
    }

    list.appendChild(btn);
    allBtns.push({ el: btn, label: it.label.toLowerCase() });
  }

  if (searchable) {
    const searchWrap = activeDocument.createElement("div");
    searchWrap.addClass("ppp-pop-search");
    const searchInput = activeDocument.createElement("input");
    searchInput.type = "text";
    searchInput.addClass("ppp-pop-search-input");
    searchInput.placeholder = "🔍";
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.toLowerCase().trim();
      for (const { el, label } of allBtns) {
        el.style.display = !q || label.includes(q) ? "" : "none";
      }
    });
    searchInput.addEventListener("mousedown", (e) => e.stopPropagation());
    searchWrap.appendChild(searchInput);
    box.appendChild(searchWrap);
    setTimeout(() => searchInput.focus(), 0);
  }

  box.appendChild(list);
  activeDocument.body.appendChild(box);

  const handle: PopoverHandle = { el: box, destroy: destroyPopover };
  currentPopover = handle;
  return handle;
}
