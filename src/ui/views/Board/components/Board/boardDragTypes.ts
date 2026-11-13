import { getContext, setContext } from "svelte";
const BOARD_CARDS = Symbol("Projects Plus Board cards");
let nextBoard = 0;
export function provideBoardDragTypes() {
  const scope = `ppp-board-${++nextBoard}`;
  setContext(BOARD_CARDS, `${scope}-cards`);
  return { columns: `${scope}-columns` };
}
export function readCardDragType(): string {
  return getContext<string>(BOARD_CARDS) ?? `ppp-card-list-${++nextBoard}`;
}
