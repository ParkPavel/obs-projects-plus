// ============================================================
// Demo project — Projects Plus
//
// Single coherent B2B Studio (digital agency) domain.
// Replaces the legacy 1937-LOC mishmash (fitness + finance + CRM + tasks)
// archived under .ai_internal/Archive/OLD-demoProject-2026-05-27.ts.
//
// Story: a digital studio with 6 clients, 8 projects, 10 tasks and
// 5 meetings — naturally exercises relations (Project.client → Client),
// filters (active vs done), board grouping by status, calendar timed
// events, gallery covers and rollup aggregates (MRR sum, project value).
//
// Idempotency: createDemoProject is safe to re-run. Folder / file
// creation calls are wrapped in try/catch — duplicates are skipped.
// ============================================================

import dayjs from "dayjs";
import { normalizePath, stringifyYaml, type Vault } from "obsidian";
import { v4 as uuidv4 } from "uuid";

import { settings } from "src/lib/stores/settings";
import type { BoardConfig } from "src/ui/views/Board/types";
import type { CalendarConfig } from "src/ui/views/Calendar/types";
import type { GalleryConfig } from "src/ui/views/Gallery/types";
import type {
  DatabaseViewConfig,
  WidgetDefinition,
} from "src/ui/views/Dashboard/types";
import { DEFAULT_PROJECT, DEFAULT_VIEW } from "src/settings/settings";
import type { ColorRule, FieldConfig } from "src/settings/base/settings";

const DEMO_FOLDER = "Projects Plus - Демо";

type FrontMatter = Record<string, unknown>;
interface DemoFile {
  readonly frontmatter: FrontMatter;
  readonly content: string;
}

// ── helpers ─────────────────────────────────────────────────────────
const today = () => dayjs();
const wikilink = (name: string) => `[[${name}]]`;
const widgetId = (() => {
  let n = Date.now();
  return () => `w-${n++}`;
})();

// ── content templates ───────────────────────────────────────────────
const clientBody = (industry: string, tagline: string) =>
  `## Клиент\n\n**Индустрия:** ${industry}\n**Описание:** ${tagline}\n\n### История\n*Заметки по аккаунту.*\n`;

const projectBody = (goal: string, scope: string[]) =>
  `## Проект\n\n**Цель:** ${goal}\n\n### Скоуп\n${scope.map((s) => `- ${s}`).join("\n")}\n\n### Заметки\n*Решения, ссылки, артефакты.*\n`;

const taskBody = (description: string, checklist: string[]) =>
  `## Задача\n\n${description}\n\n### Чеклист\n${checklist.map((c) => `- [ ] ${c}`).join("\n")}\n`;

const meetingBody = (agenda: string[]) =>
  `## Встреча\n\n### Повестка\n${agenda.map((a, i) => `${i + 1}. ${a}`).join("\n")}\n\n### Решения\n*Заполните во время встречи.*\n`;

// ============================================================
// SEED DATA — agency domain (compact tuple format)
// ============================================================
//
// Each entity row is a flat tuple converted to DemoFile by the
// build* function. This keeps the seed data dense and grep-friendly:
// names align as columns, no per-record `frontmatter:/content:` boilerplate.

interface ClientSeed {
  name: string;
  industry: string;
  stage: "lead" | "active" | "churn";
  mrr: number;
  daysAgo: number;   // signup offset
  cover: string;
  tagline: string;
}

interface ProjectSeed {
  name: string;
  client: string;
  value: number;
  startOffset: number; // days from today (negative = past)
  deadlineOffset: number;
  status: "planning" | "inProgress" | "review" | "done";
  progress: number;
  cover: string;
  goal: string;
  scope: string[];
  tags: string[];
}

interface TaskSeed {
  name: string;
  project: string;
  assignee: string;
  dueOffset: number;
  priority: "high" | "medium" | "low";
  status: "todo" | "doing" | "review" | "done";
  estimate: number;
  completed: boolean;
  description: string;
  checklist: string[];
  tags?: string[];
}

interface MeetingSeed {
  name: string;
  client: string;
  dayOffset: number;
  startTime: string;
  endTime: string;
  participants: string[];
  agenda: string[];
}

const CLIENT_SEEDS: ClientSeed[] = [
  { name: "Acme Studio",   industry: "SaaS",       stage: "active", mrr: 12000, daysAgo: 180, cover: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800", tagline: "Платформа для управления подписками." },
  { name: "Helix Labs",    industry: "FinTech",    stage: "active", mrr: 18000, daysAgo: 240, cover: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800", tagline: "Платежный процессинг для маркетплейсов." },
  { name: "Nimbus Retail", industry: "E-commerce", stage: "active", mrr: 7500,  daysAgo: 90,  cover: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800", tagline: "Сеть бутиков, омниканальная розница." },
  { name: "Lumen Academy", industry: "EdTech",     stage: "lead",   mrr: 0,     daysAgo: 14,  cover: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800", tagline: "Онлайн-курсы по data science." },
  { name: "Orbit Media",   industry: "Media",      stage: "active", mrr: 4500,  daysAgo: 45,  cover: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=800", tagline: "Подкаст-сеть и видеопродакшен." },
  { name: "Vertex Health", industry: "HealthTech", stage: "churn",  mrr: 0,     daysAgo: 420, cover: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800", tagline: "Телемедицина, ушли по бюджету Q4." },
];

const PROJECT_SEEDS: ProjectSeed[] = [
  { name: "Redesign — Acme Studio",        client: "Acme Studio",   value: 48000, startOffset: -20, deadlineOffset: 15,  status: "inProgress", progress: 55,  cover: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800", goal: "Обновить дашборд и онбординг для повышения retention.", scope: ["UX-аудит", "Новая палитра", "Прототип Figma", "Внедрение"], tags: ["project", "design"] },
  { name: "Mobile App — Helix Labs",       client: "Helix Labs",    value: 85000, startOffset: -60, deadlineOffset: 45,  status: "inProgress", progress: 40,  cover: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800", goal: "Нативное iOS/Android приложение для платежей.",         scope: ["Архитектура", "iOS MVP", "Android MVP", "QA", "Релиз"], tags: ["project", "mobile"] },
  { name: "Storefront — Nimbus Retail",    client: "Nimbus Retail", value: 32000, startOffset: -5,  deadlineOffset: 40,  status: "planning",   progress: 10,  cover: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800", goal: "Новый Shopify storefront с кастомным чекаутом.",          scope: ["Discovery", "Каталог", "Чекаут", "Тестирование"],       tags: ["project", "ecommerce"] },
  { name: "Brand Refresh — Orbit Media",   client: "Orbit Media",   value: 18000, startOffset: -30, deadlineOffset: 5,   status: "review",     progress: 85,  cover: "https://images.unsplash.com/photo-1561070791-2526d30994b8?w=800", goal: "Ребрендинг подкаст-сети: лого, гайдлайн, обложки.",       scope: ["Концепт", "Лого", "Гайдлайн", "Применение"],            tags: ["project", "branding"] },
  { name: "Pitch Deck — Lumen Academy",    client: "Lumen Academy", value: 6000,  startOffset: -7,  deadlineOffset: 10,  status: "inProgress", progress: 30,  cover: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800", goal: "Инвестиционный pitch deck для seed-раунда.",              scope: ["Storyline", "Финансы", "Дизайн слайдов"],               tags: ["project", "presentation"] },
  { name: "Site Audit — Vertex Health",    client: "Vertex Health", value: 8500,  startOffset: -120,deadlineOffset: -60, status: "done",       progress: 100, cover: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800", goal: "Технический и UX-аудит лендинга (закрыт).",               scope: ["Lighthouse", "UX-ревью", "Отчет"],                       tags: ["project", "audit"] },
  { name: "Onboarding Flow — Acme Studio", client: "Acme Studio",   value: 14000, startOffset: 7,   deadlineOffset: 50,  status: "planning",   progress: 0,   cover: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800", goal: "Переработка флоу регистрации и активации.",               scope: ["Research", "Wireframes", "A/B-эксперимент"],            tags: ["project", "ux"] },
  { name: "Content Hub — Orbit Media",     client: "Orbit Media",   value: 22000, startOffset: -90, deadlineOffset: -10, status: "done",       progress: 100, cover: "https://images.unsplash.com/photo-1542435503-956c469947f6?w=800", goal: "CMS для подкастов с публикацией по расписанию.",          scope: ["Архитектура", "CMS", "Интеграции", "Запуск"],           tags: ["project", "content"] },
];

const TASK_SEEDS: TaskSeed[] = [
  { name: "Audit performance — Redesign Acme",          project: "Redesign — Acme Studio",        assignee: "Алексей", dueOffset: 2,   priority: "high",   status: "doing",  estimate: 4,  completed: false, description: "Профилирование загрузки дашборда: цель TTI < 1.5s.",           checklist: ["Lighthouse", "Bundle analyzer", "Оптимизация изображений"], tags: ["task", "performance"] },
  { name: "Color palette draft — Redesign Acme",        project: "Redesign — Acme Studio",        assignee: "Ольга",   dueOffset: 5,   priority: "medium", status: "todo",   estimate: 6,  completed: false, description: "Подобрать акцентные и нейтральные оттенки под новый brand.",   checklist: ["Mood-board", "3 варианта", "Контраст AA"],                  tags: ["task", "design"] },
  { name: "iOS auth flow — Mobile App Helix",           project: "Mobile App — Helix Labs",       assignee: "Мария",   dueOffset: 7,   priority: "high",   status: "doing",  estimate: 16, completed: false, description: "FaceID + biometric storage для авторизации.",                  checklist: ["KeychainSwift", "FaceID", "Тесты"],                          tags: ["task", "ios"] },
  { name: "Android push — Mobile App Helix",            project: "Mobile App — Helix Labs",       assignee: "Дмитрий", dueOffset: 12,  priority: "medium", status: "todo",   estimate: 10, completed: false, description: "FCM-интеграция и обработка deep-links.",                       checklist: ["FCM setup", "Deep links", "QA на 3 устройствах"],          tags: ["task", "android"] },
  { name: "Catalog import — Storefront Nimbus",         project: "Storefront — Nimbus Retail",    assignee: "Сергей",  dueOffset: 9,   priority: "high",   status: "todo",   estimate: 8,  completed: false, description: "CSV → Shopify импорт 12 000 SKU с медиа.",                     checklist: ["Маппинг", "Импорт", "Валидация"],                          tags: ["task", "etl"] },
  { name: "Logo final variants — Brand Orbit",          project: "Brand Refresh — Orbit Media",   assignee: "Ольга",   dueOffset: 1,   priority: "high",   status: "review", estimate: 3,  completed: false, description: "Финальные lockup-варианты лого: horizontal/stacked/mark.",     checklist: ["3 варианта", "SVG/PNG", "Презентация"],                    tags: ["task", "branding"] },
  { name: "Pitch deck visuals — Lumen",                 project: "Pitch Deck — Lumen Academy",    assignee: "Ольга",   dueOffset: 8,   priority: "medium", status: "doing",  estimate: 5,  completed: false, description: "Слайды traction и market sizing.",                              checklist: ["Traction chart", "TAM/SAM/SOM", "Команда"],                tags: ["task", "presentation"] },
  { name: "Overdue: budget review — Storefront Nimbus", project: "Storefront — Nimbus Retail",    assignee: "Алексей", dueOffset: -3,  priority: "high",   status: "doing",  estimate: 2,  completed: false, description: "Просрочено: пересогласовать бюджет фазы 2.",                    checklist: ["Финансовый прогноз", "Звонок клиенту"],                    tags: ["task", "overdue"] },
  { name: "QA pass — Site Audit Vertex",                project: "Site Audit — Vertex Health",    assignee: "Мария",   dueOffset: -65, priority: "low",    status: "done",   estimate: 4,  completed: true,  description: "Финальный прогон чек-листа аудита.",                            checklist: ["Lighthouse", "axe-core", "Cross-browser"],                  tags: ["task", "qa"] },
  { name: "Sitemap — Onboarding Flow",                  project: "Onboarding Flow — Acme Studio", assignee: "Дмитрий", dueOffset: 14,  priority: "medium", status: "todo",   estimate: 4,  completed: false, description: "Информационная архитектура нового онбординга.",                 checklist: ["User flow", "Sitemap", "Wireframes"],                       tags: ["task", "ux"] },
];

const MEETING_SEEDS: MeetingSeed[] = [
  { name: "Kickoff — Acme Studio",       client: "Acme Studio",   dayOffset: 1, startTime: "10:00", endTime: "11:00", participants: ["PM", "Алексей", "Клиент"],        agenda: ["Цели нового онбординга", "Сроки и риски", "Следующие шаги"] },
  { name: "Weekly sync — Helix Labs",    client: "Helix Labs",    dayOffset: 2, startTime: "14:00", endTime: "14:45", participants: ["PM", "Мария", "Дмитрий", "CTO"],  agenda: ["Статус iOS auth", "Блокеры на Android", "План на следующую неделю"] },
  { name: "Discovery — Nimbus Retail",   client: "Nimbus Retail", dayOffset: 3, startTime: "11:00", endTime: "12:30", participants: ["PM", "Сергей", "Магазин"],        agenda: ["Болевые точки", "Объем каталога", "Интеграции с ERP"] },
  { name: "Brand review — Orbit Media",  client: "Orbit Media",   dayOffset: 4, startTime: "15:00", endTime: "16:00", participants: ["PM", "Ольга", "Креативный директор"], agenda: ["Презентация лого", "Применение", "Финальные правки"] },
  { name: "Pitch rehearsal — Lumen",     client: "Lumen Academy", dayOffset: 6, startTime: "09:30", endTime: "10:15", participants: ["PM", "Ольга", "CEO"],             agenda: ["Прогон слайдов", "Q&A репетиция", "Правки"] },
];

// ── seed → DemoFile builders ────────────────────────────────────────

function buildClients(): Record<string, DemoFile> {
  const t = today();
  const out: Record<string, DemoFile> = {};
  for (const s of CLIENT_SEEDS) {
    out[s.name] = {
      frontmatter: {
        type: "client",
        industry: s.industry,
        stage: s.stage,
        mrr: s.mrr,
        signupDate: t.subtract(s.daysAgo, "day").format("YYYY-MM-DD"),
        cover: s.cover,
        tags: s.stage === "lead" ? ["client", "lead"] : s.stage === "churn" ? ["client", "churn"] : ["client"],
      },
      content: clientBody(s.industry, s.tagline),
    };
  }
  return out;
}

function buildProjects(): Record<string, DemoFile> {
  const t = today();
  const fmt = (off: number) => t.add(off, "day").format("YYYY-MM-DD");
  const out: Record<string, DemoFile> = {};
  for (const s of PROJECT_SEEDS) {
    out[s.name] = {
      frontmatter: {
        type: "project",
        client: wikilink(s.client),
        value: s.value,
        startDate: fmt(s.startOffset),
        deadline: fmt(s.deadlineOffset),
        status: s.status,
        progress: s.progress,
        cover: s.cover,
        tags: s.tags,
      },
      content: projectBody(s.goal, s.scope),
    };
  }
  return out;
}

function buildTasks(): Record<string, DemoFile> {
  const t = today();
  const fmt = (off: number) => t.add(off, "day").format("YYYY-MM-DD");
  const out: Record<string, DemoFile> = {};
  for (const s of TASK_SEEDS) {
    out[s.name] = {
      frontmatter: {
        type: "task",
        project: wikilink(s.project),
        assignee: s.assignee,
        dueDate: fmt(s.dueOffset),
        priority: s.priority,
        status: s.status,
        estimate: s.estimate,
        completed: s.completed,
        tags: s.tags ?? ["task"],
      },
      content: taskBody(s.description, s.checklist),
    };
  }
  return out;
}

function buildMeetings(): Record<string, DemoFile> {
  const t = today();
  const fmt = (off: number) => t.add(off, "day").format("YYYY-MM-DD");
  const out: Record<string, DemoFile> = {};
  for (const s of MEETING_SEEDS) {
    out[s.name] = {
      frontmatter: {
        type: "meeting",
        client: wikilink(s.client),
        startDate: fmt(s.dayOffset),
        startTime: s.startTime,
        endTime: s.endTime,
        participants: s.participants,
        tags: ["meeting"],
      },
      content: meetingBody(s.agenda),
    };
  }
  return out;
}

// ============================================================
// VIEW CONFIGS — inline widget layouts
// ============================================================

function overviewWidgets(): WidgetDefinition[] {
  return [
    {
      id: widgetId(),
      type: "stats",
      title: "Студия в цифрах",
      layout: { x: 0, y: 0, w: 12, h: 2 },
      config: {
        cards: [
          { id: "k1", label: "Клиентов",           field: "name",      aggregation: "count" },
          { id: "k2", label: "Проектов",           field: "status",    aggregation: "count" },
          { id: "k3", label: "Открытых задач",     field: "completed", aggregation: "count_unchecked" },
          { id: "k4", label: "MRR (sum)",          field: "mrr",       aggregation: "sum", format: "currency", currencySymbol: "$" },
        ],
        columns: 4,
      },
    },
    {
      id: widgetId(),
      type: "chart",
      title: "Проекты по статусу",
      layout: { x: 0, y: 2, w: 6, h: 4 },
      transform: {
        steps: [
          { type: "filter", conditions: { conjunction: "and", conditions: [{ field: "type", operator: "is", value: "project", enabled: true }] } },
        ],
      },
      config: {
        chartType: "donut",
        xAxis: { property: "status", sortBy: "value", sortOrder: "desc", omitZero: true },
        yAxis: { property: "count", aggregation: "count" },
        style: { colorScheme: "categorical", height: "medium", showGrid: false, showLabels: true, showLegend: true, showValues: true },
      },
    },
    {
      id: widgetId(),
      type: "data-table",
      title: "Приоритетные задачи",
      layout: { x: 6, y: 2, w: 6, h: 4 },
      transform: {
        steps: [
          {
            type: "filter",
            conditions: {
              conjunction: "and",
              conditions: [
                { field: "type", operator: "is", value: "task", enabled: true },
                { field: "completed", operator: "is-not-checked", enabled: true },
              ],
            },
          },
        ],
      },
      config: {},
    },
    {
      id: widgetId(),
      type: "summary-row",
      title: "Итоги",
      layout: { x: 0, y: 6, w: 12, h: 1 },
      config: {
        columns: [
          { field: "value",    aggregation: "sum", format: "currency", currencySymbol: "$" },
          { field: "progress", aggregation: "avg", format: "percent" },
          { field: "estimate", aggregation: "sum", format: "number" },
        ],
      },
    },
  ];
}

function clientsWidgets(): WidgetDefinition[] {
  return [
    {
      id: widgetId(),
      type: "stats",
      title: "Клиентская база",
      layout: { x: 0, y: 0, w: 12, h: 2 },
      config: {
        cards: [
          { id: "c1", label: "Всего",        field: "name",  aggregation: "count" },
          { id: "c2", label: "Активных",     field: "stage", aggregation: "count" },
          { id: "c3", label: "MRR (sum)",    field: "mrr",   aggregation: "sum", format: "currency", currencySymbol: "$" },
          { id: "c4", label: "Средний MRR", field: "mrr",   aggregation: "avg", format: "currency", currencySymbol: "$" },
        ],
        columns: 4,
      },
    },
    {
      id: widgetId(),
      type: "data-table",
      title: "Список клиентов",
      layout: { x: 0, y: 2, w: 12, h: 8 },
      config: {},
    },
  ];
}

const commonTableConfig: DatabaseViewConfig["table"] = {
  fieldConfig: {
    name: { width: 280 },
    path: { hide: true },
    status: { width: 110 },
    priority: { width: 90 },
    progress: { width: 80 },
    value: { width: 100 },
    mrr: { width: 100 },
    startDate: { width: 110 },
    deadline: { width: 110 },
    dueDate: { width: 110 },
    signupDate: { width: 110 },
    industry: { width: 110 },
    stage: { width: 90 },
    assignee: { width: 110 },
    estimate: { width: 80 },
    completed: { width: 80 },
    cover: { hide: true },
    client: { width: 180 },
    project: { width: 200 },
  },
  orderFields: ["name", "status", "stage", "priority", "client", "project", "value", "mrr", "progress", "deadline", "dueDate", "assignee"],
  aggregations: { progress: "avg", value: "sum", mrr: "sum", name: "count_total" },
  showAggregationRow: true,
  rowHeight: "default",
  wrapText: false,
};

// ============================================================
// FILE WRITING (idempotent)
// ============================================================

async function writeFiles(vault: Vault, folder: string, files: Record<string, DemoFile>): Promise<void> {
  for (const [name, file] of Object.entries(files)) {
    const path = normalizePath(`${folder}/${name}.md`);
    const body = `---\n${stringifyYaml(file.frontmatter)}---\n\n${file.content}`;
    try {
      await vault.create(path, body);
    } catch {
      // Already exists — idempotent re-run. Skip silently.
    }
  }
}

// ============================================================
// MAIN ENTRY POINT
// ============================================================

export async function createDemoProject(vault: Vault): Promise<void> {
  // 1. Ensure root demo folder exists (idempotent).
  try {
    await vault.createFolder(DEMO_FOLDER);
  } catch {
    // Folder may already exist — that's fine.
  }

  // 2. Write all seed files.
  await writeFiles(vault, DEMO_FOLDER, buildClients());
  await writeFiles(vault, DEMO_FOLDER, buildProjects());
  await writeFiles(vault, DEMO_FOLDER, buildTasks());
  await writeFiles(vault, DEMO_FOLDER, buildMeetings());

  // 3. View configs.
  const overviewConfig: DatabaseViewConfig = {
    widgets: overviewWidgets(),
    layoutMode: "stack",
    layoutVersion: 1,
    table: commonTableConfig,
    showWidgetToolbar: true,
    compactMode: false,
  };

  const clientsConfig: DatabaseViewConfig = {
    widgets: clientsWidgets(),
    layoutMode: "stack",
    layoutVersion: 1,
    table: commonTableConfig,
    showWidgetToolbar: true,
    compactMode: false,
  };

  const boardConfig: BoardConfig = {
    groupByField: "status",
    orderSyncField: "deadline",
    headerField: "client",
    includeFields: ["client", "value", "deadline", "progress", "tags"],
    columns: {
      planning:   { weight: 1 },
      inProgress: { weight: 1.5 },
      review:     { weight: 1 },
      done:       { weight: 1, collapse: false },
    },
  };

  const calendarConfig: CalendarConfig = {
    interval: "week",
    displayMode: "bars",
    startDateField: "startDate",
    dateField: "dueDate",
    endDateField: "deadline",
    startTimeField: "startTime",
    endTimeField: "endTime",
    eventColorField: "priority",
    checkField: "completed",
    startHour: 8,
    endHour: 20,
    timezone: "local",
    timeFormat: "24h",
    agendaOpen: true,
  };

  const galleryConfig: GalleryConfig = {
    coverField: "cover",
    fitStyle: "cover",
    cardWidth: 280,
    includeFields: ["client", "status", "value", "deadline"],
  };

  const priorityColors: ColorRule[] = [
    { color: "#F44336", condition: { field: "priority", operator: "is", value: "high",   enabled: true } },
    { color: "#FF9800", condition: { field: "priority", operator: "is", value: "medium", enabled: true } },
    { color: "#4CAF50", condition: { field: "priority", operator: "is", value: "low",    enabled: true } },
  ];

  const fieldConfig: { [field: string]: FieldConfig } = {
    startDate:  { time: false },
    deadline:   { time: false },
    dueDate:    { time: false },
    signupDate: { time: false },
    startTime:  { time: true },
    endTime:    { time: true },
    status: {
      statusGroups: {
        todo:       ["planning", "todo"],
        inProgress: ["inProgress", "doing", "review"],
        complete:   ["done"],
      },
    },
  };

  // 4. Register project with exactly 5 views.
  settings.addProject(
    Object.assign({}, DEFAULT_PROJECT, {
      name: "Демо-проект",
      id: uuidv4(),
      path: DEMO_FOLDER,
      dataSource: { kind: "folder", config: { path: DEMO_FOLDER, recursive: false } },
      fieldConfig,
      views: [
        // 1. Обзор
        Object.assign({}, DEFAULT_VIEW, {
          name: "Обзор",
          id: uuidv4(),
          type: "dashboard",
          config: overviewConfig,
          filter: { conjunction: "and", conditions: [] },
          colors: { conditions: priorityColors },
          sort: { criteria: [{ field: "deadline", order: "asc", enabled: true }] },
        }),
        // 2. Pipeline
        Object.assign({}, DEFAULT_VIEW, {
          name: "Pipeline",
          id: uuidv4(),
          type: "board",
          config: boardConfig,
          filter: { conjunction: "and", conditions: [{ field: "type", operator: "is", value: "project", enabled: true }] },
          colors: { conditions: [] },
          sort: { criteria: [{ field: "deadline", order: "asc", enabled: true }] },
        }),
        // 3. График
        Object.assign({}, DEFAULT_VIEW, {
          name: "График",
          id: uuidv4(),
          type: "calendar",
          config: calendarConfig,
          filter: {
            conjunction: "or",
            conditions: [
              { field: "type", operator: "is", value: "meeting", enabled: true },
              { field: "type", operator: "is", value: "task", enabled: true },
            ],
          },
          colors: { conditions: priorityColors },
          sort: { criteria: [] },
        }),
        // 4. Клиенты
        Object.assign({}, DEFAULT_VIEW, {
          name: "Клиенты",
          id: uuidv4(),
          type: "dashboard",
          config: clientsConfig,
          filter: { conjunction: "and", conditions: [{ field: "type", operator: "is", value: "client", enabled: true }] },
          colors: { conditions: [] },
          sort: { criteria: [{ field: "mrr", order: "desc", enabled: true }] },
        }),
        // 5. Портфолио
        Object.assign({}, DEFAULT_VIEW, {
          name: "Портфолио",
          id: uuidv4(),
          type: "gallery",
          config: galleryConfig,
          filter: {
            conjunction: "and",
            conditions: [
              { field: "type", operator: "is", value: "project", enabled: true },
              { field: "cover", operator: "is-not-empty", enabled: true },
            ],
          },
          colors: { conditions: [] },
          sort: { criteria: [{ field: "deadline", order: "desc", enabled: true }] },
        }),
      ],
    })
  );
}
