## CV-2 audit — `main 64863ed` + рабочий стек

### Findings (по цене ошибки)

1. **High — ReDoS защита неполна**

   [regexSafety.ts](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/helpers/regexSafety.ts:7) пропускает quantified alternation, например `(a|aa)+$`; это прямо отмечено как known gap на [строке 28](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/helpers/regexSafety.ts:28).

   Уязвимый шаблон исполняется в:

   - [filterEvaluator.ts:254](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/engine/filterEvaluator.ts:254)
   - [extendedEvaluator.ts:714](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/formula/extendedEvaluator.ts:714)
   - [extendedEvaluator.ts:723](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/formula/extendedEvaluator.ts:723)
   - [transformExecutor.ts:319](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/dashboard-engine/transformExecutor.ts:319), где `safeRegexCompile()` на [строке 396](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/dashboard-engine/transformExecutor.ts:396) не применяет даже существующие лимиты длины.

   Риск: пользовательский фильтр, формула или unpivot-паттерн может блокировать UI на backtracking. `try/catch` ловит лишь синтаксическую ошибку, не ReDoS.

2. **Medium — #153 продолжает отдельный путь отбора записей мимо filterEvaluator**

   [statsSelectionReceiver.ts:102](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/Stats/statsSelectionReceiver.ts:102)-[114](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/Stats/statsSelectionReceiver.ts:114) вручную делает `records.filter()` и собственную relation-нормализацию; вызывается из [StatsWidget.svelte:65](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/Stats/StatsWidget.svelte:65).

   Это не новый общий `FilterDefinition`-путь, но #153 расширяет существующий параллельный evaluator вместо `matchesCondition`/`applyFilter`. Есть риск семантического дрейфа от [relationFilterAdapter.ts:81](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/relationFilterAdapter.ts:81)-[89](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/relationFilterAdapter.ts:89), который после нормализации делегирует решение каноническому движку.

3. **Medium — async schema-write может переоткрыть UI после закрытия Dashboard view**

   После `await` callback’и без проверки жизненного цикла вызывают `reopenSchema()`:

   - [dashboardSchema.ts:74](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/dashboardSchema.ts:74)-[78](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/dashboardSchema.ts:78)
   - [dashboardSchema.ts:113](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/dashboardSchema.ts:113)-[126](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/dashboardSchema.ts:126)
   - [dashboardSchema.ts:150](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/dashboardSchema.ts:150)-[155](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/dashboardSchema.ts:155)

   `reopenSchema()` планирует `tick().then(openSchema)` на [строках 200–205](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/dashboardSchema.ts:200), тогда как `DashboardView.onClose()` лишь уничтожает Svelte view на [строках 115–118](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/dashboardView.ts:115). У контроллера нет `dispose`/`isAlive` guard. Запись может корректно завершиться, но модалка способна открыться из уже закрытого view.

### По пунктам

| Пункт | Вердикт | Результат |
|---|---|---|
| 1. `@ts-ignore` | **clean** | В `src` нет ни одного `@ts-ignore`. |
| 2. Единый фильтрующий движок | **finding** | #141 clean: rollup только обогащает frame, затем обычный view path фильтрует через facade канонического evaluator: [View.svelte:150](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/View.svelte:150), [153](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/View.svelte:153). #153 — отдельный ручной receiver, описан выше. |
| 3. i18n | **clean** | Все 4 JSON успешно распарсены. `commands.add-sub-base.name` и все `views.dashboard.sub-bases.*` отсутствуют во всех локалях; literal-вызовов `t()` к ним в `src` нет. Новые ключи уже совпадают с English locale либо штатно используют `defaultValue`; в ru/uk/zh для 14 новых ключей будет English fallback, конфликта ключей/строк нет. |
| 4. JSON.parse / RegExp / ReDoS | **finding** | Все найденные `JSON.parse` обёрнуты в `try/catch` либо получают контролируемые test data. Синтаксические ошибки RegExp также guarded. ReDoS finding — выше. |
| 5. Мёртвый код / orphan imports | **clean** | Импортов удалённых `subBase`/`crossSubBase` нет. Оставшиеся `subBases`, `SubBaseCanvasConfig` и legacy registry — намеренный compatibility-carrier/retired placeholder, а `targetSubBaseFilter` реально читается в resolver и rollup. |
| 6. Async lifecycle dashboard | **finding** | Migration backup в [dashboardView.ts:91](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/dashboardView.ts:91) не трогает view после await и безопасен. Schema-controller путь — stale-view finding выше. |

Typecheck и Jest не удалось выполнить: sandbox запрещает Node `realpath` родительского `C:\Users\Park` (`EPERM`). Аудит выполнен статически, без изменений файлов.

Codex session ID: 01a04614-a2f7-7d51-81fb-7355c2cb616d
Resume in Codex: codex resume 01a04614-a2f7-7d51-81fb-7355c2cb616d
