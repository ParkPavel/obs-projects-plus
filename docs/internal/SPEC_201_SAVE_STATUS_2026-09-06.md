# SPEC 201 -- Save-status mark: illegible text, and it pretends to be a button

Read this session: src/ui/components/SaveStatus/SaveStatusChip.svelte (56 lines, no R0.6
entry -- no LOC ceiling exists for it yet), src/ui/components/Navigation/CompactNavBar.svelte,
src/lib/settings/saveStatus.ts, src/ui/tokens/tokens.css (z-scale, lines 102-115),
src/__tests__/R0_19_oneLayerScale.test.ts, src/__tests__/R0_6_locBudget.test.ts,
src/__tests__/R0_16_remInContainer.test.ts, src/__tests__/support/renderProbe.ts,
src/__tests__/A166_matryoshkaSizing.acceptance.test.ts,
src/__tests__/A190_peekAnchoring.acceptance.test.ts,
src/ui/views/Dashboard/widgets/WidgetShell.svelte (lines 261-290, the .ppp-widget-error
pattern), src/ui/views/Dashboard/widgets/_shared/WidgetConfigShell.svelte (lines 190-237),
src/ui/views/Dashboard/widgets/Chart/ChartWidget.svelte (lines 280-305, the color-mix warning
banner), and the two screenshots in C:/Users/Park/OBSv1.0/screanshots
(2026-09-06_16-20-17.png, 2026-09-06_16-20-40.png).

## 1. Diagnosis -- confirmed, not merely plausible

SaveStatusChip.svelte:33-34:

    background: var(--background-modifier-error-hover, var(--background-secondary-alt));
    color: var(--text-error);

The screenshot 2026-09-06_16-20-17.png shows exactly the predicted failure: a solid red
rectangle between the tab bar and the + button, with no legible glyph on it at all -- not "hard
to read," invisible. That is a live-run observation, not an inference from the source.

The mechanism: --background-modifier-error-hover is Obsidian's saturated error-red fill, meant
as a hover background for something that already has a neutral foreground (e.g. a delete-icon
hover state going from transparent to red). --text-error is a saturated error-red foreground,
meant to sit on the ambient surface (--background-primary / --background-secondary), which is
exactly how every other error usage in this codebase pairs it -- grep for --text-error across
src/ turns up dozens of call sites, and in every one of them the color sits on the neutral
surface (WidgetShell.svelte:267-270, ColorPicker.svelte:670-672,
Navigation/SettingsMenu/tabs/ViewsTab.svelte:402-403, Calendar/agenda/FilterRow.svelte:971-972)
or on a tinted neutral surface via color-mix/rgba at 5-20% opacity (ChartWidget.svelte:280-305,
DatabaseCallBlock.svelte:709-720, Timeline/AgendaSidebar.svelte:1152,1324-1325). Nowhere else in
the tree is --text-error set on a background that is itself full-strength error-red.
SaveStatusChip is the one place that pairs a saturated red foreground with a saturated red
background, and red-on-red is exactly the failure mode a live run would produce regardless of
the two colors' precise hex values in any one theme -- same hue family, and Obsidian's own theme
authors have no obligation to keep two error-family tokens apart in lightness when nothing in the
API contract says one sits on the other. Diagnosis confirmed, on the file:line above and the
screenshot, without needing the exact computed RGB from a specific theme's stylesheet (not read
this session).

## 2. The mark: composition, states, contrast, and the three themes

### Design decision -- a status mark that happens to be actionable, not a button styled down

Obsidian's own status bar (.status-bar-item, bottom of the window -- Obsidian-native, not a
Notion pattern, so this is the correct parity reference per the "Obsidian-native" principle) is
the precedent already living in this exact product: plain text/icon on the ambient surface, a
faint hover wash, no fill, no border, and it is still a real, clickable, keyboard-reachable
element. That is the model for this mark. It also matches the existing in-tree idiom for an error
row that offers a retry: WidgetShell.svelte's .ppp-widget-error (tinted background, colored
text) paired with .ppp-widget-error-retry (a small outlined control, separately labelled). This
chip has no room for two elements in a compact header, so the two roles -- state and retry --
collapse onto one control, and the visual design has to say "state" while the semantics keep
"button."

Composition (unchanged element count, restyled):
- Keep the button element (type="button") -- do not swap to a span/div with a synthetic
  role="button" and reimplemented key handling. A native button gets focus, Enter/Space,
  and :focus-visible for free, and reinventing that is how a class of defect happens. The letter
  of "not a button" is about appearance, not about discarding a working interactive element for
  a fake one.
- dot (aria-hidden, unchanged) -- small solid indicator, decorative only, not a contrast surface.
- label -- the visible text, unchanged content for now (see #4 below for the error-code addition).

States:

| State | Background | Foreground | Border | Notes |
|---|---|---|---|---|
| default (rest) | var(--background-primary) (ambient -- i.e. none painted on top; the chip sits on the header's own surface) | var(--text-error) | 0.0625rem solid var(--text-error) | text on the neutral surface, exactly the pattern every other --text-error call site in this tree already uses |
| hover | color-mix(in srgb, var(--text-error) 12%, var(--background-primary)) | var(--text-error) | unchanged | the ChartWidget.svelte:280-305 idiom: a light tint of the same hue the text already is, never the saturated fill -- the tint is derived from the foreground color, so it cannot land on the same lightness band as the text by construction |
| focus-visible | as current: outline 0.125rem solid var(--interactive-accent); outline-offset 0.125rem | unchanged | unchanged | matches CompactNavBar.svelte:89-93's own :focus-visible idiom for the icon buttons beside it -- consistent focus ring across the header |
| active (:active) | color-mix(in srgb, var(--text-error) 20%, var(--background-primary)) | unchanged | unchanged | a step darker/stronger than hover, same construction, gives the momentary "it registered the press" feedback a button would -- the mark stays a mark, the feedback stays honest |
| disabled | not applicable -- the mark is only rendered while $saveStatus.kind === "failed" (line 8, unchanged); there is no failed-but-not-retryable sub-state today |

Why this reads as "not a button" while still being one: no filled background at rest, no
visible border-as-container-shape beyond a hairline outline (thinner and same-hue as the text,
reading as an outline chip / tag rather than a raised control -- the outline is 0.0625rem,
already the codebase's standard hairline per CompactNavBar.svelte's own borders), no drop
shadow, no raised/pressed illusion. What signals interactivity instead: cursor: pointer
(kept), the hover tint (kept, changed in strength only), and the focus ring (kept). That is the
same signal set Obsidian's own status-bar items and this codebase's own .clickable-icon buttons
(CompactNavBar.svelte:84-93) use -- hover wash + focus ring, no permanent fill. Consistent with
"functional minimalism": the chip looks like what it is (a fact with a small affordance attached),
not like a call to action competing with + and the gear for visual weight.

### Contrast across three themes

--text-error is not this component's token to choose a value for -- it is Obsidian's own, and
Obsidian's theme contract is that --text-error is readable against --background-primary in
every shipped theme, light, dark, and "Adapt to system" (which is just whichever of the two loads,
Obsidian does not blend them). That contract is exactly why every other call site in this tree
pairs the two directly with no incident reported. The defect was never "the token itself is
unreadable" -- it is "this component painted a second, unrelated red under it." Removing that
second layer (the fix above) restores the same guarantee every other error label in the app
already relies on, in all three theme states, without this component needing to know a single
hex or RGB value for any of them.

No new token is needed. Every value above is either an existing Obsidian variable already used
this way elsewhere (--text-error, --background-primary, --interactive-accent) or a color-mix()
derived from one of them, which is the established in-tree idiom (ChartWidget.svelte,
DatabaseCallBlock.svelte) rather than a new pattern. Nothing here introduces a --ppp-* token, so
this spec does not trigger the "new token -> user review" clause by itself -- see the review line
at the end for what would.

## 3. "Not a button, but pressable" -- reconciled, not just asserted

The reconciliation is the split between semantics and appearance, not between "clickable"
and "not clickable":
- Semantics stay a real interactive control (button, keyboard-operable, in the tab order)
  because the retry affordance is functionally load-bearing -- on:click={() => requestSaveRetry()}
  (line 16) is the only path back from a failed write today, and #185's own comment (lines 5-7)
  already treats silent-vs-visible as a deliberate design axis; removing keyboard/AT access to the
  one visible recovery path would be a regression, not a simplification.
- Appearance stops asserting "button" by removing the one thing that visually says "button" in
  this design system -- a filled, bordered, raised-looking rectangle -- and keeping only the
  signals that say "this responds to you": pointer cursor, a hover wash, a focus ring. Those three
  are present on plenty of non-button interactive text in Obsidian itself (a wikilink, a
  status-bar item) and are read by users as "this is live" without being read as "this is a
  call-to-action."
- The user's own wording distinguishes exactly this: "не делать его в виде кнопки" -- not "make
  it unclickable," but "stop giving it the shape of a button." The fix above changes shape, not
  operability.

## 4. Where an error code (#202) lands

#202's codes are short (per the ticket, an "error number") and need to sit inside this same mark
with the reason revealed on hover. Composition, extended:

    [dot] [label] [space-sm] [code]

- code is a fourth inline child, same line, font-variant-numeric: tabular-nums if the codes are
  numeric, so the chip's width does not jitter as the number changes digit count within a session.
- It carries no color of its own beyond inheriting the mark's foreground -- it is not a second
  colored badge nested inside a colored badge (that would reintroduce the exact "color inside a
  color" mistake this spec is fixing, just at smaller scale). Visually it reads as
  "label . code," separated by a mid-dot or thin vertical rule at var(--text-faint), matching the
  low-emphasis-separator idiom already in WidgetShell.svelte and AgendaSidebar.svelte.
- The reason (the long human-readable explanation #202 will attach to each code) replaces the
  current title attribute's tooltip content, or is appended to it -- the tooltip mechanism does
  not change, only what fills it. title is Obsidian's own tooltip mechanism (used for hover-only
  detail across this codebase); it does not need a custom popover component, and building one
  would be new UI-pattern territory requiring user review per this role's documentation protocol.
  Do not build a custom hover panel for #202 -- extend the existing title string.
- Width: the chip must not wrap. white-space: nowrap is already set (line 40); with a code
  appended, the header needs the narrow-header behavior in section 5 below, not a taller chip --
  the chip's own height must not grow to fit two lines.

This is a compositional slot, not a structural change to this component's shape (still one
button, one line, four inline children instead of two) -- no architecture escalation implied by
adding it later, but #202 is a separate ticket and this section only reserves the slot; it does
not implement it.

## 5. Narrow header -- the container decides, not the window

CompactNavBar.svelte:96-101 already has @media (max-width: 30rem) for its own padding/gap, but
that is a viewport breakpoint, and per this project's own stated principle (the matryoshka
principle) a window-width media query is not the model to extend -- it answers "how wide is the
window," not "how wide is the space this chip actually has," and a split pane or a narrow
sidebar view can starve the header long before the window itself is narrow.

The tree already has exactly the container-query mechanism this needs, live in six components
(Calendar/Day.svelte, AllDayEventStrip.svelte, HeaderStripsSection.svelte, Dashboard
ChartWidget.svelte, FilterTabsWidget.svelte, WidgetConfigShell.svelte -- grepped this session)
plus container-type: inline-size already declared on ViewContent.svelte and Day.svelte. The
nav bar itself is not currently a query container, so:

- Recommended: .compact-navbar .right (the flex row already holding this chip,
  CompactNavBar.svelte:46) becomes container-type: inline-size, and the chip's own label
  hides under a container query at a width where "label + code" would otherwise force a scroll
  or an overflow -- leaving only the dot and, once #202 lands, the code visible, with the full
  text staying in title. This is consistent with the comment block already in
  CompactNavBar.svelte (removed check + hidden-on-touch precedent -- the product has already
  conceded this exact point once, for a different control).
- This is a structural change (a new query-container boundary on an existing flex row that
  three other children also sit in) -- not a pure token edit, so per this role's own handoff rule
  it is architect territory, not something implementer should take directly off this document
  alone. Flagged in the handoff line below.
- What this spec does NOT prescribe: the exact container-query breakpoint value (cqi / width
  threshold). That number should come from measuring .right's actual available width at the
  narrowest supported view, which is an implementation-time measurement, not a design-time guess
  -- guessing it here would be exactly the "budget gamed by picking a plausible-sounding number"
  failure mode this project's ratchets exist to catch.

## 6. Observable verification

- renderProbe (src/__tests__/support/renderProbe.ts) can measure the mechanism, not contrast
  directly. It runs headless Chrome against the component's own <style> block plus tokens.css,
  verbatim (per its own module doc) and returns getComputedStyle values including
  background-color / color as resolved rgb(...) strings for whatever CSS custom properties are
  fed into the page. What it cannot do out of the box is resolve a genuine value for --text-error
  / --background-primary in Obsidian's own shipped dark/light themes, because those variables are
  declared by Obsidian's core CSS, not by this repo's tokens.css -- no fixture of Obsidian's real
  theme values exists in src/__tests__ today (grepped this session, none found).
- What an acceptance test can assert, honestly: feed the probe a synthetic
  ":root{--text-error:#COLOR;--background-primary:#COLOR}" (or a small matrix of 2-3
  representative light/dark pairs, chosen as stand-ins, clearly labelled synthetic in the test's
  own comment -- the same honesty A166/A190 already practice about what they can and cannot see),
  render the chip, read back the resolved color and background-color, and assert a contrast ratio
  computed from the two rgb() triples (a small WCAG relative-luminance helper, new, colocated
  with the test) is >= 4.5:1 (small text, AA) at rest and at hover. That proves the CSS
  relationship holds for any theme that keeps the two tokens apart in lightness -- it does not
  prove Obsidian's actual shipped dark theme does so (that keeps needing a live screenshot,
  exactly as A166/A190's own module docs say about their own blind spots).
- The one thing a synthetic probe genuinely refutes: the current bug, where a second
  saturated-red layer is painted under the text. A test that sets only --text-error and
  --background-primary (no --background-modifier-error-hover override) and asserts the chip's
  rendered background equals --background-primary (not some other red) directly disproves the
  red-on-red mechanism, independent of which theme's exact reds are plugged in.
- What stays a human's job: whether the real Obsidian dark/light/system themes' actual
  --text-error and --background-primary pairing looks good at the actual pixel density in the
  actual header -- the manual/API pipeline is where that gets closed, the same way #190's report
  explicitly left the "uncovered in a second leaf" screenshot to a person.
- The narrow-header behavior (section 5) is exactly the kind of claim A166/A190 were built for --
  render two container widths and assert the label disappears (or the dot+code remain) at the
  narrower one, the same two-widths-not-one method A166 step 1 uses to prove the container, not
  the viewport, is deciding.

## Documentation impact

- None of this changes a user-facing string's meaning (only its legibility), so no
  docs/internal product doc needs an update for sections 1-3.
- Section 4 (error-code slot) will need a line in whatever end-user documentation #202 produces,
  once that ticket defines what a code means -- out of scope here.

User review required: No, for sections 1-4 (token values are all existing Obsidian variables or
color-mix() derivations of them, matching an established in-tree idiom, and the "sign not button"
interaction model has a live Obsidian-native precedent in the status bar -- no new pattern).
Yes, narrowly, for section 5's container-boundary choice on .compact-navbar .right, because it is
a structural change to a shared row three other controls also occupy, and per this project's own
routing rule that crosses module boundaries in effect (the whole header's layout contract) and
needs an architect pass before an implementer touches it -- not because the visual idea is novel.

## Handoff

Design spec ready -- architect should plan section 5 (the .right container-query boundary and
where the narrow-width breakpoint's real value comes from) before implementation. Sections 1-4
(color/state fix, "not a button" restyle, the reserved code slot) are token-and-state values with
no structural change to the component's shape -- implementer can take those directly once
section 5's plan exists, so the header does not get edited twice.
