# CX-AUDIT-166-step3 — auditor, `feat/166-step3-minimums`

- Role: `auditor` (`.codex/agents/auditor.toml`), `--effort high`
- Base `d2f2bbd` (`main`) → head `f81a7d5`; run 2026-09-02
- Expect: the `1fr` filler cannot shrink or reposition any fixed column track; header/row/footer
  resolve the identical track list; deleting `container-type` from `.ppp-dt-content` orphans no
  `cq` unit or `@container` rule; no invariant breached.

## Disposition by `lead` (2026-09-02)

Verdict **BLOCKED**, and **both blockers are the known read-only-sandbox artefact**, not findings:
the auditor cannot start a browser and cannot resolve `npx` under its sandbox, so it reports the
evidence it could not *obtain* as evidence that is *missing*. Both had in fact been produced
before the run, in the foreground, on this same head:

- **"browser probe could not run"** — `docs/internal/probes/166-minimums.html` was run in headless
  Chrome and its numbers are in `ADR_MATRYOSHKA_SIZING_2026-09-02.md` under "Measured 2026-09-02 —
  Step 3". They answer exactly the failure it names: the fixed tracks read `272 176 176` at both
  800px and 300px, and the `[+]` sits 0px after the last column at both.
- **"automated gates unverified"** — build 0 errors, jest 183 suites / 2549 tests (baseline
  183/2544, +5), lint 0 errors / 109 pre-existing tsdoc warnings, svelte-check 0/0.

Its *positive* checks are the valuable half, and two of them are independent confirmation from the
**compiled bundle** rather than from the source I edited:

- header, row and footer each compile to exactly `grid-template-columns: var(--ppp-dt-columns)` —
  the one-template invariant, verified downstream of the build;
- `main.js` carries no `.ppp-dt-content` container declaration — the deletion shipped;
- no new `@ts-ignore`, `new Menu(...)`, user-input regex or unguarded `JSON.parse`;
- "no source-level invariant breach found".

No code changed in response to this review.

## Raw output

Findings:

- BLOCKER — unverified layout behavior: [166-minimums.html](docs/internal/probes/166-minimums.html:38). The source and compiled bundle show the shared track list and removed table container, but the browser probe could not run because no browser surface is available. Failure scenario: at a narrow width, a fixed column or the add button moves unexpectedly despite the static track list. Falsify by executing the probe in a browser and checking the reported grid tracks/positions.

- BLOCKER — automated gates unverified. The focused Jest command could not start under the read-only sandbox (`npx.cmd` fails resolving the restricted user path). This leaves the px/LOC/config-drift/token-integrity ratchets and table tests UNKNOWN for this head.

Observed:

- Base is an ancestor of head; HEAD is on `feat/166-step3-minimums`, not `main`.
- `git diff --check` produced no whitespace errors.
- Header, row, and footer each compile to exactly `grid-template-columns: var(--ppp-dt-columns)`; compiled `main.js` contains no `.ppp-dt-content` container declaration.
- No new `@ts-ignore`, `new Menu(...)`, user-input regex, or unguarded JSON parsing appears in the changed source.
- The documentation probe’s literal hex/px values are outside `src/` component code and do not themselves breach the listed invariants.

Verdict: **BLOCKED** — no source-level invariant breach found, but required automated and browser-layout evidence could not be obtained in this sandbox.

Codex session ID: 01a06226-3ad3-73e2-92f2-e6b2d950837b
Resume in Codex: codex resume 01a06226-3ad3-73e2-92f2-e6b2d950837b
