# SPEC-187 - Grouping design gaps in the DataTable widget

Ticket #187. Read-only pass, base `main = 31a8416`, tree clean at read time.
Authority: read-only - this is a specification for `architect`/`implementer`, not a patch.

## 0. Screenshot check (stated up front, per the packet)

`C:\Users\Park\OBSv1.0\screanshots` contains two files as of this session:
`2026-09-04_15-29-11.png` and `2026-09-04_15-32-06.png`. Both were opened. Neither shows a
grouped table: the first is the YAML Visualizer properties pane on a single note, the second is
the "+ Add widget" type picker with a tooltip over a template entry. Neither is the
table-with-groups screenshot the packet describes ("empty separator row without a group header").
No screenshot matching the reported behaviour was found, and this spec is written from code only,
as the packet allows in that case.

## 1. What renders today, with file:line

Render pipeline - `src/ui/views/Dashboard/widgets/DatabaseCall/tableCanon.ts:173-187`
(`buildRenderRows`): with `config.groupBy.field` set, records are partitioned by
`groupRecords` (`groupRows.ts`) into an ordered list. For each group it pushes exactly one
`{ kind: "group", key, count, collapsed }` row (line 183), then, only if not collapsed, one
`{ kind: "record", record }` row per member (line 184). There is no separator row in this model.
The list is: group header, its member rows, next group header, its member rows. No blank or
spacer row is ever emitted between groups by this function.

Consumption - `src/ui/views/Dashboard/widgets/DatabaseCall/DataTableContent.svelte:206-232`: the
`{#each windowed as row}` loop renders `TableGroupSection` for `row.kind === "group"` and
`TableRow` otherwise (lines 207-213 vs 214-230). Again: no third branch, no separator element.

The group header itself -
`src/ui/views/Dashboard/widgets/DatabaseCall/TableGroupSection.svelte:17-23`:

    <button class="ppp-t2-group" ...>
      <span class="ppp-t2-group-chevron" ...><Icon name="chevron-down" /></span>
      <span class="ppp-t2-group-label">{groupKey}</span>
      <span class="ppp-t2-group-count">{count}</span>
    </button>

Composition today: chevron (rotates -90deg when collapsed, lines 54-56) plus the raw group value
as text plus a muted, tabular-nums count. Height is `var(--ppp-t2-row-height, 2.25rem)` (line 31),
the same height as a data row, on `--background-secondary` with a single `0.0625rem` bottom border
(lines 34-35). No top border, no margin, no elevation, no distinct row height from the rows it
separates. It is horizontally sticky (`position: sticky; left: 0`, lines 41-42) but not vertically
sticky, so it scrolls out of view like any row once you scroll past it - mid-scroll there is no
persistent "which group am I in" cue either.

`R0_6_locBudget.test.ts:63` caps this file at 100 lines. It is 69 lines today - 31 lines of
headroom before the ratchet has to fall.

## 2. What makes the boundary unreadable - the mechanism, not the impression

Two independent, compounding causes, both traced to source:

(a) Empty-value groups render a blank label - this is the most likely explanation for the
reported "empty row." `groupRows.ts:209-215`:

    function valueToGroupKey(value: Optional<DataValue>): string {
      if (value == null) return "";
      ...
    }

Any record whose grouped field is null or undefined collapses into a group whose key is the
empty string. That string travels unmodified: `groupRows.ts:183` (group key) into
`groupRecords` output, into `tableCanon.ts:183` `group.key`, into
`DataTableContent.svelte:209` `groupKey={row.key}`, into
`TableGroupSection.svelte:21` `<span class="ppp-t2-group-label">{groupKey}</span>`. There is no
fallback label anywhere on this path. The rendered header for that group is: chevron, then
nothing, then a count. Visually that is a thin, secondary-background strip with a number in the
corner and no top border - exactly "an empty divider line, unclear where a group starts," as
described. This is traced through the four call sites above, read in this session, not inferred
from a screenshot.

Corroborating asymmetry: the semantic grouping mode (`groupRows.ts:131-168`, `mode: "semantic"`,
used for Status fields) explicitly gives the empty bucket a label - "No Status"
(`DEFAULT_SEMANTIC_LABELS.none`, line 36) - and only surfaces it when non-empty (lines 162-166).
Plain value-mode groupBy (the default, and what a "group by field" action produces) has no
equivalent fallback label. The gap is structural, not a one-off oversight in one component: the
project already solved this problem once, for one grouping mode, and the fix never reached the
other.

(b) Even a non-empty group header is low-contrast against the rows it separates. Same row height
as a data row (`--ppp-t2-row-height`, `TableGroupSection.svelte:31`), muted text colour
(`--text-muted`, line 36) rather than `--text-normal`, and a `0.0625rem` border on one edge only
(bottom, line 34). Nothing marks it as a different kind of row except font colour and the chevron,
which for a long or wrapped label competes with cell content in adjacent scanning. This is a
secondary contributor - it does not by itself produce a blank line, but it means even labelled
groups read weakly, so the complaint is not solely about the empty-value case.

## 3. Specification

### 3a. Group header - composition and states

Design Spec: TableGroupSection (grouped-row boundary)

Interaction model: unchanged trigger - click/Enter/Space on the row toggles collapse, already
true today via the native button element (TableGroupSection.svelte:17). What changes is the
header's legibility as a section boundary, and what it shows when the group value is empty.

Token values (all already declared in src/ui/tokens/tokens.css - nothing new for the minimum
step):
  --ppp-space-4 (0.5rem) - horizontal cell padding, already used, line 32
  --ppp-space-3 (0.375rem) - inter-element gap, already used, line 29
  --ppp-font-weight-medium (500) - replace the current var(--font-medium, 500) fallback
      (an Obsidian-namespaced variable that does not exist in Obsidian's own theme API as
      --font-medium, with the fallback at TableGroupSection.svelte:38 doing the real work
      today) with the project's own --ppp-font-weight-medium, declared once at
      tokens.css:61 and, per grep this session, unused anywhere before this ticket. Not a
      new token.
  --ppp-z-sticky (already declared, tokens.css:106) - needed only if the deferred 3c
      (vertical sticky) is taken up; not needed for the minimum step in 3d.

States:
  default - as today, but with a resolved label (see "empty group" below).
  hover - unchanged: --text-normal takeover (TableGroupSection.svelte:45-47). Keep as is.
  focus - currently relies on the browser default outline on the native button; no project
      token overrides it today (no --ppp-focus-* token exists in tokens.css, confirmed by
      search this session). Recommendation: leave the browser default in place rather than
      inventing a token with nothing to anchor it to. A project-wide focus-ring token is a
      separate ticket, not something #187 should introduce under the "no new token without
      user review" rule.
  expanded/collapsed - chevron rotation, already correct (lines 54-56). No change proposed.
  empty group - NEW STATE, does not exist today: when the resolved key is the empty string,
      render a literal fallback label instead of nothing. Placement for the string:
      src/lib/stores/i18n.ts (existing i18n store, confirmed present; no dedicated "no
      value" string exists there for value-mode groupBy today). The literal fallback text
      itself is copy and is out of this role's remit - flagged to the user in section 4, not
      decided here.

Keyboard: no new binding needed - the header is already a native button with aria-expanded
(TableGroupSection.svelte:17), so Enter/Space toggle collapse today. Table-wide row-to-row
keyboard navigation (Home/End across grouped rows) was not investigated this session and is out
of scope for a grouping-boundary spec; not claimed either way.

Responsive behavior: matryoshka-consistent. DataTableContent.svelte:252 documents on purpose
that .ppp-dt-content does NOT declare its own container-type - the ancestor widget container
(queried elsewhere as @container widget, e.g. TableControlBar.svelte:170,
BlockFilterBar.svelte:93, FilterTabsWidget.svelte:167) already reaches this depth. If the
group header ever needs a narrow-widget variant (for example hiding the count at very small
widths), it must query the existing widget container rather than declare a new container-type
at this level, per the #166 decision documented at that exact line. Nothing in this spec
currently requires a breakpoint; flagged only so a future pass does not reinvent the container.

Accessibility: aria-expanded already correct (line 17). Nothing new here except: the empty
group fallback label doubles as the accessible-name fix. Today a screen reader on an
empty-value group announces "button, collapsed, 14" (the chevron icon has no accessible text
and the label is empty) with no indication of what the group is. A resolved fallback label
fixes both the visual gap and the accessible-name gap in the same change.

### Documentation impact
None found - grouping is not described in any user-facing document this session located under
docs/internal (the ones read this session were internal spec/architecture documents). If a
public changelog or README describes grouping, it was not located this session and should be
checked before release, not assumed clean.

User review required: Yes - for the empty-group fallback copy itself (the literal string, for
example "No value" or "(empty)" or "Untitled" - Notion's own convention differs by context and
in-app copy is explicitly listed under "Not yours" for this role). No new CSS token is
introduced by the minimum step (3d), so the token side of this ticket needs no review.

### 3b. Divider mechanism - there is not one to fix, only the header to fix

Re-reading the user's report against section 1: there is no separate divider-row element in the
render model to redesign - the complaint is best explained by 2(a), an existing row (the group
header) rendering with no visible content. The fix is not "add a divider"; it is "the header
that already exists must never render empty." Adding a second divider element on top of an
already-present header row would duplicate the boundary marker and spend width in a file that
is 31 lines from its ceiling for no legibility gain - not recommended.

### 3c. Deferred: vertical sticky header, taller/bordered header row

Two changes would strengthen the boundary further but are not required to close the reported
defect, and should be sequenced after 3d per the routing note in section 4:

- position: sticky; top: 0 (in addition to the existing left: 0) so the current group's
  header stays visible while its rows scroll underneath, using --ppp-z-sticky
  (tokens.css:106) for the stacking context. TableHeader.svelte:110-112 already does this
  exact pattern (position: sticky; top: 0; z-index: var(--ppp-z-float, 10);) - though that
  literal token name should be checked against the current scale before reuse: --ppp-z-float
  does not appear among the declared layers read this session
  (--ppp-z-below/base/raised/dropdown/sticky/overlay/modal/popover/toast), so that existing
  call site may itself be relying on a fallback-only value. Flagged for auditor, not this
  ticket to fix.
- A top border in addition to the existing bottom border, and/or a taller header (for example
  1.25x --ppp-t2-row-height rather than equal height), so the header reads as a distinct row
  height rather than "a row with different text colour."

Both are layout/behaviour changes - sticky positioning interacts with the shared scroll
container documented at DataTableContent.svelte:187-189 - which is architecture-adjacent, not
a token-only change. Route through architect if taken up, per this project's escalation rule
for anything beyond local component style.

### 3d. Minimum step that closes the reported complaint

1. In groupRows.ts (or at the point tableCanon.ts:183 builds the RenderRow), resolve the
   empty string to a sentinel that the header renders as a fallback label rather than blank
   text. Smallest correct fix: treat groupKey === "" in TableGroupSection as an explicit
   "empty" case and render an i18n fallback string instead of the raw value. This is a few
   lines in a 69-line file with 31 lines of headroom under the R0.6 ceiling - it fits without
   moving the ceiling.
2. Optional, low-risk, same file: replace the var(--font-medium, 500) fallback
   (TableGroupSection.svelte:38) with var(--ppp-font-weight-medium) (tokens.css:61) -
   corrects a fallback standing in for a non-existent Obsidian variable, no visual change, no
   token review needed since the token already exists.

Deferred item 3c is explicitly not part of the minimum step - it changes stacking/positioning
behaviour and is architecture-adjacent.

## 4. Minimum vs. deferred

Minimum (closes the complaint): 3d.1, the empty-label fallback. This is the mechanism
identified in 2(a) as the most likely explanation for "empty separator row, unclear where a
group ends." 3d.2 is a free-riding cleanup in the same file - not required but zero-risk.

Deferred: 3c (vertical sticky header, taller/bordered header row) - strengthens the boundary
further, is architecture-adjacent (sticky positioning plus the shared scroll container), and is
not required to make the currently-blank header show content. Also deferred: any copy decision
(the literal fallback string) - a user decision, not a design-token decision.

## 5. How this is verified - observably, not "looks better"

- Unit-level, cheapest and most direct: a groupRows.test.ts or tableCanon.test.ts case (both
  files already have __tests__ siblings - confirmed:
  src/ui/views/Dashboard/widgets/DatabaseCall/__tests__/groupRows.test.ts exists this session)
  asserting that a record with values[field] === null (or missing) produces a RenderRow of
  kind "group" whose rendered label resolves to the fallback string, not the empty string.
  This is checkable today without touching the live vault and should be the primary proof.
- Component-level: a Svelte Testing Library assertion on TableGroupSection that passing
  groupKey="" yields visible text content in .ppp-t2-group-label (not an empty node) -
  proves the accessible-name fix from 3a alongside the visual one.
- Live-vault, secondary: per docs/internal/MANUAL_TESTING_PIPELINE.md, group a table by a
  field where at least one record has that field unset, and confirm via the REST API or a live
  screenshot that the header for that bucket shows a label, not a blank strip. This is the step
  that would have shown the actual defect directly (a live grouped table was not available to
  inspect this session - see section 0) and should be run before the ticket is called closed,
  not skipped because a unit test passed.
- What would NOT prove this: any claim resting on "the header looks fine in one manual
  screenshot" without a record in an empty-value group - the defect is conditional on that case
  existing in the data, and a table with no null-valued records in the grouped field would pass
  a casual look while leaving the reported defect live.

## Not done in this pass

- No CSS was written or edited - this is a read-only pass per the packet.
- Deferred items (3c) were not designed in full CSS/markup detail - only named, since they need
  an architect pass first (routing rule: a layout/positioning change touching a shared scroll
  container).
- The literal fallback-label copy was deliberately left undecided - copy is a user decision per
  this role's charter, not a designer default.
- No screenshot matching the reported table view was found (section 0) - the mechanism in
  section 2 is inferred from source, not confirmed against the specific image the user saw.

Design spec ready - architect can plan the component structure for 3c if the user takes up the
deferred item; 3d.1/3d.2 are close to token/markup-only and, once the fallback string is decided
by the user, implementer can implement directly against this spec.
