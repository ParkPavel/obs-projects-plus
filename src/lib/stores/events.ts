import { Events, type EventRef } from "obsidian";
import { onDestroy, onMount } from "svelte";
import { get, writable } from "svelte/store";

export const events = writable<Events>(new Events());

 
export function onEvent<A extends unknown[]>(type: string, cb: (...data: A) => void) {
  let eventRef: EventRef;

  onMount(() => {
    // Whoever triggers `type` passes the arguments the listener declares.
    eventRef = get(events).on(type, cb as (...data: unknown[]) => unknown);
  });
  onDestroy(() => {
    get(events).offref(eventRef);
  });
}
