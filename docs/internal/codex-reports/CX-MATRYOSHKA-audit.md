# Вердикт

Это не «матрёшка» как системная модель: основная адаптация идёт от `rem` и viewport media queries, а не от непосредственного контейнера. Контейнерные запросы есть точечно; контейнерных единиц `cq*` — ноль.

Строгая перепроверка уточняет исходный факт: исполняемых `container-type` в `src` — **5**, не 6. Ещё два совпадения — комментарий в `FloatingPopup` и пример в `designTokens.ts`.

## Карта уровней

| Уровень | Реальная структура и определитель размера детей | Типографика / адаптивность | Вывод |
|---|---|---|---|
| Obsidian workspace leaf | `ProjectsView` монтирует Svelte `App` в `this.contentEl`; ширину задаёт Obsidian leaf, не плагин ([view.ts:110](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/view.ts:110)) | Плагин не задаёт локальный `font-size`; `rem` наследует root Obsidian. Токены прямо предполагают 16px root ([design-tokens.css:17](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/tokens/design-tokens.css:17)) | Все `rem` — родственники документа, не leaf/виджета. |
| App / View | `App` кладёт глобальный `ViewFilterBar` перед самим `View` ([App.svelte:296](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/App.svelte:296)); `View` растягивается `100% × 100%` | Унаследованные Obsidian font variables и root `rem` | Уже здесь глобальный фильтр отделён от целевой рабочей поверхности. |
| `ViewContent` | `flex:1`, `overflow:auto`, `min-width:0`, `max-width:100%`; это настоящий named container `view-content` ([ViewContent.svelte:11](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/Layout/ViewContent.svelte:11)) | Padding меняется через `@media (max-width:30rem)`, то есть viewport, не container ([ViewContent.svelte:33](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/Layout/ViewContent.svelte:33)) | Контейнер есть, но Dashboard его container queries не потребляет. |
| `DashboardCanvas` | Корень — колонка `width:100%; min-height:100%` ([DashboardCanvas.svelte:191](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/DashboardCanvas.svelte:191)) | `tokenCSS` инжектирует rem-токены, но не создаёт `container-type`; `CONTAINER_NAMES.canvas` существует лишь как план/API ([designTokens.ts:87](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/designTokens.ts:87)) | Между ViewContent и виджетом нет canvas-контекста адаптации. |
| `WidgetGrid` | Не grid в геометрическом смысле: stack-mode `flex-direction:column`, `width:100%`, gap в rem ([WidgetGrid.svelte:147](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/WidgetGrid.svelte:147)) | Нет `@container`; элементы растягиваются intrinsic/flex-правилами | Ширина WidgetShell зависит от растянутого стека, но не от собственной сеточной логики. |
| `WidgetHost` → `WidgetShell` | `WidgetHost` — дополнительный компонентный слой без собственной DOM-геометрии; он вставляет action/panel/content в `WidgetShell` ([WidgetHost.svelte:149](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/WidgetHost.svelte:149)). Shell — flex-column и named container `widget` ([WidgetShell.svelte:156](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/WidgetShell.svelte:156)) | Header имеет жёсткий `min-height:2.25rem`; контент `overflow:auto` ([WidgetShell.svelte:173](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/WidgetShell.svelte:173)) | Это единственный настоящий контейнер в dashboard-цепочке, который потребляют только Chart и FilterTabs. |
| Содержимое виджета | Stats: intrinsic grid `minmax(10rem,1fr)`; FilterTabs: одна `@container widget`; Chart: CSS-query лишь скрывает legend; Table: fixed rem tracks + горизонтальный scroll | Chart получает `width={480}` и px-высоту; Table генерирует tracks вида `${widthRem}rem` | Большинство дочерних компонентов не меняет размер/типографику от WidgetShell. |
| Popup / modal | FloatingPopup портируется в `body` и `position:fixed`, вычисляет координаты от viewport; SlideInPanel тоже fixed viewport; Relation picker — local absolute от cell | Много фиксированных min/max-width в rem, caps через `vw`/`vh` | Глобальные поверхности могут быть оправданны, но это осознанный разрыв «родственности». |

## Нарушения родственности — по цене ошибки

### P0 — теряется полезное содержимое или действие

1. **Chart не знает ширину WidgetShell.** Все основные графики получают `width={480}`, а shell скрывает overflow. Узкий shell даст клиппинг/нечитабельный график; единственная container-реакция — скрыть legend, размер canvas не пересчитывается.  
   [ChartWidget.svelte:137](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/Chart/ChartWidget.svelte:137), [ChartWidget.svelte:176](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/Chart/ChartWidget.svelte:176), [WidgetShell.svelte:245](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/WidgetShell.svelte:245)

2. **Таблица намеренно не сжимается под блок.** Tracks фиксированы в `rem`, таблица `min-width:max-content`; авторский комментарий подтверждает горизонтальный overflow как контракт. Это сохраняет выравнивание header/body, но прямо противоречит требованию «размер от родителя».  
   [tableCanon.ts:29](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/tableCanon.ts:29), [tableCanon.ts:95](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/tableCanon.ts:95), [DataTableContent.svelte:264](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/DataTableContent.svelte:264)

### P1 — сильный риск в узком leaf / split-pane

3. **Popup сознательно уходит из родителя в viewport.** Desktop popup переносится в `body`, фиксируется и clamp’ится относительно окна, а не WidgetShell; комментарий прямо называет container Shell причиной такого решения. Это технически обход overflow, но не матрёшка.  
   [FloatingPopup.svelte:114](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/FloatingPopup/FloatingPopup.svelte:114), [FloatingPopup.svelte:249](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/FloatingPopup/FloatingPopup.svelte:249), [FloatingPopup.svelte:302](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/FloatingPopup/FloatingPopup.svelte:302)

4. **Фильтр блока требует минимум 22rem независимо от ширины виджета.** Он открывается через этот viewport-popup, а внутренность имеет `min-width:22rem; max-width:28rem`. В shell уже уже 22rem пользователь получает поверхность, визуально не принадлежащую блоку и потенциально шире доступной панели.  
   [BlockFilterBar.svelte:56](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/BlockFilterBar.svelte:56), [BlockFilterBar.svelte:83](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/BlockFilterBar.svelte:83)

5. **Локальный relation picker тоже имеет фиксированный минимум 14rem.** В отличие от FloatingPopup он привязан правильно — к editable cell, — но не умеет flip/clamp/reflow и живёт внутри scroll-контекста таблицы. На узкой колонке/у нижней границы вероятны обрезание или неудобный скролл.  
   [EditableCell.svelte:105](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/EditableCell.svelte:105), [RelationPickerPopover.svelte:144](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/RelationPickerPopover.svelte:144)

6. **Pipeline реагирует на ширину окна, не на виджет.** Вложенный editor меняет трёхколоночный demo только при `@media(max-width:22rem)`. Узкий WidgetShell в широком desktop leaf не переключит layout.  
   [PipelineEditor.svelte:1050](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/PipelineEditor.svelte:1050), [PipelineEditor.svelte:1100](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/PipelineEditor.svelte:1100)

### P2 — деградация, но есть cap/fallback

7. **Slide-in panel — viewport-overlay с фиксированной базой 22rem; RecordCard повышает её до 28rem.** Есть `max-width:100vw`, поэтому не переполняет физический экран, но не адаптируется к workspace leaf/родителю.  
   [SlideInPanel.svelte:16](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/SlideInPanel/SlideInPanel.svelte:16), [SlideInPanel.svelte:94](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/SlideInPanel/SlideInPanel.svelte:94), [RecordCardView.svelte:117](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/RecordCardView/RecordCardView.svelte:117)

8. **Шаблонный confirm — viewport-sized fixed modal, а не surface текущего canvas.** Cap `calc(100vw - 2rem)` безопасен для экрана, но игнорирует размер leaf.  
   [TemplateConfirmDialog.svelte:50](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/TemplateConfirmDialog.svelte:50), [TemplateConfirmDialog.svelte:60](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/TemplateConfirmDialog.svelte:60)

## Container-type: что реально контейнеризовано

| Файл | Контейнер | Кто потребляет | Оценка |
|---|---|---|---|
| `ViewContent.svelte:16` | `view-content` | Calendar components | Работает вне Dashboard; Dashboard-потомки его не используют. |
| `WidgetShell.svelte:164` | `widget` | Chart, FilterTabs | Работает, но только две узкие адаптации. |
| `WidgetConfigShell.svelte:65` | `widget-config` | Его header/config items | Полезно: stack на 22rem. |
| `DataTableContent.svelte:255` | `db-table` | Никто | Бесполезная декларация: нет `@container db-table`. |
| `Calendar/Day.svelte:670` | unnamed inline-size | Локальная calendar query | Реально полезно, но не относится к Dashboard. |

Во всех пяти случаях контейнерные единицы `cqw/cqi/cqb/cqmin/cqmax` не используются. То есть queries могут переключать режим, но размеры/типографика всё ещё в основном root-relative `rem`.

Причина расхождения с «6 файлами»: поиск строки `container-type` находит также [FloatingPopup.svelte:251](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/FloatingPopup/FloatingPopup.svelte:251) и [designTokens.ts:90](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/designTokens.ts:90), но это комментарий и пример. Сам `design-tokens.css`, декларирующий принцип, вообще мёртвый код; effective tokens приходят из `tokens.css`. Это зафиксировано в [dashboardTokens.css:20](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/tokens/dashboardTokens.css:20).

## Фокус, табуляция, live-объявления и слои

Позитивное:

- `FloatingPopup` ставит фокус на первое действие, trap’ит Tab, возвращает фокус trigger и обрабатывает Esc.  
  [FloatingPopup.svelte:75](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/FloatingPopup/FloatingPopup.svelte:75), [FloatingPopup.svelte:188](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/FloatingPopup/FloatingPopup.svelte:188)
- Tabs в фильтре и Settings используют roving `tabindex`; editable cell и relation picker переводят фокус непосредственно на поле.  
  [FilterTabsWidget.svelte:45](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/FilterTabs/FilterTabsWidget.svelte:45), [SettingsMenuTabs.svelte:73](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/Navigation/SettingsMenu/SettingsMenuTabs.svelte:73), [RelationPickerPopover.svelte:44](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/RelationPickerPopover.svelte:44)
- Полезные статусы обозначены `aria-live`: пересчёт canvas, dirty-state, count таблицы, bridge фильтра.  
  [DashboardCanvas.svelte:152](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/DashboardCanvas.svelte:152), [WidgetConfigShell.svelte:30](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/_shared/WidgetConfigShell.svelte:30), [TableControlBar.svelte:76](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/TableControlBar.svelte:76)

Риски приоритета:

- **Settings dialog заявлен modal, но не получает initial focus, не trap’ит Tab и не возвращает фокус trigger.** `tabindex=-1` сам по себе этого не делает; значит фокус может уйти к фоновому workspace.  
  [SettingsMenuPopover.svelte:107](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/Navigation/SettingsMenu/SettingsMenuPopover.svelte:107), [SettingsMenuPopover.svelte:135](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/Navigation/SettingsMenu/SettingsMenuPopover.svelte:135)

- **SlideInPanel имеет те же пробелы:** `aria-modal=true`, Esc и backdrop есть, но initial focus / trap / restore нет.  
  [SlideInPanel.svelte:29](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/SlideInPanel/SlideInPanel.svelte:29), [SlideInPanel.svelte:51](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/SlideInPanel/SlideInPanel.svelte:51)

- **Каждый WidgetShell добавляет лишнюю Tab-остановку.** `role=region` и `tabindex=0` выдаются всем виджетам, до их реальных действий/ячеек. Для плотного dashboard это удлиняет клавиатурный путь.  
  [accessibility.ts:56](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/lib/dashboard-engine/accessibility.ts:56), [WidgetShell.svelte:93](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/WidgetShell.svelte:93)

- **Скрытые hover-actions остаются tabbable.** Configure/pipeline/lock/remove получают `opacity:0`, но не `tabindex=-1`/`inert`; клавиатурный пользователь попадает на визуально невидимые controls.  
  [WidgetHeaderActions.svelte:121](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/WidgetHeaderActions.svelte:121), [WidgetHeaderActions.svelte:145](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/WidgetHeaderActions.svelte:145)

- **Слой не выражает приоритет последовательно.** FloatingPopup и SlideInPanel оба на 50; настройки, template-confirm и локальные pickers используют другие шкалы. Токены задают иерархию, но локальные literal/разные aliases её обходят.  
  [SlideInPanel.svelte:86](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/SlideInPanel/SlideInPanel.svelte:86), [FloatingPopup.svelte:303](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/FloatingPopup/FloatingPopup.svelte:303), [TemplateConfirmDialog.svelte:57](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/TemplateConfirmDialog.svelte:57)

## ТОРМОЗА: структурно удлинённый путь к действию

1. **Добавление виджета:** сначала нужно раскрыть «Widgets», затем открыть Add menu, а templates спрятаны ещё на один уровень глубже.  
   [DashboardToolbar.svelte:23](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/DashboardToolbar.svelte:23), [WidgetToolbar.svelte:43](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/WidgetToolbar.svelte:43), [WidgetToolbar.svelte:75](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/WidgetToolbar.svelte:75)

2. **Конфигурирование существующего виджета:** primary action спрятан hover-иконкой; fallback — `…` menu; после этого `WidgetHost` добавляет ещё panel-слой перед контентом. Это хорошо для expert shortcuts, но медленно для первого использования.  
   [WidgetHeaderActions.svelte:33](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/WidgetHeaderActions.svelte:33), [WidgetHeaderActions.svelte:145](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/WidgetHeaderActions.svelte:145), [WidgetHost.svelte:174](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/WidgetHost.svelte:174)

3. **Открытие записи и row actions:** действия существуют только как hover-reveal кнопки 1.25rem. Пользователь сначала должен обнаружить hover-зону, затем попасть в маленькую цель.  
   [TableRow.svelte:58](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/TableRow.svelte:58), [TableRow.svelte:126](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/TableRow.svelte:126)

4. **Фильтры разделены на три поверхности:** глобальный FilterBar выше view, local FilterTabs внутри widget и bridge с отдельным «Save as global». Пользователю нужно сначала понять scope, а затем совершить promote как второе действие.  
   [App.svelte:300](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/App.svelte:300), [FilterBridge.svelte:16](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/FilterBridge.svelte:16), [BlockFilterBar.svelte:43](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/BlockFilterBar.svelte:43)

5. **Настройки view — вход через nav popover, затем шесть tabs, часть которых горизонтально скроллится.** Это не прямой путь к filter/sort/view config, особенно в узком leaf.  
   [App.svelte:321](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/app/App.svelte:321), [SettingsMenuTabs.svelte:12](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/Navigation/SettingsMenu/SettingsMenuTabs.svelte:12), [SettingsMenuTabs.svelte:87](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/components/Navigation/SettingsMenu/SettingsMenuTabs.svelte:87)

6. **Связь таблицы настраивается только после входа в relation cell без данных.** Прямой CTA `Link database…` появляется глубоко в picker-state, а не рядом с самой колонкой/ошибкой конфигурации.  
   [RelationPickerPopover.svelte:105](/C:/Users/Park/OBSv1.0/obs-projects-plus/src/ui/views/Dashboard/widgets/DatabaseCall/RelationPickerPopover.svelte:105)

Ограничение аудита: это статическая code-review проверка в read-only режиме; я не запускал Obsidian и не утверждаю фактические пиксельные артефакты без runtime-скриншотов.

Codex session ID: 01a048f9-fc50-70a3-800e-9ba87ad68667
Resume in Codex: codex resume 01a048f9-fc50-70a3-800e-9ba87ad68667
