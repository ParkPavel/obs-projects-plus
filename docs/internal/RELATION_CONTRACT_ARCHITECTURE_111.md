# #111 — Canonical Relation contract: architecture decision

> **Status:** approved for implementation on 2026-07-18  
> **Analysis:** `RELATION_CONTRACT_ANALYSIS_111.md`  
> **Product decision:** `RELATION_FIRST_DESIGN_BRIEF_110.md`

## Decision

Create a pure `src/lib/relations/relationContract.ts` as the sole runtime owner of relation
definition, index and diagnostic resolution. Persisted `RelationFieldConfig` remains a legacy
DTO; frontmatter remains WikiLinks. Existing engines keep their exports as adapters while moving
to the contract. No hidden record IDs, config rewrite or automatic relation inference is allowed.

## Contract

```ts
type RelationDefinition = {
  readonly source: { readonly projectId: string; readonly fieldName: string };
  readonly target: { readonly projectId: string; readonly displayField?: string };
  readonly storage: "wikilink";
  readonly inverse?: { readonly fieldName: string; readonly createIfMissing: boolean };
};

type RelationResolutionStatus = "resolved" | "unmatched" | "ambiguous";

type RelationResolution = {
  readonly rawLink: string;
  readonly canonicalPath: string;
  readonly status: RelationResolutionStatus;
  readonly targetRecordId?: string;
};
```

Every raw WikiLink produces one result in original order. Target indices map keys to arrays,
never to one last-wins record. Resolution is path-first; basename and display are explicit legacy
fallbacks. Only `resolved` records feed rollups and inverse writes; other states remain available
to UI, preview and diagnostics.

## Compatibility and ownership

1. Adapt `RelationFieldConfig` on read. An existing `inverseFieldName` maps to
   `createIfMissing: false`, so old vaults gain no new write side effect.
2. `crossProjectResolver` and dashboard `relationResolver` retain legacy exports and delegate to
   the contract. `__resolved__<field>` is a read-only compatibility projection.
3. `linkedSelection` remains a deprecated widget filter. Add a pure validator returning
   `valid`, `missing-relation`, `invalid-field` or `wrong-target-project`; UI migration belongs
   to #114.
4. The writer returns structured outcomes (`added`, `removed`, typed issues) and resolves by
   canonical vault path. `ViewApi` must not use fire-and-forget inverse writes.
5. Rollups aggregate only resolved targets and retain diagnostics separately from the current
   display value.

## Dependency order

1. Pure contract, adapter and resolver tests.
2. Engine/dashboard compatibility adapters and regression tests.
3. Rollup diagnostics seam.
4. Path-safe inverse writer and awaited ViewApi integration.
5. Legacy linked-selection validator (without UI rewrite).
6. Full four gates plus the Clients → Sessions manual acceptance preparation.

## Risks that block shortcuts

- Duplicate basenames must remain `ambiguous`; selecting one silently is data corruption.
- `targetSubBaseFilter` scopes a consumer after resolution; it is not relation identity.
- An inverse failure must be visible and retryable. Do not roll back a successfully stored forward
  WikiLink automatically.
- External Markdown changes refresh index/consumers but do not auto-write an inverse.

## Required verification

Cover path, alias, basename fallback, duplicate collision, missing target, arrays/repeats,
scope, adapter compatibility, writer idempotence/error propagation and legacy linked-selection
validation. Then run build, Jest, lint and svelte-check. UI-only flows stay for #112–#115.
