# 🐛 Bugfix Plan — Obsidian Code Review Issues

**Created**: 2026-01-29  
**Target Version**: v3.0.3  
**Status**: In Progress

## 📋 Executive Summary

Obsidian developers provided comprehensive code review feedback. This document categorizes all 51+ issues by priority, risk level, and implementation strategy to ensure zero regressions.

---

## 🎯 Issue Categories & Priority Matrix

| Category | Count | Priority | Risk Level | Est. Time |
|----------|-------|----------|------------|-----------|
| **localStorage → App API** | 4 | 🔴 Critical | High | 2h |
| **Unhandled Promises** | 32 | 🔴 Critical | High | 4h |
| **console.log removal** | 10 | 🟠 High | Low | 1h |
| **Async without await** | 15+ | 🟡 Medium | Medium | 3h |
| **`any` types** | 51 | 🟢 Low | Low | 8h |
| **Regex escape chars** | 15+ | 🟢 Low | Low | 1h |
| **Method binding issues** | 3 | 🟡 Medium | Medium | 1h |
| **Type issues** | 5 | 🟡 Medium | Low | 2h |

**Total Estimated Time**: 22 hours  
**Planned Sprints**: 3 phases

---

## 🚨 Phase 1: Critical Issues (4-6 hours)

### 1.1 localStorage → App API Migration [🔴 CRITICAL]

**Issue**: Using `localStorage` directly violates Obsidian plugin guidelines  
**Impact**: Data not isolated per vault, potential data corruption  
**Files affected**:
- `src/lib/stores/i18n.ts` (line 16)
- `src/lib/stores/ui.ts` (lines 34, 49)
- `src/ui/views/Calendar/calendar.ts` (line 263)

**Solution**:
```typescript
// Before
localStorage.setItem('key', value)
localStorage.getItem('key')

// After
this.app.saveLocalStorage('key', value)
this.app.loadLocalStorage('key')
```

**Testing**: Verify data persistence across vault switches

---

### 1.2 Unhandled Promises [🔴 CRITICAL]

**Issue**: 32 promises without `.catch()`, `.then()`, or `void` operator  
**Impact**: Silent failures, unhandled rejections crash plugin

**High-Priority Files**:
1. `src/view.ts` (lines 94, 119) — view lifecycle
2. `src/main.ts` (lines 69, 122, 177, 223-230, 340, 349) — plugin initialization
3. `src/events.ts` (lines 12-56) — event handlers
4. `src/ui/app/useView.ts` (lines 40, 48-59, 60, 76, 85) — reactive view updates

**Solution Strategy**:
```typescript
// Pattern 1: Fire-and-forget
void someAsyncFunction();

// Pattern 2: Error handling
someAsyncFunction().catch(err => console.error('Failed:', err));

// Pattern 3: Await in async context
await someAsyncFunction();
```

**Risk Analysis**:
- **Low Risk**: Event handlers, UI updates → use `void`
- **Medium Risk**: Data operations → add `.catch()` logging
- **High Risk**: Initialization code → use `await` + try/catch

---

### 1.3 console.log → console.debug/warn/error [🟠 HIGH]

**Issue**: Production logging pollution  
**Files affected**:
- `src/lib/helpers/performance.ts` (lines 221, 236)
- `src/ui/views/Calendar/logger.ts` (lines 74, 83)
- `src/ui/views/Calendar/viewport/ViewportStateManager.ts` (lines 148, 166, 186, 244, 284, 386)

**Solution**:
```typescript
// Replace all console.log with:
console.debug('[Projects+]', ...); // Development info
console.warn('[Projects+]', ...);  // Non-critical issues
console.error('[Projects+]', ...); // Critical errors
```

---

## ⚙️ Phase 2: Medium Priority Issues (6-8 hours)

### 2.1 Async Methods Without await [🟡 MEDIUM]

**Issue**: `async` keyword without any `await` expressions  
**Impact**: Unnecessary Promise wrapping, confusing intent

**Files**:
- `src/events.ts` (lines 11, 18, 29, 30, 41)
- `src/lib/filesystem/inmem/filesystem.ts` (lines 20, 24, 28, 118)
- `src/lib/dataApi.ts` (line 163)
- `src/main.ts` (lines 189, 237)
- `src/ui/views/*/View.ts` (multiple onOpen/onClose methods)

**Solution**: Remove `async` keyword or add proper `await`

---

### 2.2 Method Binding Issues [🟡 MEDIUM]

**Issue**: Methods not using arrow functions risk incorrect `this` binding  
**Files**:
- `src/main.ts` (lines 98, 135)
- `src/ui/views/Calendar/animation/AnimationController.ts` (line 47)

**Solution**:
```typescript
// Option 1: Arrow function property
private myMethod = () => { ... }

// Option 2: Explicit binding annotation
myMethod(this: void) { ... }
```

---

### 2.3 Promise in void Context [🟡 MEDIUM]

**Files**:
- `src/main.ts` (lines 155-158, 189-193) — onunload returns Promise but base expects void

**Solution**: Wrap async operations or change method signature

---

## 🔧 Phase 3: Low Priority Refactoring (8-12 hours)

### 3.1 Remove `any` Types [🟢 LOW]

**Issue**: 51 instances of `any` type reduce type safety  
**Strategy**: Gradual replacement with proper types

**Categorization**:
- **Quick wins** (15 cases): Already have known types
- **API boundaries** (20 cases): Need interface definitions
- **Dynamic data** (16 cases): Use `unknown` + type guards

**Files** (top priority):
- `src/lib/dataframe/dataframe.ts`
- `src/lib/datasources/dataview/*`
- `src/lib/metadata/decode.ts`
- `src/view.ts`

---

### 3.2 Regex Escape Character Cleanup [🟢 LOW]

**Issue**: 15+ unnecessary escape characters in regex  
**Files**:
- `src/lib/obsidian.ts` (lines 87, 90)
- `src/lib/metadata/decode.ts` (lines 51, 68)
- `src/ui/views/Gallery/helpers.ts` (lines 1, 2)

**Solution**: Remove escaping for: `"`, `!`, `|`, `#`, `^`, `[`, `:`, `<`, `>`, `*`, `?`, `/`

---

### 3.3 Type Assertion Improvements [🟢 LOW]

**Files**:
- `src/lib/duplicate/collisionDetector.ts` (line 36) — unnecessary assertion
- `src/lib/datasources/helpers.ts` (line 110) — enum type comparison
- `src/ui/views/Calendar/logger.ts` (line 99) — unknown overrides union
- `src/view.ts` (line 56) — string overrides literal types

---

## 📝 Implementation Strategy

### Testing Protocol
After each phase:
```bash
# 1. Run tests
npm run test

# 2. Run linter
npm run lint

# 3. Build plugin
npm run build

# 4. Manual testing checklist:
# - Create/edit/delete note
# - Switch between views (Board/Table/Calendar/Gallery)
# - Filter and sort records
# - Toggle project settings
# - Switch vaults (localStorage test)
```

### Commit Strategy
- **Phase 1**: 3-4 commits (localStorage, promises, console.log)
- **Phase 2**: 2-3 commits (async/await, bindings, void context)
- **Phase 3**: Multiple small commits (any types, regex, assertions)

### Rollback Plan
- Each commit must pass all tests
- Keep feature flags for risky changes
- Tag stable checkpoints: `bugfix-p1-stable`, `bugfix-p2-stable`

---

## 📊 Success Criteria

### Must Have (v3.0.3 release blockers)
- ✅ Zero localStorage usage
- ✅ Zero unhandled promise warnings in console
- ✅ All tests passing
- ✅ Plugin builds successfully
- ✅ Manual smoke test passes

### Should Have (quality improvements)
- ✅ console.log replaced with appropriate levels
- ✅ Async/await consistency
- ✅ Method binding issues fixed

### Nice to Have (future work)
- 🔄 50% reduction in `any` types (defer remaining to v3.1.0)
- 🔄 All regex escapes cleaned up
- 🔄 Type assertion improvements

---

## 🗓️ Timeline

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| Phase 1 | 6 hours | 2026-01-29 | 2026-01-29 |
| Phase 2 | 8 hours | 2026-01-30 | 2026-01-30 |
| Phase 3 | 12 hours | 2026-01-31 | 2026-02-02 |
| Testing & QA | 4 hours | 2026-02-03 | 2026-02-03 |
| **Release v3.0.3** | — | — | 2026-02-04 |

---

## 📦 User-Facing Issues (Future Work)

### Agenda Filter Propagation
**Issue**: User filters don't apply to Agenda view  
**Planned**: v3.1.0 (requires architecture changes)  
**Tracking**: Create separate issue `AGENDA_FILTERS.md`

### Frontmatter Auto-save
**Issue**: Changes require manual "Save" button click  
**Planned**: v3.1.0 (reactivity refactor needed)  
**Tracking**: Create separate issue `FRONTMATTER_AUTOSAVE.md`

---

## 🔗 Related Documents

- [Architecture: Database View](docs/architecture-database-view.md)
- [Architecture: Drag & Drop](docs/architecture-drag-drop.md)
- [Changelog](RELEASES.md)
- [User Guide](docs/user-guide.md)

---

**Last Updated**: 2026-01-29  
**Next Review**: After Phase 1 completion
