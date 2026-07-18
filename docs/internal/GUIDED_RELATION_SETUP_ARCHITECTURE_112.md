# #112 — Guided Relation setup architecture

> **Status:** approved for implementation, 2026-07-19  
> **Depends on:** #111 canonical Relation contract

## Decision

Use one standalone wizard and controller, not scattered Relation controls in Create/Configure forms.
The wizard keeps a `RelationSetupDraft` only in memory until explicit confirmation. Preview is
pure and uses #111 resolution statuses; no Markdown or settings are changed by preview or Cancel.

## Contract and commit order

1. Choose/create source Relation property and target database.
2. Load the target frame via `ViewApi.resolveExternalFrame`; resolve all existing source values
   into `resolved`, `unmatched` and `ambiguous` preview results.
3. Optionally enable an inverse field. Explain its Markdown effect and require explicit consent.
4. On Save validate again; create source field if needed; persist full source field config; then
   perform only the explicitly approved inverse schema operation.
5. Report exact outcome. Do not broadly roll back Markdown after a partial failure.

## Modules

- `src/lib/relations/relationSetup.ts`: pure draft validation, preview summary and config builder.
- `src/ui/modals/relationSetupModal.ts` and `components/RelationSetup.svelte`: accessible wizard,
  focus restoration and non-mutating Cancel/Escape.
- `src/ui/views/Dashboard/relationSetupController.ts`: sole loading/persistence coordinator.
- Schema, Create/Configure field and empty Relation cells launch the controller; they do not own
  persistence.

## Invariants

- WikiLinks remain storage; no hidden IDs and no inferred field mapping.
- Existing values are never migrated silently.
- `linkedSelection` and chart correlation are out of scope (#114).
- Primary UI uses user language, not `targetProjectId`/JSON.
- Statuses are textual and keyboard reachable; Escape commits nothing.

## Verification

Unit-test preview/config, controller order/failures/cancel and UI keyboard states. Manual proof in
`OBStests`: Sessions → Client → Clients, one resolved + unmatched record, inverse on/off,
Escape/cancel and external Markdown edit.
