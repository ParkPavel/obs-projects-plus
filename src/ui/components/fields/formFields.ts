import { getContext, onDestroy, setContext } from "svelte";

interface FormField {
  isComposing(): boolean;
  syncForSubmit(): boolean;
}
interface FormFields {
  register(field: FormField): () => void;
  syncForSubmit(): boolean;
}
const FORM_FIELDS = Symbol("form-fields");
export function currentFormFields(): FormFields | undefined { return getContext<FormFields | undefined>(FORM_FIELDS); }

/** Optional form boundary: delegates to original controls, never reads or parses DOM text. */
export function provideFormFields(): FormFields {
  const fields = new Set<FormField>();
  const form: FormFields = {
    register(field) { fields.add(field); return () => { fields.delete(field); }; },
    syncForSubmit() {
      // An active composition prevents every field from accepting this Save.
      if ([...fields].some(field => field.isComposing())) return false;
      for (const field of [...fields]) {
        if (fields.has(field) && !field.syncForSubmit()) return false;
      }
      return true;
    },
  };
  setContext(FORM_FIELDS, form);
  return form;
}

/** A destroyed control leaves only its own form; standalone field policy is unchanged. */
export function registerFormField(field: FormField): void {
  const form = getContext<FormFields | undefined>(FORM_FIELDS);
  if (form) onDestroy(form.register(field));
}
