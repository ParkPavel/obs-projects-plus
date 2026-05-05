# Session State — V5 Refactor Master

> Refresh this file at every handoff. One-page summary of where we are.

## Live status (2026-05-05)
- **session_phase**: V5.0 Foundation (documentation + architecture restart).
- **status**: V5.0 deliverables COMPLETE. Trio of V5 docs landed; legacy V1-V4 docs archived; DOCS_INDEX rewritten. NO `src/` changes this phase.
- **jest baseline**: 98 suites / 1597 tests PASS (unchanged from previous V4 closure).
- **px-budget**: 191 (locked from REFACTOR-403b/404 closure).
- **tsc -noEmit -skipLibCheck**: clean.
- **build**: PASS (1 pre-existing third-party a11y warning from `obsidian-svelte/IconButton` — off-scope).

## V5 vision (one-liner)
Перенос плагина с парадигмы "Database view с виджетами" на парадигму **"Dashboard-as-canvas + Matryoshka sub-bases"**: каждая заметка с frontmatter — мини-база, между внутренними базами проекта живут двусторонние relations и rollups.

## V5.0 Foundation deliverables (this session)
1. `docs/MASTER_MAP_V5.md` — навигация (цели, карта кода 4-Matryoshka, топ долгов K-1..K-17, фазы V5.0..V5.7).
2. `docs/ARCHITECTURE_V5.md` — целевая архитектура (4 слоя с запретами, inventory с A-F грейдами, 7 публичных контрактов, 10 must-hold invariants).
3. `docs/REFACTOR_BACKLOG_V5.md` — приоритизированный backlog R5-001..R5-015 с DEPENDS_ON / BLOCKS / AC, граф зависимостей.
4. `docs/DOCS_INDEX.md` — переписан (корраптная склеенная версия удалена).
5. `docs/archive/` — архивированы `MASTER_MAP.md`, `ARCHITECTURE.md`, `ARCHITECTURE_V4.md`, `IMPLEMENTATION_PLAN_CURRENT.md`, `PHASE_1_MAPPING.md`, `PHASE_3_TICKETS.md` (через `git mv` где возможно + Move-Item).

## Top debts entering V5.1

| ID | Title | R5 | Phase |
|---|---|---|---|
| K-1 | Legacy DataGrid Table view (D-grade ~1800 LOC) | R5-001 | V5.4 |
| K-2 | 4 fragmented formula surfaces | R5-002 | V5.2 |
| K-3 | Calendar agenda filterEngine = параллельный engine | R5-003 | V5.2 |
| K-4 | Footer count semantic divergence | R5-004 | V5.1 |
| K-5 | 5+ ad-hoc color palettes; dead `lib/colors/contracts.ts` | R5-005 | V5.3 |
| K-6 | 7 files using `new Menu()` bypass helper | R5-006 | V5.1 |
| K-7 | ReDoS guards missing in `formulaEngine.ts` | R5-007 | V5.1 |
| K-8 | Legacy `view.type === "table"` ремап жив | R5-008 | V5.3 |
| K-9 | App/View/useView/DataFrameProvider — без unit tests | R5-014 | V5.2 |
| K-11 | Svelte 4 blocker: `(view as any).$set` | R5-015 | V5.1 |
| K-12 | `JSON.parse` без try/catch на user payload (2 sites) | R5-007 | V5.1 |
| K-15 | DashboardCanvas.svelte ~700 LOC, 4+ concerns | R5-013 | V5.2 |

## Open questions for next session

1. Подтверждение пользователем V5 vision и trio документов (явный signoff перед стартом V5.1).
2. Bilingual translation user-guide для V5 features — start now или defer до V5.7?
3. Версия плагина: V5 цикл — 4.0.0 (major bump) или продолжать 3.x.x WIP до V5.7 release?
4. Sub-base canvas (R5-009): nested `<DashboardCanvas>` recursion vs separate widget — design session нужен.

## Constraints enforced

- V5.0 = docs/architecture ONLY. Никаких правок `src/` до явного signoff пользователя.
- Все архитектурные решения, затрагивающие >2 модуля → `architect` субагент перед кодом.
- После каждого крупного блока → `context-keeper` субагент для preservation.

## Lessons from V4 (encoded in V5 invariants)

- `styles.css` — hand-maintained source; `esbuild.config.mjs::mergeCSS()` appends tokens via marker. Never `Remove-Item styles.css`.
- "Closing the px ratchet" ≠ "user-visible bugs fixed". Always read user screenshots before claiming Table widget done.
- Mojibake-named files may not actually have mojibake — diagnose with byte-level UTF-8 BOM check before deferring.
- PowerShell `Set-Content -Encoding utf8` (5.1) writes BOM and re-encodes via OEM; for UTF-8-no-BOM round-trips use `[System.IO.File]::WriteAllText` with `UTF8Encoding($false)`.

## Previous V4 closure (compressed)

V4 final outcome: Layer 1-3 fully closed; Layer 4 closed (REFACTOR-403, REFACTOR-403b, REFACTOR-401 partial color math kernel, REFACTOR-404 px→rem 793→191). REFACTOR-402 (formula editor convergence) and REFACTOR-302/306 (StrictGrid + deprecation) **superseded by V5 R5-001 / R5-002**. Detailed V4 ticket history retained in `.ai_internal/context_state.md`.
# Session State вЂ” V5 Refactor Master

> Refresh this file at every handoff. One-page summary of where we are.

## Live status (2026-05-05)
- **session_phase**: V5.0 Foundation (documentation + architecture restart).
- **status**: V5.0 deliverables COMPLETE. Trio of V5 docs landed; legacy V1-V4 docs archived; DOCS_INDEX rewritten. NO `src/` changes this phase.
- **jest baseline**: 98 suites / 1597 tests PASS (unchanged from previous V4 closure).
- **px-budget**: 191 (locked from REFACTOR-403b/404 closure).
- **tsc -noEmit -skipLibCheck**: clean.
- **build**: PASS (1 pre-existing third-party a11y warning from `obsidian-svelte/IconButton` вЂ” off-scope).

## V5 vision (one-liner)
РџРµСЂРµРЅРѕСЃ РїР»Р°РіРёРЅР° СЃ РїР°СЂР°РґРёРіРјС‹ "Database view СЃ РІРёРґР¶РµС‚Р°РјРё" РЅР° РїР°СЂР°РґРёРіРјСѓ **"Dashboard-as-canvas + Matryoshka sub-bases"**: РєР°Р¶РґР°СЏ Р·Р°РјРµС‚РєР° СЃ frontmatter вЂ” РјРёРЅРё-Р±Р°Р·Р°, РјРµР¶РґСѓ РІРЅСѓС‚СЂРµРЅРЅРёРјРё Р±Р°Р·Р°РјРё РїСЂРѕРµРєС‚Р° Р¶РёРІСѓС‚ РґРІСѓСЃС‚РѕСЂРѕРЅРЅРёРµ relations Рё rollups.

## V5.0 Foundation deliverables (this session)
1. `docs/MASTER_MAP_V5.md` вЂ” РЅР°РІРёРіР°С†РёСЏ (С†РµР»Рё, РєР°СЂС‚Р° РєРѕРґР° 4-Matryoshka, С‚РѕРї РґРѕР»РіРѕРІ K-1..K-17, С„Р°Р·С‹ V5.0..V5.7).
2. `docs/ARCHITECTURE_V5.md` вЂ” С†РµР»РµРІР°СЏ Р°СЂС…РёС‚РµРєС‚СѓСЂР° (4 СЃР»РѕСЏ СЃ Р·Р°РїСЂРµС‚Р°РјРё, inventory СЃ A-F РіСЂРµР№РґР°РјРё, 7 РїСѓР±Р»РёС‡РЅС‹С… РєРѕРЅС‚СЂР°РєС‚РѕРІ, 10 must-hold invariants).
3. `docs/REFACTOR_BACKLOG_V5.md` вЂ” РїСЂРёРѕСЂРёС‚РёР·РёСЂРѕРІР°РЅРЅС‹Р№ backlog R5-001..R5-015 СЃ DEPENDS_ON / BLOCKS / AC, РіСЂР°С„ Р·Р°РІРёСЃРёРјРѕСЃС‚РµР№.
4. `docs/DOCS_INDEX.md` вЂ” РїРµСЂРµРїРёСЃР°РЅ (РєРѕСЂСЂР°РїС‚РЅР°СЏ СЃРєР»РµРµРЅРЅР°СЏ РІРµСЂСЃРёСЏ СѓРґР°Р»РµРЅР°).
5. `docs/archive/` вЂ” Р°СЂС…РёРІРёСЂРѕРІР°РЅС‹ `MASTER_MAP.md`, `ARCHITECTURE.md`, `ARCHITECTURE_V4.md`, `IMPLEMENTATION_PLAN_CURRENT.md`, `PHASE_1_MAPPING.md`, `PHASE_3_TICKETS.md` (С‡РµСЂРµР· `git mv` РіРґРµ РІРѕР·РјРѕР¶РЅРѕ + Move-Item).

## Top debts entering V5.1
| ID | Title | R5 | Phase |
|---|---|---|---|
| K-1 | Legacy DataGrid Table view (D-grade ~1800 LOC) | R5-001 | V5.4 |
| K-2 | 4 fragmented formula surfaces | R5-002 | V5.2 |
| K-3 | Calendar agenda filterEngine = РїР°СЂР°Р»Р»РµР»СЊРЅС‹Р№ engine | R5-003 | V5.2 |
| K-4 | Footer count semantic divergence | R5-004 | V5.1 |
| K-5 | 5+ ad-hoc color palettes; dead `lib/colors/contracts.ts` | R5-005 | V5.3 |
| K-6 | 7 files using `new Menu()` bypass helper | R5-006 | V5.1 |
| K-7 | ReDoS guards missing in `formulaEngine.ts` | R5-007 | V5.1 |
| K-8 | Legacy `view.type === "table"` СЂРµРјР°Рї Р¶РёРІ | R5-008 | V5.3 |
| K-9 | App/View/useView/DataFrameProvider вЂ” Р±РµР· unit tests | R5-014 | V5.2 |
| K-11 | Svelte 4 blocker: `(view as any).$set` | R5-015 | V5.1 |
| K-12 | `JSON.parse` Р±РµР· try/catch РЅР° user payload (2 sites) | R5-007 | V5.1 |
| K-15 | DashboardCanvas.svelte ~700 LOC, 4+ concerns | R5-013 | V5.2 |

## Open questions for next session
1. РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РїРѕР»СЊР·РѕРІР°С‚РµР»РµРј V5 vision Рё trio РґРѕРєСѓРјРµРЅС‚РѕРІ (СЏРІРЅС‹Р№ signoff РїРµСЂРµРґ СЃС‚Р°СЂС‚РѕРј V5.1).
2. Bilingual translation user-guide РґР»СЏ V5 features вЂ” start now РёР»Рё defer РґРѕ V5.7?
3. Р’РµСЂСЃРёСЏ РїР»Р°РіРёРЅР°: V5 С†РёРєР» вЂ” 4.0.0 (major bump) РёР»Рё РїСЂРѕРґРѕР»Р¶Р°С‚СЊ 3.x.x WIP РґРѕ V5.7 release?
4. Sub-base canvas (R5-009): nested `<DashboardCanvas>` recursion vs separate widget вЂ” design session РЅСѓР¶РµРЅ.

## Constraint enforced
- V5.0 = docs/architecture ONLY. РќРёРєР°РєРёС… РїСЂР°РІРѕРє `src/` РґРѕ СЏРІРЅРѕРіРѕ signoff РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.
- Р’СЃРµ Р°СЂС…РёС‚РµРєС‚СѓСЂРЅС‹Рµ СЂРµС€РµРЅРёСЏ, Р·Р°С‚СЂР°РіРёРІР°СЋС‰РёРµ >2 РјРѕРґСѓР»СЏ в†’ `architect` СЃСѓР±Р°РіРµРЅС‚ РїРµСЂРµРґ РєРѕРґРѕРј.
- РџРѕСЃР»Рµ РєР°Р¶РґРѕРіРѕ РєСЂСѓРїРЅРѕРіРѕ Р±Р»РѕРєР° в†’ `context-keeper` СЃСѓР±Р°РіРµРЅС‚ РґР»СЏ preservation.

---

## Previous V4 closure (kept for handoff continuity)

### Layer 4 outcomes (previous session)
- **REFACTOR-403** вњ… i18n holes sweep (52 entries, 4 locales, 4 files).
- **REFACTOR-403b** вњ… Mojibake-frozen files (DateFormulaInput, FilterRow, AdvancedFilterEditor) вЂ” verified clean (artifact name; no actual mojibake), bulk pxв†’rem conversion done.
- **REFACTOR-401 (partial)** вњ… Color math kernel extracted (`src/lib/colors/math.ts` +18 cases). Pending 401b: allowlist, persistence, RecordItem palette popover extraction.
- **REFACTOR-404** вњ… px в†’ rem migration: 793 в†’ 191 (в€’602 this session). Ratchet locked at 191.
- **REFACTOR-402** вЏёпёЏ Formula editor convergence вЂ” superseded by V5 R5-002.

### Deferred from V4 (now mapped into V5 backlog)
- StrictGrid catch-up (was REFACTOR-302) в†’ R5-001.
- Legacy Table deprecation (was REFACTOR-306) в†’ R5-001.

### Design concept on file
- `docs/DESIGN_CONCEPT_NOTION_AESTHETIC.md` вЂ” СЃСЃС‹Р»Р°РµС‚СЃСЏ РЅР° R5-001/R5-005/R5-013.

### Lessons from V4 (encoded in V5 invariants)
- `styles.css` is hand-maintained source; `esbuild.config.mjs::mergeCSS()` appends tokens via marker. Never `Remove-Item styles.css`.
- "Closing the px ratchet" в‰  "user-visible bugs fixed". Always read user screenshots before claiming Table widget done.
- Mojibake-named files may not actually have mojibake вЂ” diagnose with byte-level UTF-8 BOM check before deferring.

