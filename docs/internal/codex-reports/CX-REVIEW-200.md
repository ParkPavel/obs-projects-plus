# CX-REVIEW-200 — pre-merge review of #200

Run 2026-09-08, `review --base main --scope branch` on `feat/200-step1-verdict` at `f49e988` (21 files, +2200/-27).

Four findings, three of them P1. All four checked against the code and all four held; fixed in the commit that follows this file.

```
 21 files changed, 2200 insertions(+), 27 deletions(-)
  When a local change is still in the writer's debounce window and `writeConflictCopy` fails, this branch only avoids adding a new immediate write; it leaves the already queued local write active. That write can run moments later and overwrite the external `data.json` before the user can follow the PPP-106 instruction to copy it manually, so the version that could not be backed up is lost.

- [P1] Preserve malformed external settings before the delay — C:\Users\Park\OBSv1.0\obs-projects-plus\src\main.ts:705-706
  If an external writer leaves truncated JSON and the user changes a setting during this two-second delay, the normal 400ms settings write can replace those bytes before `onUnparsableSettlement` reads them. The later recheck then sees the plugin's valid write and makes no conflict copy, so the malformed external version is silently lost; preserve it immediately or fence writes until the delayed decision completes.

- [P1] Drain a reconciliation write queued behind a diverged write — C:\Users\Park\OBSv1.0\obs-projects-plus\src\lib\settings\settingsWriter.ts:253-259
  When reconciliation calls `pushImmediate` while the original write is still in flight, `startWrite` returns because of `inFlight`, although `pushImmediate` has set `dirty`. If that original write subsequently reports `diverged`, this early return bypasses the existing `if (dirty)` follow-up path, leaving the intended overwrite unscheduled indefinitely; the conflict copy exists, but the promised memory version is not restored to `data.json` until some unrelated later change.

- [P2] Make conflict-copy creation atomic across overlapping callbacks — C:\Users\Park\OBSv1.0\obs-projects-plus\src\lib\settings\brokenBackup.ts:185-190
  When two external-change callbacks begin in the same millisecond, both can observe this candidate as absent before either reaches `adapter.write`, then both write the same path. The latter call overwrites the earlier recovery payload yet both return success, allowing `data.json` to be overwritten as well; serialize these writes or use an exclusive-create mechanism so a confirmed conflict copy cannot replace another one.

[exited with code 0]
```
