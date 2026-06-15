# #101 EditNote live-modal — untestable Svelte surface

The dirty-merge **logic** is fully unit-tested in `editNoteMerge.test.ts`
(`mergeExternal` + the live-update sequence). The following parts live inside
`EditNote.svelte` and cannot be exercised by jest in this repo:

1. **`setValue` dirty registration** (`dirty.add(fieldName)`) and the
   clear-on-save (`dirty = new Set()` in `performSave` / `handleManualSave`).
2. **Reactive wiring** — `$: live = $dataFrame.records.find(r => r.id === recordId)`
   and `$: if (live) record = mergeExternal(record, live, dirty)`.

## Why jest cannot mount EditNote.svelte

- The `obsidian-svelte` package is mocked as **noop components**
  (`src/__mocks__/obsidian-svelte.js`). `ModalLayout` / `ModalContent` /
  `SettingItem` render no slot content, so `FieldControl` and its `<input>`
  never reach the DOM — there is no element to drive `setValue` through.
- Importing `EditNote.svelte` pulls a transitive chain
  `FieldControl → TagList → src/ui/views/helpers.ts → src/view.ts →
  BoardView.svelte → getRecordColorContext`, which executes view-layer
  module code that throws under jsdom at import time.

Both are pre-existing harness limitations, not introduced by #101. The
load-bearing reconciliation is pure and covered; the residual surface is the
two-line Svelte reactive declaration and the `dirty.add`/clear calls, verified
by manual testing in the OBStests vault.

## Manual verification (OBStests vault)

1. Open a note in the EditNote modal.
2. From a second client (or `api.updateRecord`), change an **untouched** field
   → modal refreshes that field live.
3. While typing in field X, trigger an external change to X → local edit is
   preserved (last-writer-wins for the active editor).
4. Confirm the external update does **not** trigger a save (no autosave spinner,
   no `onSave` call).
