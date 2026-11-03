/** Scroll only the list that owns an active option, never the document or form. */
export function revealInList(row: HTMLElement, list: HTMLElement | null): void {
  if (!list || !list.contains(row) || list.clientHeight <= 0) return;
  const box = list.getBoundingClientRect(), item = row.getBoundingClientRect();
  if (box.height <= 0 || item.height <= 0) return;
  const scale = list.offsetHeight > 0 ? box.height / list.offsetHeight : 1;
  const top = box.top + list.clientTop * scale, bottom = top + list.clientHeight * scale;
  if (item.top < top) list.scrollTop -= (top - item.top) / scale;
  else if (item.bottom > bottom) list.scrollTop += (item.bottom - bottom) / scale;
}
