# 📋 Code Standards & Obsidian Compliance Guide

**Version**: 3.0.3  
**Last Updated**: January 31, 2026  
**Status**: ✅ Community Plugins Compliant

This document serves as a comprehensive guide for contributors, explaining coding standards, Obsidian Community Plugins requirements, and architectural decisions made in the Projects Plus codebase.

---

## 📑 Table of Contents

1. [Overview](#overview)
2. [ESLint Configuration](#eslint-configuration)
3. [TypeScript Configuration](#typescript-configuration)
4. [Obsidian Community Requirements](#obsidian-community-requirements)
5. [Type Safety Guidelines](#type-safety-guidelines)
6. [Justified Exceptions](#justified-exceptions)
7. [Code Quality Checklist](#code-quality-checklist)
8. [Testing Requirements](#testing-requirements)

---

## Overview

Projects Plus follows strict coding standards to ensure:
- ✅ Compliance with Obsidian Community Plugins guidelines
- ✅ Type safety with TypeScript strict mode
- ✅ Clean code without development artifacts in production
- ✅ Proper async/await handling

### Current Quality Metrics

| Metric | Status | Value |
|--------|--------|-------|
| ESLint Errors | ✅ | 0 |
| TypeScript Errors | ✅ | 0 |
| Unit Tests | ✅ | 150/150 passing |
| Build | ✅ | ~6.5s, 1.4MB |
| `any` Types | ✅ | 20 justified, 0 unjustified |

---

## ESLint Configuration

### Active Rules

The project uses a flat ESLint configuration ([eslint.config.mjs](../eslint.config.mjs)):

```javascript
rules: {
    "@typescript-eslint/ban-ts-comment": "off",     // Allow @ts-ignore with justification
    "@typescript-eslint/no-explicit-any": "off",    // Handled via code review
    "@typescript-eslint/no-empty-interface": "off", // Used for extension points
    "@typescript-eslint/no-empty-function": "off",  // Used for default callbacks
    "@typescript-eslint/no-unused-vars": "off",     // Handled by TypeScript
    "no-useless-escape": "off",                     // Regex patterns may need escapes
    "tsdoc/syntax": "warn",                         // Documentation quality
}
```

### Why Certain Rules Are Disabled

| Rule | Reason |
|------|--------|
| `ban-ts-comment` | `@ts-ignore` is allowed when working with external library types (Immer, Svelte) |
| `no-explicit-any` | Justified uses exist for generic utilities and API boundaries; controlled via code review |
| `no-empty-interface` | Used for future extension points in type system |
| `no-useless-escape` | Regex patterns for frontmatter/YAML parsing require specific escapes |

---

## TypeScript Configuration

### Strict Mode Settings ([tsconfig.json](../tsconfig.json))

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noPropertyAccessFromIndexSignature": true,
    "allowUnreachableCode": false,
    "allowUnusedLabels": false,
    "exactOptionalPropertyTypes": true,
    "isolatedModules": true
  }
}
```

This is one of the strictest TypeScript configurations possible, ensuring:
- No implicit `any` types
- All code paths return values
- Index access requires explicit null checks
- Optional properties handled correctly

---

## Obsidian Community Requirements

### ✅ Resolved Issues (All Required)

The following requirements from Obsidian Community Plugin review have been fully addressed:

#### 1. No Direct localStorage Usage

**Requirement**: Use `Plugin.loadData()`/`Plugin.saveData()` or `App.loadLocalStorage()`/`App.saveLocalStorage()` instead of direct `localStorage` access.

**Reason**: Direct localStorage is shared across all vaults, breaking data isolation.

**Implementation**:
- [src/lib/stores/i18n.ts](../src/lib/stores/i18n.ts) — Uses `App.loadLocalStorage()`
- [src/lib/stores/ui.ts](../src/lib/stores/ui.ts) — Uses `App.saveLocalStorage()`
- [src/ui/views/Calendar/calendar.ts](../src/ui/views/Calendar/calendar.ts) — Uses vault-scoped storage

#### 2. No console.log in Production

**Requirement**: Remove `console.log()` statements or replace with `console.debug()`.

**Reason**: Console.log pollutes user's console; debug messages should use debug level.

**Implementation**: All 10 instances replaced with `console.debug()`:
- [src/lib/helpers/performance.ts](../src/lib/helpers/performance.ts)
- [src/ui/views/Calendar/logger.ts](../src/ui/views/Calendar/logger.ts)
- [src/ui/views/Calendar/viewport/ViewportStateManager.ts](../src/ui/views/Calendar/viewport/ViewportStateManager.ts)

#### 3. All Promises Handled

**Requirement**: No unhandled promise rejections; use `void`, `.catch()`, or `await`.

**Reason**: Unhandled rejections can crash the plugin or leave inconsistent state.

**Implementation**: All 32 promise chains properly handled:
- Fire-and-forget operations use `void` operator
- Critical operations use `try/catch` or `.catch()`
- Lifecycle methods properly await async operations

#### 4. Async/Await Consistency

**Requirement**: Methods marked `async` must use `await`; don't await non-Promises.

**Implementation**:
- [src/lib/dataApi.ts:163](../src/lib/dataApi.ts#L163) — Added `await` to `file.delete()`
- [src/lib/filesystem/inmem/filesystem.ts](../src/lib/filesystem/inmem/filesystem.ts) — Removed `async` from synchronous methods
- [src/ui/modals/editNoteModal.ts](../src/ui/modals/editNoteModal.ts) — Removed unnecessary await

#### 5. FileManager.trashFile() Instead of Vault.trash()

**Requirement** (Optional): Use `FileManager.trashFile()` to respect user's deletion preferences.

**Implementation**:
- [src/lib/filesystem/obsidian/filesystem.ts](../src/lib/filesystem/obsidian/filesystem.ts) — Both file and folder deletion updated

---

## Type Safety Guidelines

### The `any` Type Policy

**Rule**: Every `any` type must be justified. New `any` types require code review approval.

### Justified Categories

#### 1. Generic Utility Functions ✅ KEEP

```typescript
// src/lib/helpers/performance.ts
export function throttle<T extends (...args: any[]) => any>(fn: T, limit: number): T
export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): T
```

**Why**: Standard TypeScript pattern for higher-order functions. Using `unknown` breaks covariance for function parameters. This matches standard library patterns (`Array.map`, `Function.apply`).

#### 2. Event System ✅ KEEP

```typescript
// src/lib/stores/events.ts
onEvent(type: string, cb: (...data: any) => void)
```

**Why**: Events carry arbitrary payloads. Different event types have different data structures. Type parameters everywhere would break simplicity without adding real safety.

#### 3. Settings Migration ✅ KEEP

```typescript
// src/settings/settings.ts
export function migrateSettings(settings: any): Settings
```

**Why**: 
- Receives untyped data from Obsidian's `Plugin.loadData()` (returns `any` from localStorage)
- Must handle v1/v2/v3 formats + corrupted/malformed data
- Runtime checks on `version` field provide type narrowing
- Changing could break existing user migrations

#### 4. External API Integration ✅ KEEP

```typescript
// src/lib/datasources/dataview/standardize.ts
function standardizeObject(value: any)
```

**Why**: Dataview API is an external, untyped library. We must handle object structures we don't control.

#### 5. Test Mocks ✅ KEEP

```typescript
// src/__mocks__/obsidian.ts
// Various mock objects with any types
```

**Why**: Test mocks don't affect production code. Flexibility in tests is acceptable.

### Improved Types (v3.0.3)

These types were improved from `any`:

| File | Change | Reason |
|------|--------|--------|
| [viewSort.ts:40](../src/ui/app/viewSort.ts#L40) | `any` → `unknown` | Null check only, no property access |
| [logger.ts:99](../src/ui/views/Calendar/logger.ts#L99) | `Error \| unknown` → `unknown` | Union redundant (unknown includes Error) |
| [view.ts:56](../src/view.ts#L56) | Union with literals → `string` | String subsumes literal types |

---

## Justified Exceptions

### @ts-ignore Directives

The codebase contains intentional `@ts-ignore` directives for library compatibility:

#### Immer + TypeScript Strict Mode

**Location**: [src/lib/stores/dataframe.ts](../src/lib/stores/dataframe.ts)

```typescript
// 8 instances of @ts-ignore for Immer's Draft type system
draft.records.push(record);           // @ts-ignore - Immer Draft compat
draft.values[field.name] = value;     // @ts-ignore - Immer Draft compat
```

**Why**: Immer's `Draft<T>` type transforms readonly properties to mutable, but TypeScript's strict mode (`noUncheckedIndexedAccess`) conflicts with Immer's internal typing. The runtime behavior is correct; only the static type inference fails.

**Alternative Considered**: Remove Immer → Would require rewriting all immutable update patterns (~500 lines).

**Decision**: Keep `@ts-ignore` with comments. Immer is battle-tested; runtime correctness is verified by 150 unit tests.

#### Filter Functions

**Location**: [src/ui/app/filterFunctions.ts:95](../src/ui/app/filterFunctions.ts#L95)

```typescript
draft.records.filter((record) =>
  // @ts-ignore - matchesFilterConditions returns boolean
  matchesFilterConditions(filter, record)
);
```

**Why**: Complex generic type inference with Immer's produce function. The function signature is correct, but TypeScript cannot infer the full type chain.

---

## Code Quality Checklist

Before submitting a PR, ensure:

### Required ✅

- [ ] `npm run build` — Compiles without errors
- [ ] `npm test` — All 150 tests pass
- [ ] `npm run lint` — 0 ESLint errors
- [ ] No `console.log()` statements (use `console.debug()` if needed)
- [ ] No direct `localStorage` access (use App API)
- [ ] All promises handled (`void`, `.catch()`, or `await`)
- [ ] Async functions use `await` at least once
- [ ] No unnecessary `@ts-ignore` (justify in comments if needed)

### Recommended 📝

- [ ] Add tests for new functionality
- [ ] Update documentation for API changes
- [ ] Keep `any` types justified in comments
- [ ] Use `unknown` instead of `any` where possible

### Code Review Focus

Reviewers should pay special attention to:
1. New `any` types — require justification
2. New `@ts-ignore` — require explanation comment
3. Async/await patterns — verify proper handling
4. Error handling — verify promises have `.catch()`

---

## Testing Requirements

### Unit Tests

Run with: `npm test`

```bash
# Run all tests
npm test

# Run specific test file
npm test -- --testPathPattern="settings"

# Run with coverage
npm test -- --coverage
```

### Build Verification

```bash
# Full build
npm run build

# Watch mode for development
npm run dev
```

### Lint Check

```bash
# Check for issues
npm run lint

# Auto-fix where possible
npm run lint -- --fix
```

### Manual Testing Checklist

Before release, manually verify:

- [ ] Create note from template
- [ ] Edit note frontmatter
- [ ] Delete note
- [ ] Switch between views (Board, Table, Calendar, Gallery)
- [ ] Apply filters and sorting
- [ ] Multi-vault: verify data isolation

---

## Release Process

### Version Tags

**Important**: Tags must be without "v" prefix for Obsidian automatic version checking.

```bash
# Correct
git tag 3.0.3

# Incorrect (will not be detected by Obsidian)
git tag v3.0.3
```

### Files to Update

1. `manifest.json` — version field
2. `package.json` — version field
3. `versions.json` — add new version mapping
4. `CHANGELOG.md` — add release notes

### Release Checklist

- [ ] All tests pass
- [ ] Build successful
- [ ] CHANGELOG.md updated
- [ ] Version bumped in all files
- [ ] Tag created (without "v" prefix)
- [ ] GitHub release created

---

## Resources

### Obsidian Guidelines
- [Official Plugin Guidelines](https://docs.obsidian.md/Plugins/Submission+guidelines)
- [Plugin Developer Docs](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)

### Project Documentation
- [CONTRIBUTING.md](../CONTRIBUTING.md) — Contribution guide
- [CHANGELOG.md](../CHANGELOG.md) — Release history
- [README.md](../README.md) — User documentation

---

## Summary

Projects Plus maintains high code quality through:

1. **Strict TypeScript** — Catches errors at compile time
2. **ESLint Rules** — Enforces consistent style
3. **Justified Exceptions** — Every deviation documented
4. **Comprehensive Tests** — 150 unit tests
5. **Obsidian Compliance** — All requirements met

When contributing, follow this guide to ensure your code meets the project's standards and Obsidian Community Plugin requirements.

---

*Document maintained by the Projects Plus development team.*
