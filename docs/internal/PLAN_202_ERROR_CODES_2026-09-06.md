# PLAN 202 -- Error codes: one registry, one page, five surfaces

Architect pass. Base `main` @ `a85736c`, tree clean. Read-only pass: every number below was
measured in this session against that tree, not carried in from the ticket.

Files opened this session: `src/lib/viewApi.ts`, `src/main.ts`, `src/lib/settings/settingsWriter.ts`,
`src/lib/settings/saveStatus.ts`, `src/lib/settingsBackup.ts`, `src/lib/stores/i18n.ts`,
`src/lib/stores/translations/{en,ru,uk,zh-CN}.json`, `src/ui/components/SaveStatus/SaveStatusChip.svelte`,
`src/ui/components/ErrorBoundary/ErrorBoundary.svelte`, `src/ui/views/Calendar/logger.ts`,
`src/ui/views/Calendar/CalendarView.svelte`, `src/ui/views/Dashboard/widgets/WidgetShell.svelte`,
`src/ui/views/Dashboard/widgets/headerChrome.ts`, `src/ui/views/Dashboard/relationSetupController.ts`,
`src/ui/modals/relationSetupModal.ts`, `src/ui/app/onboarding/demoProject.ts`, `src/ui/app/App.svelte`,
`src/__tests__/R_filterOrder.invariant.test.ts`, `src/__tests__/R0_6_locBudget.test.ts`,
`src/__tests__/R0_7_configDrift.test.ts`, `src/__tests__/configScanBoundary.test.ts`,
`src/__tests__/setup.ts`, `jest.config.js`,
`docs/internal/codex-reports/CX-AUDIT-199.md`, `docs/internal/SPEC_201_SAVE_STATUS_2026-09-06.md`,
`docs/internal/BACKLOG.md` (#201, #202).

---

## 1. Inventory -- measured, not estimated

### 1.1 Notices

`new Notice(` in `src/`, tests excluded: **44 matches, of which 1 is commented out**
(`src/lib/dataApi.ts:202`). **43 live call sites in 11 files** -- `dataApi.ts` is in the ticket's
file list only because of that comment, and drops out.

| File | Live sites |
|---|---|
| `src/ui/views/Calendar/CalendarView.svelte` | 21 |
| `src/main.ts` | 6 |
| `src/lib/viewApi.ts` | 5 |
| `src/ui/app/App.svelte` | 2 |
| `src/ui/app/onboarding/demoProject.ts` | 2 |
| `src/ui/views/Dashboard/dashboardSchema.ts` | 2 |
| `src/ui/modals/components/EditNote.svelte` | 1 |
| `src/ui/views/Board/BoardView.svelte` | 1 |
| `src/ui/views/Dashboard/dashboardView.ts` | 1 |
| `src/ui/views/Dashboard/relationSetupController.ts` | 1 |
| `src/ui/views/Gallery/GalleryView.svelte` | 1 |

### 1.2 How many go through a locale key -- the ticket's estimate was wrong

**21 of 43 call the i18n `t(...)`; 22 pass a bare literal.** The packet's rough count ("6 with
`t(...)` against ~21 bare") understates the i18n side by a factor of three. This matters directly
to scope: the localisation work is smaller than the ticket assumed, and the *literal* work is
concentrated rather than spread.

**16 of the 22 literals are hardcoded Russian in `CalendarView.svelte`** -- shown verbatim to an
English, Ukrainian or Chinese user today. That is a shipped defect this ticket stands on top of,
not a cosmetic detail.

Going through `t(...)` is not the same as being translated. Measured per locale:

| Where the key resolves | Sites, of the 21 i18n sites |
|---|---|
| key exists in `en.json` | 14 |
| falls back to the inline `defaultValue` in `en` | 7 |
| key exists in `ru.json` | 8 |
| key exists in `uk.json` / `zh-CN.json` | 7 |

Keys used by a Notice that exist in **no** locale file at all, living purely on `defaultValue`:
`errors.recordsWriteFailed`, `errors.migrationBackupFailed`,
`commands.create-demo-project.repair-failed`, `views.filter.bar.save-name-taken`,
`views.filter.bar.saved`, `views.dashboard.canvas.error-add-field`,
`views.dashboard.canvas.error-reopen-schema`.

Total leaf keys per locale: `en` 1273, `ru` 1258, `uk` 1134, `zh-CN` 1134. Missing relative to
`en`: `ru` 15, `uk` 139, `zh-CN` 139. **The tree already ships two locales 139 keys behind English
and does not fall over**, because `defaultValue` catches them. That is the precedent section 5
leans on.

One site has no `defaultValue` at all: `src/main.ts:412`,
`new Notice(t("save-status.failed.notice"), 15000)`. The key exists in all four locales today, so
it works; if it were ever deleted, i18next would put the raw key string on screen. A registry
removes that class of failure.

### 1.3 Console

`console.error` / `console.warn` in `src/`, tests excluded: **40 sites in 20 files.** The ticket
said 36. Concentrations: `src/main.ts` 7, `src/lib/filesystem/obsidian/filesystem.ts` 4,
`src/lib/viewApi.ts` 4, `src/ui/views/Calendar/calendarView.ts` 3; the remaining 16 files carry
one or two each. `src/ui/views/Calendar/logger.ts` is a surface of its own -- a module-local logger
with levels and a `[Calendar]` prefix, wrapping `console.*`.

**Five different log prefixes are in use:** `[obs-projects-plus]` 14, `[Projects+]` 8,
`[Calendar]` 2, `[ErrorBoundary]` 2, `[EditNote]` 1. On the Notice side, only four strings carry a
product prefix at all (`"Projects+: ..."`, all in `main.ts`). A user cannot search for an event
because there is no token to search for.

### 1.4 What the messages actually are

Classified by kind, because a scheme that numbers successes is noise:

| Kind | Count | Examples, file:line |
|---|---|---|
| Failure -- something the plugin tried and could not do | 28 | `viewApi.ts:102`, `main.ts:715`, `dashboardView.ts:140` |
| Refusal / precondition -- the user or the config is not ready | 8 | `App.svelte:121`, `CalendarView.svelte:1106,1276,1282,1327,1499,1584,1589` |
| Warning, outcome genuinely unknown | 1 | `main.ts:665`, the `superseded` path |
| Success / confirmation | 6 | `main.ts:370`, `App.svelte:142`, `CalendarView.svelte:959,1061,1560`, `relationSetupController.ts:66` |

**Only the first three kinds get codes: 37 of 43 sites, not 43.**

Distinct *strings* differ from distinct *sites* in both directions. Three sites carry two texts
each through a ternary (`main.ts:353` repair-failed / repaired, `main.ts:715` copied / not copied,
`main.ts:745` copied / not copied): +3. Four duplicate pairs exist -- rename-failed is identical in
`BoardView.svelte:104` and `GalleryView.svelte:82`; `CalendarView.svelte:963` and `:1564` are the
same Russian string; `:959` and `:1560` the same success; `views.calendar.errors.date-required` is
called at `:1282` and `:1584`. So **42 distinct strings across 43 sites**.

Codes attach to **events, not call sites**. Rename-failed is one event with four call sites; each
forensic-copy ternary in `main.ts` is one event with two outcomes -- the copy path belongs in the
cause text, not in a second code.

### 1.5 Five user-visible surfaces, not three

The ticket names three (notice, mark, console). The tree has five plus the console:

| Surface | Where | Carries a code |
|---|---|---|
| `Notice` toast | the 43 sites above | yes |
| Save-status mark | `SaveStatusChip.svelte`, `save-status.failed.label` + `.tooltip` | yes -- #201 reserves the slot |
| Widget error banner | `WidgetShell.svelte:141-147`, `.ppp-widget-error` | yes |
| Modal error line | `relationSetupModal.ts:20` `setError`, fed from `relationSetupController.ts:70` | yes |
| Error boundary panel | `ErrorBoundary.svelte`, `errors.boundary.*` | yes, generic `9xx` |
| Console | 40 sites plus `Calendar/logger.ts` | always |

Any plan that wires only the first three leaves two surfaces that still cannot be cross-referenced.

---

## 2. Code scheme

Form: **`PPP-<area><nn>`** -- one prefixed token, three digits, e.g. `PPP-104`. Rendered in the UI
as a trailing token, `Settings could not be written to disk. (PPP-104)`, so it never displaces the
sentence; rendered in the console as the leading token after the prefix.

Areas come from where the messages actually cluster in the tree (section 1.4), not from taste. Each
is a thing the user can name on its own and a thing that fails for its own reasons:

| Range | Area | Anchored on |
|---|---|---|
| `1xx` | Settings persistence | `main.ts` load/verify/corrupt paths, `settings/settingsWriter.ts`, `settingsBackup.ts` |
| `2xx` | Record write | `lib/viewApi.ts`, `lib/dataApi.ts` |
| `3xx` | Record actions inside a view | Calendar, Board, Gallery, `EditNote.svelte` |
| `4xx` | Dashboard configuration | `dashboardSchema.ts`, `dashboardView.ts` migration |
| `5xx` | Relations | `relationSetupController.ts`, `relationSetupModal.ts` |
| `6xx` | Onboarding and the demo project | `onboarding/demoProject.ts`, the `create-demo-project` command |
| `7xx` | Sources and filters | `App.svelte` saved-source paths |
| `9xx` | Unexpected / boundary | `ErrorBoundary.svelte`, the `WidgetShell` render capture |

Why this split and not one per directory: `3xx` deliberately crosses four files, because
rename-failed in Board, Gallery and Calendar is **one event to the user** and must be one code.
Splitting by module would issue it three numbers, which is exactly the failure #202 exists to end.
Conversely `1xx` and `2xx` both live partly in `main.ts` and `lib/`, and are kept apart because
"your settings did not save" and "your note did not save" are different things to be told.

Two rules make a code a contract rather than a label:

1. **A code, once shipped, is permanent.** Never reused for another meaning, never renumbered.
   Retirement is a `status: "retired"` entry that stays in the registry and stays on the
   documentation page, so the number remains reserved and an old bug report stays legible. This is
   the `DataTableConfig.subBases` rule applied to a public token instead of a stored key.
2. **Successes never get a code.** The six confirmation Notices stay as they are. Numbering
   "Demo project created." would teach users that the token carries no information.

Numbers are assigned densely from `<area>01` in one pass at step 2 and never re-sorted afterwards.

---

## 3. The registry -- one module, and why it cannot cycle

Two files, and the split is the whole point.

**`src/lib/errors/errorCodes.ts` -- pure data, zero imports:**

    export type ErrorKind = "failure" | "refusal" | "warning";
    export interface ErrorCodeEntry {
      readonly code: string;      // "PPP-104"
      readonly kind: ErrorKind;
      readonly key: string;       // i18n key for the short caption
      readonly causeKey: string;  // i18n key for the tooltip cause
      readonly caption: string;   // English default for `key`
      readonly cause: string;     // English default for `causeKey`
      readonly status?: "retired";
    }
    export const ERROR_CODES: readonly ErrorCodeEntry[];

No `import` statement at all. That is not stylistic: it is what lets `settingsWriter.ts` -- a plain
module with no i18n dependency today, unit-tested in isolation -- name a code without dragging
anything behind it.

**`src/lib/errors/errorText.ts` -- resolution.** Imports the registry and `src/lib/stores/i18n.ts`;
exports `resolveError(code, params?)` returning `{ code, caption, cause }`, applying
`t(entry.key, { defaultValue: entry.caption, ...params })`.

**`src/lib/errors/errorLog.ts` -- the console.** Imports the registry only, never i18n: the console
line is English by design and uses `entry.caption`. One prefix, `[Projects+]`, plus the code. This
is what collapses the five prefixes of section 1.3 to one and makes the notice, the mark and the
console line literally the same sentence plus the same token.

**On import cycles, stated precisely rather than assumed.** I read `src/lib/stores/i18n.ts` this
session: its only imports are `i18next`, `svelte-i18next`, `dayjs` and the four translation JSON
files. It imports no application module, so a registry-to-i18n edge cannot close a cycle. The real
hazard is the one `headerChrome.ts` was created for and states in its own header -- **weight, not
cycles**: importing a module to answer a question about a string should cost a string's worth of
imports. Here the weight is the four locale JSONs (86 KB, 108 KB, 97 KB, 77 KB) plus i18next,
dragged into every unit test of every module that merely wants to name a code. Hence the data
module has no imports, resolution is a separate file, and **nothing under `src/lib/settings/` or
`src/lib/engine/` may import `errorText.ts`**. The R0.21 ratchet pins that edge, so the rule is
enforced rather than remembered.

---

## 4. Keeping the page and the registry from diverging

Page: **`docs/ERROR_CODES.md`** -- outside `docs/internal/`, because the point is to be able to send
a user to it. One section per code: what happened, why, what to do. It is not scanned by R0.7
(`SCANNED_ROOTS` is `.claude`, `.codex`, `.github`; `SCANNED_FILES` is `CLAUDE.md`, `AGENTS.md`),
so it carries no config-drift risk of its own.

Mechanism: **`src/__tests__/R0_21_errorCodeRegistry.test.ts`**, modelled on
`R_filterOrder.invariant.test.ts`, which already reads `docs/internal/` from a test and is this
tree's precedent for binding a document to code. Its header must carry the lesson that file learned
the hard way -- *a test that forbids a document from becoming true is worse than no test* -- so
R0.21 asserts **structure and bijection, never prose**:

1. Every `code` in `ERROR_CODES` is unique, matches `/^PPP-[1-9]\d\d$/`, and its area digit is one
   of the eight declared ranges.
2. Every registry code has exactly one `## PPP-nnn` heading in `docs/ERROR_CODES.md`.
3. Every `## PPP-nnn` heading in the page exists in the registry. This is the half that reserves
   retired numbers, since a retired entry keeps both sides.
4. Each page section is non-empty and contains the three required sub-headings. The *words* are
   never asserted.
5. Every `entry.key` and `entry.causeKey` resolves in `en.json`. No code ships relying on
   `defaultValue` in English.
6. No file under `src/lib/settings/` or `src/lib/engine/` imports `errorText.ts` -- the weight edge
   from section 3.
7. All four locale files still begin with a BOM (see below).

**BOM requirement, and it is not incidental.** All four locale files are UTF-8 **with a BOM**:
`json.load` on `en.json` fails outright with `Unexpected UTF-8 BOM` unless it is stripped, which is
how this was found. Any ratchet, script or tool in this ticket that reads a translation file must
read it as `utf-8-sig` (Python) or strip a leading `\uFEFF` before `JSON.parse` (Node), and must
write it back **with the BOM intact**. A tool that silently rewrites these files without the BOM
changes four large files for no reason and buries the real diff. Rule 7 makes that enforced rather
than remembered.

Ownership: whoever adds a code adds the registry entry and the page section in the same commit,
because R0.21 makes the alternative red. That is the whole answer to "who keeps it up to date" --
nobody has to.

---

## 5. Locales -- the honest order

37 codes across four languages is the number the ticket feared. It is not the number of translations
needed, for a reason already load-bearing in this tree: `uk` and `zh-CN` each run 139 keys behind
`en` today and work, because `defaultValue` covers the gap.

- **Immediately, in `en.json`:** a real key for every code's caption and cause. This is not new
  translation work -- for the 14 already-resolving sites the string exists, and for the rest it is
  the `defaultValue` already written in the source, moved into the file. R0.21 rule 5 makes it
  non-optional.
- **Immediately, in `ru.json`:** the 16 Russian literals in `CalendarView.svelte` are already
  written Russian. They move into `ru.json` as real values instead of being discarded. Removing them
  from the component fixes the shipped defect that Russian shows to every locale; putting them into
  `ru.json` means Russian users lose nothing. One step, a gain in both directions -- which is why
  `ru` is not deferred.
- **`uk` and `zh-CN`: `defaultValue` only, deferred.** Honest because it is the regime those files
  are already in; because the fallback is English and legible; and above all because **the code is
  locale-independent** -- `PPP-104` is the same token in every language, which is precisely what the
  user asked for. A user on an untranslated locale can still quote the code and find the page.
- **Never:** machine-translating 74 strings into two languages to make a count look complete. That
  produces text nobody has read in a file nobody can review.

Existing keys are not renamed. New keys are added alongside, and where a key already exists it
becomes that code's `key` unchanged (`errors.recordWriteFailed` becomes `PPP-201`'s caption key).
**No locale key that ships today is removed or repointed.**

---

## 6. Order of work -- each step ends on four green gates

| Step | Change | What it proves |
|---|---|---|
| 1 | Registry modules + R0.21 with an empty registry and an empty page, including the ratchet's own synthetic both-states test | The mechanism fails on a planted mismatch and passes on a match, before a single code is issued |
| 2 | Populate `ERROR_CODES` (37 entries) and `docs/ERROR_CODES.md`; add the `en.json` keys. **No call site touched.** | The numbering is complete and bijective with the page; nothing user-visible has changed yet |
| 3 | `1xx` wired: `main.ts` settings paths, the `settingsWriter.ts` console line, and the code slot #201 reserves in the mark | The #199 episode now shows one code in the notice, the mark and the console -- the live example that motivated the ticket |
| 4 | `2xx`, `4xx`, `5xx`, `6xx`, `7xx` wired: `viewApi.ts`, dashboard, relations, demo, `App.svelte` | Every non-view surface carries a code; four prefixes collapse to one |
| 5 | `3xx` wired: Calendar's 21 sites, Board, Gallery, `EditNote`; the Russian literals move into `ru.json` | The largest and worst area; the hardcoded-Russian defect closes with it |
| 6 | `errorLog.ts` adopted by the remaining console sites; `Calendar/logger.ts` keeps its levels but takes the shared prefix | One prefix in the console, tree-wide |

Every step is reversible on its own.

Step 3 is deliberately first among the wiring steps: it is the case the user actually lived through,
so it is where a live run can confirm the mechanism before four more areas depend on it.

Steps 3 to 6 are independent of one another. If the ticket has to stop, it stops after any of them
with a coherent tree -- some areas coded, the rest exactly as today. Nothing is half-migrated
inside a step.

**Every step must end with a live vault run of at least one message in the area it touched.** Four
green gates cannot see a Notice. #199 is the standing proof: nine unit tests, four gates, two audits
and two reviews all passed over a save path that never wrote anything.

---

## 7. Risks, and what not to do

- **Do not rewrite the message texts.** This ticket adds a token and a cause string. Re-authoring 42
  strings would bury the mechanism in an unreviewable diff and put the whole thing at the mercy of
  taste. The one exception is forced and named: the 16 Russian literals must leave the component,
  because leaving them is shipping Russian to every locale.
- **Do not break existing locale keys.** `ru` is 15 keys behind `en`, `uk` and `zh-CN` 139 each.
  Renaming a key silently widens those gaps, and the fallback hides it.
- **R0.6, LOC ceilings downward only.** `CalendarView.svelte` has **no** entry in `BUDGETS`, so step
  5 will not trip it. But `BUDGETS` covers `ui/views/Dashboard/**` by hand: any new component landing
  there must be entered at its measured size in the same commit. `SaveStatusChip.svelte` also has no
  ceiling yet, which SPEC 201 records; if #201 and #202 both grow it, one of them should give it one.
- **R0.3 (px) and R0.16 (rem in container).** Relevant only if a code gets its own visual
  affordance. It should not: the code is a text token inside an existing string, and any styling
  belongs to #201.
- **R0.19, one layer scale.** The tooltip is the surface at risk. Use the mechanism #201 specifies;
  do not introduce a second tooltip implementation with its own stacking.
- **R0.7, numbers in config.** `docs/ERROR_CODES.md` and the registry are not scanned surfaces, and
  neither states a baseline or a px budget. No interaction.
- **R0.5, no U+FFFD in `src/`.** Step 5 moves Cyrillic strings between files on a Windows host. Every
  tool used must be UTF-8 end to end. R0.5 will catch a mangling, and it is the ratchet most likely
  to fire during this ticket.
- **The real risk is scope.** 43 Notices, 40 console lines, five surfaces, four locales and eleven
  files is more than one ticket if attempted at once. The step boundaries are the containment:
  steps 1-2 are the contract, and each of 3-6 is separately shippable.
- **Do not design the mark.** #201 owns its appearance. This plan hands it a code string and a cause
  string, and stops there.

## 8. Rejected

- **A numeric-only scheme (`E104`, or a bare integer).** Unsearchable. `PPP-104` is a unique token in
  a vault, a log, an issue and a search engine; `104` is not. The prefix is the feature.
- **Deriving codes from the file path or a hash of the message.** Self-maintaining and useless as a
  contract: the code would change when the file moves or the wording is fixed, breaking every bug
  report that ever quoted it. Codes are assigned by hand precisely because they are permanent.
- **Generating `docs/ERROR_CODES.md` from the registry.** Tempting, and it would make divergence
  impossible. Rejected because the page's value is its third field -- *what to do about it* -- which
  cannot be generated, and a generated page trains everyone to ignore it. R0.21 gives the same
  guarantee about existence while leaving the prose human.
- **One module holding both the data and the i18n resolution.** Rejected for the reason
  `headerChrome.ts` exists: it would put four locale JSONs behind every unit test of every module
  that merely names a code.
- **Codes on the six success notices.** Section 2, rule 2.
- **Machine-translating everything into `uk` and `zh-CN` in this ticket.** Section 5.

## 9. Unknown

- **Whether `CalendarView.svelte`'s 21 sites are all reachable.** I read the call sites, not the
  paths into them. Some may be dead. `code-mapper` should establish this before step 5; a dead site
  should be deleted, not coded.
- **The 40 console sites are counted, not read.** I read roughly 22, in the files that also raise
  Notices. The other 18 -- including four in `lib/filesystem/obsidian/filesystem.ts` and three in
  `Calendar/calendarView.ts` -- are unclassified, and some are diagnostics that should stay uncoded.
  Step 6 needs its own inventory pass.
- **Whether the widget error banner and the ErrorBoundary panel carry structured causes** or only a
  free-text `Error.message`. `WidgetShell.svelte:143` renders `{renderError}` as a bare string;
  where that string is produced was not traced this session.
- **Where the code sits inside the tooltip** -- trailing, leading, or on its own line -- is #201's
  call, not this plan's.
- **Whether anything in the build rewrites the locale JSON.** `en.json` has a BOM and 1273 leaf keys
  under a single `translation` namespace; I did not check whether any build step touches these
  files. If one does, the BOM requirement in section 4 must be checked against it too.
