# 🗺️ Bugfix Roadmap — v3.0.3

**Status**: 🟡 In Progress  
**Target Release**: 2026-02-04

---

## 📈 Progress Overview

```
Phase 1 (Critical):    ✅✅✅✅✅✅ 6/6 hours
Phase 2 (Medium):      ⬜⬜⬜⬜⬜⬜⬜⬜ 0/8 hours  
Phase 3 (Low Priority): ⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ 0/12 hours
```

**Total Progress**: 23% (6/26 hours)

---

## ✅ Phase 1: Critical Issues (6h) — COMPLETED

### 1.1 localStorage → App API [🟢 2h] ✅
- [x] `src/lib/stores/i18n.ts` (line 16)
- [x] `src/lib/stores/ui.ts` (lines 34, 49)  
- [x] `src/ui/views/Calendar/calendar.ts` (line 263)
- [x] Test: Verify vault-specific data isolation
- **Commit**: `75b064f` — All localStorage replaced with App API

### 1.2 Unhandled Promises [🟢 3h] ✅
- [x] `src/view.ts` — 2 instances
- [x] `src/main.ts` — 5 instances (ribbon, commands, subscriptions)
- [x] `src/events.ts` — 4 instances (file watcher callbacks)
- [x] `src/ui/app/useView.ts` — 2 instances (lifecycle)
- [x] Test: Check console for unhandled rejections
- **Commit**: `35cc825` — All 32 promises handled with void or .catch()

### 1.3 console.log cleanup [🟢 1h] ✅
- [x] `src/lib/helpers/performance.ts` — 2 instances
- [x] `src/ui/views/Calendar/logger.ts` — 1 instance
- [x] `src/ui/views/Calendar/viewport/ViewportStateManager.ts` — 6 instances
- [x] Test: No console.log in production build
- **Commit**: `35cb9e5` — All 10 console.log replaced with console.debug

**Milestone**: ✅ `npm test && npm run build` — All tests pass, build successful

---

## ⚙️ Phase 2: Medium Priority (8h)

### 2.1 Async without await [🟡 4h]
- [ ] `src/events.ts` — 5 methods
- [ ] `src/lib/filesystem/inmem/filesystem.ts` — 4 methods
- [ ] `src/lib/dataApi.ts` — 1 method
- [ ] `src/main.ts` — 2 methods  
- [ ] `src/ui/views/*/View.ts` — 8+ methods
- [ ] Test: Verify async behavior unchanged

### 2.2 Method binding [🟡 2h]
- [ ] `src/main.ts` — 2 methods
- [ ] `src/ui/views/Calendar/animation/AnimationController.ts` — 1 method
- [ ] Test: Manual UI interaction tests

### 2.3 Promise/void mismatches [🟡 2h]
- [ ] `src/main.ts` onunload
- [ ] Other lifecycle methods
- [ ] Test: Plugin load/unload cycles

**Milestone**: Full regression test suite

---

## 🔧 Phase 3: Low Priority (12h)

### 3.1 Remove any types [🟢 8h]
- [ ] Quick wins — 15 instances
- [ ] API boundaries — 20 instances  
- [ ] Dynamic data — 16 instances
- [ ] Test: TypeScript strict mode passes

### 3.2 Regex cleanup [🟢 2h]
- [ ] `src/lib/obsidian.ts`
- [ ] `src/lib/metadata/decode.ts`
- [ ] `src/ui/views/Gallery/helpers.ts`
- [ ] Test: Regex unit tests pass

### 3.3 Type assertions [🟢 2h]
- [ ] Remove unnecessary assertions
- [ ] Fix enum comparisons
- [ ] Fix union type issues
- [ ] Test: Compilation warnings clean

**Milestone**: Zero TypeScript warnings

---

## 📝 Documentation & Release

### CHANGELOG.md Updates
```markdown
## [3.0.3] - 2026-02-04

### Bug Fixes
- Fix localStorage usage for proper vault isolation (#issue)
- Handle all async operations correctly
- Clean up development logging
- Improve TypeScript type safety
- Address Obsidian plugin review feedback

### Internal
- Migrate to App#saveLocalStorage/loadLocalStorage API
- Add proper error handling for 32 promise chains
- Remove console.log in favor of console.debug/warn/error
- Fix async/await consistency issues
- Reduce any types by 30%
```

### Release Notes
- [ ] Create `releases/v3.0.3/RELEASE_NOTES.md`
- [ ] Highlight Community Plugins compliance
- [ ] Document user-facing improvements (if any)

---

## 🧪 Testing Checklist

### Automated Tests
- [ ] `npm run test` — All 150 tests pass
- [ ] `npm run lint` — Zero errors
- [ ] `npm run build` — Successful build
- [ ] `npm run svelte-check` — No Svelte errors

### Manual Testing
- [ ] **Basic Operations**
  - [ ] Create note from template
  - [ ] Edit note frontmatter
  - [ ] Delete note
  - [ ] Rename note

- [ ] **Views**
  - [ ] Switch to Board view
  - [ ] Switch to Table view
  - [ ] Switch to Calendar view
  - [ ] Switch to Gallery view

- [ ] **Features**
  - [ ] Apply filters
  - [ ] Sort columns
  - [ ] Group by fields
  - [ ] Search notes
  - [ ] Toggle completion status

- [ ] **Multi-Vault**
  - [ ] Switch vaults
  - [ ] Verify data isolation
  - [ ] Check localStorage migration

- [ ] **Performance**
  - [ ] Load 1000+ notes
  - [ ] Rapid view switching
  - [ ] No console errors

---

## 📊 Risk Assessment

| Change Area | Regression Risk | Mitigation |
|-------------|----------------|------------|
| localStorage migration | 🟡 Medium | Comprehensive vault switching tests |
| Promise handling | 🟢 Low | Use `void` for fire-and-forget |
| console.log removal | 🟢 Low | No functional impact |
| Async refactoring | 🟡 Medium | Preserve method signatures |
| Type changes | 🟢 Low | Incremental, compile-checked |

---

## 🚀 Release Process

1. **Pre-release**
   - [ ] All tests pass
   - [ ] Manual QA complete
   - [ ] CHANGELOG updated
   - [ ] Version bump: `3.0.2` → `3.0.3`

2. **Release**
   - [ ] Create git tag `v3.0.3`
   - [ ] GitHub Actions build
   - [ ] Upload release artifacts
   - [ ] Publish release notes

3. **Post-release**
   - [ ] Monitor GitHub issues
   - [ ] Community feedback
   - [ ] Plan v3.1.0 (Agenda filters, autosave)

---

**Document Owner**: Development Team  
**Last Updated**: 2026-01-29  
**Next Review**: After each phase completion
