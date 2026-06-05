---
description: "Use when writing or modifying Jest tests in obs-projects-plus. Covers baseline (139 suites / 2099 tests), required updates when extending widget/field types, mock locations, and writing patterns."
applyTo: "src/**/*.{test,spec}.ts"
---

# Test patterns and baseline

## Baseline (must hold)

**139 suites / 2099 tests PASS**, `tsc --noEmit` 0 errors. Any deviation requires acknowledgement.

## Required updates when extending

| Change | Test update required |
|---|---|
| Add a new widget | `widgetRegistry.test.ts` (count) + `configPanelRegistry.test.ts` (type list) |
| Add a `DataFieldType` value | Check exhaustive switch branches in dispatchers |
| Add CSS px values | `src/__tests__/R0_3_pxBudget.test.ts` (must stay ≤ 186) |
| New formula function | `formulaMetadata.test.ts` and `extendedEvaluator.test.ts` |

## Mock locations

- Generic Obsidian API mocks: `src/__mocks__/`
- Dashboard widget mocks: `src/ui/views/Dashboard/widgets/__tests__/mocks/`

## Writing guidelines

- Test BEHAVIOR, not implementation details.
- Use `describe` per module/function.
- Mock Obsidian APIs only via `src/__mocks__/`; never inline.
- Prefer integration-style tests over unit stubs for datasource / engine code.
- Do NOT mock the database in integration tests — use real datasource behavior.
- Name pattern: `[function/component] [scenario] [expected outcome]`.
- Security tests must include malicious inputs (e.g., `evil.*evil.*evil`, corrupted JSON).

## Quick commands

```bash
npm test                                              # full suite
npx jest <pattern>                                    # specific tests
npx jest --coverage                                   # coverage report
npx tsc --noEmit                                      # type check
npx jest src/__tests__/R0_3_pxBudget.test.ts          # px budget
```
