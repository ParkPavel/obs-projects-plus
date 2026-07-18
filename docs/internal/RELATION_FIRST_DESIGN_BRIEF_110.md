# #110 — Relation-first design brief and baseline audit

> **Status:** approved for implementation on 2026-07-18  
> **Product contract:** `PRODUCT_RESET_2026-07-18.md` §§3–6  
> **Vertical acceptance scenario:** Clients → Sessions  
> **Scope boundary:** this brief defines the contract and user flow. It does not itself change
> stored user data or ship a new UI.

## Decision

`Relation` is the only persistent domain relationship. It is stored as Obsidian WikiLinks in
frontmatter and declared by one field-level contract. A dashboard selection, a linked block, a
chart correlation, a rollup and an inverse view may *consume* that contract, but none may define
another kind of relation or silently infer one from matching labels.

The primary user flow is deliberately simple:

1. In **Sessions**, create/select property **Client** and choose **Link to database**.
2. Choose **Clients** as the target. The dialog previews matched and unmatched existing values
   before saving.
3. Optionally name/create the inverse **Sessions** on Clients. Explain that it writes WikiLinks
   to Markdown and show the exact field names.
4. Save. The property header offers **Related records**, **Add rollup → Count**, and
   **Create related dashboard block**.
5. Edits in either UI or Markdown update the same relation; unresolved values remain visible as
   actionable unmatched links rather than disappearing.

## Current baseline — audited 2026-07-18

| Surface | What exists | Gap against the decision |
|---|---|---|
| Field contract | `RelationFieldConfig` has `targetProjectId`, optional display, scope and inverse field names (`src/settings/base/settings.ts:244`). | No relation id, source/target field identity, resolution status or migration version; target matching is implicit. |
| Field settings | `ConfigureField.svelte:645` renders target project, display field, inverse name and an advanced JSON scope independently. | No guided action, preview, terminology at the user level, inverse-field creation choice, or safe unmatched-state review. |
| Cell editing | Existing Relation picker can select WikiLink targets. | It edits values but does not explain the target contract or show inverse/related outcomes. |
| Resolution | `crossProjectResolver.ts:147` and `dashboard-engine/relationResolver.ts:74` resolve WikiLinks. | Two resolver paths expose differing shapes and unresolved links can be silently dropped. |
| Inverse write | `ViewApi` awaits `relationsWriter` after the forward record write. | Legacy config has no authority to create an inverse field; a missing field is reported as a structured issue. Explicit `createIfMissing` is required for creation, and external Markdown edits only derive index state. |
| Rollups | `RollupFieldConfig` references `relationField`; multiple rollup engines exist. | User must manually configure a technical rollup rather than start with Count from the relation. |
| Dashboard | `canvasSelectionStore.ts:188` converts `linkedSelection` into a field filter. | It is an independent widget configuration and is not labelled with, validated against, or derived from the relation contract. |

The supplied visual baseline (Projects dashboard screenshot, 2026-07-18) also shows raw
configuration vocabulary (`startDate`, aggregation/sort selects) in a dense settings surface.
It is evidence of discoverability risk, not a visual QA result for the new flow: the live
Obsidian window was not controllable in this audit session.

## Canonical contract for #111

The following is the required public semantic shape. Names may be refined by the architect, but
the meanings and compatibility boundary are fixed.

```ts
type RelationDefinition = {
  source: { projectId: string; fieldName: string };
  target: { projectId: string; displayField?: string };
  storage: "wikilink";
  inverse?: { fieldName: string; createIfMissing: boolean };
};

type RelationResolution = {
  rawLink: string;
  canonicalPath: string;
  status: "resolved" | "unmatched" | "ambiguous";
  targetRecordId?: string;
};
```

Compatibility rules:

- Existing `typeConfig.relation` remains readable without migration loss; it is adapted to the
  canonical definition.
- Existing frontmatter strings and arrays remain WikiLinks. Never replace them with hidden IDs.
- `targetSubBaseFilter` is an optional consumer scope, not relationship identity.
- An inverse is derived when absent; it is written only after the user explicitly selects the
  opt-in creation/write-back behaviour.
- `linkedSelection` remains supported as a legacy widget filter, but its configuration must point
  to an existing Relation or present an explicit migration/creation action. It must never be
  called a Relation in the UI.

## Interaction and language contract for #112–#114

| Moment | Required UI | Never do |
|---|---|---|
| Start | “Link to database” from property setup, property menu and Relation cell empty state. | Ask for `targetProjectId` or JSON as the first user action. |
| Target | Searchable database list, then a target-record preview. | Infer a relationship merely because two field labels match. |
| Mapping | Preview: matched, unmatched, ambiguous; save disabled only for invalid schema, not for unmatched records. | Silently drop unresolved WikiLinks. |
| Inverse | Checkbox: “Add `Sessions` to Clients”; describe Markdown write-back and show field name. | Create or delete fields without explicit opt-in. |
| After save | Relation header shows target, inverse state and actions: related records, count rollup, related block. | Send users to a dashboard filter panel to discover basic relation results. |
| Dashboard | “Filter by relation: Client” shows source, target and current selection; no relation means a direct link to setup. | Present `linkedSelection` as a separate relation model. |

Keyboard and accessibility requirements:

- Every entry point is keyboard reachable; focus moves into target picker and returns to the
  invoking property after save/cancel.
- Picker supports typeahead, arrows, Space/Enter selection and Escape without writing.
- Matched/unmatched/ambiguous status is text plus icon, never colour alone; counts have accessible
  labels; inverse side effects are announced before confirmation.
- External Markdown changes update related records, rollups and relation-aware dashboard results
  without a manual refresh.

## Delivery slices and acceptance gates

### #111 — canonical contract

- One resolver adapter returns `RelationResolution` for all current consumers.
- Tests cover alias, basename/path, arrays, duplicate links, missing files and ambiguous targets.
- Existing `RelationFieldConfig`, inverse writer and legacy dashboards remain compatible.

### #112 — guided setup

- Start from property and empty cell; choose Clients; preview at least one resolved and one
  unmatched Session; create optional inverse; cancel leaves Markdown unchanged.
- No raw implementation identifiers appear in primary labels.

### #113 — related records and Count rollup

- A Client shows its Sessions and a Count rollup without pipeline configuration.
- Changing `client: [[Acme]]` in a note updates both after vault events.

### #114 — relation-aware dashboard

- Related block starts from the configured Client relation, identifies it in plain language and
  reacts to selection. Legacy `linkedSelection` gets a migration/explanation path.

### #115 — clean-vault end-to-end proof

In `OBStests`: create Clients and Sessions, configure Client → Clients, add an inverse, link a
session, inspect the client’s Sessions/count, edit the WikiLink externally, verify updates in
Table and dashboard, then test unmatched and Escape paths. Capture screenshots and an explicit
manual checklist; technical gates alone are insufficient.

## Non-goals and risks

- No database abstraction that hides Markdown, no automatic field-to-field inference, and no
  broad dashboard redesign in #111.
- Target collision/ambiguity must be represented, not guessed from filename basename.
- Inverse writes can race external edits; #111 must define ordering/error reporting before making
  them authoritative.
- The existing `src/archive/dashboard-v1` inverse/sub-base code is evidence only and must not be
  revived as the new contract.

## Evidence and audit limit

Code evidence in this document was read on 2026-07-18. The current application window could not
be controlled or captured in this session, so the screenshot supplied with the request is only
baseline context. A visual audit of #112–#115 remains a required acceptance activity after the
flow is implemented.
