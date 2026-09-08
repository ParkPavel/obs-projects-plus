# CX-REVIEW-200-followup — the code that landed after the pre-merge gate

Run 2026-09-08, `review --base f49e988 --scope branch` on `main` (17 files, +725/-61).

Why it exists: the pre-merge review ran at `f49e988`, and two commits with CODE landed after it — `83abc43` (the implementation of that review's own findings) and `8d13d84` (#210). The merge therefore had a gate covering an earlier state, which is what this run closes.

Three findings, two P1. All three held; fixed on `fix/211-conflict-races`.

```
The new conflict-handling paths still permit races that overwrite an external settings version before it is preserved, and one recovery fallback can point users at the wrong file.

Full review comments:

- [P1] Do not drain arbitrary queued writes after divergence — C:\Users\Park\OBSv1.0\obs-projects-plus\src\lib\settings\settingsWriter.ts:282-282
  When another writer replaces `data.json` while a save is in flight and a normal settings edit is queued, this immediately writes the queued value before `onExternalSettingsChange` has necessarily read and copied the external version. The event handler and verification both perform asynchronous reads, so the follow-up can win that race and erase the other writer's changes without creating a conflict copy; only a reconciliation-authorized restore should bypass the normal debounce here.

- [P1] Block in-flight writes before offering manual conflict recovery — C:\Users\Park\OBSv1.0\obs-projects-plus\src\main.ts:742-742
  If preserving the external version fails while a settings save is already in flight, `hold()` only cancels timers; it cannot stop that in-flight save from completing afterward and overwriting `data.json`. In that timing, PPP-106 tells the user to copy the file manually, but the file may already have been replaced by this session's settings. Fence or await in-flight work before issuing this fallback.

- [P2] Do not direct recovery to an already overwritten data.json — C:\Users\Park\OBSv1.0\obs-projects-plus\src\main.ts:851-855
  When a nonempty unparsable payload is captured, a local save completes during the recheck delay, and `writeConflictCopy` then fails, `preserveConflicting(seen, ...)` emits PPP-106 instructing the user to copy `data.json` by hand. At this point `data.json` is the confirmed local payload, not `seen`, so the instruction cannot recover the external bytes and the original version is lost; this branch needs a distinct failure path or must prevent that overwrite before the fallback is shown.

[exited with code 0]
```

## Второй проход — ревью самой ветки `fix/211-conflict-races` (base `main`)

Две находки, обе верные, исправлены в `c4d4c37` (см. коммит).

```
 11 files changed, 223 insertions(+), 20 deletions(-)

Full review comments:

- [P1] Fence ordinary writes until the external version is preserved — C:\Users\Park\OBSv1.0\obs-projects-plus\src\lib\settings\settingsWriter.ts:313-315
  When a normal edit is queued behind a write that verifies as `diverged`, this re-arms its 400 ms timer without coordinating with `onExternalSettingsChange`. The host callback/read and `writeConflictCopy` are asynchronous, so that timer can fire before the handler has read or copied the external `data.json`, overwriting it with no recovery copy. Do not release/re-arm the ordinary write until reconciliation has preserved or explicitly handled the external payload.

- [P2] Clear the immediate marker when a normal edit supersedes it — C:\Users\Park\OBSv1.0\obs-projects-plus\src\lib\settings\settingsWriter.ts:379-385
  If `pushImmediate()` is called while a write is in flight and the user then makes an ordinary edit before that write resolves, `push()` replaces `latest` but leaves `immediate` true. On divergence, `onWritten()` therefore writes the user's ordinary edit immediately instead of honoring the debounce, reintroducing the race this split is intended to avoid. Reset the marker in `push()` or track the mode together with the queued value.

[exited with code 0]
```
