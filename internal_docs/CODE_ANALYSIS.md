# 📊 Code Analysis Report: obs-projects-plus

**Date**: November 16, 2025  
**Scope**: Unused imports, dead code, and code quality issues  
**Analyzed Directories**: `src/lib/`, `src/ui/`, `src/managers/`, `src/settings/`

---

## 🔴 Critical Issues (Must Fix)

### 1. Missing `await` Statements in `src/lib/dataApi.ts`

**File**: `src/lib/dataApi.ts`  
**Lines**: 77-78, 86-87  
**Type**: Missing `await` in async functions  
**Severity**: 🔴 CRITICAL

**Issue**: Two async methods don't await Promise.all() calls, causing promises to be ignored.

```typescript
// ❌ Line 77-87 (BROKEN)
async renameField(paths: string[], from: string, to: string): Promise<void> {
  Promise.all(  // ← Missing await here!
    paths
      .map((path) => this.fileSystem.getFile(path))
      .filter(notEmpty)
      .map((file) =>
        this.updateFile(file, (data) => doRenameField(data, from, to))()
      )
  );
}

async deleteField(paths: string[], name: string): Promise<void> {
  Promise.all(  // ← Missing await here!
    paths
      .map((path) => this.fileSystem.getFile(path))
      .filter(notEmpty)
      .map((file) =>
        this.updateFile(file, (data) => doDeleteField(data, name))()
      )
  );
}
```

**Fix**: Add `await` before `Promise.all()`

---

## 🟠 High Priority Issues

### 2. Unused Import Alias `T` and `TE` in `src/lib/dataApi.ts`

**File**: `src/lib/dataApi.ts`  
**Line**: 22  
**Type**: Unused import aliases  
**Severity**: 🟠 HIGH

```typescript
// ❌ Line 22
import { function as F, task as T, either as E, taskEither as TE } from "fp-ts";
//                              ↑ T unused                      ↑ TE unused
```

**Context**: 
```typescript
import { function as F, task as T, either as E, taskEither as TE } from "fp-ts";
// Only F and E are used in the file; T and TE are imported but never used
```

**Used**: `F` (function), `E` (either)  
**Unused**: `T` (task), `TE` (taskEither)

**Fix**: Remove `task as T` and `taskEither as TE` from import

---

### 3. Unused Import `moment` in `src/lib/dataApi.ts`

**File**: `src/lib/dataApi.ts`  
**Line**: 2  
**Type**: Unused import  
**Severity**: 🟠 HIGH

```typescript
// ❌ Line 2
import moment from "moment";  // Imported but not used

// ✅ Line 1 - dayjs is used instead
import dayjs from "dayjs";
```

**Context**:
```typescript
import dayjs from "dayjs";
import { produce } from "immer";


import { get } from "svelte/store";
```

The file imports `moment` but uses `dayjs` instead. `moment` is not referenced anywhere in the file.

**Fix**: Remove `import moment from "moment"`

---

### 4. Unused Import `moment` in `src/ui/modals/components/CreateProject.svelte`

**File**: `src/ui/modals/components/CreateProject.svelte`  
**Line**: 2  
**Type**: Unused import  
**Severity**: 🟠 HIGH

```typescript
// ❌ Line 2
import moment from "moment";
```

**Context**:
```typescript
<script lang="ts">
  import moment from "moment";  // ← Imported but not used
  import {
    Button,
    Callout,
    FileAutocomplete,
    ...
  } from "obsidian-svelte";
```

**Used for**: The component calls `interpolateTemplate()` which accepts `moment()` in the template formatter, but imports it directly without using it elsewhere.

**Fix**: Check if the template functions actually need direct `moment` import, or remove it

---

### 5. Unused Import `moment` in `src/lib/stores/i18n.ts`

**File**: `src/lib/stores/i18n.ts`  
**Line**: 4  
**Type**: Unused import  
**Severity**: 🟠 HIGH (Different usage pattern)

```typescript
// Line 4
import { moment } from "obsidian";
```

**Context**:
```typescript
import i18next from "i18next";
import { createI18nStore } from "svelte-i18next";

import { moment } from "obsidian";  // Imported from obsidian
// ...later in code:
i18next.init({
  lng: moment.locale(),  // ✅ This IS used
  // ...
});
```

**Status**: ✅ **This import IS actually used** - It's used to get the locale setting. No action needed.

---

## 🟡 Medium Priority Issues

### 6. Empty Exported Function `activateView` in `src/managers/CommandManager.ts`

**File**: `src/managers/CommandManager.ts`  
**Lines**: 83-84  
**Type**: Empty stub method  
**Severity**: 🟡 MEDIUM

```typescript
// ❌ Lines 83-84
private activateView(projectId?: string, viewId?: string): void {
  // This will be injected by the main plugin
}
```

**Context**:
```typescript
private activateView(projectId?: string, viewId?: string): void {
  // This will be injected by the main plugin
}

setActivateViewFunction(fn: (projectId?: string, viewId?: string) => void): void {
  this.activateView = fn;
}
```

**Issue**: This is a stub method with no implementation. It's meant to be overridden via `setActivateViewFunction()`. Consider documenting this pattern better or using a callback pattern.

**Fix**: Add documentation or consider refactoring to use dependency injection more explicitly

---

### 7. Unused Variable Initialization in `src/ui/views/Developer/DeveloperView.svelte`

**File**: `src/ui/views/Developer/DeveloperView.svelte`  
**Lines**: 44-47  
**Type**: Variables initialized but only partially used  
**Severity**: 🟡 MEDIUM

```typescript
// ❌ Lines 44-47 (Partial usage)
let textValue = "Text";
let numberValue = 10;
```

**Context**:
```typescript
let btn1: HTMLButtonElement;
let btn1Open = false;

let btn2: HTMLButtonElement;
let btn2Open = false;

let btn3: HTMLButtonElement;
let btn3Open = false;

let textValue = "Text";
let numberValue = 10;
```

**Status**: These are declared but are likely demo/development UI variables. The component appears to be a developer view for testing components.

---

## 🟢 Low Priority Issues / Code Quality

### 9. Blank Lines Between Imports in `src/lib/dataApi.ts`

**File**: `src/lib/dataApi.ts`  
**Line**: 2-5  
**Type**: Code formatting  
**Severity**: 🟢 LOW

```typescript
// ❌ Lines 1-5 - Inconsistent spacing
import dayjs from "dayjs";
import { produce } from "immer";


import { get } from "svelte/store";  // Extra blank lines
```

**Context**:
```typescript
import dayjs from "dayjs";
import { produce } from "immer";
// ↑ Two blank lines here - inconsistent formatting

import { get } from "svelte/store";
import { v4 as uuidv4 } from "uuid";
```

**Fix**: Remove extra blank lines to follow consistent import grouping

---

## 📋 Summary Table

| # | File | Line | Issue Type | Severity | Status |
|---|------|------|-----------|----------|--------|
| 1 | `src/lib/dataApi.ts` | 77-87 | Missing `await` | 🔴 CRITICAL | ❌ MUST FIX |
| 2 | `src/lib/dataApi.ts` | 22 | Unused import alias `T`, `TE` | 🟠 HIGH | ❌ SHOULD FIX |
| 3 | `src/lib/dataApi.ts` | 2 | Unused import `moment` | 🟠 HIGH | ❌ SHOULD FIX |
| 4 | `src/ui/modals/components/CreateProject.svelte` | 2 | Unused import `moment` | 🟠 HIGH | ⚠️ CHECK |
| 5 | `src/managers/CommandManager.ts` | 83-84 | Empty stub method | 🟡 MEDIUM | ℹ️ DOCUMENT |
| 6 | `src/ui/views/Developer/DeveloperView.svelte` | 44-47 | Demo variables | 🟡 MEDIUM | ℹ️ CONTEXT |
| 7 | `src/lib/dataApi.ts` | 2-5 | Extra blank lines | 🟢 LOW | ✅ FORMAT |

---

## ✅ Recommendations

### Priority 1 (CRITICAL - Fix Immediately)
1. **Add `await` keywords** in `src/lib/dataApi.ts` methods `renameField()` and `deleteField()`

### Priority 2 (HIGH - Fix Soon)
2. **Remove unused imports** in `src/lib/dataApi.ts`: `moment`, `T` (task), `TE` (taskEither)
3. **Check `moment` usage** in `src/ui/modals/components/CreateProject.svelte`

### Priority 3 (MEDIUM - Code Quality)
4. **Document empty methods** in `src/managers/CommandManager.ts` with clearer pattern
5. **Fix import spacing** in `src/lib/dataApi.ts`

### Priority 4 (LOW - Nice to Have)
6. **Review developer view variables** - Determine if they're test fixtures or cleanup needed
7. **Run linter** with strict mode enabled to catch more issues

---

## 🔧 Next Steps

1. Run TypeScript compiler in strict mode: `tsc --noUnusedLocals --noUnusedParameters`
2. Run ESLint with all rules enabled to catch additional issues
3. Add pre-commit hooks to catch these issues automatically
4. Consider adding `const T = T; // explicitly unused` if fp-ts types need to be imported
