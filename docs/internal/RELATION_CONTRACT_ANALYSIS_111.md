# #111 — Canonical Relation contract: analysis record

> **Status:** analysis complete, architecture plan pending  
> **Input:** `RELATION_FIRST_DESIGN_BRIEF_110.md`  
> **Date:** 2026-07-18

## Result

The product has one storage convention (WikiLinks) but not one relation contract. Four separate
interpretations exist: field configuration, cross-project enrichment, dashboard resolution and
vault inverse indexing. #111 must create one diagnostic resolver and migrate consumers through
adapters; adding another resolver is prohibited.

## Verified findings

| Finding | Evidence | Required consequence |
|---|---|---|
| Display and identity are conflated. | `src/lib/engine/crossProjectResolver.ts:63-92` indexes `displayField` as a match key. | Display may not control identity. Resolve canonical path first; only explicit fallbacks may use labels. |
| Ambiguity is invisible. | Both `crossProjectResolver.ts:63-92` and `dashboard-engine/relationResolver.ts:43-58` use `Map<string, DataRecord>`. | Resolver returns `ambiguous`, never last-write-wins. |
| Unmatched links vanish. | `crossProjectResolver.ts:147-163` and `relationResolver.ts:125-135` filter missing targets. | Preserve one result for every raw WikiLink, including `unmatched`. |
| Current relation contract is only declarations. | `src/lib/relations/contracts.ts:1-83` had no implementation consumers. | Two options were offered: make it the owner of public types, or remove its normative claim. **The second was taken — #178, 2026-09-02: the file was deleted**, together with `lib/engine/contracts.ts` (its only import source) and `lib/colors/contracts.ts` (the other dead importer). Text archived at `docs/internal/archive/ENGINE_CONTRACTS_V4_DESIGN.md`. The live relation model is `src/lib/relations/relationContract.ts` and the inverse index in `src/lib/relations/inverseIndex.ts`, which never implemented the class-shaped `RelationIndex` this row is about. |
| Parsing is duplicated. | `engine/wikilink.ts`, `crossProjectResolver.ts:111-133`, `relations/parseRelationLinks.ts:32-68`, `relationsWriter.ts:82-105`. | Reuse canonical WikiLink parser; document compatibility handling for legacy plain/CSV values. |
| Dashboard link is not a Relation. | `Dashboard/types.ts:91-99`, `DatabaseCallSettings.svelte:141-152`, `relationFilterAdapter.ts:68-90`. | Keep it legacy-compatible but validate/migrate it against a declared Relation; never call it a relation. |
| Inverse writes cannot be authoritative. | `viewApi.ts:40-55`, `relationsWriter.ts:50-75,97-105`. | Return outcomes/errors, carry source path, and require an explicit create/write policy. |

## Compatibility boundary

- Persisted `RelationFieldConfig` remains readable unchanged: `targetProjectId`, `displayField`,
  `targetSubBaseFilter`, `inverseFieldName`, `inverseDisplayField`
  (`src/settings/base/settings.ts:244-263`).
- Markdown remains WikiLink strings/string arrays; no hidden IDs.
- `targetSubBaseFilter` is a consumer scope, never relation identity.
- Existing `__resolved__<field>` stays temporarily as an adapter projection because Table consumes
  it (`GridRelationCell.svelte:19-40`).
- Existing `linkedSelection` keeps working during migration, but invalid non-Relation use produces
  an explicit diagnosis instead of pretending a relationship exists.

## Required test matrix

1. Exact path, alias, basename fallback, arrays, duplicate values, heading aliases and nulls.
2. Duplicate basenames in separate folders → `ambiguous`; missing target → `unmatched` with raw
   and canonical value retained.
3. Legacy config adapter preserves all optional keys; scope limits results after identity is
   resolved.
4. Compatibility parity for current cross-project happy paths and `__resolved__` projection.
5. Writer add/remove idempotence, exact path, duplicate basename, opt-in inverse-field creation,
   failure propagation and external Markdown refresh.
6. Legacy `linkedSelection` valid/invalid diagnosis without breaking current dashboards.

## Handoff

Affected modules exceed two (relations, engine, dashboard, UI/data write path). A
`backend-architect` decision is required before implementation.
