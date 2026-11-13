import NumberField from "src/ui/components/fields/NumberField.svelte";
import SelectField from "src/ui/components/fields/SelectField.svelte";

/** Native Setting rows host the existing field kit; hiding retires callbacks. */
export function preferenceNumber(target: HTMLElement, label: string, value: number, write: (value: number) => void) {
  const field = new NumberField({ target, props: { value, ariaLabel: label, placeholder: "1000", min: 1, integer: true, preserveInvalidOnBlur: true } });
  let alive = true;
  const off = field.$on("commit", (event: CustomEvent<number | null>) => {
    if (!alive || event.detail === null) return;
    field.$set({ value: event.detail });
    write(event.detail);
  });
  return { $set(props: { value: number }) { if (alive) field.$set(props); }, $destroy() { alive = false; off(); field.$destroy(); } };
}

export function preferenceChoice(target: HTMLElement, label: string, value: string, options: readonly { value: string; label: string }[], write: (value: string) => void) {
  const field = new SelectField({ target, props: { value, options, tooltip: label, contextKey: label } });
  let alive = true;
  const off = field.$on("change", (event: CustomEvent<string>) => {
    if (!alive) return;
    field.$set({ value: event.detail });
    write(event.detail);
  });
  return { $set(props: { value: string }) { if (alive) field.$set(props); }, $destroy() { alive = false; off(); field.$destroy(); } };
}
