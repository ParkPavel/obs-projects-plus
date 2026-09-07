# CX-ADV-200 — adversarial review of #200 (settings ownership)

Run 2026-09-07, `adversarial-review --base main --scope branch` on `feat/200-step1-verdict` at `ccc6fff`.
Focus: the decision table, the `uniqueIdCounter` max exception, the conflict copy, and whether any branch can lose a user's data.

All three findings were checked against the code and all three held. Fixed in `a6a53b3`; what was done and why is in that commit and in PLAN_200 §11c.

```

Findings:
- [high] A persistent truncated external file is silently overwritten without any recovery copy (src/main.ts:675-682)
  The `keep` branch only logs and returns. It neither preserves `raw` nor blocks the normal settings subscription from writing the in-memory whole-file value later. If a synchronizer leaves valid user settings truncated rather than immediately completing it, the next ordinary setting change overwrites those bytes and verification reports that new write as confirmed. The lost external version was never copied or disclosed.
  Recommendation: Treat an unparsable external change as a write barrier: re-read after a short stability delay, then preserve the raw bytes to a sibling file before allowing any settings write. If preservation fails, surface a blocking warning and keep the writer from overwriting data.json.
- [high] The decision table adopts malformed same-version JSON into live settings (src/lib/settings/settingsReconcile.ts:214-220)
  `versionMatches` accepts any non-array object whose `version` equals the current version. Thus a parseable partial write such as `{ "version": 4 }` is classified as adoptable, although normal loading routes the same input through `migrateSettings`/the resolver. The hook then puts that raw object into the store; consumers expect `preferences`, `projects`, and `archives`, so this can throw or later persist an invalid shape with no forensic copy of the prior configuration.
  Recommendation: Validate and resolve the parsed payload with the same migration/shape path used by `loadSettings` before returning `adopt`. On validation failure, retain current memory and preserve or explicitly quarantine the external payload rather than setting it into the store.
- [medium] Conflict-copy naming can overwrite an earlier recovery file after an existence-check failure (src/lib/settings/brokenBackup.ts:100-115)
  When `exists` rejects, `freeName` returns the base path anyway. `writeConflictCopy` then performs a normal overwrite-capable write and reports success. If that timestamped conflict file already exists (for example, concurrent external-change handlers or a synchronized collision), the earlier user version is replaced; the caller then proceeds to overwrite `data.json`, so the promised recovery copy is gone.
  Recommendation: Never write to a path whose absence cannot be established. Use an exclusive-create API or a high-entropy unique suffix and retry on collision; otherwise return null so the caller preserves data.json and tells the user to copy it manually.

Next steps:
- Block merge until external malformed-data handling and conflict-copy creation cannot destroy an unseen version.
- Add integration-style tests for persistent truncated JSON, parseable partial v4 JSON, and concurrent/failed-exists conflict-copy creation.

[exited with code 0]
```
