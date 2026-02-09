import { Events, type EventRef } from "obsidian";
import { onDestroy, onMount } from "svelte";
import { get, writable } from "svelte/store";

export const events = writable<Events>(new Events());

// /skip @typescript-eslint/no-explicit-any - Event bus callback can receive any data payload
export function onEvent(type: string, cb: (...data: any) => void) {
  let eventRef: EventRef;

  onMount(() => {
    eventRef = get(events).on(type, cb);
  });
  onDestroy(() => {
    get(events).offref(eventRef);
  });
}
