---
description: "Use when editing TypeScript or Svelte source files in obs-projects-plus. Enforces architectural invariants: no @ts-ignore, dispatch by DataFieldType, rem-only CSS, single filter engine, dates use 4 params."
applyTo: "src/**/*.{ts,svelte}"
---

# Source code invariants

These rules apply to all TypeScript and Svelte files in `src/`. They are enforced by `audit-manager` before any merge and partially blocked by `.github/hooks/invariants.json`.

## Hard invariants — never violate

1. **Zero `@ts-ignore`** — fix the types instead. There is no allowed exception.
2. **Dispatch by `DataFieldType`** — never by `field.name`. Pattern:
   ```ts
   switch (field.type) {
     case DataFieldType.Date: ...
     case DataFieldType.Number: ...
   }
   ```
3. **Dates always use 4 parameters**: `startDate`, `startTime`, `endDate`, `endTime`. Never combine date + time into a single param.
4. **`filterEvaluator.ts` is the single filter engine**. Do not create parallel implementations in `Calendar/`, `Board/`, etc.; use thin wrappers around the canonical engine.
5. **Board columns are derived** from unique values of the user-selected field. Never hardcode column lists.
6. **No `new Menu(`** outside `src/lib/contextMenu.ts`. Always go through the helper.
7. **No hardcoded hex colors** (`#abc`, `#aabbcc`) in `src/`. Use design tokens (`--ppp-*`) or the palettes store.

## CSS rules

- **PX-budget ratchet ≤ 186** total px values across the codebase (`src/__tests__/R0_3_pxBudget.test.ts`).
- All NEW spacing, sizing, and typography in `rem`.
- May DECREASE the budget only after a real px→rem conversion. NEVER increase without explicit user approval.

## Formula pipeline (derived fields)

Always apply in this order:
```
applyFormulaFields → enrichFrameWithRelations → display
```
Do not bypass `applyFormulaFields` for formula-typed fields.

## Locked dependencies

- **Svelte 3.59.2** — do not suggest Svelte 4/5 migrations, do not import Svelte 4+ APIs.
- **esbuild** — do not introduce webpack, vite, or rollup configs.

## Security patterns

- `new RegExp(userInput)` — always guard with `isUnsafePattern()` to prevent ReDoS.
- `JSON.parse(userData)` — always wrap in `try/catch`.
- Never use template literals to build SQL-like queries.
